#!/bin/sh

# Starts varnish
varnishd -a :3000 -f /etc/varnish/default.vcl -s malloc,512m -p thread_pool_min=50 -p thread_pool_max=4000 &

# Starts API
npm start
