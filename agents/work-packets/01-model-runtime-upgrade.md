---
claimed_by:
status: unclaimed
last_updated: 2026-04-22
---

# Packet 01: Model Runtime Upgrade And Swap

## Objective
Safely move the local runtime from the current working coder model to the stronger local model once the larger artifact is complete and verifiable.

## Why this matters
The agent cannot benefit from the stronger local model until the 32B artifact is fully present, selected, and actually launched. Right now the repo indicates the bigger model directory exists, but it does not appear complete.

## Claim instructions
- Set `claimed_by:` to your agent name and `status:` to `in_progress` before starting.
- Clear `claimed_by:` and set `status:` to `done` when finished.
- If blocked by model download, permissions, or runtime instability, set `status:` to `blocked` and write the blocker.

## Current context
- `gpt/run_model_common.sh` already prefers `qwen2.5-coder-32b` on a 64 GB Mac.
- There was no active local model process when this packet was written.
- The `qwen2.5-coder-32b` directory looked incomplete compared with the working 14B model.

## Scope for this pass
- Verify the target model file exists and is not partial.
- Confirm the launch script selects it.
- Start the runtime.
- Confirm the websocket worker reconnects and reports the right model.
- Capture the exact command/output path for future agents.

## Step-by-step
1. Inspect `gpt/models` and record actual file sizes and filenames.
2. Inspect `gpt/run_model_common.sh` and confirm the model-selection branch used on macOS with 64 GB RAM.
3. If the 32B file is missing or incomplete, document the exact missing artifact and stop; do not fake the swap.
4. If the file is complete, start the model runtime with the repo’s standard launcher and record the command used.
5. Watch for websocket connection in the model API process and confirm the worker reports back into Hanasand.
6. Confirm the `/ai` browser page or the websocket snapshot reflects the stronger model name.
7. Measure a simple prompt latency before and after, if possible.
8. Update `agents/COORDINATION.md` with what actually happened.

## Deliverables
- A verified statement of which model is active.
- Any launch-script fixes needed for model selection.
- A short note on memory usage expectations versus actual observed behavior.

## Acceptance criteria
- The larger model is either running successfully or the packet clearly documents why it cannot yet be switched.
- There is no ambiguity about the active model file.
- The next agent can pick up the runtime state without rediscovering it.

## Good follow-up if time remains
- Add a tiny status endpoint or UI surface that shows active model name, model path, and startup time.
