# Share Request Workbench User Story

## Reddit-Derived Story

As a developer debugging an unfamiliar service through a shared terminal, I may only have a copied browser cURL, a vague error report that says "some item is blocked", and a deeply nested JSON response where the important id, owner, or status is buried several levels down. I want a lightweight request workbench inside the share page where I can paste the cURL, keep share-scoped variables, send the request through the connected terminal, inspect pretty, raw, searchable tree, header, and preview views, export the exact executed request back to cURL or `.http` text, and resend or delete prior requests without turning the tool into a cloud-synced API platform.

Acceptance:
- `/s` opens a stable `/s/{shareId}` URL so the workspace is recoverable.
- A user can define `baseUrl` in the request workbench and use `{{baseUrl}}` in the URL, headers, and body.
- Pasting a cURL command into the URL field decomposes its URL, method, headers, and body into the request form.
- The visible URL row shows the resolved full URL and preserves the template for editing.
- Sending `GET {{baseUrl}}/api/` with `baseUrl=https://api.hanasand.com` sends `https://api.hanasand.com/api/` through the share request route.
- Pasting `curl -X POST 'https://api.hanasand.com/api/' -H 'X-Debug: one' --data-raw '{"hello":"world"}'` sets method `POST`, URL `https://api.hanasand.com/api/`, header `X-Debug: one`, and body `{"hello":"world"}`.
- After a request runs, the response inspector exposes a `cURL` view with a self-contained cURL command for the exact executed method, URL, headers, and body.
- After a request runs, the response inspector exposes an `HTTP` view that can be pasted into a repo-owned `.http` request file.
- JSON responses render in a readable `Pretty` view while the exact body remains available in `Raw`.
- Nested JSON responses expose a filterable `Tree` view with stable paths for leaf values, such as `$.data.items[0].id`.
- The response body and headers remain inspectable, and image previews still appear for image responses or image URLs.
- Request history can resend the same templated request and delete entries without corrupting the original request.
- Invalid headers or missing variables surface as warnings instead of breaking the workbench.

E2E check:
- Open `/s`, confirm the browser lands on `/s/{shareId}`.
- Open Tool box, set `baseUrl`, run `{{baseUrl}}/api/`, verify the share request payload contains the resolved URL, verify the API welcome response renders, then resend from history and verify the second request uses the same resolved URL.
- Paste the cURL command above into the URL field and verify the request form decomposes the command before sending.
- Run that request, open the `cURL` response view, and verify the exported command includes the same method, URL, header, and body.
- Open the `HTTP` response view and verify it includes the request line, header, blank separator, and body as plain text suitable for a committed `.http` file.
- Verify the `Pretty` view formats JSON responses while `Raw` keeps the exact original response body.
- Verify the `Tree` view flattens a nested JSON response into useful paths, filters by path or value, and does not change the raw response or request exports.
