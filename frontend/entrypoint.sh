#!/bin/sh

# Starts varnish. Keep the cache modest so the Next.js server has headroom inside
# the production container.
varnishd -a :3000 -f /etc/varnish/default.vcl -s malloc,256m -p thread_pool_min=50 -p thread_pool_max=4000 &

# Fails fast on hook/lint regressions that would otherwise keep resurfacing.
bun run check:startup

# Starts frontend
HOSTNAME=0.0.0.0 PORT="${PORT:-3001}" bun server.js
