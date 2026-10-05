# Café Anoush v1 handover

## What you received

Four screens share one live order: the waiter opens and updates a table check, the kitchen prepares its items, the cashier records the payment, and the manager sees the day's numbers and controls menu availability.

## A normal shift

1. **Waiter:** Sign in, open the table's order, add menu items and notes, then request the bill when the guests are ready.
2. **Kitchen:** Keep the board open, start each incoming item, and mark it ready when it leaves the kitchen.
3. **Cashier:** Open the bill request, review the check, optionally apply a discount with a reason, then record POS card, card-to-card, or cash.
4. **Manager:** Review today's revenue and checks, then toggle an item unavailable when it is sold out; it disappears from waiter menus.

## Limitations to know

- The service needs internet access. There is no offline mode; use paper briefly if connectivity is lost, then re-enter the order.
- Payment is recorded, not processed. There is no payment gateway.
- There is no kitchen printer, inventory, purchasing, reservations, delivery integration, SMS, or accounting export.
- Managers can toggle menu availability; full menu editing is not included.
- Staff use four-digit PINs. Establish PIN rotation and an account lockout policy before wider rollout.
- Live updates use 2.5-second polling, not push messaging.

## Ranked next steps

1. Add an offline-tolerant PWA queue and carefully designed synchronization.
2. Add POS/card-to-card reconciliation and evaluate a ZarinPal link where appropriate.
3. Add a kitchen printer and floor map.
4. Add reservations and a waitlist.
5. Add inventory and waste tracking.

## Where the current design will need to change

- **10 restaurants:** The current approach is suitable for a small deployment; add pagination to growing lists and continue testing tenant boundaries.
- **1,000 restaurants:** Polling can create significant database load. Move live updates to SSE with Redis-backed fan-out and consider a read replica for manager reporting.
- **100,000 restaurants:** Partition the `OrderEvent` history, move analytics to a warehouse, and add PostgreSQL row-level security as a second tenant-isolation layer.
