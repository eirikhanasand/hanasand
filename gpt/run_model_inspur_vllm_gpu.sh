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
MAX_NUM_SEQS="${HANASAND_VLLM_MAX_NUM_SEQS:-4}"
MAX_NUM_BATCHED_TOKENS="${HANASAND_VLLM_MAX_NUM_BATCHED_TOKENS:-2048}"
VLLM_VERSION="${HANASAND_VLLM_VERSION:-0.17.1}"
MODEL_CACHE_DIR="${HANASAND_MODEL_CACHE_DIR:-/var/lib/hanasand-model-cache}"
ENFORCE_EAGER="${HANASAND_VLLM_ENFORCE_EAGER:-1}"
ENABLE_PREFIX_CACHING="${HANASAND_VLLM_ENABLE_PREFIX_CACHING:-1}"
LANE_SPECS="${HANASAND_VLLM_LANE_SPECS:-}"
LANE_SPECS_FILE="${HANASAND_VLLM_LANE_SPECS_FILE:-}"
LANE_PLAN_FILE=""
MODEL_LANES_FILE=""

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
  if [ -n "${LANE_PLAN_FILE:-}" ]; then
    rm -f "$LANE_PLAN_FILE"
  fi
  if [ -n "${MODEL_LANES_FILE:-}" ]; then
    rm -f "$MODEL_LANES_FILE"
  fi
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

build_lane_plan() {
  local detected_gpus="$1"
  LANE_PLAN_FILE="$(mktemp)"
  MODEL_LANES_FILE="$(mktemp)"

  LANE_SPECS="$LANE_SPECS" \
  MODEL_PORT="$MODEL_PORT" \
  MODEL_REPO="$MODEL_REPO" \
  SERVED_MODEL_NAME="$SERVED_MODEL_NAME" \
  LANES="$LANES" \
  TENSOR_PARALLEL_SIZE="$TENSOR_PARALLEL_SIZE" \
  DTYPE="$DTYPE" \
  MAX_MODEL_LEN="$MAX_MODEL_LEN" \
  GPU_MEMORY_UTILIZATION="$GPU_MEMORY_UTILIZATION" \
  MAX_NUM_SEQS="$MAX_NUM_SEQS" \
  MAX_NUM_BATCHED_TOKENS="$MAX_NUM_BATCHED_TOKENS" \
  ENFORCE_EAGER="$ENFORCE_EAGER" \
  ENABLE_PREFIX_CACHING="$ENABLE_PREFIX_CACHING" \
  DETECTED_GPUS="$detected_gpus" \
  LANE_PLAN_FILE="$LANE_PLAN_FILE" \
  MODEL_LANES_FILE="$MODEL_LANES_FILE" \
  python3 - <<'PY'
import json
import os
import sys

detected = int(os.environ["DETECTED_GPUS"])
base_port = int(os.environ["MODEL_PORT"])
raw_specs = os.environ.get("LANE_SPECS", "").strip()

if raw_specs:
    try:
        specs = json.loads(raw_specs)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"HANASAND_VLLM_LANE_SPECS is not valid JSON: {exc}")
    if not isinstance(specs, list) or not specs:
        raise SystemExit("HANASAND_VLLM_LANE_SPECS must be a non-empty JSON array.")
else:
    specs = []
    lanes = int(os.environ["LANES"])
    for lane in range(lanes):
        specs.append({
            "id": f"fast-{lane}",
            "label": f"Fast lane {lane + 1}",
            "tier": "fast",
            "model": os.environ["MODEL_REPO"],
            "servedModelName": os.environ["SERVED_MODEL_NAME"],
            "port": base_port + lane,
            "gpus": [lane],
            "tensorParallelSize": int(os.environ["TENSOR_PARALLEL_SIZE"]),
            "dtype": os.environ["DTYPE"],
            "maxModelLen": int(os.environ["MAX_MODEL_LEN"]),
            "gpuMemoryUtilization": float(os.environ["GPU_MEMORY_UTILIZATION"]),
            "maxNumSeqs": int(os.environ["MAX_NUM_SEQS"]),
            "maxNumBatchedTokens": int(os.environ["MAX_NUM_BATCHED_TOKENS"]),
            "enforceEager": os.environ["ENFORCE_EAGER"] == "1",
            "enablePrefixCaching": os.environ["ENABLE_PREFIX_CACHING"] == "1",
            "routeWeight": 1,
        })

used_gpus = set()
plan_lines = []
model_lanes = []

for index, spec in enumerate(specs):
    if not isinstance(spec, dict):
        raise SystemExit(f"Lane spec {index} must be an object.")
    gpus = spec.get("gpus", [index])
    if isinstance(gpus, int):
        gpus = [gpus]
    gpus = [int(gpu) for gpu in gpus]
    if not gpus:
        raise SystemExit(f"Lane spec {index} needs at least one GPU.")
    for gpu in gpus:
        if gpu < 0 or gpu >= detected:
            raise SystemExit(f"Lane spec {index} uses GPU {gpu}, but detected GPUs are 0..{detected - 1}.")
        if gpu in used_gpus:
            raise SystemExit(f"GPU {gpu} is assigned to more than one lane.")
        used_gpus.add(gpu)

    tp = int(spec.get("tensorParallelSize", len(gpus)))
    if tp != len(gpus):
        raise SystemExit(f"Lane spec {index} tensorParallelSize={tp} must match GPU count {len(gpus)}.")

    port = int(spec.get("port", base_port + index))
    model = str(spec.get("model", os.environ["MODEL_REPO"]))
    served = str(spec.get("servedModelName", spec.get("served_model_name", os.environ["SERVED_MODEL_NAME"])))
    max_model_len = int(spec.get("maxModelLen", spec.get("max_model_len", os.environ["MAX_MODEL_LEN"])))
    max_num_seqs = int(spec.get("maxNumSeqs", spec.get("max_num_seqs", os.environ["MAX_NUM_SEQS"])))

    row = [
        str(index),
        str(spec.get("id", f"lane-{index}")),
        str(spec.get("label", f"Lane {index + 1}")),
        str(spec.get("tier", "fast")),
        model,
        served,
        str(port),
        ",".join(str(gpu) for gpu in gpus),
        str(tp),
        str(spec.get("dtype", os.environ["DTYPE"])),
        str(max_model_len),
        str(spec.get("gpuMemoryUtilization", spec.get("gpu_memory_utilization", os.environ["GPU_MEMORY_UTILIZATION"]))),
        str(max_num_seqs),
        str(spec.get("maxNumBatchedTokens", spec.get("max_num_batched_tokens", os.environ["MAX_NUM_BATCHED_TOKENS"]))),
        "1" if spec.get("enforceEager", os.environ["ENFORCE_EAGER"] == "1") else "0",
        "1" if spec.get("enablePrefixCaching", os.environ["ENABLE_PREFIX_CACHING"] == "1") else "0",
        str(spec.get("routeWeight", spec.get("route_weight", 1))),
    ]
    plan_lines.append("\t".join(row))
    model_lanes.append({
        "id": row[1],
        "label": row[2],
        "tier": "strong" if row[3] == "strong" else "fast",
        "model": model,
        "url": f"http://127.0.0.1:{port}",
        "gpuIndex": gpus[0],
        "gpuIndices": gpus,
        "maxRequests": max_num_seqs,
        "contextMaxTokens": max_model_len,
        "routeWeight": float(row[16]),
    })

open(os.environ["LANE_PLAN_FILE"], "w", encoding="utf-8").write("\n".join(plan_lines) + "\n")
open(os.environ["MODEL_LANES_FILE"], "w", encoding="utf-8").write(json.dumps(model_lanes, separators=(",", ":")))
PY
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
    while IFS=$'\t' read -r _index _id _label _tier _model _served lane_port _gpus _tp _dtype _max_len _util _max_seqs _max_tokens _eager _prefix _weight; do
      if [ -n "$model_apis" ]; then
        model_apis="${model_apis},"
      fi
      model_apis="${model_apis}http://127.0.0.1:${lane_port}"
    done < "$LANE_PLAN_FILE"
  fi
  local model_lanes
  model_lanes="$(cat "$MODEL_LANES_FILE")"

  if need_cmd bun; then
    HANASAND_WEB_SEARCH=1 HANASAND_MODEL_BACKEND=vllm HANASAND_MODEL_PROFILE="${HANASAND_MODEL_PROFILE:-inspur-v100-mixed-vllm}" HANASAND_SERVED_MODEL_NAME="$SERVED_MODEL_NAME" HANASAND_MODEL_CONTEXT_MAX_TOKENS="$MAX_MODEL_LEN" MODEL_API="http://127.0.0.1:$MODEL_PORT" MODEL_APIS="$model_apis" MODEL_LANES="$model_lanes" bun src/index.ts &
  else
    HANASAND_WEB_SEARCH=1 HANASAND_MODEL_BACKEND=vllm HANASAND_MODEL_PROFILE="${HANASAND_MODEL_PROFILE:-inspur-v100-mixed-vllm}" HANASAND_SERVED_MODEL_NAME="$SERVED_MODEL_NAME" HANASAND_MODEL_CONTEXT_MAX_TOKENS="$MAX_MODEL_LEN" MODEL_API="http://127.0.0.1:$MODEL_PORT" MODEL_APIS="$model_apis" MODEL_LANES="$model_lanes" node src/index.ts &
  fi
  NODE_PID=$!
}

if ! need_cmd nvidia-smi; then
  echo "nvidia-smi is required; refusing to run the GPU-native model server without NVIDIA GPUs."
  exit 1
fi

if [ -n "$LANE_SPECS_FILE" ]; then
  LANE_SPECS="$(cat "$LANE_SPECS_FILE")"
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

if [ -z "$LANE_SPECS" ] && { [ "$LANES" -lt 1 ] || [ "$LANES" -gt "$detected_gpus" ]; }; then
  echo "HANASAND_VLLM_LANES=${LANES} must be between 1 and detected GPU count ${detected_gpus}."
  exit 1
fi

if [ -z "$LANE_SPECS" ] && [ "$TENSOR_PARALLEL_SIZE" -ne 1 ] && [ "$LANES" -ne 1 ]; then
  echo "Multiple lanes require HANASAND_VLLM_TENSOR_PARALLEL_SIZE=1. Set HANASAND_VLLM_LANES=1 for tensor-parallel large-model mode."
  exit 1
fi

build_lane_plan "$detected_gpus"

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
export HF_HOME="${HF_HOME:-$MODEL_CACHE_DIR/huggingface}"
export HUGGING_FACE_HUB_CACHE="${HUGGING_FACE_HUB_CACHE:-$MODEL_CACHE_DIR/huggingface/hub}"
export VLLM_CACHE_ROOT="${VLLM_CACHE_ROOT:-$MODEL_CACHE_DIR/vllm}"
export TORCHINDUCTOR_CACHE_DIR="${TORCHINDUCTOR_CACHE_DIR:-$MODEL_CACHE_DIR/torchinductor}"

echo "Starting vLLM lane plan (${VLLM_VERSION})"
while IFS=$'\t' read -r lane lane_id lane_label lane_tier lane_model lane_served lane_port lane_gpus lane_tp lane_dtype lane_max_len lane_gpu_util lane_max_seqs lane_max_batched_tokens lane_eager lane_prefix _lane_weight; do
  echo "Starting ${lane_tier} lane ${lane_id} (${lane_label}) on GPU(s) ${lane_gpus}, port ${lane_port}: ${lane_model}"
  VLLM_ARGS=(
    --model "$lane_model"
    --served-model-name "$lane_served"
    --host 127.0.0.1
    --port "$lane_port"
    --tensor-parallel-size "$lane_tp"
    --dtype "$lane_dtype"
    --max-model-len "$lane_max_len"
    --gpu-memory-utilization "$lane_gpu_util"
    --max-num-seqs "$lane_max_seqs"
    --max-num-batched-tokens "$lane_max_batched_tokens"
    --trust-remote-code
  )

  if [ "$lane_tp" -gt 1 ]; then
    VLLM_ARGS+=(--disable-custom-all-reduce)
  fi

  if [ "$lane_eager" = "1" ]; then
    VLLM_ARGS+=(--enforce-eager)
  fi

  if [ "$lane_prefix" = "1" ]; then
    VLLM_ARGS+=(--enable-prefix-caching)
  fi

  CUDA_VISIBLE_DEVICES="$lane_gpus" "$VLLM_VENV/bin/python" -m vllm.entrypoints.openai.api_server "${VLLM_ARGS[@]}" &
  SERVER_PIDS+=("$!")
done < "$LANE_PLAN_FILE"

while IFS=$'\t' read -r _lane _id _label _tier _model _served lane_port _gpus _tp _dtype _max_len _gpu_util _max_seqs _max_batched_tokens _eager _prefix _weight; do
  wait_for_openai_server "$lane_port"
done < "$LANE_PLAN_FILE"

start_api_worker
wait -n "${SERVER_PIDS[@]}"
