# Architecture decisions

## One complete workflow over four partial workflows

- **Decision:** Deliver table ordering end to end across waiter, kitchen, and cashier, with manager visibility and menu controls.
- **Reason:** The brief's acceptance bar is behavioral: a real check must travel through the stations.
- **Alternative:** Build a broader but shallow set of unrelated restaurant features.
- **Trade-off:** Inventory, reservations, and integrations are out of scope for v1.

## Polling rather than WebSockets or SSE

- **Decision:** Refresh station data every 2.5 seconds.
- **Reason:** Polling needs no extra infrastructure and is compatible with serverless hosting.
- **Alternative:** WebSockets or Server-Sent Events with a persistent connection service.
- **Trade-off:** Updates can take up to 2.5 seconds and each connected client adds database reads; revisit when client volume grows.

## Versioned writes and transaction boundaries

- **Decision:** New order lines are inserted; edits and kitchen status transitions compare an `OrderItem` version; order-changing actions also increment the parent order version; checkout checks both the order version and its active status.
- **Reason:** A stale edit to a line is detected instead of silently overwriting another edit, while checkout can detect intervening order changes. New lines remain separate rows rather than overwriting the order.
- **Alternative:** Last-write-wins updates or locking the whole order for every operation.
- **Trade-off:** Conflicting concurrent writes can require a refresh and retry. Database transactions protect multi-row changes and audit records.

## Staff code and four-digit PIN

- **Decision:** Shared devices authenticate with a staff code and PIN rather than email and password.
- **Reason:** Staff share tablets and need fast shift handover without collecting email addresses.
- **Alternative:** Individual email/password accounts.
- **Trade-off:** PINs are weak secrets; add an operational lockout and rotation policy before broader deployment.

## AI suggests; staff decide

- **Decision:** Smart add-ons return IDs from the restaurant's available menu, and a waiter must choose whether to add them. The call times out after six seconds and falls back to house rules.
- **Reason:** Suggestions can help a waiter without allowing an AI response to create an order or stall service.
- **Alternative:** Automatically add AI-selected items or block on provider availability.
- **Trade-off:** Suggestions are less automated; menu text must be treated as untrusted prompt input.

## No payment gateway

- **Decision:** Record POS card, card-to-card, or cash as the payment method; do not process money.
- **Reason:** The shop uses physical terminals and transfers, and v1 should not introduce gateway risk.
- **Alternative:** Integrate a payment provider.
- **Trade-off:** There is no automatic payment reconciliation.

## Snapshot item names and prices

- **Decision:** Copy the menu name and price onto each `OrderItem` when it is added.
- **Reason:** Changes to a menu or inflation-driven repricing must not rewrite an existing or paid check.
- **Alternative:** Calculate historical bills from current menu values.
- **Trade-off:** Historical order lines intentionally do not track later menu edits.

## Revisit after v1

- One Neon database is currently used for development and production; separate environments would improve operational hygiene.
- Staff codes are entered without a restaurant picker; globally unique codes or an explicit tenant selection flow would remove ambiguity as tenants grow.
- Polling should move to SSE when the number of concurrently connected clients makes its database load material.
