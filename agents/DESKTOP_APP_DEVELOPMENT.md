---
last_updated: 2026-04-26
purpose: Teach Hanasand agents how to independently continue the Hanasand native app work.
---

# Desktop App Development Playbook

This is the durable training note for agents working on the Hanasand desktop app. Use it when the user asks for native app work, website parity, or a feature copied from the web product into an app.

## Prime Directive

When the user asks for a feature from the website to be implemented in an app, do not ask them for endpoint names, component names, or data shapes. Discover those yourself from the website code, API handlers, existing native app code, and tests. Then implement the smallest complete native version that preserves the website capability and fits the app's design system.

The expected behavior is: "Implement the share functionality from the website" should be enough information to find the web share implementation, identify the API contract, add the native API helpers/types/screen UI, persist any needed local settings, and verify it.

## Repositories And Roles

- Hanasand repo: `/Users/eirikhanasand/Desktop/personal/hanasand`
- Hanasand native app: `/Users/eirikhanasand/Desktop/personal/hanasand/app`
- Hanasand web frontend: `/Users/eirikhanasand/Desktop/personal/hanasand/frontend`
- Hanasand API: `/Users/eirikhanasand/Desktop/personal/hanasand/api`

Hanasand app, dashboard, and API work stays in this repository. Recreate needed behavior here from the Hanasand web/API surface instead of routing work through another product repo.

## First Ten Minutes

1. Run `git status --short` in the target repo and preserve unrelated user changes.
2. Identify the source website feature with `rg`, starting from human words in the request.
3. Trace the feature in this order:
   - website screen/component
   - website utility/API helper
   - backend route/handler
   - shared type definitions
   - existing native app analogue
4. Validate the endpoint shape before writing UI. Use the helper implementation, route handler, and types; if a live call is practical, smoke it with auth headers from existing settings.
5. Implement the native helper and types first, then the screen/component.
6. Add focused tests where the codebase already has tests or the data transformation is nontrivial.
7. Run the target app's typecheck/lint/test/build commands from the correct directory.

## Hanasand Native App Patterns

The Hanasand native app lives in `app/`.

Key files:
- app entry: `app/src/App.tsx`
- shared UI primitives: `app/src/components/ui.tsx`
- settings drawer: `app/src/components/SettingsDrawer.tsx`
- API helpers: `app/src/lib/api.ts`
- persisted settings: `app/src/lib/storage.ts`
- app types: `app/src/types.ts`
- theme tokens/context: `app/src/theme/tokens.ts`, `app/src/theme/context.tsx`
- screens: `app/src/screens/*.tsx`

Rules:
- Use `Screen`, `GlassCard`, `SectionTitle`, `PillButton`, `NativeTile`, and `LabeledInput` before adding new primitives.
- Use `useAppTheme()` for colors. Do not add new hardcoded hex values unless a native API requires them.
- Add API calls to `app/src/lib/api.ts`, validate response shape defensively, and throw useful `Error` messages.
- Add app-level types to `app/src/types.ts` instead of scattering anonymous objects through screens.
- Persist user-configurable values through `AppSettings`, `defaultSettings`, and `AsyncStorage` in `app/src/lib/storage.ts`.
- Keep the app compact and operational. This app is a personal control surface, not a marketing page.

Hanasand verification:

```bash
cd /Users/eirikhanasand/Desktop/personal/hanasand/app
npm run typecheck
npm run lint
```

## Reinstall Hanasand Desktop After UI Text Changes

Use this when the user needs the macOS Hanasand Desktop app refreshed after a SwiftUI copy or UI text edit.

1. Preserve user work first:

```bash
cd /Users/eirikhanasand/Desktop/personal/hanasand
git status --short
```

Do not reset or revert unrelated dirty files. If `app/desktop/Sources/Hanasand/Hanasand.swift` is dirty, read the relevant area and work with the current content.

2. Verify the desired login copy exists in source:

```bash
rg -n 'Forgot password\?' app/desktop/Sources/Hanasand/Hanasand.swift
```

3. Build the release app through the repo packaging workflow. Keep SwiftPM and Clang caches in `/tmp` so phone-to-Mac or sandboxed agent runs do not fail on `~/.cache` permissions:

```bash
mkdir -p /tmp/hanasand-swift-cache /tmp/hanasand-clang-module-cache
CLANG_MODULE_CACHE_PATH=/tmp/hanasand-clang-module-cache \
SWIFTPM_HOME=/tmp/hanasand-swift-cache \
HANASAND_APP_VERSION=<next-version> \
HANASAND_APP_RELEASE_NOTES='Refresh login screen copy after UI text change.' \
app/desktop/scripts/package-update.sh
```

This recreates `app/desktop/dist/Hanasand.app`, `app/desktop/dist/Hanasand-<next-version>-macos.zip`, `app/desktop/dist/latest-macos.zip`, and `app/desktop/dist/manifest.json`.

4. Reinstall the app bundle from the rebuilt repo artifact:

```bash
ditto app/desktop/dist/Hanasand.app /Applications/Hanasand.app
```

If the current agent sandbox blocks writes to `/Applications`, do not force it with destructive commands. Launch or verify `app/desktop/dist/Hanasand.app` directly, record the block, and leave the rebuilt bundle/package ready for a host-side reinstall.

5. Relaunch and verify the installed/runnable executable contains the current login copy:

```bash
open -n /Applications/Hanasand.app
strings /Applications/Hanasand.app/Contents/MacOS/Hanasand | rg 'Forgot password\?'
```

When `/Applications` could not be updated, verify the rebuilt runnable bundle instead:

```bash
strings app/desktop/dist/Hanasand.app/Contents/MacOS/Hanasand | rg 'Forgot password\?'
```

When native dependencies or platform configuration change:

```bash
cd /Users/eirikhanasand/Desktop/personal/hanasand/app
npx expo prebuild
npx expo install --check
```

## Website-To-App Porting Recipe

Use this recipe for features like share management, events, ads, music, status, logs, vulnerabilities, or dashboard tools.

1. Find the web feature.
   - Hanasand: search `frontend/src`.
   - Hanasand dashboard: search `frontend/src`.
2. Find the API helper used by the web feature.
   - Hanasand share helpers are in `frontend/src/utils/share`.
   - Hanasand API helpers and routes are under `frontend/src/utils`, `api/src/handlers`, and `api/src/routes.ts`.
3. Find the exact request contract.
   - Look for URL, method, headers, query params, body, and response shape.
   - Read backend handlers when available.
   - Check shared types and API smoke tests.
4. Implement native API helpers.
   - Add headers from app settings/profile.
   - Decode/normalize token values the same way the website does if needed.
   - Return a stable array/object even when the server response is malformed.
   - Throw `Error` with the server error text when requests fail.
5. Implement native UI.
   - Start from the target app's existing primitives.
   - Preserve actions the website has, but compress for mobile.
   - Add empty, loading, error, and success states.
6. Verify.
   - Typecheck/lint.
   - Run focused Jest tests when helpers or transforms changed.
   - Use simulator/build checks when native dependencies or navigation changed.

## Concrete Example: Share Functionality

If asked to implement website share functionality in the Hanasand native app, this is the path:

Source web files:
- `frontend/src/utils/share/getUserShares.ts`
- `frontend/src/utils/share/post.ts`
- `frontend/src/utils/share/put.ts`
- `frontend/src/utils/share/delete.ts`
- `frontend/src/utils/share/lockShare.ts`
- `frontend/src/utils/share/getTree.ts`
- `frontend/src/components/share/dashboard/dashboardShare.tsx`
- `frontend/src/components/share/dashboard/projects.tsx`
- `frontend/src/components/share/files/openFiles.tsx`

Existing native foothold:
- `app/src/lib/api.ts` already has `fetchUserShares` and `createShare`.
- `app/src/screens/ControlScreen.tsx` already has a small share creator.
- `app/src/types.ts` has `ShareSummary`.
- settings include `cdnBaseUrl`, `authToken`, and `userId`.

Expected complete native capability:
- List the user's shares from `GET {cdnBaseUrl}/share/user/{userId}`.
- Create a share with `POST {cdnBaseUrl}/share`.
- Edit name/path/content/type with `PUT {cdnBaseUrl}/share/{id}`.
- Delete a share with the website's delete endpoint.
- Lock/unlock a share if the website supports it.
- Show tree/files when `includeTree` or tree endpoints are part of the website flow.
- Use `Authorization: Bearer {authToken}` and `id: {userId}` headers.
- Support loading, empty, error, edit, saved, and delete-confirmation states.
- Keep the UI inside Hanasand's compact `GlassCard`/`NativeTile` language.

Minimum verification for that scenario:

```bash
cd /Users/eirikhanasand/Desktop/personal/hanasand/app
npm run typecheck
npm run lint
```

If helper parsing is nontrivial, add a small pure parser function and test it rather than testing the whole screen manually.

## Endpoint Shape Rules

- Never call `.map`, `.filter`, or property chains on unknown JSON without checking with `Array.isArray` or a small normalizer.
- Treat website helpers as the first contract, backend handlers as the source of truth, and live responses as smoke verification.
- If the API returns either a string error or an object, normalize before rendering.
- Preserve auth headers exactly: many services expect both bearer token and `id`.
- Keep user-facing errors short. Log or inspect detail during development, but do not dump raw payloads into the UI.

## Design Rules For The Apps

Hanasand app:
- Dark operational control surface.
- Compact cards and utility rows.
- Theme-aware colors through `useAppTheme`.
- No landing-page composition.

## Done Criteria

A feature is not done until:
- the target app can reach the same underlying data/actions as the website;
- endpoint shapes are validated before rendering;
- the UI has loading/empty/error states;
- auth/session behavior matches the website;
- translations are added in Nucleus when applicable;
- typecheck passes;
- lint passes when the repo has lint;
- tests are added or updated when a helper, parser, transform, route, or regression-prone flow changed;
- any unfinished follow-up is documented in `agents/COORDINATION.md`.
