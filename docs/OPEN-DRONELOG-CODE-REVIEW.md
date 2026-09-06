# Open DroneLog implementation review

Reviewed 6 September 2026. Upstream `main` resolved to
`8b1a863f5317bb85ef34cb7454d419460bd17893` (package version 3.3.0).
This is a source-code review, not a runtime benchmark, security audit, or proof of
compatibility with Ivan's original DJI files. No upstream application code was
copied into AEROLOG, and no credentials or private logs were sent to this project.

## Recommendation

Keep AEROLOG's operations, organization, approval and inventory foundation.
Use Open DroneLog as a detailed reference for post-flight analysis. Prefer
independently licensed upstream libraries over copying its application modules.
An unmodified local Open DroneLog installation could also serve as an optional
file-conversion tool, followed by a documented interchange import. That still
requires mapping its exported fields to ours; its exports are not currently
accepted by AEROLOG's normalized JSON importer unchanged.

## Reuse and licensing

The application declares AGPL-3.0-only in both package.json and Cargo.toml.
Copying/adapting substantial components is not a permissive-license shortcut:
AGPL source-availability obligations can apply to a combined/modified application,
including network use. A separate process is not automatically a license exception.
Resolve that licensing choice before incorporating application source. Ordinary
flight-data exports and independently implemented interoperability are a different
route from copying its implementation.

Sources: [application license](https://github.com/arpanghosh8453/open-dronelog/blob/8b1a863f5317bb85ef34cb7454d419460bd17893/LICENSE),
[dependency declarations](https://github.com/arpanghosh8453/open-dronelog/blob/8b1a863f5317bb85ef34cb7454d419460bd17893/src-tauri/Cargo.toml).
The underlying [dji-log-parser](https://github.com/lvauvillier/dji-log-parser)
is separately MIT-licensed and provides a CLI, Rust library and a JavaScript
binding directory. Evaluate its bindings against our target platforms before
replacing the existing pydjirecord adapter. Our current importer already delegates
binary DJI decoding to a library; we are not starting that capability from zero.

## Findings by implementation

| Area | Code inspected | What it does better / reuse opportunity | AEROLOG integration work |
|---|---|---|---|
| DJI decoding | `src-tauri/src/parser.rs` 190–335, 809–940; `api.rs` | Format dispatch, SHA-256 duplicate check, per-file decryption-key caching, parser panic isolation. Uses DJI flight-record keychains. | Keep our upload boundary; enrich our decoder output with precise UTC time, aircraft/battery/controller serials, cell voltages, capacities and messages. Cache successful keychains privately. Benchmark the MIT decoder rather than copying its AGPL wrapper. |
| CSV interoperability | `airdata_parser.rs` 1–110; `litchi_parser.rs`; `dronelogbook_parser.rs` 1–65 | Detects headers and converts feet/metres, mph/knots/m/s and Fahrenheit/Celsius. | Add format adapters with known fixtures. Our CSV currently requires date/durationSeconds, and our JSON is normalized application JSON. Important: their `dronelogbook_parser.rs` reads **Open DroneLog's own export**, not the DroneLogbook SaaS API or Ivan's original summary CSV. |
| Chart interaction | `src/components/charts/TelemetryCharts.tsx` 891–970 and field definitions | ECharts zoom synchronizes across charts with a recursion guard; playback drives shared chart cursors. Field selection covers cell voltages, RC, GPS, attitude and capacity. | Reuse an independently licensed chart library or extend our Recharts interaction. Add one shared cursor/selection model. This is an adapter project, not a drop-in component. |
| Flight replay | `src/components/map/FlightMap.tsx` 535–715 | requestAnimationFrame playback, scrubbing, speed control, interpolated marker and telemetry overlay; MapLibre + deck.gl supports 3D and path coloring. | Keep our Mapbox map. Add timestamp-aware replay for timed logs and explicitly labeled route scrubbing for KML. Component imports their Zustand store, i18n, custom types, map styles and UI. |
| Telemetry storage | `src-tauri/src/database.rs` 1223–1540 | Raw telemetry is queried separately and display requests may request fewer points; exports can request raw rows. DuckDB handles aggregation. | Move large telemetry out of bootstrap JSON into per-flight fetches/private storage. Keep summaries in Supabase. Avoid adopting a second authoritative database just for charts. |
| Battery history | `database.rs` 1587–1610, 1797–1830; `Overview.tsx` 1850–2260 | Full-capacity history per serial and discharge rate per minute across flights. | Store actual measurements and provenance; chart capacity, cell spread and temperature per physical battery. Existing inventory metadata alone cannot populate those graphs. |
| Battery pairing | `src/lib/batteryPairs.ts` 25–85; `src-tauri/src/battery_pairs.rs` | Explicit serial-pair definitions, deterministic group keys, first unambiguous partner mapping. | Keep each battery's GUID as primary identity; add optional pair membership. Our flight records already retain multiple battery IDs. Never infer pair identity from similar names. |
| Cross-format duplicates | `database.rs` 2388–2607 | File hash plus exact drone serial/battery serial/start-time signature; maintenance deduplication keeps the record with more telemetry points. | Add duplicate candidate detection and audited enrichment into the existing flight. Do not auto-delete operational history or re-add hours. Missing serials/timezones require review. |
| Folder sync | `src-tauri/src/server.rs` 1673–1775, 2415–2520 | Manual/scheduled scan of per-profile SYNC_LOGS_PATH folders, import outcomes, blacklist. | Useful local companion workflow for controller/phone-exported files. A browser/Vercel deployment cannot continuously scan a user's filesystem; it needs a local companion or uploads. |
| Export/reporting | `src/lib/exportUtils.ts` 15–80, 395–590; `htmlReportBuilder.ts` | CSV/JSON/GPX/KML builders, XML escaping, grouped printable reports with subtotals. | Smaller adaptation boundary than map/store components, subject to licensing. Our exporters should include source GUID, units, altitude datum, timestamps when present and provenance. |
| Search and dashboard | `FlightList.tsx` 129–206; `Overview.tsx`; `FlightClusterMap.tsx` | Saved filters, multi-select drone/battery/controller/tag filters, geographic overview and richer analysis. | Adopt the interaction design in our existing UI. Add date range, source, track availability and equipment filters first. |

All file references above use this [pinned source tree](https://github.com/arpanghosh8453/open-dronelog/tree/8b1a863f5317bb85ef34cb7454d419460bd17893).

## Behaviors to improve rather than copy

1. **Cycle budget is not measured battery health.** `Overview.tsx` 2062–2065
   computes max(0, 100 - cycles / maxCycles * 100), falling back to flight count.
   That may be a service-life indicator, but is not measured state of health and
   not predictive battery failure analysis. AEROLOG should keep measured health
   unknown until measured capacity/reference capacity or another validated basis
   is present. Discharge rate also varies with payload, weather, speed and mission.
2. **Replay uses sample index as time.** `FlightMap.tsx` 590–605 interpolates at
   progress × (track length − 1); `TelemetryCharts.tsx` 945–965 maps progress to
   a chart index. Their parser constructs a more regular sampling timeline, but
   this assumption still needs checking for missing samples and other formats.
   Use real timestamps for our timed logs. KML route progress must not masquerade
   as accurate second-by-second playback.
3. **Averaging can hide anomalies.** `database.rs` 1422 onward uses AVG in time
   buckets, including positions and sensor fields. Good for smooth overviews;
   inappropriate as the only evidence for a voltage dip or a sharp route corner.
   Keep raw data; use extrema-preserving chart reductions and separate route
   simplification. Our current DJI adapter also discards frames using a stride:
   that is a gap we should correct, rather than claiming our parser is complete.
4. **Altitude datum can be mixed in exports.** `exportUtils.ts` 489–523 falls back
   from absolute altitude to relative height/VPS height but labels the output
   absolute. Preserve datum explicitly in our exports and never silently convert
   missing absolute elevations to relative values.
5. **Authentication is not our operations permission model.** `server.rs`
   105–155 resolves per-profile databases using X-Session, then X-Profile for
   unprotected profiles. It includes optional password protection, but this is
   not interchangeable with our org memberships, pilot attribution, role-based
   approval and audit history. Keep our Supabase ownership model.
6. **Parser plugins execute host processes.** `plugins.rs` 116–151 awaits a
   configured subprocess with no timeout in that function. That design suits
   trusted local configuration, not arbitrary org-user parser plugins. Our upload
   adapter already has a timeout and decoded-output size limit; retain those.

## Practical sequence

1. **Finish the data contract first.** Preserve original DJI/telemetry files,
   exact start timestamp/timezone, GUID/serial identity, units, per-battery arrays,
   altitude datum and nullable channels. Do not recreate deleted flights.
2. **Add chart-to-map inspection for the existing 20 KML flights.** Hover/scrub a
   route point to show location and height; color route by height. This provides
   immediate value without pretending we have battery or elapsed-time samples.
3. **Validate one original timed DJI log end to end.** Enrich an existing verified
   flight, compare decoder output against known source values, then enable timed
   playback, battery drain, voltage and temperature panels only for supplied data.
4. **Add measured battery trends and multi-battery comparisons.** Keep cycle
   utilization distinct from measured health; later prediction needs enough
   labeled operating history.
5. **Harden repeatable imports.** Format adapters, raw/summary separation,
   duplicate candidate review, resumable batch imports, then an optional local
   folder companion. Add export/report improvements after stable normalization.

The best immediate shortcut is the MIT parser/CLI or data interchange, not a
wholesale Rust/DuckDB/Tauri backend transplant. ECharts/deck.gl are candidates for
specific advanced visuals, but our current Mapbox/Recharts stack can deliver the
next slice without replacing the application architecture.
