# Code review index state

This directory stores generated state for the live code review indexer. The
indexer reads the Hanasand Git repository from a bare mirror in
ops/code-review/repository.git and publishes its inventory under
ops/code-review/published. The app containers mount the published directory
read-only.

Both paths are runtime data and are excluded from Git: the mirror is nearly
1 GB and the generated inventory is tens of MB. Deployment scripts and indexer
code live in the main project. Run
scripts/resilience/deploy-code-indexer.sh from the project root to initialize
or refresh the indexer.
