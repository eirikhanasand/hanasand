#!/usr/bin/env bash
set -euo pipefail

MAIL_HOSTNAME="${MAIL_HOSTNAME:-mail.hanasand.com}"
MAIL_DOMAIN="${MAIL_DOMAIN:-hanasand.com}"
MAIL_ACCOUNT="${MAIL_ACCOUNT:-eirik}"
MAIL_ADDRESS="${MAIL_ADDRESS:-eirik@hanasand.com}"
MAIL_ACCOUNT_PASSWORD="${MAIL_ACCOUNT_PASSWORD:?MAIL_ACCOUNT_PASSWORD must be set}"
MAIL_HTTP_LOCAL_PORT="${MAIL_HTTP_LOCAL_PORT:-8081}"
STALWART_CONTAINER="${STALWART_CONTAINER:-hanasand_mail}"
STALWART_VOLUME_DIR="${STALWART_VOLUME_DIR:-/home/ubuntu/hanasand/mail/stalwart}"

wait_for_http() {
    local attempts=0
    until curl -fsS "http://127.0.0.1:${MAIL_HTTP_LOCAL_PORT}/jmap/session" >/dev/null 2>&1; do
        attempts=$((attempts + 1))
        if [ "$attempts" -gt 60 ]; then
            echo "Stalwart did not become ready on port ${MAIL_HTTP_LOCAL_PORT}."
            exit 1
        fi
        sleep 2
    done
}

extract_admin_password() {
    docker logs "${STALWART_CONTAINER}" 2>&1 | sed -n "s/.*password '\([^']*\)'.*/\1/p" | tail -n 1
}

api() {
    local method="$1"
    local path="$2"
    local body="${3:-}"
    if [ -n "$body" ]; then
        curl -fsS -u "admin:${ADMIN_PASSWORD}" -H 'Content-Type: application/json' -H 'Accept: application/json' -X "$method" "http://127.0.0.1:${MAIL_HTTP_LOCAL_PORT}${path}" -d "$body"
    else
        curl -fsS -u "admin:${ADMIN_PASSWORD}" -H 'Accept: application/json' -X "$method" "http://127.0.0.1:${MAIL_HTTP_LOCAL_PORT}${path}"
    fi
}

ensure_principal() {
    local name="$1"
    local type="$2"
    local body="$3"

    local principal_id
    principal_id="$(api GET '/api/principal?limit=500' | jq -r --arg name "$name" --arg type "$type" '.data.items[]? | select(.name == $name and .type == $type) | .id' | head -n 1)"

    if [ -n "${principal_id}" ]; then
        echo "Principal ${type}:${name} already exists (${principal_id})."
        return 0
    fi

    api POST '/api/principal' "$body" >/dev/null
    echo "Created principal ${type}:${name}."
}

mkdir -p "${STALWART_VOLUME_DIR}"
wait_for_http

ADMIN_PASSWORD="$(extract_admin_password)"
if [ -z "${ADMIN_PASSWORD}" ]; then
    echo "Unable to determine the initial Stalwart admin password from container logs."
    exit 1
fi

if docker exec "${STALWART_CONTAINER}" sh -lc 'command -v stalwart-cli >/dev/null 2>&1'; then
    docker exec "${STALWART_CONTAINER}" sh -lc "stalwart-cli -u http://127.0.0.1:8080 -c admin:${ADMIN_PASSWORD} server add-config server.hostname ${MAIL_HOSTNAME}" >/dev/null || true
    docker exec "${STALWART_CONTAINER}" sh -lc "stalwart-cli -u http://127.0.0.1:8080 -c admin:${ADMIN_PASSWORD} server add-config http.url https://${MAIL_HOSTNAME}" >/dev/null || true
    docker exec "${STALWART_CONTAINER}" sh -lc "stalwart-cli -u http://127.0.0.1:8080 -c admin:${ADMIN_PASSWORD} server reload-config" >/dev/null || true
fi

ensure_principal "${MAIL_DOMAIN}" "domain" "$(jq -nc --arg name "${MAIL_DOMAIN}" '{type:"domain",quota:0,name:$name,description:"Hanasand mail domain",secrets:[],emails:[],urls:[],memberOf:[],roles:[],lists:[],members:[],enabledPermissions:[],disabledPermissions:[],externalMembers:[]}')"
ensure_principal "${MAIL_ACCOUNT}" "individual" "$(jq -nc --arg name "${MAIL_ACCOUNT}" --arg email "${MAIL_ADDRESS}" --arg secret "${MAIL_ACCOUNT_PASSWORD}" '{type:"individual",quota:0,name:$name,description:"Primary Hanasand mailbox",secrets:[$secret],emails:[$email],urls:[],memberOf:[],roles:["user"],lists:[],members:[],enabledPermissions:[],disabledPermissions:[],externalMembers:[]}')"

api POST '/api/dkim' "$(jq -nc --arg domain "${MAIL_DOMAIN}" '{id:null,algorithm:"Ed25519",domain:$domain,selector:null}')" >/dev/null || true

echo
echo "DNS records suggested by Stalwart for ${MAIL_DOMAIN}:"
api GET "/api/dns/records/${MAIL_DOMAIN}" | jq -r '.data[] | "\(.type)\t\(.name)\t\(.content // .value // "")"'
