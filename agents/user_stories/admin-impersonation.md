# Admin Impersonation User Stories

## 1. Layout Complaint Triage

An administrator receives a message from Sindre saying that a dashboard element appears out of place on his account, but screenshots are cropped and do not show which permissions or data are shaping the page. The administrator opens user management, chooses Sindre, starts impersonation, and sees the persistent "Impersonating Sindre · Return to own view" banner while moving between Dashboard, Notes, Mail, and Profile. The admin confirms whether the layout problem is tied to Sindre's actual portal data rather than the admin's broader access.

## 2. Missing Machine Access

A user reports that a VM they expect to see is missing from the portal. The administrator impersonates the account, navigates to the dashboard and VM views, and verifies the machine list through the same API perspective the user receives. If the VM does not appear, the admin can leave impersonation, return to management, inspect role or VM access assignments, then impersonate again to confirm the fix.

## 3. Role Boundary Review

Before granting a new role, an administrator wants to know whether a non-admin account can accidentally access system-only surfaces such as logs, database tools, rate limits, or vulnerability panels. The administrator impersonates the target user and navigates across restricted routes. The portal should keep the admin's return control visible while the API evaluates requests as the target user, making unauthorized areas fail or disappear from the target perspective.

## 4. Mailbox Permission Audit

A user says they can see the Mail tab but the wrong mailbox or mailbox actions are available. The administrator impersonates that user from web, mobile, or desktop, opens Mail, and checks the accounts, messages, filters, and compose controls exactly as that user. The admin uses the persistent banner to avoid forgetting they are inspecting another account before making account-level changes.

## 5. Cross-App Support Session

An administrator begins support on the website, later checks the same user from the mobile app while away from the desk, and finishes by validating the desktop app's native panels. Each client keeps impersonation state through navigation, clearly labels the target account, and provides a one-action return to the real admin view. The experience lets the admin compare web, mobile, and desktop behavior without logging out or sharing the user's password.
