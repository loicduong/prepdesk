# PrepDesk — Design Spec

Date: 2026-10-12
Status: Draft for review

## 1. Purpose

PrepDesk is a small, real, deployed web app that serves as portfolio proof for an Upwork proposal ("Build a Small Paid Web App"). A user pastes a job posting; the server sends it to Claude with a private prompt and returns a formatted interview-prep report. Users have a monthly report limit, enforced by a credit ledger, and can upgrade through Stripe.

The reviewer is a prospective client who will open the live demo and read the code on GitHub. The project must show correct server-side engineering: an atomic credit ledger, idempotent Stripe webhooks, a private prompt and API key, and retries with refunds.

PrepDesk is a standalone demo. It is not affiliated with any client, and uses no client name, prompt, or private material.

### Success criteria

- A public Vercel URL where anyone can sign in by email, generate a report, see a credit reserved and committed (or refunded on failure), and upgrade to Pro with a Stripe test card.
- A public GitHub repository with a README that explains the architecture, the ledger, and the security model.
- A ledger concurrency test showing that 10 simultaneous reserve calls with 3 credits left produce exactly 3 successes.
- CI (lint, typecheck, unit tests) passes on every push.

### Out of scope (first version)

PDF export, report ratings, bot checks (Turnstile), admin page, proration, taxes, coupons, multiple prices, Playwright end-to-end tests. Google OAuth is optional and enabled only if the Google Cloud setup is done.

## 2. Stack

- Next.js (App Router), TypeScript, deployed on Vercel.
- Supabase: Postgres, Auth (email magic link; optional Google), Row Level Security.
- Stripe (test mode): Checkout, Customer Portal, webhooks.
- Anthropic Claude API, model set by environment variable (default Claude Sonnet 5.5).
- zod for validation, Vitest for unit tests, GitHub Actions for CI.

## 3. Structure

```
app/
  (auth)/login/            sign in (magic link, optional Google)
  (app)/new/               paste posting, generate report
  (app)/reports/           history
  (app)/reports/[id]/      single report
  (app)/billing/           plan, credits left, upgrade, manage billing
  api/reports/             POST: create report
  api/stripe/checkout/     POST: start Checkout
  api/stripe/portal/       POST: open Customer Portal
  api/stripe/webhook/      POST: Stripe events
lib/
  credits.ts               wrappers for the SQL functions
  claude.ts                model call, output validation, retries
  prompts/report.ts        private prompt (server-only)
  stripe.ts                Stripe client and event handling
  rate-limit.ts            per-user rate limit (Postgres-backed)
  supabase/                server and browser clients
supabase/migrations/       tables, SQL functions, RLS policies
scripts/ledger-concurrency.ts
```

Each `lib` module has one job and is testable on its own. Files that hold the prompt or secrets import `server-only`.

## 4. Data model (Postgres)

- `profiles`: `user_id` (PK, references auth.users), `plan` (`free` | `pro`), `monthly_limit` (int), `period_start` (timestamptz), `stripe_customer_id` (text, nullable).
- `reports`: `id` (uuid PK), `user_id`, `input_text`, `output_json` (jsonb, nullable), `status` (`pending` | `ready` | `failed`), `attempts` (int), `created_at`, `finished_at`.
- `credit_ledger` (append-only): `id`, `user_id`, `report_id` (nullable), `kind` (`reserve` | `commit` | `refund` | `grant`), `amount` (int), `created_at`. Unique `(report_id, kind)`.
- `stripe_events`: `event_id` (PK), `type`, `received_at`.

Plans: Free = 3 reports per month; Pro = $9/month test price, 30 reports per month.

Balance is derived, never stored: `monthly_limit − (reserves − refunds in the current period)`. For Free users, if more than one month has passed since `period_start`, the period rolls forward when the balance is computed.

RLS: users can select their own `profiles`, `reports`, and `credit_ledger` rows. No user-facing insert, update, or delete. All writes go through SQL functions called with the service role.

## 5. SQL functions

All run in a single transaction and lock the user's `profiles` row with `SELECT … FOR UPDATE`.

- `start_report(user_id, input_text) → report_id`: roll the Free period forward if due; compute balance; if ≤ 0 raise `insufficient_credits`; insert report (`pending`) and a `reserve` row (−1).
- `finish_report(report_id, output_json)`: if status is `pending`, set `ready`, save output, insert `commit` row (amount 0). Otherwise do nothing.
- `fail_report(report_id)`: if status is `pending`, set `failed`, insert `refund` row (+1). Otherwise do nothing.
- `refund_stale_reports(user_id)`: call `fail_report` for the user's reports `pending` for more than 10 minutes.
- `apply_subscription(user_id, plan, period_start)`: set plan, limit, and period.

The unique `(report_id, kind)` constraint is a second guard against double commit or refund.

## 6. Report flow — `POST /api/reports`

1. No session → 401.
2. Input not 200–15,000 characters → 400.
3. `refund_stale_reports(user)`.
4. More than 5 reports created by the user in the last 60 seconds → 429 with seconds to wait.
5. `start_report` → on `insufficient_credits`, 402.
6. Call Claude with the private prompt and the posting. Output must be JSON matching the schema: `role_summary` (string), `likely_questions` (string[]), `star_stories` (string[]), `questions_to_ask` (string[]), `watch_outs` (string[]). Validate with zod (all sections present, non-empty, sane lengths). On invalid output or a 25-second timeout, retry, up to 3 attempts. Route `maxDuration` is 90 seconds.
7. Success → `finish_report`, return `{ id }`; client navigates to `/reports/[id]`. Failure after 3 attempts → `fail_report`, 502.

User-facing errors are generic and never include the prompt or model output. Logs record report ID, user ID, attempt count, and timing only.

## 7. Stripe

- `POST /api/stripe/checkout`: create a Stripe customer if missing (store `stripe_customer_id`); create a subscription Checkout Session for `STRIPE_PRICE_ID` with `client_reference_id = user_id`; return the URL.
- `POST /api/stripe/portal`: create a Customer Portal session; return the URL.
- `POST /api/stripe/webhook`: verify the signature against the raw body (400 on failure); insert `event_id` into `stripe_events` with `on conflict do nothing`, and if it already existed return 200 without processing. Handle:
  - `checkout.session.completed` → Pro, limit 30.
  - `customer.subscription.updated` / `customer.subscription.deleted` → Free, limit 3, when the subscription is canceled or not active.
  - `invoice.paid` → new period: `period_start` = invoice period start.
- Webhooks are the only source of plan changes. The success page polls the profile until the plan is Pro.
- Local testing: Stripe CLI `stripe listen --forward-to localhost:3000/api/stripe/webhook`, test card 4242 4242 4242 4242.

## 8. Errors

| Case | Status | User sees |
|---|---|---|
| Not signed in | 401 | Redirect to login |
| Posting too short/long | 400 | "Paste 200–15,000 characters of the job posting" |
| Rate limited | 429 | "Try again in N seconds" |
| No credits left | 402 | "You've used 3 of 3 reports this month" + upgrade button |
| Model failed 3 times | 502 | "Couldn't generate the report. 1 credit refunded." |
| Bad webhook signature | 400 | (logged only) |

## 9. Testing

- Vitest:
  - output schema validation (valid, missing section, empty arrays, oversized);
  - retry loop with a mocked model (fail then succeed → commit; fail ×3 → refund);
  - Stripe event handling with mocked events, including a duplicate event ID.
- `scripts/ledger-concurrency.ts` against the dev Supabase project with a test user: 10 parallel `start_report` calls with 3 credits left → exactly 3 succeed; calling `finish_report` / `fail_report` twice changes nothing the second time. Results are recorded in the README.
- GitHub Actions: lint, typecheck, Vitest on push and pull request.
- Manual checklist in the README for sign-in, generate, refund, upgrade, portal.

## 10. Configuration

`.env.example` lists: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`. Real values live only in `.env.local` (git-ignored) and in Vercel. The owner creates all accounts and enters all keys.

## 11. Deployment and publishing

- Vercel project linked to `loicduong/prepdesk`; environment variables set in Vercel; production webhook endpoint registered in Stripe; site URL added to Supabase Auth redirect URLs.
- The repository stays private until: `.env*` (except `.env.example`) is git-ignored, the commit history is scanned for secrets, and the owner confirms. Then it is made public.

## 12. README

Architecture diagram (mermaid), ledger design and concurrency test results, how the prompt and keys stay private, local setup, Stripe test card, manual checklist, and a note that this is a standalone demo project.
