FROM node:22-bookworm-slim AS ocr
WORKDIR /src
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
RUN npm ci --ignore-scripts --workspaces=false
COPY scripts/prepare-mobile-ocr.mjs scripts/
RUN node scripts/prepare-mobile-ocr.mjs

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY backend/src/PosSync/ backend/src/PosSync/
COPY backend/src/PosMobile/ backend/src/PosMobile/
COPY --from=ocr /src/backend/src/PosMobile/wwwroot/ocr/ backend/src/PosMobile/wwwroot/ocr/
RUN dotnet publish backend/src/PosMobile/PosMobile.csproj -c Release -o /app --no-self-contained

FROM mcr.microsoft.com/dotnet/aspnet:8.0-bookworm-slim
WORKDIR /app
COPY --from=build /app/ ./
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "PosMobile.dll"]
