# Telemetry imports

AEROLOG accepts its summary CSV template, normalized JSON, local DJI TXT records,
and Airdata telemetry CSV files. Imports retain the original file in private
storage through the existing archive workflow. No Airdata account or service
connection is involved in importing an exported file.

## Airdata CSV

One telemetry CSV represents one flight. Required headers:
`time(millisecond)`, `datetime(utc)`, `latitude`, `longitude`, and
`altitude(meters)` or `altitude(feet)` (also `m` / `ft`). UTC dates use
`YYYY-MM-DD HH:mm:ss`. GPS and height are required per row; clock resets and
unknown dimensional units are rejected. The adapter accepts 2–20,000 samples
without downsampling. Distance is calculated along observed GPS positions,
not from a distance-to-home column. Sample-span duration excludes any time
before the first or after the last supplied reading.

Optional channels include `speed(m/s)`, `speed(km/h)`, `speed(mph)` or
`speed(knots)`, `battery_percent`, `voltage`, and
`battery_temperature(c)` / `battery_temperature(f)`. Blank optional cells
remain missing rather than becoming zero. Source heights retain an unspecified
datum because the column does not establish an absolute altitude reference.

## Normalized JSON

The summary fields follow the CSV template (`date`, `durationSeconds`,
`distanceKm`, etc.). Optional `startedAt` is a complete ISO timestamp with a
UTC suffix or explicit offset. `aircraftSerial` and `batterySerials` retain
source equipment identity separately from the operator's inventory assignment.

Each `telemetry` sample includes `time` (elapsed seconds), `longitude`,
`latitude`, `altitude` (metres) and optional `battery` (%), `temperature` (°C),
`voltage` (V), `speed` (m/s), `currentAmps`, `remainingCapacityMah`,
`fullCapacityMah`, `designCapacityMah` and `cellVoltages` (V).

For aircraft with multiple batteries, use `batteryPacks` on each sample. Each
pack requires a `serial` and supports its own `charge`, `temperature`, `voltage`,
`currentAmps`, capacities and cell voltages. Never copy aircraft-level combined
measurements into both packs. A cycle count is not a measured health percentage.

`importProvenance` optionally records `format`, `parserVersion`, `sampleCount`
and `heightDatum` (`relativeToTakeoff`, `relativeToGround`, `absolute`, or
`unspecified`). Values are schema validated when previewing and saving.

## Validation status

Unit fixtures cover unit conversion, irregular sample times, missing optional
channels, invalid units, clock resets, exact timestamps and separate battery
packs. A real exported Airdata CSV and original DJI TXT supplied by the operator
are still needed for end-to-end validation of those source formats. Ivan's
current KML files provide route positions and heights only, so the app must not
invent their battery measurements or elapsed sample times.

## Reviewed enrichment

Managers and administrators can select “Same flight — add telemetry” for a
candidate and provide a review reason. The operation retains the recorded
flight duration, usage counters, KML track, equipment assignments and original
source hash. It creates an audit entry and retains the additional source hash
for duplicate detection. Source files are archived through the import workflow.
If samples already exist, enrichment accepts additional channels on the exact
same sample grid only. Conflicting readings or different grids are rejected;
keep both originals for manual comparison. Start-time and aircraft-serial
conflicts are also rejected. A candidate is a prompt to review, not proof of
identity.

Migration `202609060013_flight_enrichment.sql` is applied to the connected project.
The rollback-only database check runs with `node scripts/test-enrichment-db.mjs`
and requires the existing local pooler URL and server-side database password.

Archive retries merge links to saved flights without removing earlier links.
Migration `202609060014_source_retry_links.sql` is applied to the connected
project. Partial batch errors retain successful rows, attempt their source
archive, refresh the workspace, and explain what was saved before the failure.

The local DJI parser now retains the decoded exact start time and aircraft /
battery serials for cross-format review. Its existing large-log sample limit is
explicitly reported in provenance and preview warnings: uniformly sampled
stored telemetry may miss brief events, while the original TXT remains the
source of record. Do not use those reduced curves as a battery fault detector.
