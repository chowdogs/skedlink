# SkedLink finals revision — 12 October 2026

## Implemented source changes

- One listing represents one room. New listings use a whole-room rate, divided by capacity for a shared bed. Legacy listings retain their original per-tenant interpretation until edited.
- Shared, exclusive, or both occupancy options. Reservation checks use dates and capacity, including concurrent requests. Exclusive occupancy consumes the entire room.
- Nightly, weekly, or monthly billing per listing, with independently configurable minimum stay. Weekly bookings round up to whole weeks. Monthly rent is billed by anniversary; a partial final period is charged as a full period. A listing has one billing frequency; separate packages can be represented by separate listings only if they represent distinct rooms.
- Reusable advance and security-deposit periods independently enabled/disabled. First rent, advance, deposit and fixed utilities are itemized separately.
- Per-utility included/fixed/variable policies. Fixed amounts are per tenant per rental period, including an exclusive renter. Included utilities cannot be charged again under the signed terms.
- Maintenance requested/started/resolved timestamps, status history and reason-required tenant charges. The agreed maintenance policy overrides later listing edits. For shared landlord/tenant liability, the landlord posts only the tenant portion and explains the split.
- Private PDF contract exchange; 48-hour reservation; contract acceptance creates a move-in bill. Confirmed payment activates household membership. No browser or chat approval bypass.
- Tenant schedules, email, phone and ID remain in private user records. Shared room data contains only display name/avatar. Compatibility is computed server-side and only aggregate scores are returned. Live co-tenant activity display is removed.
- Per-tenant billing, consolidated month-filtered statements, paid line strike-through, payment references, Print / Save PDF, separate advance/deposit balances and landlord-reviewed advance requests. Credits are transactional and maintain separate receipts for partial applications.
- Free one-room plan. Paid tiers: 2/4/6/8/10 rooms for PHP 300/600/900/1,200/1,500 per 30-day term. No trial. Custom requests above ten rooms are recorded for manual commercial follow-up. No invented contact address or automatic custom-price approval.
- Paid access activates only after confirmed checkout. Renewals add 30 days; upgrades start a new full-price 30-day term without proration. Downgrades become available after expiry. Existing household records stay accessible; only the first room accepts new applications on the expired/free plan.
- Premium revenue analytics and CSV export. Seekers have no subscription. Test booking commission is recorded as 3% of first-month rent or 8% of nightly/weekly accommodation. No commission on deposits, advance, utilities, maintenance, or later advance usage.
- Daily rent generation at 00:05 Asia/Manila, plus a landlord “Generate due rent” action. Deterministic bill IDs prevent duplicate rent charges.
- Login/profile restoration after refresh, including return from payment checkout.

## Deployment status

The frontend is deployed at https://skedlink-taupe.vercel.app from GitHub `main` (implementation commit `afa46ed`). Vercel reported a successful deployment and the public JavaScript bundle contains the new payment and advance workflows.

Firebase backend deployment remains blocked by the project's disabled billing. Cloud Functions is not enabled and the project has no Storage bucket. The project owner must enable Blaze before Functions and private PDF storage can be provisioned. Functions, indexes, Firestore/Storage rules and the legacy-data migration still need deployment. A recursive read-only backup captured 103 existing Firestore documents in ignored local artifacts; no production database records were changed.

PayMongo code is restricted to **test keys**. The supplied test key was accepted by PayMongo. A real provider test checkout session was created with card, GCash and Maya enabled, then expired without payment. The key is saved only in an ignored local secret file, pending upload to Firebase Secret Manager. Webhook registration, the signing secret and end-to-end payment confirmation remain pending backend deployment. Automated settlement tests use mocked provider responses.

The commission is a test accounting entry. Automated marketplace split payouts, escrow custody, refunds and dispute handling are not implemented. Gateway processing charges are not represented as platform revenue. Do not describe the demo as real escrow or payouts.

The default contract template is intentionally deferred until the user supplies their reference. Landlords can upload their own PDF now. PDF upload/exchange is not automatic legal-document drafting or digital-signature verification.

## Setup

Use Node 22 for Firebase deployment. The local workspace has Node 24; tests and builds were run there as well.

```powershell
npm ci
npm ci --prefix functions
```

Firebase CLI is installed locally in `functions/node_modules`. Authenticate using the appropriate project owner account. Explicitly choose the project for every deployment; there is no automatic production project alias.

Set server secrets interactively, never as React environment variables or tracked files:

```powershell
node functions/node_modules/firebase-tools/lib/bin/firebase.js functions:secrets:set PAYMONGO_SECRET_KEY --project skedlink
node functions/node_modules/firebase-tools/lib/bin/firebase.js functions:secrets:set PAYMONGO_WEBHOOK_SECRET --project skedlink
```

Set `APP_URL` to the actual frontend origin when Firebase prompts, or in the ignored `functions/.env.skedlink` file. Configure a PayMongo **test-mode** webhook for `checkout_session.payment.paid`, targeting the deployed `paymongoWebhook` URL. Functions use `asia-southeast1`.

Deployment requires a Firebase project with Functions and Storage provisioned, and an appropriate billing plan. For storage downloads, configure bucket CORS for the actual frontend origin if needed. Do not put secret keys in `REACT_APP_*`.

### Existing data rollout

Use a maintenance window. Export a Firestore backup first. Deploy restrictive rules before creating the migration archive, so old private fields in the archive are never client-readable.

```powershell
node functions/node_modules/firebase-tools/lib/bin/firebase.js deploy --only firestore,storage --project skedlink
$env:GCLOUD_PROJECT='skedlink'
# Requires Application Default Credentials for the selected project.
node functions/scripts/migrate.js
# Review counts; then apply the prepared migration:
node functions/scripts/migrate.js --apply
node functions/node_modules/firebase-tools/lib/bin/firebase.js deploy --only functions --project skedlink
npm run build
```

Publish the resulting `build` through the existing hosting workflow. Functions are mandatory for new financial and tenancy actions; there is no insecure client-write fallback.

Migration strips sensitive tenant fields from shared property documents, records listing inventory for subscription enforcement and splits old shared bills into private per-tenant records. Original records are retained in the server-only `migrationArchive`. It does not invent historic resolution dates, signed contracts, deposits or advance balances. Existing tenants retain access; legacy applications without rental dates must be cancelled and resubmitted to enter the new contract flow. Legacy billing remains separately accessible.

### Local verification

```powershell
$env:CI='true'
npm test -- --watchAll=false --runInBand
npm test --prefix functions
Push-Location functions
$env:DEBUG=''
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only 'firestore,storage' --project demo-skedlink --config ../firebase.json "node --test test/*.integration.js"
Pop-Location
npm run build
```

Tests use only the `demo-skedlink` emulator project. A Windows emulator may leave its Java process after shutdown; verify its command line/project before stopping it or choose a free port. The Storage emulator can print a shutdown-only Java exception after successful tests.

### Verification results

- 4 React interaction tests passed.
- 12 rental-domain tests passed.
- 16 Firestore/Storage rules and workflow integration tests passed against local emulators.
- The production build compiled successfully and the frontend was deployed through Vercel. Provider test checkout creation and expiration passed; browser-based payment completion and webhook delivery remain pending backend deployment.
- Production-only dependency audit for the new Functions package reported zero known vulnerabilities. Development tooling and the existing frontend dependency tree are not covered by that result.

## Defense walkthrough after deployment

1. Register landlord on Free; create a PHP 6,000 room, capacity three, both occupancy modes, three-month reusable advance and one-month deposit.
2. Set included internet, separate water/electricity and a case-by-case maintenance policy.
3. Seeker compares PHP 2,000 shared versus PHP 6,000 exclusive, selects dates and submits an application.
4. Landlord uploads PDF; seeker downloads and returns signed PDF; landlord accepts it. Confirm no tenant membership yet.
5. Seeker completes PayMongo test checkout. Confirm membership, receipt, PHP 6,000 shared advance and PHP 2,000 shared deposit (or exclusive equivalents).
6. Submit maintenance; change status; display all dates; post a tenant portion with written reason. Pay it, then print a statement showing it paid and excluding it from the outstanding total.
7. Generate a due rent bill and request advance usage. Approve once; verify separate balances, payment receipt and history. Do not alter the clock of production data to demo future dates; use a prepared demo tenant/bill.
8. Show another tenant cannot retrieve schedule/contact/ID data; compatibility still returns an aggregate score.
9. Try a second listing on Free (blocked); pay the two-room test plan and retry. Show Premium analytics/export and the custom-plan request form.

## Reference documents to update

Update Chapters 1 and 2 of the supplied PDF for tier pricing, removal of trial/SkedLink Plus, contract exchange, private schedules, server-side matching, Functions, and test payment limitations. Replace the old immediate-approval and public-activity diagrams. Firebase SDK version in the existing paper does not match the frontend dependency version.

Payment implementation references: [PayMongo checkout API](https://docs.paymongo.com/re/reference/create_checkout_sessions), [expiry endpoint](https://docs.paymongo.com/reference/expire-a-checkout-session), [webhook signature verification](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management), [Firebase callable functions](https://firebase.google.com/docs/functions/callable).
