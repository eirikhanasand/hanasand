#!/bin/sh
set -eu

until [ -S "/tmp/.X11-unix/X${DISPLAY#:}" ]; do sleep 0.1; done
selkies-gstreamer-resize "${BROWSER_STREAM_RESOLUTION:-1280x720}"
xfwm4 --sm-client-disable >/tmp/xfwm.log 2>&1 &
cd /app
exec bun start
