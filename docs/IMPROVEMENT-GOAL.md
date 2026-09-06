# Local improvement goal

Preserve AEROLOG design, organization isolation, immutable flight accounting and
local Git. Independently implement product behavior; no AGPL application code copying.

- [x] Refresh the AEROLOG logo and place it beside the name in the header, matching the existing design. Added an original drone/A monogram with the app's lime-to-cyan gradient; verified its placement in the local browser.
- [ ] Flight analysis: shared map/chart cursor, route scrubbing, timestamp-based playback, altitude coloring, truthful missing-data panels and exports.
- [ ] Imports: better normalized data contract, supported CSV adapters, identity/provenance, duplicate candidates and safe enrichment; preserve raw logs.
- [ ] Battery history: per-battery measurements and multi-battery links; distinguish service-life counters from measured health.
- [ ] Inventory: source identity, review workflow, usable search/filter and readiness details.
- [ ] Teams: review membership management, role changes and deactivation, permissions and pilot totals; preserve organization access boundaries.
- [ ] Validate integrated workflows, responsive UI and local persistence; document original-file-dependent limitations.

## Verified progress — 6 September 2026

- Implemented flight analysis with a shared chart/route cursor, untimed KML scrubbing, timestamp-based playback, altitude colors and GeoJSON export. Height datum stays in export metadata rather than being mislabeled as absolute GeoJSON elevation. Display sampling preserves extrema and missing-reading boundaries. Browser verified Ivan's real route and the altitude toggle; timed playback and responsive checks remain to finish.
- Added searchable, paginated team access directory with role/status filters and identity-based totals. Browser verified Ivan's 20 flights / 8.22 h and opened his access editor without changing his permissions.
- Passed 14 unit tests, production build, and 29 organization API checks using isolated temporary test users/organizations with cleanup. Existing e& records were not modified.
- Fixed a map race found during browser QA: route updates no longer depend on all source data finishing loading. Stable empty geometry defaults prevent redundant route writes while scrubbing.

### Import contract progress

- Normalized JSON now retains exact timestamps, source aircraft/battery serials, per-pack capacity/current/cell readings and parser provenance. These fields pass through the same validated preview/save schema.
- Added an independently written Airdata telemetry CSV adapter with explicit unit conversion, GPS distance, sample-span duration and strict clock/unit checks. No upstream AGPL code or third-party service is used.
- 17 unit tests pass; production build passes. Real Airdata/DJI-file validation, duplicate candidate review, safe enrichment and the battery history UI remain pending. See `TELEMETRY-IMPORTS.md` for supported columns and limits.

### Battery history progress

- Added per-flight battery telemetry trends to the battery passport: reported full capacity, full/design ratio, minimum voltage, peak temperature, maximum simultaneous cell spread and observed discharge rate. Measured flights link back to their flight analysis.
- Attribution requires an unambiguous pack serial or a single-battery assignment. Combined aircraft readings are not copied to multiple packs. Charge increases and clock resets suppress discharge-rate estimates. Missing channels stay empty; inventory cycle counters do not become health estimates.
- Passed 21 unit tests and production build. Browser confirmed Ivan's linked battery shows 0 measured flights and no fabricated readings. Populated-chart and responsive QA remain in the final validation pass.

### Duplicate review progress

- Added per-flight import review with exact source-hash duplicates, aircraft-serial/exact-start matches across time zones, and weaker same-day/aircraft/duration/distance candidates.
- Exact matches are skipped; other candidates default to skip with an explicit separate-flight choice. Candidates are not automatically merged, deleted or attached to an existing flight. Reviewed new flights alone increment usage.
- Fixed batch source archive IDs: duplicate rows within an upload reference the actual saved record, not the discarded generated ID. Skipped uncertain matches are excluded from source attachments.
- 25 unit tests pass. Safe audited enrichment and browser import review QA are still pending; candidate checks supplement existing database hash uniqueness and do not replace server permissions.

### Audited enrichment progress

- Managers/admins can choose an existing duplicate candidate in import review and add a review reason. The endpoint adds telemetry, never duration, track geometry, equipment links, accounting or original import hashes. Existing sample sets accept missing channels only; conflicting values or different sample grids require manual review.
- Applied migration 013: service-only RPC checks active manager membership, organization and revision under the existing lock order; writes before/after audit data and tracks source hashes. Previously enriched sources are detected on reimport.
- Database rollback test proved retained duration/KML, unchanged fleet and battery events, audit insertion, stale revision rejection and lack of authenticated direct RPC access. No operational flight was modified. Production build and 28 unit tests passed before the added enrichment-reimport regression test.
- Browser import/enrichment and final responsive/real-data checks remain pending.

### Integrated validation progress

- Browser verified timed playback advances and pauses with a map marker and chart cursor; at 390 px the flight header, playback controls and charts wrap without collisions. Verified the local sample battery has 7 populated voltage-history points at phone width. Restored the normal viewport.
- Improved partial import failures: successfully saved/enriched rows still attempt source archiving, workspace state refreshes, and the error reports retained progress with a retry path. Cleared readiness measurements now remain unknown instead of becoming zero; imported assets can retain Unverified while being reviewed.
- Extended isolated organization API tests with normalized file preview, manager-only enrichment, revision conflict, persisted telemetry and serial, raw source archive, audit and unchanged usage. Test resources (including storage files) are cleaned up.
- Native Codex file-picker computer use is prohibited by the tool, so full browser file-upload review is not verified. This does not block independent API tests or other work; do not claim that browser workflow passed.
- Expanded integration run passed all 35 API checks, including the enrichment/archive path. Usage comparison uses the saved value before enrichment, respecting existing three-decimal accounting precision.
