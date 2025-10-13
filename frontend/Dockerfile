FROM node:20-alpine AS build
WORKDIR /app

# Copy workspace manifests and install dependencies
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
RUN npm ci

# Copy the frontend workspace including its vendored dependencies
COPY frontend ./frontend

# Build the frontend workspace
RUN npm run build --workspace frontend

FROM nginx:1.25-alpine
# Serve the built frontend
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
