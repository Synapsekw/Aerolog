# Local testing handover — 6 September 2026

Open http://127.0.0.1:3000/ and use the development **admin / manager / pilot / technician / observer** sign-in buttons. The server runs on the Mac and connects to the existing Supabase project. No Vercel deployment or remote Git push was performed.

## Verified

| Check | Result |
| --- | --- |
| Next.js optimized build and TypeScript compilation | Passed |
| Import unit tests | 4 passed |
| Real Supabase/API integration checks | 23 passed |
| Runtime dependency audit | No reported vulnerabilities |
| Secret scan of source and browser build output | No configured private credentials found |
| 390px responsive view | Dashboard and logbook fit without page overflow; mobile navigation closes on selection |
| Mission draft saved through UI | Persisted and reopened from Supabase |
| Mapbox | Dark basemap and saved mission boundary visibly rendered; token and styles configured |
| Flight detail | Saved synthetic trace, altitude chart and battery data available |

The integration checks cover authentication for five roles, local login origin restrictions, database permissions, independent review, complete risk assessments, locked packages, overnight assignment conflicts, optimistic concurrency, private mission documents and PDF packages, debrief completion, duplicate flight protection, usage accounting, malformed DJI input, original source-file archiving, battery quarantine, maintenance sign-off, tenant isolation, account provisioning and membership revocation. Temporary integration fixtures were removed after each run.

## Remaining limits

- **Historical DJI account cloud sync is not available.** No verified supported API contract was identified for syncing a pilot's historical records by account login. The supplied account credentials have not been transmitted to undocumented endpoints. DJI TXT parsing is installed; actual encrypted logs from your fleet still need a compatibility test and the corresponding DJI parsing entitlement.
- Email invitations, password-reset mail and approval emails are not enabled. Use in-app approvals and notifications, local test sign-in, administrator-created temporary credentials and Settings → Change password. Configure and test an email provider in a later phase.
- Airspace restriction feeds and live weather are not connected. Mapbox provides the basemap. Risk entries and test certificates are sample planning data.
- Battery charts display measured or explicitly synthetic test data. Predictive AI is future work. Uploaded originals are retained privately for later reprocessing.
- The repository's strict `npm run lint` check is **not clean**: it reports explicit dynamic JSON/form types, React effect guidance and accessibility/type findings in application and supplied shadcn components. TypeScript, the build and the integration suite pass, but this lint cleanup remains engineering work before a production release.
- The PDF package currently uses a standard Latin font with a text fallback for unsupported characters. Full multilingual PDF typography is a later improvement.

Sample records are labeled **LOCAL SAMPLE** or **SYNTHETIC LOCAL TEST FIXTURE**. They exist to exercise screens and workflows, and are not real flight history. See the root README for setup, import formats, role workflows and the future Vercel runtime considerations.
