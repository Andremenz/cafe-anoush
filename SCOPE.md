# SCOPE.md — Café Anoush Service Platform, v1

Prepared for: the owners of Café Anoush (2 branches, Tehran)
Prepared by: Ali Zamanipour — engagement scope agreement, day 1

## 1. What we understood from you
Today a shift at Café Anoush runs on paper slips, a shared messaging group, and the
cashier's memory. Orders get re-shouted when paper goes missing. Nobody knows which
tables are waiting. The month-end report is a night of manual arithmetic. Meanwhile
a waiter, the kitchen, and the cashier all need to touch the same order at the same
time — and today, things get silently lost.

## 2. The goal of v1 (one workflow, done properly)
v1 replaces the paper slip with a live table-ordering flow that survives a real
Friday-night shift across three stations:

- **Waiter (phone/tablet at the table):** see tables and their state, open an order,
  browse the menu by category, add items with quantities and short notes
  ("no onions"), send items to the kitchen, request the bill.
- **Kitchen (one screen on the wall):** live board of incoming items; advance each
  item PENDING → PREPARING → READY. See table number, item, qty, notes, age.
- **Cashier (terminal):** see bill requests, review the check, apply a discount with
  a reason, close it as POS card / card-to-card transfer / cash.
- **Manager:** today's numbers (revenue, checks closed, average check, busiest items)
  and menu availability toggles (86'd items disappear from waiter screens instantly).

Everything updates live on every screen (a few seconds' latency) so nobody shouts
across the room.

## 3. Roles (four, deliberately)
WAITER, KITCHEN, CASHIER, MANAGER. Staff log in with a staff code + 4-digit PIN on
shared devices — no emails, no passwords, fast shift handover. In a small shop the
manager can also work the cashier screen; the roles are permissions, not people.

## 4. What v1 will NOT do (explicit cuts, with reasons)
- **No payment-gateway integration.** Iranian payments are POS terminals and
  card-to-card transfers performed on physical devices; the system records the
  method, it does not process money. Building a gateway in this timebox would add
  risk without adding workflow value.
- **No offline mode.** True offline-with-sync is a multi-week engineering problem
  (conflict merge, queues). v1 assumes the shop's Wi-Fi/4G works; if it drops, staff
  fall back to paper for a few minutes and re-enter. Stated plainly, not hidden.
- **No inventory/purchasing, no reservations, no delivery-app integrations, no
  SMS notifications, no accounting export.** Each is a future phase.
- **No complex modifier matrices** (size/option grids). v1 has quantity + free-text
  notes, which covers how Iranian kitchens actually receive modifications.

## 5. Keeping your data safe (in plain language)
- Each restaurant's data is walled off at the database level; every screen and every
  request is filtered by your restaurant. Another restaurant guessing your URLs sees
  "not found", never your data. We will demonstrate this with an automated test.
- When two people touch the same order at once (waiter adds a drink while the kitchen
  marks the burger preparing), both changes survive: additions are inserts, item
  updates lock the individual line, and checkout locks the bill. Every single change
  is written to a permanent event log with who did it and when — nothing disappears
  quietly. If two people truly collide on the same line, the second person sees
  "this changed, refresh" instead of a silent overwrite.

## 6. AI in v1 (small and defensible)
One capability: **"Smart add-ons"** on the waiter screen. After items are added, one
button suggests complementary items *from your own menu* (kebab → doogh, salad,
bread) to lift the average check. It never adds anything by itself — the waiter taps
to accept. If the AI provider is slow or down (6-second limit), the system silently
falls back to simple house rules (top available drinks/appetizers), so the shift
never waits on a robot. Menu names are treated as untrusted text inside the prompt.

## 7. How you will accept v1
With demo credentials you will: run one table from open to paid across three
browser windows at once; watch the kitchen board update without refreshing; try to
open another restaurant's data and fail; and read today's numbers as manager.
Automated tests cover the full order lifecycle and the cross-restaurant wall.

## 8. Timebox and honesty
This scope is what fits a six-hour engineering box with tests and deployment.
Anything above the line in section 4 is a candidate for phase 2, ranked in the
handover document. If we exceed the box we will say where the time went.
