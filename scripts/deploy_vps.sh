#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# Time Travel – VPS Deployment Script
# Deploys the full stack (web + API + Postgres + Redis + nginx)
# on a fresh Ubuntu 22.04+ VPS.
#
# Usage (on the VPS):
#   sudo bash deploy_vps.sh
#
# Prerequisites:
#   1. A domain pointed at this server (A record -> VPS IP)
#      e.g. timetotravel.app and api.timetotravel.app
#   2. This repo cloned on the VPS
#   3. A .env.production file in the repo root (see .env.example)
# ══════════════════════════════════════════════════════════════
set -euo pipefail

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# ── 1. System dependencies ────────────────────────────────────
log "Installing system dependencies (Docker, Node.js, certbot)..."
apt-get update -y
apt-get install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

log "Installing Node.js 20 (required for the Expo web build)..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node --version >/dev/null 2>&1 || die "Node.js installation failed."

# ── 2. .env.production ────────────────────────────────────────
if [[ ! -f .env.production ]]; then
  die "Missing .env.production in ${REPO_DIR}. See .env.example for required variables."
fi
set -a; source .env.production; set +a

# Domains — read from .env.production, fall back to defaults
DOMAIN="${DOMAIN:-timetotravel.app}"
WEB_DOMAIN="${WEB_DOMAIN:-${DOMAIN}}"
API_DOMAIN="${API_DOMAIN:-api.${DOMAIN}}"
EMAIL="${SSL_EMAIL:-admin@${DOMAIN}}"

# Compose file selection — low-mem override for Oracle free 1 GB shapes
COMPOSE_FILES=(-f docker-compose.prod.yml)
if [[ "${LOWMEM:-0}" == "1" ]]; then
  COMPOSE_FILES+=(-f docker-compose.lowmem.yml)
  log "LOWMEM=1 → single web replica, monitoring disabled (1 GB shape)."
fi
COMPOSE_CMD() { docker compose "${COMPOSE_FILES[@]}" "$@"; }

# ── 3. DNS sanity check ───────────────────────────────────────
log "Verifying DNS for ${WEB_DOMAIN} / ${API_DOMAIN} (A records must point to this server)..."
resolve() { getent hosts "$1" | awk '{print $1}' | head -1; }
MY_IP="$(curl -fsS -4 ifconfig.me 2>/dev/null || echo '')"
for d in "${WEB_DOMAIN}" "${API_DOMAIN}"; do
  ip="$(resolve "$d")"
  log "  ${d} -> ${ip:-NOT RESOLVED}"
  if [[ -z "$ip" ]]; then
    die "DNS for ${d} does not resolve. Create the A record (-> $MY_IP) and wait for propagation, then rerun."
  fi
  if [[ -n "$MY_IP" && "$ip" != "$MY_IP" ]]; then
    die "DNS for ${d} (${ip}) does not match this server (${MY_IP}). Fix the A record, then rerun."
  fi
done

# ── 4. Let's Encrypt SSL (standalone; port 80 must be free) ───
mkdir -p deploy/nginx/ssl
SSL_DIR="/etc/letsencrypt/live/${API_DOMAIN}"
if [[ ! -f "${SSL_DIR}/fullchain.pem" ]]; then
  # Deduplicate domains (free setups often use one hostname for web + API,
  # e.g. yourname.duckdns.org — certbot rejects duplicate -d flags).
  CERT_DOMAINS=()
  for d in "${API_DOMAIN}" "${WEB_DOMAIN}"; do
    [[ " ${CERT_DOMAINS[*]} " == *" ${d} "* ]] || CERT_DOMAINS+=("$d")
  done
  CERT_ARGS=()
  for d in "${CERT_DOMAINS[@]}"; do CERT_ARGS+=(-d "$d"); done

  log "Issuing Let's Encrypt certificate for: ${CERT_DOMAINS[*]}"
  systemctl stop nginx >/dev/null 2>&1 || true   # free port 80 for standalone mode
  certbot certonly --standalone \
    --non-interactive --agree-tos -m "$EMAIL" \
    "${CERT_ARGS[@]}" \
    --register-unsafely-without-email \
    || die "certbot failed — ensure port 80 is open and DNS is correct, then rerun."
else
  log "Existing certificate found (${SSL_DIR}) — skipping issuance."
fi
# Copy the live certs into the nginx container's mount (gitignored).
cp "${SSL_DIR}/fullchain.pem" deploy/nginx/ssl/cert.pem
cp "${SSL_DIR}/privkey.pem"  deploy/nginx/ssl/key.pem
chmod 644 deploy/nginx/ssl/cert.pem
chmod 600 deploy/nginx/ssl/key.pem

# ── 5. Disable system nginx (dockerized nginx binds 80/443) ──
systemctl disable --now nginx >/dev/null 2>&1 || true

# ── 6. Build & launch the stack ───────────────────────────────
log "Building web bundle (Expo export)..."
(cd TimeTravelMobile && npm ci && npx expo export --platform web) \
  || die "Web build failed — see npm output above."

log "Starting Docker stack..."
COMPOSE_CMD up -d --build

# ── 7. Wait for health ────────────────────────────────────────
log "Waiting for API health check..."
for i in $(seq 1 30); do
  if curl -fsS "http://localhost:5001/api/health" >/dev/null 2>&1; then
    log "API healthy."
    break
  fi
  sleep 3
  [[ $i -eq 30 ]] && die "API not healthy after 90s — check: COMPOSE_CMD logs web"
done

# ── 8. Alembic migrations ─────────────────────────────────────
log "Running database migrations..."
COMPOSE_CMD exec -T web alembic upgrade head \
  || die "Migration failed — check DATABASE_URL in .env.production"

# ── 9. Verify nginx rendered config ───────────────────────────
log "Verifying nginx config (server_name: ${API_DOMAIN}, ${WEB_DOMAIN})..."
COMPOSE_CMD exec -T nginx nginx -t \
  || die "nginx config invalid — check API_DOMAIN/WEB_DOMAIN in .env.production"

# ── 10. Cron: daily backup + TLS renewal ──────────────────────
log "Installing daily backup + TLS renewal cron..."
if [[ -f scripts/backup_db.sh && -f scripts/renew_ssl.sh ]]; then
  chmod +x scripts/backup_db.sh scripts/renew_ssl.sh
  ( crontab -l 2>/dev/null | grep -v -E 'backup_db\.sh|renew_ssl\.sh'; \
    echo "0 3 * * * cd ${REPO_DIR} && ./scripts/backup_db.sh >> ${REPO_DIR}/deploy/backups/backup.log 2>&1"; \
    echo "0 4 * * * cd ${REPO_DIR} && ./scripts/renew_ssl.sh >> ${REPO_DIR}/deploy/backups/renew.log 2>&1" ) | crontab -
  log "Backup cron: daily 03:00. TLS renewal cron: daily 04:00."
fi

log "✅ Deployment complete."
log "   Web:  https://${WEB_DOMAIN}"
log "   API:  https://${API_DOMAIN}/api/health"
log "   Metrics: https://${API_DOMAIN}/grafana (admin / \$GRAFANA_ADMIN_PASSWORD)"
