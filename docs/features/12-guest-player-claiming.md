# Guest Player Claiming Journey

## Summary

Make the existing guest→registered-user claim flow a first-class, discoverable experience instead of relying purely on invitation emails.

## Why / Goal

Guest players are created by admins with an email + display name. When a real user signs up with that email, an invite is auto-sent — but the flow is invisible and easy to miss. Converting guests to full accounts is a key activation win.

## Scope

- Surface pending claims: "You have a guest profile waiting" banner on signup/sign-in for matching emails
- Walk the user through claiming: set name/password → claim existing player records + match history
- Reuse the existing auto-invitation hook; add the claim UI and linking
- Handle the case where a guest email is already claimed

## Code map

- Auto-invitation/claim hook: `apps/worker/src/lib/better-auth-organization-hooks.ts` (guest→user claim)
- Invitation accept route: `apps/web/src/routes/accept-invitation.$invitationId.tsx`
- Guest creation/edit: `apps/worker/src/trpc/router/player-router.ts` (`createGuestPlayer`, `editGuestPlayer`)
- Sign-up UI: `apps/web/src/routes/_auth/auth/-components/sign-up-form.tsx`

## Acceptance criteria

- A user signing up with a guest-owned email sees a clear "claim your profile" path
- Claiming links existing player records/history to the account
- Claimed email can no longer be claimed again
- Works with the existing `editGuestPlayer` repointing logic

## Open questions / notes

- Can a claim merge two accounts (registered user already has a player)? Keep simple: claim only if no player for that email yet.
- Copy/tone of the claim banner
