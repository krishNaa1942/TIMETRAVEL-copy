#!/usr/bin/env bash
set -euo pipefail

# Generate production secrets for Time Travel AI Kubernetes deployment.
# Usage: ./setup-secrets.sh
# Prerequisites: kubectl configured with target cluster context.

NAMESPACE="${NAMESPACE:-timetravel}"

echo "==> Generating secrets for namespace: $NAMESPACE"

SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
JWT_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')

kubectl create secret generic timetravel-secrets \
  --namespace "$NAMESPACE" \
  --from-literal="DATABASE_URL=postgresql://user:password@postgres-service:5432/timetravel" \
  --from-literal="REDIS_URL=redis://redis-service:6379/0" \
  --from-literal="SECRET_KEY=$SECRET_KEY" \
  --from-literal="JWT_SECRET_KEY=$JWT_SECRET_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Secret 'timetravel-secrets' created."
echo "==> WARNING: Database URL still uses placeholder credentials."
echo "==> Set POSTGRES_USER and POSTGRES_PASSWORD in the secret for production:"
echo "    kubectl patch secret timetravel-secrets -n $NAMESPACE -p '{\"stringData\":{\"POSTGRES_USER\":\"...\",\"POSTGRES_PASSWORD\":\"...\"}}'"
