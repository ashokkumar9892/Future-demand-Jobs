# ---- build ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore in its own layer so a source change does not invalidate the NuGet cache.
COPY ["Directory.Build.props", "./"]
COPY ["FutureTech.Domain/FutureTech.Domain.csproj", "FutureTech.Domain/"]
COPY ["FutureTech.Application/FutureTech.Application.csproj", "FutureTech.Application/"]
COPY ["FutureTech.Infrastructure/FutureTech.Infrastructure.csproj", "FutureTech.Infrastructure/"]
COPY ["FutureTech.Api/FutureTech.Api.csproj", "FutureTech.Api/"]
RUN dotnet restore "FutureTech.Api/FutureTech.Api.csproj"

COPY . .
RUN dotnet publish "FutureTech.Api/FutureTech.Api.csproj" -c Release -o /app/publish --no-restore

# ---- runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Non-root: a container escape should not start with privileges.
RUN adduser --system --uid 1001 --group appuser
COPY --from=build --chown=appuser:appuser /app/publish .
USER appuser

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD ["/bin/sh", "-c", "wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1"]

ENTRYPOINT ["dotnet", "FutureTech.Api.dll"]
