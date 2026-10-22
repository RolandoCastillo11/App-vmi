# Security Specification - VMI Retail México

## Data Invariants
1. A shop can only view its own inventory (if we had separate shops, but for now we assume a single environment or shop-based filtering).
2. An order must include at least one item and a valid total.
3. Order status can only transition forward (pending -> confirmed -> etc).
4. Users must be authenticated to write any data.

## The Dirty Dozen Payloads (Rejection Targets)
1. Update `shopInventory` with a negative stock.
2. Create an order with `status: 'delivered'` directly.
3. Create an order without `createdAt` or with a client-side timestamp.
4. Update an order's `total` after it's been confirmed.
5. Inject a "ghost field" `isAdmin: true` into a user inventory document.
6. Delete the `providerCatalog` items (Client should only read).
7. Create an item in `shopInventory` without an `sku`.
8. Order item with a 1MB string in the name field.
9. Change `shopId` of an existing order.
10. Anonymous user attempting to list orders.
11. Unverified email user attempting to place order (if verification required).
12. Update `createdAt` of an existing order.
