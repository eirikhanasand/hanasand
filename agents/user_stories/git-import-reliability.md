# Git Import Reliability User Stories

These stories are based on recurring complaints from Reddit, Stack Overflow, and GitLab community threads: SSH clone URLs fail with `Permission denied (publickey)`, browser/CI/non-interactive Git flows hide credential prompts as `terminal prompts disabled`, users cannot tell whether a repository is private or the vendor is down, and malformed-but-human-pasted URLs often collapse into generic failures.

## Evidence Themes

- Reddit users repeatedly paste `git@github.com:owner/repo` and see `Permission denied (publickey)` plus `fatal: Could not read from remote repository`, even when the repository is public or browser access works.
- Reddit and forum users report SSH authentication appearing to work with `ssh -T`, while `git clone` still fails because the actual clone path, key selection, agent state, SSO, or repo visibility is different.
- Stack Overflow and GitLab forum users hit `could not read Username ... terminal prompts disabled` in non-interactive environments where the product cannot ask for credentials.
- Reddit outage reports show users misdiagnosing remote 500/502 errors as local key or permission problems.

Sources:
- Reddit: https://www.reddit.com/r/github/comments/d9oozd/permission_denied_fatal_could_not_read_from_remote_repository/
- Reddit: https://www.reddit.com/r/git/comments/c457ml/git_submodule_gitgithubcom_permission_denied_publickey_error/
- Reddit: https://www.reddit.com/r/github/comments/1rmqdin/getting_permission_denied_publickey_but_it_seems/
- Reddit: https://www.reddit.com/r/github/comments/1i0sks6/github_is_down/
- GitLab Forum: https://forum.gitlab.com/t/fatal-could-not-read-username-for-gitlab-terminal-prompts-disabled/131509
- Stack Overflow: https://stackoverflow.com/questions/38556096/github-permission-denied-publickey-fatal-could-not-read-from-remote-reposit

## Stories

### 01. Pasted SSH URL Imports Public Repo

As a coder pasting the clone URL from a Git vendor, I want Hanasand to accept `git@host:owner/repo`, `git@host/owner/repo`, `ssh://git@host/owner/repo`, and `git+ssh://git@host/owner/repo` so public imports work without me understanding SSH key setup.

Acceptance:
- `git@git.hanasand.com/eirikhanasand/hanasand` normalizes to `https://git.hanasand.com/eirikhanasand/hanasand.git`.
- The correct SCP form normalizes the same way.
- `ssh://git@...` and `git+ssh://git@...` normalize to HTTPS for public import.
- GitHub SCP URLs continue to normalize to GitHub HTTPS.

### 02. Vendor Down Does Not Look Like My Fault

As a coder importing a real repo, I want vendor outages and reverse-proxy 5xx responses to show `Git server unavailable` so I do not spend time rotating keys or tokens for a server-side problem.

Acceptance:
- Git 502, 503, 504, host resolution, connection-refused, and failed-connect errors map to HTTP 503.
- The visible message says the Git server is unavailable and suggests retrying when the remote is reachable.
- The UI must not display `Internal server error` for these cases.

### 03. Private Repo Auth Failure Gives a Next Step

As a coder importing a private repository, I want non-interactive auth failures to tell me to check visibility or attach a token so I know what action to take.

Acceptance:
- `terminal prompts disabled`, `could not read Username`, `Authentication failed`, and `Could not read from remote repository` map to authentication guidance.
- The message differentiates auth from server downtime.
- Public generic Git vendors are not mislabeled as GitHub-only.

### 04. Progress Proves the Import Is Alive

As a coder importing a repo with many files, I want synced count, current file, language overview, and ETA while the editor workspace is being populated so I do not assume the import is stuck.

Acceptance:
- After remote Git fetch succeeds, the UI shows `syncedFiles / totalFiles`.
- ETA is displayed in seconds or minutes.
- Language overview appears under the sync component.
- Progress updates during file creation/update, not only after completion.

### 05. Real Repo Remains Editable After Import

As a coder importing from any Git vendor, I want the resulting workspace to behave like a normal editable project so the Git flow is not just a preview.

Acceptance:
- Project files are loaded into the share tree.
- The user can edit a loaded file.
- Git status can stage changed files, commit with a message, and push where credentials allow it.
- Auto-pull can be enabled or disabled and shows the last sync time.

## Regression Gate

Run `bun scripts/e2e-git-import-complaints.ts` from `api/` whenever the Git import parser, import endpoint, or share Git plugin changes.
