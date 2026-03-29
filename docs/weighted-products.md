# Selling Products by Weight (kg, g, lb)

Use this guide when an item should be sold using a **weight amount** instead of whole-unit quantity (for example: wheat, rice, nuts, spices, or produce).

## 1) Configure the product

1. Open **Products**.
2. Click **Add product** (or edit an existing one).
3. Fill normal fields (name, barcode, category, price, etc.).
4. Enable **Sold by weight**.
5. Choose the **Weight unit** (`kg`, `g`, or `lb`).
6. Save.

### What this setting changes

- The product keeps the same unit price logic (price per selected unit you define).
- In the POS cart, quantity becomes decimal-friendly for that item.
- Cashiers can enter quantities like `0.25`, `1.5`, or `2.375`.
- Non-weight items still use whole-number quantities only.

## 2) Ring up the item in POS

1. Add the weighted product to cart (tap item tile or scan barcode).
2. In the cart line, edit **Qty** and enter a decimal value.
3. Press **Enter** or leave the input to confirm.
4. Total is recalculated automatically based on the entered quantity.

> Example: If wheat is priced at `2.00 USD` per kg and quantity is `1.25`, line total becomes `2.50 USD`.

## 3) Optional barcode behavior

If you use linked/alternate barcodes, those still work normally:

- You can keep regular linked barcode quantities for packs/bundles.
- For true scale-integrated flows, keep using your existing barcode process and adjust cart quantity when needed.

## 4) Best practices

- **Decide your base unit** (kg, lb, etc.) and keep it consistent in product naming (e.g., `Wheat (kg)`).
- **Train staff** to always verify decimal quantities before checkout.
- **Avoid mixing units** for the same item unless clearly labeled.
- **Audit pricing** after rollout with a few test transactions.

## Troubleshooting

- If quantity only accepts integers, confirm **Sold by weight** is enabled on that product.
- If totals look off, verify the product's base unit price and entered decimal quantity.
- If you changed the setting recently, reload POS and scan again.
