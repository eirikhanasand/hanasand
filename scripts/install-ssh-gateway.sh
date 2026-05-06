#!/usr/bin/env bash
set -euo pipefail

HOST_USER="${HOST_USER:-hanasand}"
HOST_SOURCE_USER="${HOST_SOURCE_USER:-ubuntu}"
VM_GROUP="${VM_GROUP:-hanasand-vm}"
FORGEJO_CONTAINER="${FORGEJO_CONTAINER:-git_ui}"
FORGEJO_AUTHORIZED_KEYS="${FORGEJO_AUTHORIZED_KEYS:-/var/lib/docker/volumes/git_git_data/_data/git/.ssh/authorized_keys}"
FORGEJO_APP_INI="${FORGEJO_APP_INI:-/data/gitea/conf/app.ini}"
PRIMARY_PORTS="${PRIMARY_PORTS:-22 222}"
EMERGENCY_PORTS="${EMERGENCY_PORTS:-2223}"
TEST_PORT="${TEST_PORT:-}"
GATEWAY_ADDRESS_FAMILY="${GATEWAY_ADDRESS_FAMILY:-inet}"
if [ -z "${LXC_BIN:-}" ]; then
    if [ -x /snap/lxd/current/bin/lxc ]; then
        LXC_BIN=/snap/lxd/current/bin/lxc
    else
        LXC_BIN=$(command -v lxc || true)
    fi
fi

require_root() {
    if [ "${EUID}" -ne 0 ]; then
        echo "Run as root." >&2
        exit 1
    fi
}

install_forgejo_helper() {
    install -d -m 0755 /usr/local/src /usr/local/sbin
    cat >/usr/local/src/forgejo-gitea-serv.c <<'C'
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#ifndef FORGEJO_CONTAINER
#define FORGEJO_CONTAINER "git_ui"
#endif

#ifndef FORGEJO_APP_INI
#define FORGEJO_APP_INI "/data/gitea/conf/app.ini"
#endif

static int valid_key(const char *s) {
    if (strncmp(s, "key-", 4) != 0) return 0;
    if (!isdigit((unsigned char)s[4])) return 0;
    for (const char *p = s + 4; *p; ++p) {
        if (!isdigit((unsigned char)*p)) return 0;
    }
    return 1;
}

int main(int argc, char **argv) {
    char expected_config[256];
    snprintf(expected_config, sizeof(expected_config), "--config=%s", FORGEJO_APP_INI);

    if (argc != 4 || strcmp(argv[1], expected_config) != 0 || strcmp(argv[2], "serv") != 0 || !valid_key(argv[3])) {
        fprintf(stderr, "Unsupported Forgejo SSH command.\n");
        return 1;
    }

    if (setgid(0) != 0 || setuid(0) != 0) {
        perror("setuid/setgid");
        return 1;
    }

    const char *original_command = getenv("SSH_ORIGINAL_COMMAND");
    char original_command_env[8192];
    if (original_command == NULL) {
        original_command = "";
    }
    if (snprintf(original_command_env, sizeof(original_command_env), "SSH_ORIGINAL_COMMAND=%s", original_command) >= (int)sizeof(original_command_env)) {
        fprintf(stderr, "SSH_ORIGINAL_COMMAND is too long.\n");
        return 1;
    }

    char *cmd[] = {
        "/usr/bin/docker", "exec", "-i", "--user", "git", "-e", original_command_env, FORGEJO_CONTAINER,
        "/usr/local/bin/gitea", argv[1], argv[2], argv[3], NULL
    };
    execv(cmd[0], cmd);
    perror("execv docker");
    return 1;
}
C
    gcc -O2 -Wall -Wextra \
        -DFORGEJO_CONTAINER="\"${FORGEJO_CONTAINER}\"" \
        -DFORGEJO_APP_INI="\"${FORGEJO_APP_INI}\"" \
        -o /usr/local/sbin/forgejo-gitea-serv /usr/local/src/forgejo-gitea-serv.c
    chown root:root /usr/local/sbin/forgejo-gitea-serv
    chmod 4755 /usr/local/sbin/forgejo-gitea-serv

    cat >/usr/local/bin/gitea <<'SH'
#!/usr/bin/env bash
exec /usr/local/sbin/forgejo-gitea-serv "$@"
SH
    chmod 0755 /usr/local/bin/gitea
}

install_gateway_scripts() {
    install -d -m 0755 /usr/local/sbin

    cat >/usr/local/sbin/forgejo-authorized-keys <<SH
#!/usr/bin/env bash
set -euo pipefail
trap '' PIPE
[ "\${1:-}" = "git" ] || exit 1
output=\$(cat "${FORGEJO_AUTHORIZED_KEYS}" 2>/dev/null || true)
if [ -n "\$output" ]; then
    printf '%s\\n' "\$output" || true
fi
exit 0
SH
    chmod 0755 /usr/local/sbin/forgejo-authorized-keys
    install -d -m 0755 /var/lib/hanasand-ssh-gateway/home/git
    if ! id git >/dev/null 2>&1; then
        useradd -M -N -r -d /var/lib/hanasand-ssh-gateway/home/git -s /bin/bash git
    fi
    usermod -d /var/lib/hanasand-ssh-gateway/home/git -s /bin/bash git
    usermod -p '!' git >/dev/null 2>&1 || true

    cat >/usr/local/sbin/hanasand-vm-authorized-keys <<'SH'
#!/usr/bin/env bash
set -euo pipefail
trap '' PIPE
if [ -z "${LXC_BIN:-}" ]; then
    if [ -x /snap/lxd/current/bin/lxc ]; then
        LXC_BIN=/snap/lxd/current/bin/lxc
    else
        LXC_BIN=$(command -v lxc || true)
    fi
fi
user="${1:-}"
if [[ ! "$user" =~ ^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$ ]]; then
    exit 1
fi
if [ -z "${LXC_BIN}" ] || ! "${LXC_BIN}" info "$user" >/dev/null 2>&1; then
    exit 1
fi
wait_ready() {
    for _ in $(seq 1 90); do
        "${LXC_BIN}" exec "$1" -- true >/dev/null 2>&1 && return 0
        sleep 1
    done
    return 1
}
info=$("${LXC_BIN}" info "$user")
state=$(awk '/^Status:/ {print tolower($2); exit}' <<<"$info")
if [ "$state" != "running" ]; then
    "${LXC_BIN}" start "$user" >/dev/null 2>&1 || exit 1
fi
wait_ready "$user" || exit 1
output=$("${LXC_BIN}" exec "$user" -- sh -lc "test -r /home/$user/.ssh/authorized_keys && cat /home/$user/.ssh/authorized_keys" 2>/dev/null || true)
if [ -n "$output" ]; then
    printf '%s\n' "$output" || true
fi
exit 0
SH
    chmod 0755 /usr/local/sbin/hanasand-vm-authorized-keys

    cat >/usr/local/sbin/hanasand-vm-ssh-dispatch-root <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [ -z "${LXC_BIN:-}" ]; then
    if [ -x /snap/lxd/current/bin/lxc ]; then
        LXC_BIN=/snap/lxd/current/bin/lxc
    else
        LXC_BIN=$(command -v lxc || true)
    fi
fi
vm="${HANASAND_GATEWAY_USER:-${SUDO_USER:-${USER:-}}}"
original_command="${1:-${SSH_ORIGINAL_COMMAND:-}}"
logger -t hanasand-vm-ssh-dispatch -- "user=$vm cmd=${original_command}" || true
if [[ ! "$vm" =~ ^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$ ]]; then
    echo "Invalid VM name." >&2
    exit 1
fi
if [ -z "${LXC_BIN}" ] || ! "${LXC_BIN}" info "$vm" >/dev/null 2>&1; then
    echo "VM '$vm' not found." >&2
    exit 1
fi
wait_ready() {
    for _ in $(seq 1 90); do
        "${LXC_BIN}" exec "$1" -- true >/dev/null 2>&1 && return 0
        sleep 1
    done
    return 1
}
info=$("${LXC_BIN}" info "$vm")
state=$(awk '/^Status:/ {print tolower($2); exit}' <<<"$info")
if [ "$state" != "running" ]; then
    echo "Starting VM '$vm'..." >&2
    "${LXC_BIN}" start "$vm" >/dev/null
fi
wait_ready "$vm" || {
    echo "VM '$vm' did not become ready." >&2
    exit 1
}
if ! "${LXC_BIN}" exec "$vm" -- id "$vm" >/dev/null 2>&1; then
    echo "User '$vm' is missing inside VM '$vm'." >&2
    exit 1
fi
if [ -n "$original_command" ]; then
    exec "${LXC_BIN}" exec "$vm" -- sudo -Hiu "$vm" -- bash -lc "$original_command"
fi
exec "${LXC_BIN}" exec "$vm" -- sudo -Hiu "$vm"
SH
    chmod 0755 /usr/local/sbin/hanasand-vm-ssh-dispatch-root

    cat >/usr/local/sbin/hanasand-vm-ssh-dispatch <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [ -n "${SSH_ORIGINAL_COMMAND:-}" ]; then
    exec /usr/bin/sudo -n /usr/local/sbin/hanasand-vm-ssh-dispatch-root "$SSH_ORIGINAL_COMMAND"
fi
exec /usr/bin/sudo -n /usr/local/sbin/hanasand-vm-ssh-dispatch-root
SH
    chmod 0755 /usr/local/sbin/hanasand-vm-ssh-dispatch

    cat >/usr/local/sbin/hanasand-sync-ssh-users <<SH
#!/usr/bin/env bash
set -euo pipefail
groupadd -f "${VM_GROUP}"
sync_one() {
    local name="\$1"
    [ -n "\$name" ] || return 0
    [[ "\$name" =~ ^[A-Za-z0-9][A-Za-z0-9_-]{1,63}\$ ]] || return 0
    [ -n "${LXC_BIN}" ] || return 0
    "${LXC_BIN}" info "\$name" >/dev/null 2>&1 || return 0
    if ! id "\$name" >/dev/null 2>&1; then
        useradd -M -N -g "${VM_GROUP}" -s /bin/bash "\$name"
    else
        usermod -aG "${VM_GROUP}" "\$name"
    fi
    install -d -m 0750 -o "\$name" -g "${VM_GROUP}" "/var/lib/hanasand-ssh-gateway/home/\$name"
    usermod -g "${VM_GROUP}" -d "/var/lib/hanasand-ssh-gateway/home/\$name" -s /bin/bash "\$name"
    local password
    password=\$("${LXC_BIN}" config get "\$name" user.hanasand.sudo_password 2>/dev/null || true)
    if [ -n "\$password" ]; then
        printf '%s:%s\\n' "\$name" "\$password" | chpasswd
    else
        usermod -p '!' "\$name" >/dev/null 2>&1 || true
    fi
}
write_sudoers() {
    local tmp
    tmp=\$(mktemp)
    {
        printf '# Generated by install-ssh-gateway.sh. Do not edit by hand.\\n'
        [ -n "${LXC_BIN}" ] || return 0
        "${LXC_BIN}" list --format csv -c n | while IFS=, read -r name; do
            [ -n "\$name" ] || continue
            [[ "\$name" =~ ^[A-Za-z0-9][A-Za-z0-9_-]{1,63}\$ ]] || continue
            "${LXC_BIN}" info "\$name" >/dev/null 2>&1 || continue
            printf '%s ALL=(root) NOPASSWD: /usr/local/sbin/hanasand-vm-ssh-dispatch-root, /usr/local/sbin/hanasand-vm-ssh-dispatch-root *\\n' "\$name"
        done
    } >"\$tmp"
    install -m 0440 -o root -g root "\$tmp" /etc/sudoers.d/hanasand-ssh-gateway
    rm -f "\$tmp"
    visudo -cf /etc/sudoers.d/hanasand-ssh-gateway >/dev/null
}
if [ "\$#" -gt 0 ]; then
    for name in "\$@"; do sync_one "\$name"; done
else
    if [ -n "${LXC_BIN}" ]; then
        "${LXC_BIN}" list --format csv -c n | while IFS=, read -r name; do sync_one "\$name"; done
    fi
fi
write_sudoers
SH
    chmod 0755 /usr/local/sbin/hanasand-sync-ssh-users
}

install_host_user() {
    if ! id "${HOST_USER}" >/dev/null 2>&1; then
        useradd -m -s /bin/bash "${HOST_USER}"
    fi
    install -d -m 700 -o "${HOST_USER}" -g "${HOST_USER}" "/home/${HOST_USER}/.ssh"
    if [ "/home/${HOST_SOURCE_USER}/.ssh/authorized_keys" != "/home/${HOST_USER}/.ssh/authorized_keys" ]; then
        cp "/home/${HOST_SOURCE_USER}/.ssh/authorized_keys" "/home/${HOST_USER}/.ssh/authorized_keys"
    fi
    chown "${HOST_USER}:${HOST_USER}" "/home/${HOST_USER}/.ssh/authorized_keys"
    chmod 600 "/home/${HOST_USER}/.ssh/authorized_keys"
}

install_sync_timer() {
    cat >/etc/systemd/system/hanasand-sync-ssh-users.service <<'UNIT'
[Unit]
Description=Synchronize Hanasand LXD instance SSH gateway users

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/hanasand-sync-ssh-users
UNIT

    cat >/etc/systemd/system/hanasand-sync-ssh-users.timer <<'UNIT'
[Unit]
Description=Periodically synchronize Hanasand LXD instance SSH gateway users

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
AccuracySec=20s
Unit=hanasand-sync-ssh-users.service

[Install]
WantedBy=timers.target
UNIT

    systemctl daemon-reload
    systemctl enable --now hanasand-sync-ssh-users.timer
}

write_sshd_configs() {
    local ports_content=""
    if [ -n "${TEST_PORT}" ]; then
        ports_content="Port ${TEST_PORT}"
    else
        for port in ${PRIMARY_PORTS}; do
            ports_content="${ports_content}Port ${port}"$'\n'
        done
    fi

    cat >/etc/ssh/sshd_config_hanasand_gateway <<CONF
${ports_content}
AddressFamily ${GATEWAY_ADDRESS_FAMILY}
HostKey /etc/ssh/ssh_host_ed25519_key
UseDNS no
GSSAPIAuthentication no
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
UsePAM yes
PermitRootLogin no
X11Forwarding no
PrintMotd yes
AcceptEnv LANG LC_*
AuthorizedKeysFile .ssh/authorized_keys
Subsystem sftp /usr/lib/openssh/sftp-server

Match User git
    AuthorizedKeysCommand /usr/local/sbin/forgejo-authorized-keys %u
    AuthorizedKeysCommandUser root
    PasswordAuthentication no
    KbdInteractiveAuthentication no

Match Group ${VM_GROUP}
    AuthorizedKeysCommand /usr/local/sbin/hanasand-vm-authorized-keys %u
    AuthorizedKeysCommandUser root
    ForceCommand /usr/local/sbin/hanasand-vm-ssh-dispatch
    PermitTTY yes
    AllowTcpForwarding no
    X11Forwarding no
    PasswordAuthentication yes
    KbdInteractiveAuthentication no
CONF

    local emergency_ports=""
    for port in ${EMERGENCY_PORTS}; do
        emergency_ports="${emergency_ports}Port ${port}"$'\n'
    done
    awk '
        /^Port / { next }
        { print }
    ' /etc/ssh/sshd_config > /etc/ssh/sshd_config_hanasand_emergency.body
    {
        printf '%s' "${emergency_ports}"
        cat /etc/ssh/sshd_config_hanasand_emergency.body
    } > /etc/ssh/sshd_config_hanasand_emergency
    rm -f /etc/ssh/sshd_config_hanasand_emergency.body

    install -d -m 0755 /run/sshd
    sshd -t -f /etc/ssh/sshd_config_hanasand_gateway
    sshd -t -f /etc/ssh/sshd_config_hanasand_emergency
}

install_systemd_units() {
    local gateway_name="hanasand-ssh-gateway"
    if [ -n "${TEST_PORT}" ]; then
        gateway_name="hanasand-ssh-gateway-test"
    fi
    cat >"/etc/systemd/system/${gateway_name}.service" <<UNIT
[Unit]
Description=Hanasand SSH gateway
After=network.target docker.service snap.lxd.daemon.service

[Service]
ExecStartPre=/usr/bin/install -d -m 0755 /run/sshd
ExecStart=/usr/sbin/sshd -D -f /etc/ssh/sshd_config_hanasand_gateway -E /var/log/hanasand-ssh-gateway.log
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

    cat >/etc/systemd/system/hanasand-ssh-emergency.service <<'UNIT'
[Unit]
Description=Hanasand emergency direct SSH
After=network.target

[Service]
ExecStartPre=/usr/bin/install -d -m 0755 /run/sshd
ExecStart=/usr/sbin/sshd -D -f /etc/ssh/sshd_config_hanasand_emergency -E /var/log/hanasand-ssh-emergency.log
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

    systemctl daemon-reload
    systemctl enable --now "${gateway_name}.service"
    if [ -z "${TEST_PORT}" ]; then
        systemctl enable --now hanasand-ssh-emergency.service
    fi
}

main() {
    require_root
    install_forgejo_helper
    install_gateway_scripts
    install_host_user
    install_sync_timer
    write_sshd_configs
    install_systemd_units
    /usr/local/sbin/hanasand-sync-ssh-users "$@"
}

main "$@"
