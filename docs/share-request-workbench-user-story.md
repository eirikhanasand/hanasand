# Share Request Workbench User Story

## Reddit-Derived Story

As a developer who likes Postman for quick API work but dislikes account gates, bloat, and unreliable duplication, I want a lightweight request workbench inside the share page where I can keep a small set of share-scoped variables, send a request through the connected terminal, inspect the body/headers/preview, and resend or delete prior requests without losing the exact working setup.

Acceptance:
- `/s` opens a stable `/s/{shareId}` URL so the workspace is recoverable.
- A user can define `baseUrl` in the request workbench and use `{{baseUrl}}` in the URL, headers, and body.
- The visible URL row shows the resolved full URL and preserves the template for editing.
- Sending `GET {{baseUrl}}/api/` with `baseUrl=https://api.hanasand.com` sends `https://api.hanasand.com/api/` through the share request route.
- The response body and headers remain inspectable, and image previews still appear for image responses or image URLs.
- Request history can resend the same templated request and delete entries without corrupting the original request.
- Invalid headers or missing variables surface as warnings instead of breaking the workbench.

E2E check:
- Open `/s`, confirm the browser lands on `/s/{shareId}`.
- Open Tool box, set `baseUrl`, run `{{baseUrl}}/api/`, verify the share request payload contains the resolved URL, verify the API welcome response renders, then resend from history and verify the second request uses the same resolved URL.
