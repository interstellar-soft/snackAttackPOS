# Version 0.2.1 — password and mobile planning update

- First-run administrator setup now accepts passwords of at least 9 characters. The HTML form and trusted Electron setup handler both enforce the boundary.
- Account creation and password changes use the same 9-character minimum. Existing passwords and store data are unchanged; no password reset is required.
- The mobile plan now requires a complete mirror of POS business data and history, plus admin-reviewed purchase drafts from invoice/receipt photographs. These mobile features are planned, not implemented in this installer.

Validation: frontend and Electron TypeScript/build checks passed, all 55 backend tests passed, and the packaged UI rejected an 8-character password and completed setup, login and restart with exactly 9 characters. One initial UI run encountered a temporary port conflict; the subsequent run passed after the port was free.

The installer remains unsigned. Clean-PC installation and physical scanner/printer acceptance checks remain outstanding as described in the installation guide.
