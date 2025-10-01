FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ./src/PosBackend/PosBackend.csproj ./
RUN dotnet restore PosBackend.csproj || true
COPY ./src/PosBackend ./
RUN dotnet publish PosBackend.csproj -c Release -o /app/publish || true

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish ./
ENV ASPNETCORE_URLS=http://0.0.0.0:5000
EXPOSE 5000
ENTRYPOINT ["dotnet", "PosBackend.dll"]
