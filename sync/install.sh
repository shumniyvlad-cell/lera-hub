#!/bin/sh
# Ставит вечерний синк «Штурмана» на мак: копия скрипта в ~/.config/shturman (launchd не ходит в Documents)
# и задание launchd на 21:00. Поменял map.json или sync.mjs — запусти install.sh ещё раз.
set -eu
cd "$(dirname "$0")"
D="$HOME/.config/shturman"
mkdir -p "$D" "$HOME/Library/Logs"
cp sync.mjs map.json "$D/"
PL="$HOME/Library/LaunchAgents/ru.marchvlv.shturman-sync.plist"
cat > "$PL" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>ru.marchvlv.shturman-sync</string>
  <key>ProgramArguments</key><array><string>/opt/homebrew/bin/node</string><string>$D/sync.mjs</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>21</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/shturman-sync.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/shturman-sync.log</string>
</dict></plist>
PLIST
launchctl bootout "gui/$(id -u)" "$PL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PL"
launchctl print "gui/$(id -u)/ru.marchvlv.shturman-sync" | grep -E "state|path" | head -3
