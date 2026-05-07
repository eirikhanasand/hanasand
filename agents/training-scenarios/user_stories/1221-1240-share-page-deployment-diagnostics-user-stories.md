# Share Page Deployment Diagnostic User Stories 1221-1240

Source alignment: these stories are based on recurring Reddit complaints from Vercel, Next.js, Cursor, and Claude Code users: missing build logs, env variables that work locally but fail in production, preview/staging drift, runtime logs not loading, agents guessing instead of collecting evidence, and users losing time to terminal-style context churn.

Objective: when a `/s` user describes deployment, build, env, log, preview, staging, production, edge, serverless, or runtime failures, Hanasand AI should enter diagnostic mode. It should collect the smallest useful evidence first instead of blindly editing files.

Strict success criteria for every story:

- The composer shows diagnostic mode before send.
- The model prompt contains deployment diagnostic instructions.
- The model context marks `diagnosticMode: true`.
- The response is visible within 2.5 seconds in the mocked user-story test.
- The response asks for concrete evidence: target URL, env scope, changed config/package files, exact logs, and smallest next check.
- No pending edit is created without evidence.
- Raw `hanasand-tool` tags never appear.

## Stories

1221. A Vercel user says build failed but build logs are missing. Hanasand should not invent a fix; it should ask for target and exact build/runtime evidence.

1222. Env vars work locally but production says undefined. The AI should distinguish local, preview, staging, and production env scopes before editing.

1223. Preview and production do not match. The AI should ask for both URLs and browser evidence before changing code.

1224. A Netlify deploy queue is stuck. The AI should identify platform/runtime evidence needed rather than editing app files.

1225. Staging redirects fail but local works. The AI should request target URL, rewrite config, and platform logs.

1226. Runtime logs load forever. The UI should keep the next check compact and concrete.

1227. An edge function fails only after deploy. The AI should ask for edge/runtime logs and route target before patching.

1228. A corporate reviewer needs deployment evidence first. The response should be structured and auditable.

1229. A designer says the preview is stale. The AI should verify the preview target instead of assuming code is wrong.

1230. A beginner says the website deployed but looks old. The AI should guide toward cache, target URL, and latest deployment evidence.

1231. An agency client says production is broken. The AI should avoid panic edits and collect minimal evidence.

1232. Support asks where the build error is. The AI should name the specific missing log/evidence.

1233. A founder demo link is down after deploy. The next step should be target URL plus deploy/runtime status.

1234. A pricing page deploy changed environment behavior. The AI should check env scope before touching pricing code.

1235. Mobile preview works but production mobile fails. The AI should require both targets and browser evidence.

1236. Compliance says do not expose secrets in logs. The AI should ask for redacted evidence and avoid broad secrets.

1237. A terminal agent kept guessing at the deploy bug. Hanasand should explicitly say no edit without evidence.

1238. A handoff agent needs the exact next deploy check. The diagnostic summary should make continuation easy.

1239. A client asks why Vercel succeeded but app errors. The AI should separate build success from runtime failure.

1240. Product owner asks whether the stories are real-world enough. Deployment diagnostics fill the gap between website editing and actual hosted-app operation.
