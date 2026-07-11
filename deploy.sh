#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="bAdmin@46.202.88.39"
VPS_KEY="$HOME/.ssh/id_ed25519_pwa_templo"

echo "Desplegando a $VPS_HOST..."

ssh -i "$VPS_KEY" "$VPS_HOST" '
  cd ~/hospedaje &&
  git pull &&
  cd backend &&
  npm install --omit=dev &&
  pm2 restart hospedaje-api
'

echo "Verificando..."
sleep 1
curl -sf https://lldmhospedaje.tech/api/health && echo " - OK" || echo "El health check falló, revisa el servidor."
