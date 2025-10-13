FROM node:20-alpine AS build
WORKDIR /app

# Copy workspace manifest files to leverage cached dependency installs
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json

# Install only the frontend workspace dependencies using the shared lockfile
RUN npm ci --workspace frontend

# Copy the remaining frontend source code
COPY frontend ./frontend

# Build the frontend workspace
RUN npm run build --workspace frontend

FROM nginx:1.25-alpine
# Serve the built frontend
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
