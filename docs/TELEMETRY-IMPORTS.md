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
