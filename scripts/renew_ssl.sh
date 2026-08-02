#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# Time Travel – TLS Renewal Script
# Renews the Let's Encrypt certificate, copies it into the nginx
# container's mount, and reloads nginx. Run daily via cron
# (certbot renew is a no-op until <30 days to expiry).
# ══════════════════════════════════════════════════════════════
set -euo pipefail

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

if [[ -f .env.production ]]; then
  set -a; source .env.production; set +a
fi

DOMAIN="${DOMAIN:-timetotravel.app}"
API_DOMAIN="${API_DOMAIN:-api.${DOMAIN}}"

certbot renew --quiet --deploy-hook true

SSL_DIR="/etc/letsencrypt/live/${API_DOMAIN}"
if [[ ! -f "${SSL_DIR}/fullchain.pem" ]]; then
  log "No certificate found for ${API_DOMAIN} — run deploy_vps.sh first."
  exit 0
fi

mkdir -p deploy/nginx/ssl
cp "${SSL_DIR}/fullchain.pem" deploy/nginx/ssl/cert.pem
cp "${SSL_DIR}/privkey.pem"  deploy/nginx/ssl/key.pem
chmod 644 deploy/nginx/ssl/cert.pem
chmod 600 deploy/nginx/ssl/key.pem

if docker compose -f docker-compose.prod.yml ps >/dev/null 2>&1; then
  docker compose -f docker-compose.prod.yml restart nginx
  log "TLS certificate refreshed and nginx reloaded."
else
  log "TLS certificate refreshed (stack not running — nginx will pick it up on next start)."
fi
