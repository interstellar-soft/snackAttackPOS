# Onboarding Existing Inventory

When you first deploy Aurora POS into an existing store, products start with no quantity on hand. To bring your current stock levels into the system, follow this two-step workflow:

1. **Create or import your product catalog**
   - Go to the **Products** area and add each SKU (or bulk import a catalog if you have one).
   - Products are created with `0` quantity on hand; this screen is only for item metadata such as name, barcode, category, taxes, and prices.

2. **Record an "Initial Stock" purchase**
   - Navigate to the **Purchases** screen and create a new purchase order.
   - Use a supplier such as `Existing Inventory` to distinguish this intake from real vendors.
   - Add each product with the quantity that is currently on your shelves. Enter the historical unit cost so average cost and profit reporting remain accurate.
   - Submit the purchase. Aurora POS posts the quantities to inventory, updates average cost, and timestamps the restock.

Why this matters:

- The **Purchases** workflow is the only place that adjusts on-hand quantities upward while tracking cost history.
- Editing products directly does not change stock levels, so skipping the purchase step would leave your inventory at zero.
- Recording the intake as a purchase keeps audit trails and profitability metrics consistent with future restocks.

Once this one-time initialization is complete, continue restocking through the **Purchases** workflow whenever you receive new goods.
