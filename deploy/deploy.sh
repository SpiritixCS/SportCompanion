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
# Build pendant que l'ancien serveur tourne encore : aucune base n'est
# touchée à cette étape.
# shellcheck disable=SC2029
ssh -i "$SSH_KEY" "$REMOTE" "
  set -e
  mkdir -p $REMOTE_DIR/data
  cd $REMOTE_DIR
  npm ci
  npm run build
  cp -r public .next/standalone/public
  cp -r .next/static .next/standalone/.next/static
  rm -rf .next/standalone/migrations && cp -r migrations .next/standalone/migrations
"

echo "==> Ensuring systemd unit is up to date"
scp -i "$SSH_KEY" ./deploy/sportcompanion.service "$REMOTE:/tmp/sportcompanion.service"

# Service arrêté pendant sauvegarde + reprise + migrations : plus aucune
# écriture ne peut arriver dans une base pendant qu'on la copie ou la migre.
# En cas d'échec (set -e), le service RESTE ARRÊTÉ : mieux vaut une coupure
# visible qu'un utilisateur servi sur une copie incomplète.
echo "==> Stopping service, backing up, migrating"
# shellcheck disable=SC2029
ssh -i "$SSH_KEY" "$REMOTE" "
  set -e
  cd $REMOTE_DIR
  sudo mv /tmp/sportcompanion.service /etc/systemd/system/sportcompanion.service
  sudo systemctl daemon-reload
  sudo systemctl enable $SERVICE
  sudo systemctl stop $SERVICE
  ts=\$(date +%s)
  for f in data/*.db data/users/*.db; do
    [ -e \"\$f\" ] || continue
    for part in \"\$f\" \"\$f-wal\" \"\$f-shm\"; do
      if [ -e \"\$part\" ]; then cp \"\$part\" \"\$part.bak-\$ts\"; fi
    done
  done
  set -a; [ -f .env ] && . ./.env; set +a
  npm run db:adopt-legacy
  npm run db:migrate
  sudo systemctl start $SERVICE
  sleep 1
  systemctl is-active $SERVICE
"

echo "==> Deployed. https://workout.spiritix.fr"
