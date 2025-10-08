# Aurora POS desktop packaging guide

This document answers the recurring question of whether the Aurora POS frontend
requires major code changes to run inside a desktop container (such as Electron
or Tauri) instead of a traditional web browser.

## Do we need large code changes?

No. The current frontend is a standard React + Vite single-page application.
Both Electron and Tauri embed a browser runtime (Chromium/WebView2/WebKit), so
the existing UI can load without modification. You mainly need to provide the
HTML/JS bundle to the host shell.

The recent auth-store update already avoids relying on `sessionStorage` when it
is unavailable, which matches desktop runtimes that scope storage to the
application lifetime. When the app process exits, the in-memory store is
cleared, so users are prompted to log in again on the next launch—mirroring your
"close and reopen the system" requirement.

## Recommended integration steps

1. **Choose a shell**: Electron offers mature Node.js integration, while Tauri
   keeps the binary size small with a Rust backend. Pick whichever matches your
   stack preferences.
2. **Point the shell at the Vite build output**: Run `npm install` (once) and
   then `npm run build` in `frontend/` to generate the production bundle in
   `frontend/dist`. Configure your shell to load that directory as the main
   window.
3. **Bridge native APIs as needed**: If you later need file system, serial
   device, or OS integration, expose those capabilities through Electron's main
   process or Tauri commands. The React UI can call them over IPC without
   requiring component rewrites.
4. **Handle auto updates and installers**: Desktop distribution usually adds
   packaging (MSIX/DMG/AppImage) and update flows. These are shell-level tasks
   and do not require changing the React components.

## Optional adjustments

While not required, you can consider the following quality-of-life tweaks for a
polished desktop build:

- **Custom window chrome**: Implement draggable regions and close/minimize
  buttons if you want to hide the native frame. CSS changes live in
  `frontend/src` and work in both browser and desktop modes.
- **Local configuration storage**: If you need persistence between launches,
  switch the auth store (or other stores) to a file-backed storage exposed by
  your shell instead of `sessionStorage`.
- **Splash screen / loading indicator**: Desktop users often expect a splash
  screen while the web assets load. This is configured in the shell, not the
  React bundle.

In short, converting Aurora POS into a desktop application is primarily an
integration exercise. The React codebase already runs inside the embedded web
view, so you can focus on packaging and optional desktop-only polish rather than
large-scale frontend rewrites.
