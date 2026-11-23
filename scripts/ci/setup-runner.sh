#!/usr/bin/env bash
# One-time: give grc's existing self-hosted runner (ghrunner, /home/ghrunner/actions-runner,
# label grc) the jklepp/ci engine's environment, like the other projects' runners:
# its own CI home, Podman store, and gVisor for the install stage.
#
#   sudo bash scripts/ci/setup-runner.sh
#
# Everything grc's CI keeps lives under /srv/grc-ci. Undo: restore the runner's .env.bak,
# restart the service, sudo rm -rf /srv/grc-ci.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "run with sudo" >&2; exit 1; }
OWNER="${SUDO_USER:?run through sudo, so the invoking user is known}"
RUNNER_USER=ghrunner
RUNNER_DIR=/home/ghrunner/actions-runner
SERVICE=actions.runner.jklepp-grc.jpc-wsl.service
HOME_DIR=/srv/grc-ci

grep -q '"gitHubUrl": "https://github.com/jklepp/grc"' "$RUNNER_DIR/.runner" \
  || { echo "$RUNNER_DIR is not grc's runner" >&2; exit 1; }
command -v runsc >/dev/null || { echo "gVisor (runsc) is not installed" >&2; exit 1; }
RUNNER_UID=$(id -u "$RUNNER_USER")

echo "== $HOME_DIR, owned by $RUNNER_USER; readable by $OWNER through the $RUNNER_USER group"
install -d -o "$RUNNER_USER" -g "$RUNNER_USER" -m 0750 "$HOME_DIR"
for d in containers logs npm-cache trivy-cache work; do
  install -d -o "$RUNNER_USER" -g "$RUNNER_USER" -m 0750 "$HOME_DIR/$d"
done
usermod -aG "$RUNNER_USER" "$OWNER"

echo "== Podman store for grc alone"
cat > "$HOME_DIR/containers/storage.conf" <<CONF
[storage]
driver = "overlay"
graphroot = "$HOME_DIR/containers/storage"
runroot = "/run/user/$RUNNER_UID/grc-containers"
CONF
chown "$RUNNER_USER:$RUNNER_USER" "$HOME_DIR/containers/storage.conf"

echo "== runner environment"
[ -f "$RUNNER_DIR/.env.bak" ] || cp -p "$RUNNER_DIR/.env" "$RUNNER_DIR/.env.bak"
cat > "$RUNNER_DIR/.env" <<ENV
LANG=C.UTF-8
CI_HOME=$HOME_DIR
CONTAINERS_STORAGE_CONF=$HOME_DIR/containers/storage.conf
XDG_RUNTIME_DIR=/run/user/$RUNNER_UID
# The engine runs the install stage (npm ci) in gVisor: needs runsc on PATH (jklepp/ci engine/README.md).
CI_SANDBOX=gvisor
ENV
chown "$RUNNER_USER:$RUNNER_USER" "$RUNNER_DIR/.env"

systemctl restart "$SERVICE"
systemctl --no-pager status "$SERVICE" | head -5
echo "done."
