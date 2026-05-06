# Share Request Tool E2E User Stories 361-380

These stories target the `/s` request workbench as a real debugging tool, not a demo panel. They assume a user may not know whether the bug is in their app, their headers, the connected terminal, the request tool, or the generated project. The agent should investigate through the request tool, avoid jumping straight to a solution, and leave the tool functional after every failed request.

## 361. Frontend API Smoke Debug
As a user with a generated frontend and API, I want to run `GET /health` from the workbench, see the full request URL, and understand whether the frontend or API is broken.

Acceptance:
- The story starts with a Next.js frontend calling a Fastify API through Docker.
- The agent runs the request from the workbench, confirms status, body, headers, and latency, then explains what the UI should show next.
- The full URL is visible in the workbench even when the panel is narrow.

## 362. Invalid Bearer Header Recovery
As a user who pasted a bad Authorization header, I want the workbench to skip the invalid header and still send the request.

Acceptance:
- The request includes `Authorization: Bearer osbvuwavaa+wdvhapw9pvhrv9+p3vpja3jv9a3j+jååjdojvåq30v39r+v9a`.
- The tool does not fail with `Header has invalid value`.
- The response shows a warning that the invalid header was skipped, not a raw token.

## 363. Unneeded Auth Header Investigation
As a user testing a public endpoint, I want the agent to notice that no bearer token is needed before blaming the API.

Acceptance:
- The endpoint works without auth and may reject irrelevant auth.
- The agent reruns once without the unnecessary header, compares the outcomes, and explains the difference.
- The request history keeps both attempts easy to resend.

## 364. AI Response Explanation
As a user who clicks the AI tab after a failed request, I want an explanation and a next request suggestion.

Acceptance:
- The AI tab shows a loading state.
- The final answer includes the active URL, status/error, likely cause, and one next request to try.
- If AI is unavailable, the user sees a retryable message instead of an empty panel.

## 365. Broken UI Data Shape
As a user whose UI renders blank cards, I want the request tool to prove whether the API body shape matches the component.

Acceptance:
- The agent requests the frontend’s expected API endpoint.
- The agent compares returned JSON fields with the UI component’s field names.
- The fix changes the smallest component or API mapping needed.

## 366. CORS Versus VM Request
As a user confused by browser CORS errors, I want the workbench to explain when a request ran from the browser versus the share VM.

Acceptance:
- The same URL is tried in browser mode and share VM mode when available.
- The response source is visible.
- The agent explains whether the target service or browser policy caused the failure.

## 367. Image Preview Debug
As a user testing image URLs, I want the workbench to show a preview when the response is an image.

Acceptance:
- The agent requests an image URL and checks content type.
- The preview tab displays the image.
- If the URL returns HTML or an error image, the agent explains the mismatch.

## 368. POST Body Validation
As a user testing a form flow, I want the agent to send an invalid POST first, read the validation error, then send the corrected payload.

Acceptance:
- The history shows both attempts.
- The response panel surfaces the validation body.
- The agent does not edit the app until it proves whether validation is expected.

## 369. Docker Port Mismatch
As a user whose preview is blank, I want the agent to use the request tool to find whether the API is listening on the expected port.

Acceptance:
- The agent checks `/health` on the configured port.
- If the port is wrong, the agent inspects Docker/compose config and fixes the mapping.
- The final verification uses the workbench request and the browser preview.

## 370. Slow Endpoint Feedback
As a user hitting a slow endpoint, I want the workbench to show that the request is running and then show latency.

Acceptance:
- Running requests are visible.
- Completed requests show latency.
- A timeout is explained as timeout, not as a generic broken UI.

## 371. Header History Cleanup
As a user resending previous requests, I want old bad headers to be skipped safely.

Acceptance:
- A request loaded from history with an invalid header value can be resent.
- The visible request details redact sensitive values.
- The response warning tells the user what was skipped.

## 372. Wrong Content Type
As a user whose API rejects JSON, I want the agent to check `Content-Type` before changing backend code.

Acceptance:
- The first request omits or missets `Content-Type`.
- The agent reads the response, adds the header, and reruns.
- The final answer explains that the request was wrong, not the app.

## 373. Empty Response Body
As a user seeing no response body, I want the workbench to make clear whether the endpoint returned empty content or the tool hid it.

Acceptance:
- The response tab says `No response body.` for true empty responses.
- Headers and status remain visible.
- The agent uses status and headers to decide the next step.

## 374. Redirect Chain Debug
As a user testing login redirects, I want the agent to identify redirect behavior and the final URL.

Acceptance:
- The request records status, location header, and visible URL.
- The agent follows or manually requests the next URL when needed.
- The explanation distinguishes expected auth redirect from broken routing.

## 375. API Contract Drift
As a user whose frontend says “undefined”, I want the agent to compare old and current API contracts.

Acceptance:
- The agent uses history to resend the last known-good endpoint.
- The agent compares response keys.
- The fix includes a small compatibility layer or a backend response correction.

## 376. Share VM Offline
As a user without a connected terminal, I want the workbench to degrade gracefully.

Acceptance:
- The tool says the share VM is unavailable and offers browser/API mode when possible.
- No request silently disappears.
- AI explains what connection state needs to be fixed.

## 377. Multiple Concurrent Requests
As a user comparing endpoints, I want to run more than one request and switch between results.

Acceptance:
- Concurrent requests remain visible as separate runs.
- Switching runs preserves each response body, headers, status, URL, and warnings.
- Resending a failed run does not overwrite unrelated results.

## 378. Generated Service Debug Session
As a user, I want the agent to build a small service with frontend and API, then debug it through the request workbench as if I reported a broken UI.

Acceptance:
- The generated project has a frontend page, API route/service, Dockerfile, compose file, and health endpoint.
- The agent first reproduces the UI problem, then probes the API with the request tool.
- The final fix is verified through both UI and request workbench.

## 379. Misleading Tool Error Guardrail
As a user, I want tool errors to identify themselves so I do not blame my service for a broken request tool.

Acceptance:
- Invalid local headers, CORS failures, VM offline, and AI unavailable are labeled as tool/setup issues.
- Target HTTP 4xx/5xx responses are labeled as service responses.
- The AI tab uses that distinction in its explanation.

## 380. End-to-End Recovery Review
As a product reviewer, I want a full story where setup, failed request, AI explanation, rerun, code fix, redeploy, and final verification all happen without losing the workbench state.

Acceptance:
- The user starts from `/s/{id}` and can return to the same URL.
- Request history supports resend and delete.
- The final verification includes a browser UI check, a request tool check, and a short review of what failed and why.
