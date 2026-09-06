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
