# DroneLogbook API imports

The local DroneLogbook import uses `ApiKey` and `DlbUrl` headers over HTTPS. Credentials stay in ignored `.env.local`; no credentials are sent to DJI through this integration.

A personal key may have company-administrator access. Flight ownership is determined by the linked person's GUID and **Pilot** personnel role, not by the account that created the record (`user_guid`). List endpoints use `num_page`; finish pagination and verify unique IDs against the reported total before replacing existing data.

For Ivan's authorized CSV replacement, keep the same `DLB-<flight GUID>` record identity and deterministic import hash. Back up existing records, validate the complete API dataset, then replace matching records and add missing historical flights. Remove CSV-only records only after replacements succeed. Preserve pilot membership and verify total seconds and uniqueness after saving. This is a historical migration, so importing summaries must not create battery cycles or increment equipment counters a second time.

Upcoming entries are retained in the source archive but excluded from recorded flight time. Historical API flights with missing dates retain an empty date and display "Unknown date"; they contribute to total hours but never to a fabricated day in date-based charts. Other import sources still require a valid date. Aircraft names, serials, equipment references, UTC timestamps and site information can be obtained from the API. Imported equipment references do not imply inventory registration or maintenance clearance.

The public flight response supplies planned geometry and site coordinates but does not document an actual GPS track. Flight details label the first planned polygon or the site marker explicitly. These must never be presented as flight replay. Raw API responses for the pilot and related references are retained privately as a downloadable source archive. KML/original logs are still needed for actual tracks.

This is a one-time import; no recurring sync is enabled.

## KML route enrichment

The provided `MultipleFlights.kml` batch contains 20 LineStrings (flight numbers
9156–9175) and 29,532 positions. Each was matched to a unique API flight number
and exact source name, then checked against the existing record's pilot, GUID,
source date and duration. The private source attachment references only these
20 existing flight IDs. No flights, hours, asset usage or battery cycles were added.

Untimed coordinates are stored in `flightTrack` as longitude/latitude/height
triples, separate from timed `telemetry`. The map displays this actual route before
falling back to planned boundaries or site markers. Source altitude mode is retained
in track provenance; no sample times are inferred. Existing flight metadata and
telemetry are preserved. The one-off import backup and verification report are
in the ignored `.local/imports/ivan-kml/` directory.

Storage migration 202609060010 allows KML MIME attachments without changing
bucket privacy or file size limits. This allowance was applied to the current
project via the Storage API during the import.
