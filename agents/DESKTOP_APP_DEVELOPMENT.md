---
last_updated: 2026-04-26
purpose: Teach Hanasand agents how to independently continue the Hanasand and Nucleus native app work.
---

# Desktop App Development Playbook

This is the durable training note for agents working on the Hanasand desktop app and the Login/Nucleus app. Use it when the user asks for native app work, website parity, or a feature copied from the web product into an app.

## Prime Directive

When the user asks for a feature from the website to be implemented in an app, do not ask them for endpoint names, component names, or data shapes. Discover those yourself from the website code, API handlers, existing native app code, and tests. Then implement the smallest complete native version that preserves the website capability and fits the app's design system.

The expected behavior is: "Implement the share functionality from the website" should be enough information to find the web share implementation, identify the API contract, add the native API helpers/types/screen UI, persist any needed local settings, and verify it.

## Repositories And Roles

- Hanasand repo: `/Users/eirikhanasand/Desktop/personal/hanasand`
- Hanasand native app: `/Users/eirikhanasand/Desktop/personal/hanasand/app`
- Hanasand web frontend: `/Users/eirikhanasand/Desktop/personal/hanasand/frontend`
- Hanasand API: `/Users/eirikhanasand/Desktop/personal/hanasand/api`
- Nucleus app: `/Users/eirikhanasand/Desktop/Login/nucleus`
- Beehive website: `/Users/eirikhanasand/Desktop/Login/beehive`
- Hanasand dashboard frontend: `/Users/eirikhanasand/Desktop/personal/hanasand/frontend`
- Hanasand API: `/Users/eirikhanasand/Desktop/personal/hanasand/api`
- App notification API: `/Users/eirikhanasand/Desktop/Login/app_api`

Hanasand app and Nucleus are both Expo/React Native apps, but they have different design systems. Do not copy UI literally across them. Copy behavior and data contracts, then adapt to the target app's local primitives.

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

## Nucleus App Patterns

The Nucleus app lives in `/Users/eirikhanasand/Desktop/Login/nucleus`.

Key files:
- app entry/navigation: `src/components/nav/tabs.tsx`
- screen route types: `src/types/screenTypes.ts`
- shared layout: `src/components/shared/parent.tsx`, `src/components/shared/cluster.tsx`, `src/components/shared/text.tsx`
- shared marquee: `src/components/shared/marquee.tsx`
- Hanasand dashboard API helpers: `frontend/src/utils/**` and API handlers under `api/src/handlers/**`
- Beehive/discovery helpers: `src/utils/discoveryApi.ts`, `src/utils/fetch.ts`
- auth/profile helpers: `src/utils/auth.ts`, `src/utils/authProfile.ts`
- tests: `src/tests/*.test.ts`
- translations: `public/text/en.json`, `public/text/no.json`, and feature-specific text folders where present

Rules:
- Use existing shared components and style modules. Do not create full-width text walls or left/right text layouts on mobile.
- Every user-facing string added to a durable page needs English and Norwegian translations.
- Validate every endpoint response before mapping it. The previous `clients.map is not a function` bug came from trusting payload shape.
- Implement Hanasand functionality in this repo first. Do not route new dashboard work through Login, Queenbee, or Beekeeper.
- If implementing Beehive parity, inspect Beehive first, then move only the behavior and needed data into Nucleus.
- For long titles in compact list rows, use the shared `Marquee` component instead of letting text escape.
- For native navigation or deep linking, update both route types and navigation config.

Nucleus verification:

```bash
cd /Users/eirikhanasand/Desktop/Login/nucleus
npx tsc --noEmit
npm test -- --watchman=false
```

When native dependencies or platform config change:

```bash
cd /Users/eirikhanasand/Desktop/Login/nucleus
npx expo prebuild
npx expo install --check
eas build -p ios --local
```

## Website-To-App Porting Recipe

Use this recipe for features like share management, events, ads, music, status, logs, vulnerabilities, or dashboard tools.

1. Find the web feature.
   - Hanasand: search `frontend/src`.
   - Login public site: search `beehive/src`.
   - Hanasand dashboard: search `frontend/src`.
2. Find the API helper used by the web feature.
   - Hanasand share helpers are in `frontend/src/utils/share`.
   - Hanasand API routes are in `api/src/routes.ts` and `api/src/handlers`.
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

Nucleus:
- Login design language with existing shared components.
- Mobile-first, no side-by-side text layouts.
- Every durable string translated.
- Preserve footer/header/safe-area behavior.
- For Queenbee parity, prefer analytical collapsed sections with scan-friendly rows.

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
