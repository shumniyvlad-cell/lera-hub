#!/bin/sh
# Выкладка API «Штурмана» на «Час». Пароли и ключ синка — из ../ACCESS.txt в /etc/shturman/env (только при первом запуске).
set -eu
cd "$(dirname "$0")"
HOST="root@83.141.94.106"
KEY="$HOME/.ssh/id_ed25519_chas"
S="ssh -o BatchMode=yes -i $KEY $HOST"
$S 'install -d -m 755 /opt/shturman && install -d -m 700 /etc/shturman'
rsync -az -e "ssh -o BatchMode=yes -i $KEY" server.mjs "$HOST:/opt/shturman/"
rsync -az -e "ssh -o BatchMode=yes -i $KEY" shturman.service "$HOST:/etc/systemd/system/shturman.service"
if ! $S 'test -s /etc/shturman/env'; then
  A=../ACCESS.txt
  LP=$(sed -n 's/^Лера: логин lera, пароль //p' "$A"); VP=$(sed -n 's/^Влад: логин vlad, пароль //p' "$A"); SK=$(sed -n 's/^Ключ синка: //p' "$A")
  printf 'PORT=8841\nDB_PATH=/var/lib/shturman/shturman.db\nALLOWED_ORIGINS=https://shumniyvlad-cell.github.io\nLERA_PASS=%s\nVLAD_PASS=%s\nSYNC_KEY=%s\n' "$LP" "$VP" "$SK" | $S 'umask 077; cat > /etc/shturman/env'
  echo "env записан"
fi
$S 'bash -s' <<'REMOTE'
set -eu
systemctl daemon-reload && systemctl enable -q shturman && systemctl restart shturman
CF=/etc/caddy/Caddyfile
if ! grep -q "handle_path /shturman-api/\*" "$CF"; then
  BAK="$CF.bak-shturman-$(date +%s)"; cp "$CF" "$BAK"
  python3 - "$CF" <<'PY'
import sys
cf=sys.argv[1]; s=open(cf).read()
anchor="\t# «Запуск за день»"
assert anchor in s
block="""\t# «Штурман»: API рабочего места Леры (сайт на GitHub Pages) → 127.0.0.1:8841
\thandle_path /shturman-api/* {
\t\treverse_proxy 127.0.0.1:8841
\t}
"""
s=s.replace(anchor, block+anchor, 1); open(cf,"w").write(s)
PY
  if caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1; then systemctl reload caddy; echo "Caddy: обновлён (прежний в $BAK)"; else cp "$BAK" "$CF"; echo "Caddyfile не прошёл проверку, вернул прежний"; exit 1; fi
fi
sleep 1; systemctl is-active shturman; curl -s http://127.0.0.1:8841/health; echo
REMOTE
sleep 1
curl -s -m 15 https://marchvlv.ru/shturman-api/health; echo
