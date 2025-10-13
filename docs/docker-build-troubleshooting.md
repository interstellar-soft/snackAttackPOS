# Docker Frontend Build Troubleshooting

When building the frontend image inside Docker the build normally reuses the
vendored `node_modules` directory that is committed to the repository. This
keeps the build completely offline so long as the vendored dependencies are
present.

If the build falls back to running `npm ci` it will attempt to contact the npm
registry. In restricted environments (for example, behind a corporate proxy or
with unreliable outbound internet access) this will result in `ECONNRESET` or
similar network errors, causing the build to fail.

To avoid the network requirement, make sure the `node_modules` directory is
present when the Docker context is sent. The Dockerfile now uses the vendored
modules whenever they exist, even if optional platform-specific packages such as
`@rollup/rollup-linux-x64-musl` are missing. Rollup automatically falls back to
its portable JavaScript implementation when the platform-specific binary is not
available, so the build can proceed without re-installing the dependencies.

If you need to force a clean reinstall (for example after upgrading
dependencies), delete the vendored `node_modules` directories locally before
invoking `docker compose build` so that the Docker build step will run `npm ci`
inside the container. Ensure you have reliable access to the npm registry or a
configured proxy before doing so.
