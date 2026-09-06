# DroneLogbook API imports

The local DroneLogbook import uses `ApiKey` and `DlbUrl` headers over HTTPS. Credentials stay in ignored `.env.local`; no credentials are sent to DJI through this integration.

A personal key may have company-administrator access. Flight ownership is determined by the linked person's GUID and **Pilot** personnel role, not by the account that created the record (`user_guid`). List endpoints use `num_page`; finish pagination and verify unique IDs against the reported total before replacing existing data.

For Ivan's authorized CSV replacement, keep the same `DLB-<flight GUID>` record identity and deterministic import hash. Back up existing records, validate the complete API dataset, then replace matching records and add missing historical flights. Remove CSV-only records only after replacements succeed. Preserve pilot membership and verify total seconds and uniqueness after saving. This is a historical migration, so importing summaries must not create battery cycles or increment equipment counters a second time.

Upcoming entries are retained in the source archive but excluded from recorded flight time. Historical API flights with missing dates retain an empty date and display "Unknown date"; they contribute to total hours but never to a fabricated day in date-based charts. Other import sources still require a valid date. Aircraft names, serials, equipment references, UTC timestamps and site information can be obtained from the API. Imported equipment references do not imply inventory registration or maintenance clearance.

The public flight response supplies planned geometry and site coordinates but does not document an actual GPS track. Flight details label the first planned polygon or the site marker explicitly. These must never be presented as flight replay. Raw API responses for the pilot and related references are retained privately as a downloadable source archive. KML/original logs are still needed for actual tracks.

This is a one-time import; no recurring sync is enabled.
