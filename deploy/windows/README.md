# Running the FutureTech API on a Windows server

This folder builds and installs the .NET 8 API as a Windows service. The package
is **self-contained** — the server does not need the .NET runtime installed.

Everything here was run and verified on a Windows machine: the published build
seeds its database, authenticates, and passes the full 41-check API suite.

---

## 1. Build the package (on your dev machine)

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\publish.ps1
```

Output lands in `deploy\windows\out\` — about **111 MB**, 12 seed files, plus the
operator scripts. Add `-Zip` to also produce `FutureTech.Api-win-x64.zip` for
copying.

## 2. Copy it to the server

Copy the whole `out` folder to the server, for example to `C:\FutureTechApi`.
RDP + copy/paste, a file share, or:

```powershell
# from your machine, if PowerShell remoting is enabled
$s = New-PSSession -ComputerName 35.196.141.147 -Credential (Get-Credential)
Copy-Item .\deploy\windows\out\* -Destination C:\FutureTechApi -Recurse -ToSession $s
```

## 3. Set the signing key before anything else

Open `appsettings.Production.json` on the server and replace `Jwt:SigningKey`.
The shipped value is a placeholder. **Anyone who knows the key can mint a valid
token for any account, including the admin.**

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

`install-service.ps1` warns if you forget, but it will not stop you.

## 4. Check it runs, in the foreground

```powershell
cd C:\FutureTechApi
.\run-api.ps1
```

First start seeds the database and takes a few seconds. You should see
`Now listening on: http://0.0.0.0:5080`. In another window:

```powershell
Invoke-RestMethod http://localhost:5080/health
```

Ctrl+C to stop. Do this before installing the service — startup errors go to the
console here and to the event log once it is a service.

## 5. Install it as a service

```powershell
# Administrator PowerShell
cd C:\FutureTechApi
.\install-service.ps1
```

It registers `FutureTechApi`, sets it to start at boot, configures restart-on-
crash, starts it, and calls `/health` to confirm it is actually serving rather
than merely running.

```powershell
Get-Service FutureTechApi
Restart-Service FutureTechApi
Stop-Service FutureTechApi
Get-EventLog -LogName Application -Source FutureTechApi -Newest 20   # if it misbehaves
```

To remove it: `.\uninstall-service.ps1` (keeps the database) or
`.\uninstall-service.ps1 -RemoveFiles` (deletes everything, including accounts
and progress).

## 6. Open the port

```powershell
.\open-firewall.ps1                                # anywhere
.\open-firewall.ps1 -RemoteAddress 203.0.113.4     # one address only
```

**A cloud VM needs two firewalls opened, not one.** Windows Firewall is what this
script handles; your provider's network firewall is separate:

| Provider | What to add |
|---|---|
| GCP | `gcloud compute firewall-rules create futuretech-api --allow tcp:5080` |
| AWS | Inbound rule, TCP 5080, on the instance security group |
| Azure | Inbound port rule, TCP 5080, on the network security group |

Then, from any other machine: `http://35.196.141.147:5080/health`

---

## Connecting the web app to it

The site is served over **HTTPS** and this API speaks **HTTP**. A browser will
refuse to let an HTTPS page call `http://` directly — that is mixed content, and
no CORS setting changes it. So the browser must not call the API directly.

**Use the Netlify proxy.** Netlify fetches `/api/*` server-side and passes it
through, so the browser only ever sees same-origin HTTPS. This also means CORS
never applies, and you can leave `Cors:Origins` alone.

In Netlify → Site configuration → Environment variables:

| Variable | Value |
|---|---|
| `VITE_DEMO_MODE` | `false` |
| `API_PROXY_TARGET` | `http://35.196.141.147:5080` |

Then trigger a deploy. The build script writes a `_redirects` file that proxies
`/api/*` to the target ahead of the SPA fallback. Check the build log for:

```
[redirects] /api/* -> http://35.196.141.147:5080/api/:splat, SPA fallback written.
```

Leaving `VITE_DEMO_MODE` at `true` keeps the browser-only demo and the API is
never contacted — that is the current default, so you have to change it.

### Verifying the switch

```powershell
# should return JSON, not HTML
Invoke-RestMethod https://future-demand-jobs.netlify.app/api/careers
```

If you get the SPA's HTML instead, the proxy is not in place — the app detects
this case and shows an explicit message rather than failing obscurely.

---

## Putting TLS in front of it

Proxying through Netlify protects the browser hop, but the Netlify → server hop
is still plain HTTP across the public internet. Sign-in credentials and JWTs
cross it unencrypted. For anything beyond testing, terminate TLS at the server:

- **Cloudflare Tunnel** — easiest, no inbound port and no certificate to manage.
  Install `cloudflared`, run `cloudflared tunnel --url http://localhost:5080`,
  and point `API_PROXY_TARGET` at the `https://…trycloudflare.com` hostname it
  prints. You can then close 5080 to the internet entirely.
- **IIS or nginx as a reverse proxy** with a Let's Encrypt certificate
  (win-acme on Windows), forwarding to `http://localhost:5080`.
- **Kestrel HTTPS directly**, by adding a certificate and an `https://` entry to
  `Urls` — workable, but you own renewal.

With real TLS you can also call the API directly from the browser instead of
proxying: set `VITE_API_BASE_URL` to `https://your-host/api` and add the Netlify
origin to `Cors:Origins`.

---

## Configuration reference

All of it lives in `appsettings.Production.json` next to the executable.

| Setting | Default | Notes |
|---|---|---|
| `Urls` | `http://0.0.0.0:5080` | The service reads the port from here. Keep it in step with the firewall rule. |
| `Database:Provider` | `Sqlite` | `Postgres` is also supported. |
| `ConnectionStrings:Sqlite` | `data/futuretech.db` | Relative to the install folder, so the database travels with it. |
| `Jwt:SigningKey` | placeholder | **Must be replaced.** |
| `Jwt:ExpiryHours` | `12` | |
| `Cors:Origins` | Netlify URL | Only used for direct browser calls, not via the proxy. |
| `Seed:CreateDemoUser` | `true` | Seeds `demo@futuretech.local` with ~14 weeks of progress. Set `false` for a clean instance — then register an account before you can sign in. |

The service is started by the Service Control Manager with no arguments, so it
always reads its port from this file. `run-api.ps1 -Port` passes `--urls` on the
command line instead, which is the only thing that overrides the file.

### Switching to PostgreSQL

Install PostgreSQL, create the database, then:

```json
"Database":          { "Provider": "Postgres" },
"ConnectionStrings": { "Postgres": "Host=localhost;Port=5432;Database=futuretech;Username=postgres;Password=…" }
```

Restart the service. Schema and content are created on first run. Note this
starts from an empty database — it does not migrate the SQLite data across.

---

## Accounts

| Email | Password | Role |
|---|---|---|
| `demo@futuretech.local` | `Demo#2026` | Learner, pre-seeded with progress |
| `admin@futuretech.local` | `Admin#2026` | Admin — salary data, content, videos |

**Change both passwords before putting this on a public address**, or set
`Seed:CreateDemoUser` to `false` and register your own account.

---

## Troubleshooting

**Service installs but will not start.** Run `.\run-api.ps1` instead; the real
error appears on the console. The usual causes are a port already in use and
malformed JSON in `appsettings.Production.json`.

**`/health` works locally but not from outside.** One of the two firewalls. Check
the provider's network rule first — it is the one people forget.

**"Could not reach the API".** The SPA is still in demo mode or the proxy is not
configured. Confirm `VITE_DEMO_MODE=false` and `API_PROXY_TARGET` are both set in
Netlify, and that you redeployed after setting them.

**Everything returns 401 after a restart.** Changing `Jwt:SigningKey` invalidates
every token that was already issued. Sign in again.

**Database is locked.** Two copies of the API are pointed at one SQLite file —
likely a leftover `run-api.ps1` console alongside the service. Stop one.
