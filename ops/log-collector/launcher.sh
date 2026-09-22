#!/bin/sh
if [ -f /usr/local/lib/hanasand-log-collector/release ]; then
    HANASAND_COLLECTOR_RELEASE=$(cat /usr/local/lib/hanasand-log-collector/release)
    export HANASAND_COLLECTOR_RELEASE
fi
exec /usr/bin/node /usr/local/lib/hanasand-log-collector/collector.cjs "$@"
