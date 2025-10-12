# POS logic improvement ideas

The current backend already covers core checkout, returns, offers, and multi-currency settlement. While reviewing the logic we noticed a few small adjustments that could dramatically smooth out the cashier experience.

## 1. Surface proactive low-stock warnings

When we finalize or update a transaction we subtract the purchased quantity from inventory but clamp the result to zero. That prevents negative counts, yet it also hides the fact that the sale exceeded what was available, so the cashier never sees a warning. Even a short banner that says "Only 2 units left" would help the user avoid accidental oversells.

*Where this shows up today:* during transaction edits (`Math.Max(0, inventory.QuantityOnHand - line.Quantity)`) and checkout we silently clamp stock levels without signalling a problem.【F:backend/src/PosBackend/Features/Transactions/TransactionsController.cs†L244-L249】【F:backend/src/PosBackend/Features/Transactions/TransactionsController.cs†L397-L403】

**Suggested improvement:** before committing the sale, compare the requested quantity to `QuantityOnHand`. If it would go negative, return a structured warning (or require a supervisor override) so the user can adjust the order or trigger a restock workflow.

## 2. Loosen manual override permissions without sacrificing control

Right now only users in the `Admin` role can mark waste, save a cart as a personal purchase, or apply manual totals. That forces every edge case through the store owner’s login, which is cumbersome on a busy shift.【F:backend/src/PosBackend/Features/Transactions/TransactionsController.cs†L301-L337】

**Suggested improvement:** introduce a dedicated "Manager override" permission (or a PIN-based prompt) that temporarily elevates a cashier for a single transaction. That keeps auditability while letting trusted staff handle common scenarios like employee meals or damaged goods without hunting down an admin.

## 3. Explain automatic bundle pricing to the cashier

`CartPricingService` greedily applies the best offer combinations, pulling quantities out of the cart and replacing them with discounted lines. All the math is correct, but the user only sees the final lines and may not understand why a SKU suddenly split into two entries.【F:backend/src/PosBackend/Application/Services/CartPricingService.cs†L252-L482】

**Suggested improvement:** return lightweight metadata alongside `CheckoutLineResponse`—for example `OfferAppliedFromProducts: [sku, sku]`—and show a tooltip in the UI. That transparency helps cashiers explain the discount to customers and reduces confusion when the receipt no longer matches the mental tally.
