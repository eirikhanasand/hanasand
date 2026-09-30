# External monitoring

Create a check at `/automation/health`, choose **External events**, and enter one source ID for one sensor condition, for example `home-1/basement/moisture`. Save the check, then create its sender key. Store the key on the household hub. Creating another key revokes the previous one. Pausing or archiving the check stops event acceptance.

Send `POST /api/automations/<check-id>/events` to the Hanasand API with `Content-Type: application/json` and `X-API-Key: <sender-key>`. The key is bound to that check and permits only event submission. It grants no browser login, management access or access to another check.

The [event schema](../api/public/external-monitor-event.schema.json) defines the external interface. Sensors and hardware drivers are not implemented yet. The mock sender submits saved JSON files:

```sh
node api/scripts/mock-external-monitor.mjs --example > incident.json
# Set the API endpoint and the saved sender key in your local environment.
EXTERNAL_MONITOR_URL=https://api.hanasand.com/api/automations/<check-id>/events \
EXTERNAL_MONITOR_KEY=<sender-key> node api/scripts/mock-external-monitor.mjs incident.json
```

Each event needs a stable `eventId`, a strictly increasing `sequence`, the configured `source`, a `type` and an ISO timestamp with a timezone in `observedAt`. Incident and recovery events also need a short message saying what happened and what to do next. Optional sensor details hold the pod, sensor, location, reading and unit.

Persist the sequence and pending events on the hub across restarts. Retry the exact same event until the API acknowledges it. A duplicate is acknowledged without another run or case update. An older sequence is retained as a receipt but does not change current state. Reusing an ID or sequence for different data returns 409. New sequences cannot move observation time backwards; timestamps more than one minute ahead of Hanasand are rejected. Keep clocks synchronized.

`incident` opens or updates an HA case immediately. `recovery` records a confirmed normal sensor reading. `heartbeat` refreshes source availability and preserves the last sensor condition; it cannot clear an incident. Before a sensor reading arrives, the check cannot report healthy. Old observations cannot establish current availability.

The silence limit is configured in seconds. Hanasand checks it every minute, so detection can occur up to one minute after the limit. Lost contact keeps any sensor alarm open. Restoring contact alone does not clear an alarm. Case changes, event evidence and check history are committed together before acknowledgment. Notifications use the existing case sender, grace period and persisted 24-hour limit per case and destination.

The panel pulls recorded status and event history through the existing automation APIs; cases appear at `/cases`. For remote status polling, the hub can later expose an HTTPS status endpoint and use an existing HTTP/JSON check. The hub's remote log endpoint, household connectivity and physical sensor drivers are outside this first version.

Local checks: run `bun test tests/push-monitoring.test.ts` from `api/`, and `bun run check:external-monitoring` from `frontend/`. The browser check starts a local mock API and the real frontend, then closes both. It uses a Playwright browser or `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. The database test `api/tests/push-monitoring-postgres.test.ts` accepts `PUSH_TEST_PGLITE_MODULE` pointing to a locally installed PGlite module and creates a disposable PostgreSQL engine in memory; it never uses the application database.
