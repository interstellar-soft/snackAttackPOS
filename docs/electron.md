# Aurora POS Electron distribution

The Windows build is now self-contained. See [Windows installation and builds](windows-installation.md) for setup, packaging, data storage, and verification.

For frontend development, run npm run electron:dev from frontend with the Docker development stack available. Packaged Windows builds use the bundled local services instead. Automatic updates require an explicitly configured HTTPS ELECTRON_UPDATE_URL; no feed is enabled by default. macOS and Linux self-contained installers are not implemented by this Windows release.
