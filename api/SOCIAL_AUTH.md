# Google and Apple sign-in

Existing users connect a provider under **Profile → Account**, while signed in with their current method. Thereafter the login-page provider button signs into that same account. New users use the existing sign-up flow first. Email addresses and display names never select or merge accounts; a unique provider + subject identity does. Existing roles, inactive-account checks and session expiry still apply.

Server-only configuration on authentication workers:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google Cloud OAuth web application credentials. Enable/configure the consent screen and register `https://hanasand.com/api/auth/social/google/callback` as an authorized redirect URI.
- `APPLE_CLIENT_ID`: Apple Services ID associated with a Sign in with Apple-enabled primary App ID.
- `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`: Apple developer team, key identifier and private .p8 key (PEM; escaped newlines are also accepted). Register `hanasand.com` and `https://hanasand.com/api/auth/social/apple/callback` in the Services ID web configuration. Client-secret JWTs are signed on demand and expire after five minutes.
- `SOCIAL_AUTH_ORIGIN`: optional fixed HTTPS origin, defaults to `https://hanasand.com`. If overridden, set the same value on the frontend and register both callback URLs at that origin. Never derive callback origins from incoming Host headers.

Keep credentials in the server's existing secret/environment provisioning, never in git or `NEXT_PUBLIC_*`. The resilience deployment inherits authentication settings from `hanasand_api`; ensure secrets are provisioned in that source environment as well as all workers when enabling providers. Missing credentials leave the relevant buttons disabled with an explicit setup status.

Before first auth-worker deployment, run `ensureSocialAuthSchema()` from `api/src/utils/db/socialAuthSchema.ts` against the primary database using the existing server environment. This creates only the two social-login tables and index; it is also included in the main application's schema setup. Authentication workers intentionally do not migrate on startup.

The frontend stores a ten-minute Secure, HttpOnly, host-only browser verification cookie. SameSite=None permits Apple's cross-site form POST. Linking requires a same-origin POST and an authenticated own-account session; impersonation is rejected. State is consumed atomically in PostgreSQL before token exchange, so callbacks cannot be replayed across workers. Google uses PKCE; both providers require signed, correctly scoped, unexpired identity tokens and the transaction nonce. Authorization codes and tokens must not be logged.

Verification: `bun scripts/check-social-oidc.ts`, `bun scripts/check-social-auth.ts`, and `node scripts/check-social-login-ui.mjs` (frontend, with `SOCIAL_TEST_URL` pointing to the test frontend). Complete one real connection and subsequent sign-in for each provider after credentials and provider-console registration are available; local token tests cannot verify those external settings.
