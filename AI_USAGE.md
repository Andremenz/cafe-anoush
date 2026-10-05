# AI usage and verification

## Tools used

- An LLM assistant helped shape the architecture, implementation specification, and code.
- The Copilot coding agent generated and integrated project files.

## Where assistance saved time

- Scaffolding and Prisma seed boilerplate.
- Repeated station-page and server-action patterns.
- Initial test and documentation drafts.

## Incorrect or rejected output

- The first seed draft used an unscoped `deleteMany`, which could have deleted every tenant's data. It was replaced with tenant-scoped cleanup and an isolation-test restaurant.
- Running `npx` outside the project selected a Prisma 8 beta; the CLI and client were aligned to Prisma 6 for the requested schema and seed setup.
- WebSockets and Redis were initially proposed for live updates. Polling was chosen instead because it meets the v1 latency goal without extra infrastructure in the six-hour timebox.

## Verification

- TypeScript check, ESLint, and production build passed.
- A manual browser smoke test exercised the waiter, kitchen, cashier, and manager stations.
- The Playwright suite passed a three-context waiter/kitchen/cashier workflow and a cross-tenant access-denial test.

## Decisions requiring my judgment

Scope cuts, transaction and lock granularity, price snapshots, and the decision that AI may suggest but never place items were product and engineering judgments. PIN authentication and the AI timeout/fallback boundaries were also deliberate safety and usability choices.
