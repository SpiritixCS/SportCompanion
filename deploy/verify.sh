#!/usr/bin/env bash
set -euo pipefail

SSH_KEY="$HOME/Desktop/Claude Code/ssh-key-2026-05-17.key"
REMOTE="ubuntu@158.178.213.227"

echo "root route:"
ssh -i "$SSH_KEY" "$REMOTE" 'curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/'

echo "design-system route:"
ssh -i "$SSH_KEY" "$REMOTE" 'curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/dev/design-system'

echo "css asset actually served:"
ssh -i "$SSH_KEY" "$REMOTE" 'css=$(curl -s http://127.0.0.1:3001/ | grep -o "/_next/static/[^\"]*\.css" | head -1); curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3001$css"'

echo "sportcompanion.service:"
ssh -i "$SSH_KEY" "$REMOTE" 'systemctl is-active sportcompanion.service'

echo "pocketbase.service (other tenant):"
ssh -i "$SSH_KEY" "$REMOTE" 'systemctl is-active pocketbase.service'

echo "cloudflared-selfpatrimoine.service (other tenant):"
ssh -i "$SSH_KEY" "$REMOTE" 'systemctl is-active cloudflared-selfpatrimoine.service'

echo "cloudflared-backpain.service (tunnel we kept):"
ssh -i "$SSH_KEY" "$REMOTE" 'systemctl is-active cloudflared-backpain.service'
