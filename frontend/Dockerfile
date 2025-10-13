FROM node:20-alpine AS build
WORKDIR /app

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
RUN if [ -d node_modules ] && [ "$(ls -A node_modules)" ]; then \
        if npm ls --workspace frontend @rollup/rollup-linux-x64-musl >/dev/null 2>&1; then \
            echo "Using vendored dependencies for workspace"; \
        else \
            echo "Vendored dependencies found but missing linux rollup binary; reinstalling"; \
            rm -rf node_modules frontend/node_modules; \
            npm ci; \
        fi; \
    elif [ -d frontend/node_modules ] && [ "$(ls -A frontend/node_modules)" ]; then \
        echo "Using vendored dependencies for frontend workspace"; \
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
