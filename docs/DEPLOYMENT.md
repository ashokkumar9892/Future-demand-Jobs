# Deployment Guide — FutureTech Career Academy

How to deploy the .NET 8 API and the React SPA, configure a database, set the
administrator account, and verify the result.

**This application is two deployments, not one.** A static host serves the SPA;
the .NET API runs somewhere that executes code. They are wired together at the
end.

| Part | What it is | Where it can run |
|---|---|---|
| `FutureTech.Api` | .NET 8 Web API, Clean Architecture, EF Core | Windows service, IIS, Linux systemd, Docker, Azure App Service / Container Apps |
| `src/frontend` | React 19 + Vite SPA | Netlify, Cloudflare Pages, S3+CDN, or the API's own host behind nginx |

---

## Contents

1. [Prerequisites](#1-prerequisites)
2. [Build the API](#2-build-the-api)
3. [Choose a database](#3-choose-a-database)
4. [Configuration reference](#4-configuration-reference)
5. [Administrator account](#5-administrator-account)
6. [Deploy: Windows service](#6-deploy-windows-service)
7. [Deploy: other targets](#7-deploy-other-targets)
8. [Deploy the SPA and connect it](#8-deploy-the-spa-and-connect-it)
9. [Security checklist](#9-security-checklist)
10. [Verify the deployment](#10-verify-the-deployment)
11. [Upgrading](#11-upgrading)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

**Build machine**

- .NET SDK 8.0 or later. The projects target `net8.0` with
  `RollForward: LatestMajor`, so a .NET 9/10 SDK builds and runs them.
- Node.js 22+ and npm, for the SPA.

**Target server**

- Nothing, if you deploy the self-contained package — it carries its own .NET
  runtime.
- Otherwise the ASP.NET Core 8 runtime.

Verify the build machine:

```powershell
dotnet --version
node --version
```

---

## 2. Build the API

### Self-contained (recommended for a server you control)

No .NET runtime needed on the target. About 111 MB.

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\publish.ps1
# output: deploy\windows\out\        add -Zip for an archive
```

### Framework-dependent (smaller, needs the runtime installed)

```powershell
dotnet publish src\backend\FutureTech.Api\FutureTech.Api.csproj `
  -c Release -o publish
```

### Linux

```bash
dotnet publish src/backend/FutureTech.Api/FutureTech.Api.csproj \
  -c Release -r linux-x64 --self-contained true -o publish
```

The published folder must contain `SeedData/` (12 JSON files). Without it the
API starts and serves an empty platform.

---

## 3. Choose a database

Three providers are supported. Set `Database:Provider` and the matching
connection string. The EF Core model is identical across all three; enums are
stored as strings and dates as ISO-8601, so the data stays readable.

| Provider value | Use when | Needs installing |
|---|---|---|
| `Sqlite` (default) | Single server, one API instance, simplest possible setup | Nothing |
| `SqlServer` | You already run SQL Server | SQL Server 2016+ |
| `Postgres` | You prefer Postgres, or deploy on Linux/containers | PostgreSQL 13+ |

SQLite and SQL Server have both been run end to end against this build: schema
creation, seeding and the full API test suite. PostgreSQL is exercised through
`docker-compose`.

### SQLite

```json
"Database":          { "Provider": "Sqlite" },
"ConnectionStrings": { "Sqlite": "Data Source=data/futuretech.db" }
```

The path is resolved against the install folder, not the working directory, so
the database travels with the installation. Back it up by copying the file
(stop the service first, or copy the `.db`, `.db-wal` and `.db-shm` together).

### SQL Server

```json
"Database": { "Provider": "SqlServer" },
"ConnectionStrings": {
  "SqlServer": "Data Source=YOUR_SERVER;Initial Catalog=FutureTechAPI;User ID=YOUR_USER;Password=YOUR_PASSWORD;TrustServerCertificate=True"
}
```

Notes:

- **Create the database first.** The API creates tables, not the database.
  `CREATE DATABASE FutureTechAPI;`
- The login needs `db_owner` on that database, or at minimum `CREATE TABLE`
  plus read/write. Check with:
  ```sql
  SELECT IS_MEMBER('db_owner'), HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE TABLE');
  ```
- `TrustServerCertificate=True` is required unless the server presents a
  certificate the client trusts. `Microsoft.Data.SqlClient` 5 encrypts by
  default, and without this you get *"A connection was successfully established
  … but then an error occurred during the login process"*.
- Transient failures are retried automatically (5 attempts, up to 10s apart),
  which matters when the database is on a different host from the API.
- Open TCP 1433 from the API host to the database host — both in the OS firewall
  and in the cloud provider's network rules.
- Creating the schema produces 55 tables. Verify with
  `SELECT COUNT(*) FROM sys.tables;`.

### PostgreSQL

```json
"Database": { "Provider": "Postgres" },
"ConnectionStrings": {
  "Postgres": "Host=YOUR_HOST;Port=5432;Database=futuretech;Username=YOUR_USER;Password=YOUR_PASSWORD"
}
```

### Switching providers

Schema and content are created on first run against whichever database you
point at. **Switching providers starts from an empty database** — it does not
migrate existing accounts or progress across.

---

## 4. Configuration reference

Settings live in `appsettings.json`, overridden by
`appsettings.{Environment}.json`, then by environment variables, then by command
line. Use `__` (double underscore) as the separator in environment variables:
`Jwt:SigningKey` becomes `Jwt__SigningKey`.

| Setting | Default | Notes |
|---|---|---|
| `Urls` | `http://0.0.0.0:5080` | Where Kestrel listens. A Windows service reads the port from here. |
| `Database:Provider` | `Sqlite` | `Sqlite`, `SqlServer` or `Postgres`. |
| `ConnectionStrings:*` | see above | One per provider. |
| `Jwt:SigningKey` | dev placeholder | **Must be replaced.** Anyone with it can mint a token for any account. |
| `Jwt:Issuer` / `Jwt:Audience` | `futuretech-academy` / `-web` | Change both together or existing tokens stop validating. |
| `Jwt:ExpiryHours` | `12` | |
| `Cors:Origins` | localhost dev ports | Only used when the browser calls the API directly. Irrelevant behind a same-origin proxy. |
| `Seed:Path` | `SeedData` | Relative to the install folder. |
| `Seed:CreateDemoUser` | `true` | Seeds the administrator and a demo learner with ~14 weeks of progress. |
| `Seed:AdminEmail` | `admin@futuretech.local` | See below. |
| `Seed:AdminPassword` | `Admin#2026` | See below. |

### Precedence gotcha

`ASPNETCORE_URLS` does **not** override a `Urls` value in `appsettings.json` —
the JSON file is loaded after the host environment variables, so the file wins.
To change the port either edit `Urls`, or pass `--urls` on the command line,
which is added last and does win:

```powershell
.\FutureTech.Api.exe --urls "http://0.0.0.0:8080"
```

---

## 5. Administrator account

### Default (development only)

A fresh database is seeded with two accounts:

| Role | Email | Password |
|---|---|---|
| **Administrator** | `admin@futuretech.local` | `Admin#2026` |
| Demo learner | `demo@futuretech.local` | `Demo#2026` |

The administrator can edit salary data, curriculum content and video links, and
reaches `/admin`. The demo learner carries seeded progress so every screen has
data.

**These are published in this document, so treat them as public.** They are for
local development. Anyone who can reach a deployment still running them has
administrator access.

These credentials are **not shown anywhere in the application UI**. The sign-in
page ships no credentials and, outside the browser-only demo, no prefilled
fields.

### Setting your own administrator credentials

Set these before first run. On an existing database they are applied at the next
startup, so this is also how you rotate the password.

```powershell
# Windows service — machine-scoped so the service sees them
[Environment]::SetEnvironmentVariable('Seed__AdminEmail',    'you@yourcompany.com', 'Machine')
[Environment]::SetEnvironmentVariable('Seed__AdminPassword', '<a long random password>', 'Machine')
Restart-Service FutureTechApi
```

or in `appsettings.Production.json`:

```json
"Seed": {
  "AdminEmail": "you@yourcompany.com",
  "AdminPassword": "<a long random password>"
}
```

Generate one:

```powershell
[Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Maximum 256 }))
```

What happens on startup:

- If `Seed:AdminPassword` is still the default, the API logs a warning naming
  the account and does not change anything.
- If it differs, the existing administrator's email and password hash are
  updated to match, and the API logs *"Administrator credentials updated from
  configuration."*

Passwords are stored as PBKDF2-SHA256 with 100,000 iterations and a per-user
salt. The plaintext is never persisted.

**Known limitation:** there is no change-password endpoint yet, for any user.
Configuration is currently the only way to change the administrator password,
and learners cannot change theirs at all. Because configuration is applied at
every startup, a password changed any other way would be reverted on restart.

### Removing the demo learner

For a clean production instance:

```json
"Seed": { "CreateDemoUser": false }
```

This skips **both** seeded accounts, so create your own via
`POST /api/auth/register` before you can sign in. Registered users get the
`Learner` role; promoting one to `Admin` currently requires a direct database
update:

```sql
UPDATE Users SET Role = 'Admin' WHERE Email = 'you@yourcompany.com';
```

---

## 6. Deploy: Windows service

Full runbook, including firewall and TLS: [`deploy/windows/README.md`](../deploy/windows/README.md).

```powershell
# 1. Build (on the build machine)
powershell -ExecutionPolicy Bypass -File deploy\windows\publish.ps1

# 2. Copy deploy\windows\out\ to the server, e.g. C:\FutureTechApi

# 3. Edit appsettings.Production.json: Jwt:SigningKey, database, Seed:AdminPassword

# 4. Smoke-test in the foreground — errors appear on the console, not the event log
.\run-api.ps1

# 5. Install as a service (Administrator)
.\install-service.ps1      # auto-start, restart-on-crash, post-install health check
.\open-firewall.ps1
```

If you copied the whole `deploy\windows` folder, the binaries are in its `out`
subfolder; the scripts look there automatically.

```powershell
Get-Service FutureTechApi
Restart-Service FutureTechApi
Get-EventLog -LogName Application -Source FutureTechApi -Newest 20
```

---

## 7. Deploy: other targets

### IIS

Install the [ASP.NET Core Hosting Bundle](https://dotnet.microsoft.com/permalink/dotnetcore-current-windows-runtime-bundle-installer),
then create a site pointing at the published folder with an application pool set
to **No Managed Code**. The app runs in-process; `Urls` is ignored and IIS
supplies the binding. Give the app pool identity write access to the SQLite file
or the folder holding it.

### Linux (systemd)

```ini
# /etc/systemd/system/futuretech-api.service
[Unit]
Description=FutureTech Career Academy API
After=network.target

[Service]
WorkingDirectory=/opt/futuretech-api
ExecStart=/opt/futuretech-api/FutureTech.Api
Restart=always
RestartSec=5
User=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=Jwt__SigningKey=<your key>
Environment=Seed__AdminPassword=<your password>

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now futuretech-api
sudo journalctl -u futuretech-api -f
```

`WorkingDirectory` matters: it is how the app finds `appsettings.json` and
`SeedData`.

### Docker

`docker-compose.yml` at the repo root brings up PostgreSQL, the API and the web
tier together:

```bash
docker compose up --build
```

The API image is `src/backend/FutureTech.Api/Dockerfile`.

### Azure

- **App Service (Windows or Linux)** — deploy the published folder. Put every
  secret in Application Settings; the `__` separator works there.
- **Container Apps** — build the API Dockerfile, push to ACR, set the same
  environment variables as secrets.

In both cases prefer Azure SQL or Azure Database for PostgreSQL over SQLite:
App Service storage is not a good home for a write-heavy single file, and it
cannot be shared across scaled-out instances.

> **Scale-out note.** SQLite is single-writer. If you run more than one instance
> of the API, use SQL Server or PostgreSQL.

---

## 8. Deploy the SPA and connect it

### Build

```bash
cd src/frontend
npm ci
npm run build          # -> dist/
```

### Netlify

`netlify.toml` at the repo root already sets `base`, `command` and `publish`.
Routing is generated into `dist/_redirects` at build time.

Environment variables:

| Variable | Value | Meaning |
|---|---|---|
| `VITE_DEMO_MODE` | `false` | Talk to the real API. `true` is the browser-only demo. |
| `API_PROXY_TARGET` | `http://YOUR_API_HOST:5080` | Netlify proxies `/api/*` here, server-side. |

Confirm in the build log:

```
[redirects] /api/* -> http://YOUR_API_HOST:5080/api/:splat, SPA fallback written.
```

### Why the proxy, and not a direct call

The site is served over HTTPS. A browser will not let an HTTPS page call an
`http://` API — that is mixed content, and no CORS setting changes it. Proxying
through Netlify means the browser only ever makes a same-origin HTTPS request,
and CORS never applies.

If the API has real TLS you can skip the proxy: set
`VITE_API_BASE_URL=https://your-api-host/api` and add the site's origin to
`Cors:Origins`.

### Demo mode

`VITE_DEMO_MODE=true` bundles the seed content into the browser and keeps
progress in `localStorage`, with no API at all. It exists so a static host is a
working product rather than a shell.

**Never use demo mode for a real deployment.** Its accounts and their passwords
are compiled into the JavaScript bundle, because there is no server to check
them against. They unlock only that visitor's own browser, but they are readable
by anyone.

---

## 9. Security checklist

Before exposing a deployment:

- [ ] **`Jwt:SigningKey` replaced.** The default is in source control. Anyone
      with it can forge a token for any account, including the administrator.
      Changing it invalidates all issued tokens — users sign in again.
- [ ] **`Seed:AdminPassword` set**, or `Seed:CreateDemoUser` false. The default
      is published in this document.
- [ ] **`Seed:CreateDemoUser` false** for a production instance, unless you want
      the demo learner.
- [ ] **TLS in front of the API.** Kestrel binds plain HTTP here. Over a public
      network that means credentials and JWTs travel in the clear. Use
      Cloudflare Tunnel, or IIS/nginx with a certificate.
- [ ] **Database credentials in environment variables or a secret store,** never
      in a file committed to source control. `appsettings.Production.json` in the
      repo is a template: fill it in on the server.
- [ ] **Firewall scoped.** If only the proxy needs to reach the API, allow only
      that source address rather than the whole internet.
- [ ] **Database port not public.** 1433 or 5432 should be reachable from the API
      host, not from everywhere.
- [ ] **Backups.** Copy the SQLite file, or use your SQL Server / PostgreSQL
      backup schedule.

---

## 10. Verify the deployment

Do these in order; each one rules out a different failure.

```powershell
# 1. The process is alive and serving
Invoke-RestMethod http://localhost:5080/health
# -> status=ok

# 2. Content actually seeded (this is what an empty SeedData folder breaks)
$t = (Invoke-RestMethod -Method Post http://localhost:5080/api/auth/login `
      -ContentType application/json `
      -Body '{"email":"admin@futuretech.local","password":"Admin#2026"}').token
Invoke-RestMethod http://localhost:5080/api/admin/stats -Headers @{ Authorization = "Bearer $t" }
```

A correctly seeded instance reports:

```
careers=13  courses=10  modules=30  lessons=60  videos=60  videosWithUrl=49
practiceQuestions=56  interviewQuestions=20  projects=10
```

If `careers=0`, `SeedData/` is missing from the deployed folder or the content
root is wrong.

```powershell
# 3. Reachable from outside
# from another machine:
Invoke-RestMethod http://YOUR_API_HOST:5080/health

# 4. The SPA reaches the API — must return JSON, not HTML
Invoke-RestMethod https://your-site.netlify.app/api/careers
```

If step 4 returns the SPA's HTML, the proxy is not configured. The app detects
this case and says so on the sign-in page rather than failing obscurely.

Swagger is at `/swagger` for exploring the API directly.

---

## 11. Upgrading

1. Build a new package.
2. Stop the service.
3. **Back up the database.**
4. Replace the binaries, keeping `appsettings.Production.json` and the `data`
   folder. `install-service.ps1` excludes `data` when it copies.
5. Start the service and re-run the verification above.

Schema handling is `EnsureCreated` plus an additive `SchemaSync` pass that adds
tables the model has gained. **There are no EF Core migrations yet**, so a
change to an existing table's columns is not applied automatically. Adopt
migrations before you have production data you cannot recreate.

---

## 12. Troubleshooting

**Service installs but will not start.** Run `.\run-api.ps1` instead; the real
error goes to the console. Usually a port already in use or malformed JSON in
`appsettings.Production.json`.

**Starts, reports healthy, every screen is empty.** `SeedData/` is not in the
deployed folder, or the working directory is not the install folder. Check the
startup log for `Seeding content pack from <path>` and confirm that path exists.

**`SQLite Error 14: unable to open database file`.** The account running the
service cannot write to the database folder, or the path does not exist. The
`data` folder is created at startup; check permissions.

**SQL Server: login succeeds then fails during the login process.** Add
`TrustServerCertificate=True`, or install a certificate the client trusts.

**SQL Server: `CREATE TABLE permission denied`.** The login is not `db_owner` on
that database, or the database does not exist yet.

**Everything returns 401 after a restart.** `Jwt:SigningKey` changed, which
invalidates every issued token. Sign in again.

**Administrator password will not change.** Confirm `Seed__AdminPassword` is
visible to the *service* (machine-scoped, not just your shell) and look for
*"Administrator credentials updated from configuration."* in the log.

**`database is locked` (SQLite).** Two processes are using one file — commonly a
leftover `run-api.ps1` console alongside the service. Stop one.

**"Could not reach the API" on the site.** The SPA is still in demo mode, or the
proxy is not set. Confirm `VITE_DEMO_MODE=false` and `API_PROXY_TARGET`, and
that you redeployed after changing them.
