#!/usr/bin/env bash
# Deploy SportCompanion to the Oracle VM. Run from repo root: ./deploy/deploy.sh
set -euo pipefail

SSH_KEY="$HOME/Desktop/Claude Code/ssh-key-2026-05-17.key"
REMOTE="ubuntu@158.178.213.227"
REMOTE_DIR="/home/ubuntu/sportcompanion"
SERVICE="sportcompanion.service"

echo "==> Syncing source (excluding node_modules, .next, data)"
rsync -az --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'data' \
  --exclude '.git' \
  --exclude '.env*' \
  --exclude '.superpowers' \
  --exclude '.claude' \
  --exclude '*.tsbuildinfo' \
  -e "ssh -i \"$SSH_KEY\"" \
  ./ "$REMOTE:$REMOTE_DIR/"

echo "==> Installing deps + building on VM"
# shellcheck disable=SC2029
ssh -i "$SSH_KEY" "$REMOTE" "
  set -e
  mkdir -p $REMOTE_DIR/data
  cd $REMOTE_DIR
  npm ci
  ts=\$(date +%s)
  for f in data/*.db; do
    [ -e \"\$f\" ] || continue
    cp \"\$f\" \"\$f.bak-\$ts\" 2>/dev/null || true
  done
  set -a; [ -f .env ] && . ./.env; set +a
  npm run db:migrate
  npm run build
  cp -r public .next/standalone/public
  cp -r .next/static .next/standalone/.next/static
"

echo "==> Ensuring systemd unit is up to date"
scp -i "$SSH_KEY" ./deploy/sportcompanion.service "$REMOTE:/tmp/sportcompanion.service"
# shellcheck disable=SC2029
ssh -i "$SSH_KEY" "$REMOTE" "
  set -e
  sudo mv /tmp/sportcompanion.service /etc/systemd/system/sportcompanion.service
  sudo systemctl daemon-reload
  sudo systemctl enable $SERVICE
  sudo systemctl restart $SERVICE
  sleep 1
  systemctl is-active $SERVICE
"

echo "==> Deployed. https://workout.spiritix.fr"
