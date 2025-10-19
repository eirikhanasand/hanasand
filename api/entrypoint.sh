#!/bin/sh

# THIS IS THE API ENTRYPOINT. SEE /ui/entrypoint.sh FOR THE FRONTEND ENTRYPOINT.

mkdir -p /root/.ssh
chmod 700 /root/.ssh
ssh-keyscan github.com >> /root/.ssh/known_hosts 2>/dev/null
echo "$API_SSH_KEY" | tr -d '\r' | sed 's/\\n/\n/g' > /root/.ssh/id_ed25519
chmod 600 /root/.ssh/id_ed25519

# Starts cron
crond -f &

# Starts varnish
varnishd -a :8080 -f /etc/varnish/default.vcl -s malloc,512m &

# Starts API
npm start
