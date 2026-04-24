# Local Model Draft

Source:
- model: local `Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf`
- runtime: `llama.cpp` on `http://127.0.0.1:8081`
- requested by: codex
- packet: `20-release-runbook`
- status: draft for human or agent refinement

---

# Hanasand Agent Workspace Release Runbook - Packet 20

## Current Working Capabilities
- **Browser/AI Workspace**: Fully functional.
- **Share-backed Next.js + Docker Starter**: Exists and can be used for development.
- **Local Model Runtime**: Uses llama.cpp.
- **14B Local Model**: Available and ready for use.
- **32B Artifact**: Incomplete.
- **Docker Scaffolds**: Exists.
- **Compose Tools**: `up`, `logs`, `down` are functional.

## Startup Sequence
1. **Clone the Repository**: Ensure you have the latest version of the repository.
2. **Navigate to the Project Directory**: Use `cd` to go to the project root.
3. **Build the Docker Containers**: Run `docker-compose up --build` to build and start the containers.
4. **Verify Startup**: Check the logs using `docker-compose logs` to ensure all services are running without errors.

## Verification Sequence
1. **Check Browser/AI Workspace**: Open the workspace in a browser and ensure it loads correctly.
2. **Test Local Model Runtime**: Run a test command using llama.cpp to ensure the 14B model is operational.
3. **Docker Services**: Verify that all Docker services are up and running using `docker-compose ps`.
4. **Check Logs**: Review logs for any errors or warnings using `docker-compose logs`.

## Troubleshooting
- **Sandbox-exec Fallback Issue**: If local command helpers are not working, try using the sandbox-exec fallback as a temporary workaround.
- **Docker Issues**: If containers do not start, check Docker daemon status and ensure all dependencies are installed.
- **Model Errors**: If the 14B model fails to load, verify the model files and ensure they are correctly placed in the expected directory.

## Known Blockers
- **32B Artifact Incomplete**: The 32B model artifact is not yet complete and may cause issues if attempted to use.
- **Sandbox-exec Fallback**: The sandbox-exec fallback is a temporary solution and may not be ideal for long-term use.

## Next Packets to Pick Up
- **Packet 21**: Focus on completing the 32B model artifact and integrating it into the workspace.
- **Packet 22**: Enhance the local model runtime to support additional models and optimize performance.
- **Packet 23**: Improve the Docker setup for easier deployment and scalability.

## Handoff Section
- **Next Agent**: [Agent Name]
- **Key Tasks**: Complete the 32B model artifact and integrate it into the workspace.
- **Communication**: Use the coordination file in this repo for updates.
- **Review**: Refine this runbook against the actual packet list before marking complete.

---

This runbook provides a clear and actionable guide for the next agent to ensure smooth operation and progress of the Hanasand Agent Workspace.
