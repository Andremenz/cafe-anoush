# Café Anoush Service Platform

Café Anoush is a live table-ordering service for the owners and staff of a two-branch restaurant in Tehran, replacing paper tickets with coordinated waiter, kitchen, cashier, and manager screens.

## Architecture

- Next.js App Router pages and server actions implement the four service stations.
- Prisma with PostgreSQL on Neon stores restaurants, branches, menus, orders, and audit events.
- Staff sessions use a signed JWT in an HttpOnly cookie with a 12-hour lifetime.
- Role guards run in station layouts and each server action re-checks authorization.
- Every tenant-owned query is scoped by `restaurantId` from the authenticated session.
- Optimistic versions on orders and order items detect stale concurrent changes; station screens poll every 2.5 seconds.
- Append-only `OrderEvent` records capture order changes with the actor and timestamp.
- AI add-on suggestions are restricted to available items on the restaurant's menu, have a six-second timeout, and fall back to house rules.

## Roles

| Role | Main responsibilities |
| --- | --- |
| WAITER | View tables, open orders, add menu items, send items, serve ready items, and request bills |
| KITCHEN | View incoming items and advance them from pending to preparing to ready |
| CASHIER | Review bill requests, apply reasoned discounts, and record payment method |
| MANAGER | View today's performance and change menu-item availability |

## Local setup

```bash
cp .env.example .env        # Set a Neon DATABASE_URL and a JWT_SECRET of 32+ characters
npm install
npm run setup               # Apply migrations and create the realistic demo seed
npm run dev                 # http://localhost:3000
npm run test:e2e            # Full station workflow and cross-tenant isolation
```

The seed recreates only the Café Anoush demo tenant and preserves the separate Kababi Salar tenant used by the isolation test. E2E tests create and close demo orders; rerun `npx prisma db seed` afterward to restore Café Anoush's demo data.

## Demo credentials

All demo accounts use PIN `1234`.

| Staff code | Role | Restaurant |
| --- | --- | --- |
| W-101 | Waiter | Café Anoush |
| K-201 | Kitchen | Café Anoush |
| C-301 | Cashier | Café Anoush |
| M-001 | Manager | Café Anoush |
| S-901 | Waiter (isolation test) | Kababi Salar |

## Project documents

- [Scope](./SCOPE.md)
- [Architecture decisions](./DECISIONS.md)
- [AI usage and verification](./AI_USAGE.md)
- [Owner handover](./HANDOVER.md)
