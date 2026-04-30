---
last_updated: 2026-04-26
scenario: website-share-functionality-to-native-app
status: active-training-check
---

# Training Scenario: Port Share Functionality To A Native App

Use this scenario to check whether an agent can continue Hanasand/Nucleus native app development without extra human guidance.

## User Prompt To Handle

> Implement the share functionality from the website in the Hanasand desktop app.

## Expected Agent Behavior

The agent should independently discover:
- the website share UI under `frontend/src/components/share`;
- website share API helpers under `frontend/src/utils/share`;
- CDN share contracts:
  - `GET /share/user/:id`
  - `POST /share`
  - `PUT /share/:id`
  - delete endpoint used by `frontend/src/utils/share/delete.ts`
  - lock endpoint used by `frontend/src/utils/share/lockShare.ts`
  - tree/file endpoints used by `frontend/src/utils/share/getTree.ts` and related file components;
- Hanasand app helper foothold in `app/src/lib/api.ts`;
- Hanasand app screen foothold in `app/src/screens/ControlScreen.tsx`;
- Hanasand app settings fields for `cdnBaseUrl`, `authToken`, and `userId`.

The agent should not ask the user for endpoint names, payload shapes, or where the website code lives.

## Minimum Implementation Plan

1. Add or extend share types in `app/src/types.ts`.
2. Extend share helpers in `app/src/lib/api.ts`:
   - list shares;
   - create share;
   - update share;
   - delete share;
   - lock/unlock share if present in the website contract;
   - fetch tree/files if present in the website contract.
3. Replace the small share creator in `ControlScreen` with a compact share manager:
   - refresh/list;
   - empty state;
   - selected share details;
   - create/edit/delete;
   - lock/unlock;
   - visible URL/path/alias;
   - useful error state.
4. Use `useAppTheme()` and existing Hanasand primitives.
5. Validate unknown JSON before rendering.
6. Run verification.

## Acceptance Criteria

- The native app can create and list shares using the same backend contract as the website.
- Existing user shares render without crashing when the response is empty, malformed, or unauthenticated.
- The UI does not ask the user to paste implementation details that can be found in the repo.
- The agent records any endpoint ambiguity in `agents/COORDINATION.md` only after source inspection fails.
- `npm run typecheck` passes in `app`.
- `npm run lint` passes in `app`.

## Failure Modes To Avoid

- Calling `.map` on raw JSON before `Array.isArray`.
- Recreating a separate share API instead of using the existing CDN contract.
- Hardcoding token/user IDs.
- Copying web layout directly into the native app.
- Adding a new design system when `components/ui.tsx` already has the needed primitives.
- Treating "desktop app" as the Next.js website.

