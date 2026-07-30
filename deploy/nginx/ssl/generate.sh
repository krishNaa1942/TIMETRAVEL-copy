#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-api.timetotravel.app}"

echo "==> Generating self-signed SSL certificate for $DOMAIN"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$(dirname "$0")/key.pem" \
    -out "$(dirname "$0")/cert.pem" \
    -subj "/CN=$DOMAIN/O=Time Travel/C=IN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost"

echo "==> Done: cert.pem + key.pem generated for $DOMAIN"
echo "==> For production, replace these with a real CA-signed certificate."
