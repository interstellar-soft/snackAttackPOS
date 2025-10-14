FROM node:20-alpine AS build
WORKDIR /app

# Allow callers to tune npm's registry and retry behaviour when vendored
# dependencies are unavailable. The defaults match the public registry with
# conservative retry settings so the build remains resilient on slower
# connections while still permitting custom mirrors through build args.
ARG NPM_REGISTRY="https://registry.npmjs.org/"
ARG NPM_FETCH_RETRIES="5"
ARG NPM_FETCH_RETRY_MINTIMEOUT="20000"
ARG NPM_FETCH_RETRY_MAXTIMEOUT="120000"
ARG NPM_NETWORK_TIMEOUT="600000"

ENV npm_config_registry=${NPM_REGISTRY} \
    npm_config_fetch_retries=${NPM_FETCH_RETRIES} \
    npm_config_fetch_retry_mintimeout=${NPM_FETCH_RETRY_MINTIMEOUT} \
    npm_config_fetch_retry_maxtimeout=${NPM_FETCH_RETRY_MAXTIMEOUT} \
    npm_config_network_timeout=${NPM_NETWORK_TIMEOUT} \
    npm_config_prefer_offline=true \
    npm_config_audit=false \
    npm_config_fund=false

# Copy the workspace manifests first so dependency installation decisions can be cached
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package-lock.json ./frontend/

# Bring the remainder of the repository – including any vendored node_modules –
# into the build context. When the vendored dependencies are present this keeps
# the build entirely offline, while still allowing clean clones (without
# node_modules) to fall back to npm ci.
COPY . ./

# Install dependencies only when vendored modules are unavailable. This allows offline
# Docker builds to rely on the committed node_modules directory while still supporting
# clean installs when the vendored modules are absent.
RUN vendored_frontend_dir="frontend/node_modules"; \
    vendored_workspace_dir="node_modules"; \
    has_vendored_workspace=false; \
    has_vendored_frontend=false; \
    if [ -d "$vendored_workspace_dir" ] && [ "$(ls -A "$vendored_workspace_dir")" ]; then \
        has_vendored_workspace=true; \
    fi; \
    if [ -d "$vendored_frontend_dir" ] && [ "$(ls -A "$vendored_frontend_dir")" ]; then \
        has_vendored_frontend=true; \
    fi; \
    rollup_platform=$(node -p "process.platform"); \
    rollup_arch=$(node -p "process.arch"); \
    rollup_variant="rollup-${rollup_platform}-${rollup_arch}"; \
    if [ "$rollup_platform" = "linux" ]; then \
        if command -v ldd >/dev/null 2>&1 && ldd /bin/sh 2>&1 | grep -qi musl; then \
            rollup_variant="${rollup_variant}-musl"; \
        else \
            rollup_variant="${rollup_variant}-gnu"; \
        fi; \
    fi; \
    rollup_native_pkg="$vendored_workspace_dir/@rollup/${rollup_variant}/package.json"; \
    rollup_native_pkg_frontend="$vendored_frontend_dir/@rollup/${rollup_variant}/package.json"; \
    has_native_rollup=false; \
    if [ -f "$rollup_native_pkg" ] || [ -f "$rollup_native_pkg_frontend" ]; then \
        has_native_rollup=true; \
    fi; \
    if ${has_vendored_workspace} || ${has_vendored_frontend}; then \
        if ${has_native_rollup}; then \
            if ${has_vendored_workspace}; then \
                echo "Using vendored dependencies for workspace"; \
            else \
                echo "Using vendored dependencies for frontend workspace"; \
            fi; \
        else \
            echo "Vendored dependencies detected but missing native Rollup binary for ${rollup_variant}; running npm ci"; \
            npm ci; \
        fi; \
    else \
        echo "Vendored dependencies not found, running npm ci"; \
        npm ci; \
    fi

# Build the frontend workspace
RUN npm run build --workspace frontend

FROM nginx:1.25-alpine
# Serve the built frontend
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
