# Local improvement acceptance — 6 September 2026

This records the completed scope of the Open DroneLog-inspired improvement goal.
It supersedes the chronological “pending QA” notes in IMPROVEMENT-GOAL.md.

| Requirement | Implemented evidence | Validation |
| --- | --- | --- |
| Code-level upstream review and useful reuse | OPEN-DRONELOG-CODE-REVIEW.md examines parser, telemetry, maps, battery calculations, identity, profiles and folder sync at commit 8b1a863. AEROLOG behavior is independently implemented; AGPL application source was not copied. | Source audit distinguishes applicable features from incompatible desktop/profile architecture. Existing org permissions and inventory are retained. |
| Preserve design, improve brand | Original lime/cyan drone-A SVG beside AEROLOG; glass cards and current navigation retained. | Browser inspected logo, full-page analysis, inventory and team directory. |
| Flight analysis and route inspection | flight-analysis.tsx and mission-map.tsx: shared cursor, scrubbing, timed playback, altitude colors, missing-channel panels and GeoJSON. Export keeps source heights in metadata instead of asserting an absolute GeoJSON altitude. | Real Ivan KML path/color toggle and untimed labels inspected; sample timed playback started/paused/reset; 390 px control/chart layout inspected. Unit tests cover irregular times, missing channel boundaries and extrema preservation. |
| Robust telemetry imports | Summary CSV, normalized JSON, Airdata telemetry CSV; precise timestamps, serials, units, sample provenance and battery-pack channels. Existing DJI TXT path gains decoded identity and explicit large-log sampling disclosure. | Unit fixtures verify CSV unit conversions, malformed units/times, independent packs and normalized fields. API test uploads normalized JSON and checks persisted telemetry/serial. Python parser syntax checked; real TXT compatibility is not claimed. |
| Deduplication and enrichment | Exact source hashes plus reviewed cross-format candidates; manager-only enrichment adds telemetry without accounting changes, checks revision and conflicts, and audits the update. | Unit tests plus 38 isolated API checks cover duplicate imports, reviewer permissions, stale revisions, persisted results, original source archive and source-link retries. Rollback-only SQL test confirms retained KML/duration and unchanged fleet/battery events. Browser synthetic-file preview verifies all decision types and mandatory reason gating without saving test flights into e&. |
| Source and accounting preservation | Original flight data retained; raw file archive retries merge links transactionally. Partial batch errors archive completed rows, refresh and explain retained progress. | Read-only e& audit: 27 total flights; Ivan 20 flights, 29,532 KML positions, 29,599 seconds; no invented telemetry. API tests clean temporary users/orgs/files; rollback tests leave no writes. |
| Battery history | Passport trends for full capacity, full/design ratio, voltage, temperature, simultaneous cell spread and observed discharge. Separate serial-based pack readings; combined readings not duplicated to two packs. | Unit tests for pack identity ambiguity and charge increases; browser viewed 7 populated sample voltage points on mobile and Ivan’s truthful empty state. Cycle counts are not converted to measured health. |
| Inventory workflow | Categorized, searchable, paginated inventory; GUID/source serial/status retained; source imports stay Unverified until review. Custody/service editor preserves unknown values; Unverified amber; no unknown-value progress bars. | Browser inspected category counts, source aircraft search/passport, serial/status, unknown maintenance fields and linked flights. Schema tests preserve unknown readiness; existing DB mission gate rejects unreviewed equipment. |
| Teams | Search/role/status filters, paginated membership directory, access editor, org totals and stable pilot attribution; branding and invite workflow retained. | Browser filtered Ivan and opened editor without changing access; API tests cover invitations, org isolation, deactivation/reactivation and pilot attribution; unit tests prevent duplicate-name misattribution. |
| Local validation and delivery | Local-only commits, no deployment or remote push. | 29 unit tests, 38 API checks, rollback DB check and production build pass. Mobile import width bug found and fixed during browser QA. |

## Source-dependent limits

- The supplied KML contains route coordinates and heights, not sample timestamps,
  battery readings, current or cell voltages. Those channels remain empty until
  an original telemetry file supplies them.
- DJI personal-account historical cloud sync has not been established through
  a supported direct DJI API. This goal does not claim that capability.
- Real DJI TXT and real Airdata-export compatibility still require operator
  source files. Synthetic fixtures/API tests validate AEROLOG's contract and
  workflows, not every device/firmware/export version.
- The existing DJI parser uniformly reduces large logs to its stored sample
  limit; preview/provenance disclose this. Raw TXT is archived, but short events
  may not appear in reduced curves. These charts are not a battery fault detector.
- Enrichment refuses conflicting readings or a different existing sample grid.
  It does not silently overwrite/merge ambiguous operational history.

All defined local improvement workflows are implemented and validated within
these explicitly reported data/decoder limits. Web deployment remains deferred.
