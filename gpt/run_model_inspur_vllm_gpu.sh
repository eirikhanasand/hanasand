#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
CURRENT_DIR="$SCRIPT_DIR"

MODEL_PORT="${MODEL_PORT:-18081}"
API_DIR="$CURRENT_DIR/api"
MODULES_DIR="$CURRENT_DIR/modules"
VLLM_VENV="${HANASAND_VLLM_VENV:-$CURRENT_DIR/.venv-vllm}"
EXPECTED_NVIDIA_GPUS="${HANASAND_EXPECTED_NVIDIA_GPUS:-8}"
MODEL_REPO="${HANASAND_VLLM_MODEL_REPO:-Qwen/Qwen2.5-Coder-7B-Instruct}"
SERVED_MODEL_NAME="${HANASAND_VLLM_SERVED_MODEL_NAME:-hanasand}"
LANES="${HANASAND_VLLM_LANES:-$EXPECTED_NVIDIA_GPUS}"
TENSOR_PARALLEL_SIZE="${HANASAND_VLLM_TENSOR_PARALLEL_SIZE:-1}"
DTYPE="${HANASAND_VLLM_DTYPE:-float16}"
MAX_MODEL_LEN="${HANASAND_VLLM_MAX_MODEL_LEN:-32768}"
GPU_MEMORY_UTILIZATION="${HANASAND_VLLM_GPU_MEMORY_UTILIZATION:-0.92}"
MAX_NUM_SEQS="${HANASAND_VLLM_MAX_NUM_SEQS:-16}"
MAX_NUM_BATCHED_TOKENS="${HANASAND_VLLM_MAX_NUM_BATCHED_TOKENS:-4096}"
VLLM_VERSION="${HANASAND_VLLM_VERSION:-0.17.1}"
MODEL_CACHE_DIR="${HANASAND_MODEL_CACHE_DIR:-/var/lib/hanasand-model-cache}"
ENFORCE_EAGER="${HANASAND_VLLM_ENFORCE_EAGER:-1}"
ENABLE_PREFIX_CACHING="${HANASAND_VLLM_ENABLE_PREFIX_CACHING:-1}"

SERVER_PIDS=()
NODE_PID=""

cleanup() {
  echo "Stopping background processes..."
  if [ -n "${NODE_PID:-}" ]; then
    kill "$NODE_PID" 2>/dev/null || true
  fi
  for pid in "${SERVER_PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

wait_for_openai_server() {
  local port="$1"
  local retries="${HANASAND_MODEL_READY_RETRIES:-900}"
  local delay="${HANASAND_MODEL_READY_DELAY:-2}"

  for _ in $(seq 1 "$retries"); do
    if curl -fsS "http://127.0.0.1:${port}/v1/models" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done

  echo "Timed out waiting for vLLM OpenAI server on port ${port}."
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

  local model_apis="${HANASAND_MODEL_APIS:-}"
  if [ -z "$model_apis" ]; then
    for lane in $(seq 0 $((LANES - 1))); do
      local lane_port=$((MODEL_PORT + lane))
      if [ -n "$model_apis" ]; then
        model_apis="${model_apis},"
      fi
      model_apis="${model_apis}http://127.0.0.1:${lane_port}"
    done
  fi

  if need_cmd bun; then
    HANASAND_WEB_SEARCH=1 HANASAND_MODEL_BACKEND=vllm HANASAND_MODEL_PROFILE=inspur-v100-8x7b-vllm HANASAND_SERVED_MODEL_NAME="$SERVED_MODEL_NAME" HANASAND_MODEL_CONTEXT_MAX_TOKENS="$MAX_MODEL_LEN" MODEL_API="http://127.0.0.1:$MODEL_PORT" MODEL_APIS="$model_apis" bun src/index.ts &
  else
    HANASAND_WEB_SEARCH=1 HANASAND_MODEL_BACKEND=vllm HANASAND_MODEL_PROFILE=inspur-v100-8x7b-vllm HANASAND_SERVED_MODEL_NAME="$SERVED_MODEL_NAME" HANASAND_MODEL_CONTEXT_MAX_TOKENS="$MAX_MODEL_LEN" MODEL_API="http://127.0.0.1:$MODEL_PORT" MODEL_APIS="$model_apis" node src/index.ts &
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

if [ "$LANES" -lt 1 ] || [ "$LANES" -gt "$detected_gpus" ]; then
  echo "HANASAND_VLLM_LANES=${LANES} must be between 1 and detected GPU count ${detected_gpus}."
  exit 1
fi

if [ "$TENSOR_PARALLEL_SIZE" -ne 1 ] && [ "$LANES" -ne 1 ]; then
  echo "Multiple lanes require HANASAND_VLLM_TENSOR_PARALLEL_SIZE=1. Set HANASAND_VLLM_LANES=1 for tensor-parallel large-model mode."
  exit 1
fi

if [ ! -d "$VLLM_VENV" ]; then
  python3 -m venv "$VLLM_VENV"
fi

mkdir -p "$MODEL_CACHE_DIR/huggingface/hub" "$MODEL_CACHE_DIR/vllm" "$MODEL_CACHE_DIR/torchinductor"

if ! "$VLLM_VENV/bin/python" -c "import vllm, sys; sys.exit(0 if vllm.__version__ == '${VLLM_VERSION}' else 1)" >/dev/null 2>&1; then
  "$VLLM_VENV/bin/python" -m pip install --upgrade pip wheel 'setuptools>=77.0.3,<81.0.0'
  "$VLLM_VENV/bin/python" -m pip install "vllm==${VLLM_VERSION}"
else
  echo "vLLM ${VLLM_VERSION} already installed; skipping Python dependency install."
fi

export VLLM_WORKER_MULTIPROC_METHOD="${VLLM_WORKER_MULTIPROC_METHOD:-spawn}"
export PYTORCH_CUDA_ALLOC_CONF="${PYTORCH_CUDA_ALLOC_CONF:-expandable_segments:True}"
export VLLM_ATTENTION_BACKEND="${VLLM_ATTENTION_BACKEND:-TRITON_ATTN}"
export HF_HOME="${HF_HOME:-$MODEL_CACHE_DIR/huggingface}"
export HUGGING_FACE_HUB_CACHE="${HUGGING_FACE_HUB_CACHE:-$MODEL_CACHE_DIR/huggingface/hub}"
export VLLM_CACHE_ROOT="${VLLM_CACHE_ROOT:-$MODEL_CACHE_DIR/vllm}"
export TORCHINDUCTOR_CACHE_DIR="${TORCHINDUCTOR_CACHE_DIR:-$MODEL_CACHE_DIR/torchinductor}"

echo "Starting ${LANES} vLLM lane(s) ${VLLM_VERSION}: ${MODEL_REPO} as ${SERVED_MODEL_NAME}"
for lane in $(seq 0 $((LANES - 1))); do
  lane_port=$((MODEL_PORT + lane))
  echo "Starting lane ${lane} on GPU ${lane}, port ${lane_port}"
  VLLM_ARGS=(
    --model "$MODEL_REPO"
    --served-model-name "$SERVED_MODEL_NAME"
    --host 127.0.0.1
    --port "$lane_port"
    --tensor-parallel-size "$TENSOR_PARALLEL_SIZE"
    --dtype "$DTYPE"
    --max-model-len "$MAX_MODEL_LEN"
    --gpu-memory-utilization "$GPU_MEMORY_UTILIZATION"
    --max-num-seqs "$MAX_NUM_SEQS"
    --max-num-batched-tokens "$MAX_NUM_BATCHED_TOKENS"
    --trust-remote-code
  )

  if [ "$TENSOR_PARALLEL_SIZE" -gt 1 ]; then
    VLLM_ARGS+=(--disable-custom-all-reduce)
  fi

  if [ "$ENFORCE_EAGER" = "1" ]; then
    VLLM_ARGS+=(--enforce-eager)
  fi

  if [ "$ENABLE_PREFIX_CACHING" = "1" ]; then
    VLLM_ARGS+=(--enable-prefix-caching)
  fi

  CUDA_VISIBLE_DEVICES="$lane" "$VLLM_VENV/bin/python" -m vllm.entrypoints.openai.api_server "${VLLM_ARGS[@]}" &
  SERVER_PIDS+=("$!")
done

for lane in $(seq 0 $((LANES - 1))); do
  wait_for_openai_server "$((MODEL_PORT + lane))"
done

start_api_worker
wait -n "${SERVER_PIDS[@]}"
