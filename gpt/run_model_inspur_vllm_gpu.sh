#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
CURRENT_DIR="$SCRIPT_DIR"

MODEL_PORT="${MODEL_PORT:-18081}"
API_DIR="$CURRENT_DIR/api"
MODULES_DIR="$CURRENT_DIR/modules"
VLLM_VENV="${HANASAND_VLLM_VENV:-$CURRENT_DIR/.venv-vllm}"
EXPECTED_NVIDIA_GPUS="${HANASAND_EXPECTED_NVIDIA_GPUS:-8}"
MODEL_REPO="${HANASAND_VLLM_MODEL_REPO:-Qwen/Qwen3-Coder-30B-A3B-Instruct}"
SERVED_MODEL_NAME="${HANASAND_VLLM_SERVED_MODEL_NAME:-hanasand}"
TENSOR_PARALLEL_SIZE="${HANASAND_VLLM_TENSOR_PARALLEL_SIZE:-8}"
DTYPE="${HANASAND_VLLM_DTYPE:-float16}"
MAX_MODEL_LEN="${HANASAND_VLLM_MAX_MODEL_LEN:-65536}"
GPU_MEMORY_UTILIZATION="${HANASAND_VLLM_GPU_MEMORY_UTILIZATION:-0.86}"
MAX_NUM_SEQS="${HANASAND_VLLM_MAX_NUM_SEQS:-2}"
MAX_NUM_BATCHED_TOKENS="${HANASAND_VLLM_MAX_NUM_BATCHED_TOKENS:-2048}"
VLLM_VERSION="${HANASAND_VLLM_VERSION:-0.17.1}"
MODEL_CACHE_DIR="${HANASAND_MODEL_CACHE_DIR:-/var/lib/hanasand-model-cache}"
ENFORCE_EAGER="${HANASAND_VLLM_ENFORCE_EAGER:-1}"
ENABLE_PREFIX_CACHING="${HANASAND_VLLM_ENABLE_PREFIX_CACHING:-0}"

SERVER_PID=""
NODE_PID=""

cleanup() {
  echo "Stopping background processes..."
  if [ -n "${NODE_PID:-}" ]; then
    kill "$NODE_PID" 2>/dev/null || true
  fi
  if [ -n "${SERVER_PID:-}" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

wait_for_openai_server() {
  local retries="${HANASAND_MODEL_READY_RETRIES:-900}"
  local delay="${HANASAND_MODEL_READY_DELAY:-2}"

  for _ in $(seq 1 "$retries"); do
    if curl -fsS "http://127.0.0.1:${MODEL_PORT}/v1/models" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done

  echo "Timed out waiting for vLLM OpenAI server on port ${MODEL_PORT}."
  return 1
}

install_api_dependencies() {
  if [ -d "$MODULES_DIR" ]; then
    cd "$MODULES_DIR" || exit 1
    if [ -d node_modules ]; then
      echo "Modules dependencies already present; skipping install."
    elif [ -f package-lock.json ]; then
      npm ci
    else
      npm install
    fi
  fi

  cd "$API_DIR" || exit 1
  if [ -d node_modules ]; then
    echo "API dependencies already present; skipping install."
  elif [ -f bun.lock ] && need_cmd bun; then
    bun install
  elif [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
}

start_api_worker() {
  install_api_dependencies
  cd "$API_DIR" || exit 1

  if need_cmd bun; then
    HANASAND_WEB_SEARCH=1 HANASAND_MODEL_BACKEND=vllm HANASAND_MODEL_PROFILE=qwen3-coder-30b-a3b-vllm HANASAND_SERVED_MODEL_NAME="$SERVED_MODEL_NAME" HANASAND_MODEL_CONTEXT_MAX_TOKENS="$MAX_MODEL_LEN" MODEL_API="http://127.0.0.1:$MODEL_PORT" bun src/index.ts &
  else
    HANASAND_WEB_SEARCH=1 HANASAND_MODEL_BACKEND=vllm HANASAND_MODEL_PROFILE=qwen3-coder-30b-a3b-vllm HANASAND_SERVED_MODEL_NAME="$SERVED_MODEL_NAME" HANASAND_MODEL_CONTEXT_MAX_TOKENS="$MAX_MODEL_LEN" MODEL_API="http://127.0.0.1:$MODEL_PORT" node src/index.ts &
  fi
  NODE_PID=$!
}

if ! need_cmd nvidia-smi; then
  echo "nvidia-smi is required; refusing to run the GPU-native model server without NVIDIA GPUs."
  exit 1
fi

detected_gpus="$(nvidia-smi --list-gpus | wc -l | tr -d ' ')"
echo "Detected NVIDIA GPUs: ${detected_gpus}"
if [ "$detected_gpus" != "$EXPECTED_NVIDIA_GPUS" ]; then
  echo "Expected ${EXPECTED_NVIDIA_GPUS} GPUs, but nvidia-smi reports ${detected_gpus}."
  exit 1
fi

if [ "$TENSOR_PARALLEL_SIZE" -gt "$detected_gpus" ]; then
  echo "Tensor parallel size ${TENSOR_PARALLEL_SIZE} exceeds detected GPU count ${detected_gpus}."
  exit 1
fi

if [ ! -d "$VLLM_VENV" ]; then
  python3 -m venv "$VLLM_VENV"
fi

mkdir -p "$MODEL_CACHE_DIR/huggingface/hub" "$MODEL_CACHE_DIR/vllm" "$MODEL_CACHE_DIR/torchinductor"

"$VLLM_VENV/bin/python" -m pip install --upgrade pip wheel setuptools
"$VLLM_VENV/bin/python" -m pip install "vllm==${VLLM_VERSION}"

export VLLM_WORKER_MULTIPROC_METHOD="${VLLM_WORKER_MULTIPROC_METHOD:-spawn}"
export PYTORCH_CUDA_ALLOC_CONF="${PYTORCH_CUDA_ALLOC_CONF:-expandable_segments:True}"
export HF_HOME="${HF_HOME:-$MODEL_CACHE_DIR/huggingface}"
export HUGGING_FACE_HUB_CACHE="${HUGGING_FACE_HUB_CACHE:-$MODEL_CACHE_DIR/huggingface/hub}"
export VLLM_CACHE_ROOT="${VLLM_CACHE_ROOT:-$MODEL_CACHE_DIR/vllm}"
export TORCHINDUCTOR_CACHE_DIR="${TORCHINDUCTOR_CACHE_DIR:-$MODEL_CACHE_DIR/torchinductor}"

echo "Starting vLLM ${VLLM_VERSION}: ${MODEL_REPO} as ${SERVED_MODEL_NAME}"
VLLM_ARGS=(
  --model "$MODEL_REPO"
  --served-model-name "$SERVED_MODEL_NAME"
  --host 127.0.0.1
  --port "$MODEL_PORT"
  --tensor-parallel-size "$TENSOR_PARALLEL_SIZE"
  --dtype "$DTYPE"
  --max-model-len "$MAX_MODEL_LEN"
  --gpu-memory-utilization "$GPU_MEMORY_UTILIZATION"
  --max-num-seqs "$MAX_NUM_SEQS"
  --max-num-batched-tokens "$MAX_NUM_BATCHED_TOKENS"
  --disable-custom-all-reduce
  --trust-remote-code
)

if [ "$ENFORCE_EAGER" = "1" ]; then
  VLLM_ARGS+=(--enforce-eager)
fi

if [ "$ENABLE_PREFIX_CACHING" = "1" ]; then
  VLLM_ARGS+=(--enable-prefix-caching)
fi

"$VLLM_VENV/bin/python" -m vllm.entrypoints.openai.api_server "${VLLM_ARGS[@]}" &
SERVER_PID=$!

wait_for_openai_server
start_api_worker
wait "$SERVER_PID"
