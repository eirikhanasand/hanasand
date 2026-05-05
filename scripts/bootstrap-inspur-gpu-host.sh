#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
SERVICE_NAME="${HANASAND_MODEL_SERVICE_NAME:-hanasand-model}"
SERVICE_USER="${HANASAND_MODEL_USER:-$(id -un)}"
SERVICE_GROUP="${HANASAND_MODEL_GROUP:-$(id -gn)}"
MODEL_BACKEND="${HANASAND_MODEL_BACKEND:-vllm}"
EXPECTED_GPUS="${HANASAND_EXPECTED_NVIDIA_GPUS:-8}"
DRIVER_PACKAGE="${HANASAND_NVIDIA_DRIVER_PACKAGE:-nvidia-driver-550-server}"
UTILS_PACKAGE="${HANASAND_NVIDIA_UTILS_PACKAGE:-nvidia-utils-550-server}"
SUDO_PASSWORD_FILE="${HANASAND_SUDO_PASSWORD_FILE:-/home/hanasand/sudo}"
MODEL_CACHE_DIR="${HANASAND_MODEL_CACHE_DIR:-/var/lib/hanasand-model-cache}"
MODEL_CACHE_LV_NAME="${HANASAND_MODEL_CACHE_LV_NAME:-hanasand-model-cache}"
MODEL_CACHE_LV_SIZE="${HANASAND_MODEL_CACHE_LV_SIZE:-512G}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

if ! need_cmd sudo; then
  echo "sudo is required for host driver and systemd setup."
  exit 1
fi

sudo_auth() {
  if sudo -n true 2>/dev/null; then
    return
  fi

  if [ -r "$SUDO_PASSWORD_FILE" ]; then
    sudo -S -p '' -v < "$SUDO_PASSWORD_FILE"
    return
  fi

  echo "sudo requires a password. Set HANASAND_SUDO_PASSWORD_FILE or run with cached sudo credentials."
  exit 1
}

sudo_cmd() {
  sudo_auth
  sudo -n "$@"
}

ensure_model_cache_storage() {
  echo "Preparing model cache storage at ${MODEL_CACHE_DIR}..."
  sudo_cmd mkdir -p "$MODEL_CACHE_DIR"

  if mountpoint -q "$MODEL_CACHE_DIR"; then
    sudo_cmd chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "$MODEL_CACHE_DIR"
    return
  fi

  local vg_name=""
  if need_cmd vgs && need_cmd lvs && need_cmd lvcreate; then
    vg_name="$(sudo_cmd vgs --noheadings -o vg_name 2>/dev/null | awk 'NF {print $1; exit}')"
  fi

  if [ -n "$vg_name" ]; then
    local lv_path="/dev/${vg_name}/${MODEL_CACHE_LV_NAME}"

    if [ ! -e "$lv_path" ]; then
      sudo_cmd lvcreate -L "$MODEL_CACHE_LV_SIZE" -n "$MODEL_CACHE_LV_NAME" "$vg_name"
    fi

    if ! sudo_cmd blkid "$lv_path" >/dev/null 2>&1; then
      sudo_cmd mkfs.ext4 -F "$lv_path"
    fi

    local lv_uuid
    lv_uuid="$(sudo_cmd blkid -s UUID -o value "$lv_path")"
    if ! grep -q "$lv_uuid" /etc/fstab; then
      printf 'UUID=%s %s ext4 defaults,nofail 0 2\n' "$lv_uuid" "$MODEL_CACHE_DIR" \
        | sudo_cmd tee -a /etc/fstab >/dev/null
    fi

    sudo_cmd mount "$MODEL_CACHE_DIR"
  fi

  sudo_cmd chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "$MODEL_CACHE_DIR"
}

sudo_auth

echo "Installing NVIDIA host driver packages..."
sudo_cmd env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get update
sudo_cmd env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get install -y \
  "linux-headers-$(uname -r)" \
  build-essential \
  ca-certificates \
  cmake \
  curl \
  dkms \
  file \
  git \
  gnupg \
  lsof \
  nodejs \
  npm \
  nvidia-cuda-toolkit \
  python3 \
  python3-pip \
  python3-venv \
  "$DRIVER_PACKAGE" \
  "$UTILS_PACKAGE"

if ! command -v bun >/dev/null 2>&1; then
  echo "Installing Bun for the Hanasand TypeScript model worker..."
  sudo_cmd npm install -g bun
fi

ensure_model_cache_storage

echo "Installing NVIDIA Container Toolkit..."
sudo_cmd install -d -m 0755 /usr/share/keyrings
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
  | sudo_cmd gpg --batch --yes --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
  | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
  | sudo_cmd tee /etc/apt/sources.list.d/nvidia-container-toolkit.list >/dev/null
sudo_cmd env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get update
sudo_cmd env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get install -y nvidia-container-toolkit
sudo_cmd nvidia-ctk runtime configure --runtime=docker

echo "Disabling nouveau so NVIDIA can claim the GPUs..."
sudo_cmd tee /etc/modprobe.d/blacklist-nouveau-hanasand.conf >/dev/null <<'EOF'
blacklist nouveau
options nouveau modeset=0
EOF
sudo_cmd update-initramfs -u

if lsmod | grep -q '^nouveau'; then
  cat <<EOF
nouveau is still loaded and owns one or more NVIDIA GPUs.
Reboot the host, then rerun this script to finish validation and service setup.
EOF
  exit 75
fi

echo "Loading NVIDIA kernel modules..."
sudo_cmd depmod -a
sudo_cmd modprobe nvidia
sudo_cmd modprobe nvidia_uvm
sudo_cmd modprobe nvidia_drm || true

detected_gpus="$(nvidia-smi --list-gpus | wc -l | tr -d ' ')"
if [ "$detected_gpus" != "$EXPECTED_GPUS" ]; then
  echo "Expected ${EXPECTED_GPUS} GPUs, but nvidia-smi reports ${detected_gpus}."
  echo "A reboot may be required if this is the first driver install."
  exit 1
fi

echo "Writing systemd service ${SERVICE_NAME}.service..."
if [ "$MODEL_BACKEND" = "vllm" ]; then
  MODEL_EXEC="${REPO_ROOT}/gpt/run_model_inspur_vllm_gpu.sh"
  MODEL_PROFILE="inspur-v100-8x7b-vllm"
else
  MODEL_EXEC="${REPO_ROOT}/gpt/run_model_inspur_gpu.sh"
  MODEL_PROFILE="inspur-gpu"
fi

sudo_cmd tee "/etc/systemd/system/${SERVICE_NAME}.service" >/dev/null <<EOF
[Unit]
Description=Hanasand Inspur GPU model server
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${REPO_ROOT}/gpt
Environment=API=https://api.hanasand.com/api
Environment=HANASAND_MODEL_PROFILE=${MODEL_PROFILE}
Environment=HANASAND_MODEL_BACKEND=${MODEL_BACKEND}
Environment=HANASAND_REQUIRE_CUDA=1
Environment=HANASAND_EXPECTED_NVIDIA_GPUS=${EXPECTED_GPUS}
Environment=GPT_REQUIRE_SELECTED_MODEL=1
Environment=HANASAND_VLLM_LANES=${EXPECTED_GPUS}
Environment=HANASAND_VLLM_TENSOR_PARALLEL_SIZE=1
Environment=HANASAND_VLLM_MODEL_REPO=Qwen/Qwen2.5-Coder-7B-Instruct
Environment=HANASAND_VLLM_SERVED_MODEL_NAME=hanasand
Environment=HANASAND_VLLM_DTYPE=float16
Environment=HANASAND_VLLM_MAX_MODEL_LEN=32768
Environment=HANASAND_VLLM_GPU_MEMORY_UTILIZATION=0.92
Environment=HANASAND_VLLM_MAX_NUM_SEQS=16
Environment=HANASAND_VLLM_MAX_NUM_BATCHED_TOKENS=4096
Environment=HANASAND_VLLM_ENFORCE_EAGER=1
Environment=HANASAND_VLLM_ENABLE_PREFIX_CACHING=1
Environment=HANASAND_MODEL_CONTEXT_MAX_TOKENS=32768
Environment=HF_HOME=${MODEL_CACHE_DIR}/huggingface
Environment=HUGGING_FACE_HUB_CACHE=${MODEL_CACHE_DIR}/huggingface/hub
Environment=VLLM_CACHE_ROOT=${MODEL_CACHE_DIR}/vllm
Environment=TORCHINDUCTOR_CACHE_DIR=${MODEL_CACHE_DIR}/torchinductor
Environment=LLAMA_CTX_SIZE=32768
Environment=LLAMA_BATCH_SIZE=4096
Environment=LLAMA_UBATCH_SIZE=1024
Environment=LLAMA_THREADS=64
Environment=LLAMA_THREADS_BATCH=64
ExecStart=${MODEL_EXEC}
Restart=always
RestartSec=10
LimitMEMLOCK=infinity
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF

sudo_cmd systemctl daemon-reload
sudo_cmd systemctl enable "${SERVICE_NAME}.service"

echo "Validating Docker GPU runtime..."
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi

cat <<EOF
Inspur GPU host bootstrap is ready.

Start the host model server:
  sudo systemctl start ${SERVICE_NAME}.service

Check it:
  systemctl status ${SERVICE_NAME}.service
  curl -s http://127.0.0.1:18081/slots
EOF
