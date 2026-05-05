# Inspur GPU Model Host

This host is intended to run the Hanasand model server directly on the machine, not inside Docker, so vLLM can use all 8 NVIDIA V100 GPUs through the host CUDA driver. Docker Compose can start only the Hanasand GPT worker that joins the public pool and forwards prompts to the host model endpoint.

## First-time host bootstrap

Run this once after provisioning or recovering the server:

```sh
./scripts/bootstrap-inspur-gpu-host.sh
```

The bootstrap installs Ubuntu NVIDIA server driver packages, CUDA compiler tooling, NVIDIA Container Toolkit, blacklists `nouveau`, validates that `nvidia-smi` sees 8 GPUs, writes `hanasand-model.service`, creates the host model cache volume, and validates Docker GPU access with a CUDA `nvidia-smi` container.

If the driver install succeeds but the GPUs do not appear immediately, reboot the host and rerun the script.

## Start the model server

```sh
sudo systemctl start hanasand-model.service
systemctl status hanasand-model.service
curl -s http://127.0.0.1:18081/slots
```

The service runs:

```sh
gpt/run_model_inspur_vllm_gpu.sh
```

That launcher refuses to fall back to CPU. It requires exactly 8 NVIDIA GPUs and serves `Qwen/Qwen3-Coder-30B-A3B-Instruct` as `hanasand` with a 65,536 token context by default. The older llama.cpp launcher remains as a fallback at `gpt/run_model_inspur_gpu.sh`.

## Join the Hanasand pool

The systemd service already starts the pool worker after vLLM is ready. If you specifically want to run only the worker via Compose against an already-running host model endpoint:

```sh
docker compose -f docker-compose.yml -f docker-compose.inspur-gpu.yml up -d
```

The `gpt_worker` service uses host networking and connects to:

```sh
API=https://api.hanasand.com/api
MODEL_API=http://127.0.0.1:18081
```

Verify from the public API host:

```sh
curl -s https://api.hanasand.com/api/ai/models
```

The Inspur client should be connected with non-error model metrics and should become the preferred worker once it has the highest observed `tps`.
