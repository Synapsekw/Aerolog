# AEROLOG — local drone operations application

A Next.js application with Supabase authentication, role permissions, persistent operational records, private document storage, Mapbox maps and a responsive glass interface. This checkout is for local testing. There is no new web deployment or remote Git push.

## Start locally

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:3000/**. The development sign-in screen offers **admin, manager, pilot, technician and observer** test accounts. These are real Supabase sessions. The shortcut is restricted to the loopback host in development and is absent from production builds.

The Supabase project is already linked and migrations are applied. `.env.local` contains your existing settings and is ignored by Git. You do not need to create another project or choose its region again. The app runs on your Mac; its data and private files are stored in your connected Supabase project, so an internet connection is required.

The current workspace also contains clearly labeled **LOCAL SAMPLE** flights, synthetic telemetry, a draft, an approval package and a work order. `npm run seed:examples` adds the repeatable samples without overwriting existing records.

To bootstrap the initial test workspace again without overwriting operational records:

```sh
npm run setup:local
```

For DJI TXT parsing, use Python 3.10+ (this machine uses 3.12):

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Set `DJI_PARSER_PYTHON` in `.env.local` to the absolute path of `.venv/bin/python`. It is already configured on this machine. Restart the dev server after changing environment values. The Next.js build deliberately does not bundle the machine-specific Python environment.

## Testing the workflows

1. Sign in as **admin**. Inspect Inventory, Batteries and Crew. Initial equipment and certificates are explicitly local test fixtures.
2. Plan a mission: enter the site, date and time, draw a boundary on Mapbox, assign different pilot/observer, choose a ready aircraft and compatible equipment, and complete the hazards, mitigations and residual risk scores. Save drafts or submit the package.
3. Sign out and select **manager**. Open the submitted mission, download its PDF package and approve it or request changes with a note. Independent review is enforced by default. Approval locks the plan and its attachments.
4. As the assigned pilot or administrator, complete an approved mission with a debrief. Record a flight or import logs. Aircraft hours update transactionally and duplicate source identifiers do not count twice.
5. As **technician**, create a work order and sign it off with findings. The next service threshold advances from the recorded aircraft hours. Record battery charge cycles and measured health/temperature; quarantine stays in force until explicitly changed by an authorized fleet user.
6. Inspect flight traces, battery events, notifications and the audit trail. Settings allows administrators to create accounts, manage access and update operational thresholds. Accounts and crew qualifications are separate records.

Open two browser sessions with different roles to test stale edits. The server rejects outdated revisions. Visible workspaces refresh every 30 seconds and after mutations; the refresh button updates immediately.

## Import formats

- **CSV:** download the template from Flight logs → Import logs. Required columns: `date` (`YYYY-MM-DD`) and `durationSeconds`. Optional: `distanceKm`, `altitude`, `start`, `end`, `battery`, `notes`, `pilot`, `aircraft`, `mission`. Choose the responsible pilot and registered aircraft before import. Battery values are registered battery IDs; leave blank when unknown.
- **Normalized JSON:** an object, an array, or `{ "flights": [...] }` containing the same fields. `distanceMeters` is also accepted. Optional `telemetry` points contain `time` in seconds, `longitude`, `latitude`, `altitude` in metres above takeoff, and optional `battery` percent, `temperature` Celsius, `voltage` volts and `speed` metres/second.
- **DJI binary TXT:** server-side decoding uses [pydjirecord](https://github.com/rembish/pydjirecord). Encrypted records require the supplied DJI Open API key and flight-record parsing access. The current machine is configured, but decoding your actual aircraft logs remains unverified until a representative log is imported. Unsupported or malformed files return an error, never synthetic telemetry.

Imports accept up to 25 MB and 500 flight summaries per file. The plotted DJI trace is sampled to at most 15,000 points. Original uploaded files are retained privately in Supabase after confirmed import, with a SHA-256 digest, and can be downloaded from flight details. If a batch partially fails, saved flights remain; retry skips duplicates. The UI tells you if source archiving fails after the flights were saved.

## Integration boundaries

**DJI account cloud sync is not implemented or claimed working.** A developer parsing key is not sufficient evidence of a supported historical pilot-account sync API. Test account credentials stay server-side and have not been sent to undocumented endpoints. Importing supported logs is the available path. [DJI Cloud API documentation](https://developer.dji.com/doc/cloud-api-tutorial/en/) describes a separate integration surface; a verified supported account-sync contract is still required.

Mapbox dark and satellite basemaps are connected. Regulatory airspace layers and live weather are not connected; the map displays this state. Battery prediction is a future feature; current charts show recorded measurements, not AI predictions.

Approval packages and notifications are available inside the application. Email invitations, email password resets and emailed approval notifications are not configured or enabled. New accounts receive a temporary password once through the administrator interface; users can change their own password in Settings. Supabase administrators can reset accounts through the Supabase dashboard.

## Validation and architecture

```sh
npm test
npm run typecheck
npm run test:integration  # requires dev server and .env.local
npm run build
npm run lint
```

Integration checks use temporary records in the local test workspace and remove only their own fixtures. They exercise roles, RLS isolation, risk validation, independent review, overnight conflicts, version conflicts, private files, PDF creation, flight accounting, duplicate protection, negative-value rejection, battery quarantine, maintenance sign-off and import preview. They require authenticated Supabase access.

Operational tables use the `aerolog_` prefix. Writes use authenticated transactional PostgreSQL functions with organization locks, optimistic revisions and audit records. Direct browser table mutations are revoked. The service secret is used only by server modules for explicitly authorized account and private-file operations. Database migrations are in `supabase/migrations`; existing unrelated Supabase tables are preserved.

Local Git only. For the later Vercel phase, configure production authentication redirects and email delivery, remove local test fixtures from the intended production organization, and move the Python decoder to a supported service/runtime or replace it with a compatible Node/Rust worker. The current local Python path is not a Vercel deployment configuration.
