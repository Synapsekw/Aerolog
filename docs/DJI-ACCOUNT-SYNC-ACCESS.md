# DJI personal-account flight synchronization: access request

Updated September 6, 2026 after deeper research: Flight Reader publishes a personal DJI account authentication, cloud log enumeration, and original-file download API at https://www.flightreader.com/api/documentation/. FlyFreely publicly confirms using this provider. A Flight Reader API key and a real-account test are now the concrete next dependencies for that intermediary route. The message below remains useful for investigating a direct DJI arrangement, but contacting DJI is not the only route. No personal account connection or flight synchronization has been completed, and no credentials have been sent to Flight Reader. See the research report in output/pdf/dji-account-sync-research.pdf.

## Message ready to send

To: dev@dji.com (DJI Developer business cooperation contact)

Subject: Personal DJI account flight-record retrieval integration for AEROLOG

Hello DJI Developer Support,

We are developing AEROLOG, a drone operations and maintenance application. Each pilot should be able to authorize access to their own DJI account so we can retrieve their cloud-synchronized flight records, parse them, and record flight time and equipment usage in their chosen organization.

We already have a DJI Developer Open API application and a flight-record parsing key. We understand that parsing/decryption is separate from authenticating a pilot and downloading that pilot's cloud flight history.

Please confirm whether DJI offers a supported personal-account flight-record retrieval integration, and whether it requires partner approval or a separate entitlement. Our intended sources include DJI Fly, DJI GO 4, and DJI Pilot/Pilot 2. FlightHub 2 organization integration is a separate workstream.

Could you provide:

1. The application/partner onboarding process, required permissions, and whether our existing Open API application can receive them.
2. Authentication and user consent documentation, including token expiry, refresh, revocation, and any CAPTCHA or MFA requirements.
3. Flight-list and original-record download endpoints, response schemas, pagination, incremental synchronization, stable record identifiers, and deletion behavior.
4. Coverage across DJI apps and account regions, including any restrictions on historical or newly generated records.
5. Rate limits, retention constraints, test-account requirements, and available test fixtures or a sandbox.
6. Aircraft and battery serial-number availability so we can attribute maintenance usage correctly.

Our application is currently running locally for development. Please advise on callback requirements for a local test environment. We can supply our developer application identifier through your preferred channel; no passwords or secret keys are included in this request.

Thank you.

## Evidence checked on September 6, 2026

- DJI's parsing library documents a key for parsing flight-record files. It does not document personal-account history retrieval: https://github.com/dji-sdk/FlightRecordParsingLib
- DJI Cloud API documents Pilot 2/Dock connections to third-party platforms: https://developer.dji.com/cloud-api/
- DJI's FlightHub 2 sample documents organization-scoped authentication. This is not evidence that the same credentials retrieve consumer account history: https://github.com/dji-sdk/FlightHub-2-OpenAPI-V2-Demo/blob/main/README.en.md
- AirData explicitly describes downloading records from a user's DJI cloud account, establishing that this capability exists in that product. Its help page does not provide the underlying DJI API contract: https://app.airdata.com/sync-app-server?instr=2
- DJI lists dev@dji.com for business cooperation: https://developer.dji.com/user/apps/
- An unofficial credential-extractor repository was reviewed as a lead, not executed. Its proposed flight-list path was probed without credentials and returned HTTP 404 with “no Route matched with those values”. It is not a verified connector and was not added to the application.

## Implementation once the API contract is available

Connect each DJI authorization to the signed-in AEROLOG pilot. Keep tokens server-side and encrypted, and provide disconnect/revocation. Retrieve records with pagination and incremental checkpoints, retain original source files privately, and deduplicate on stable source identity. Resolve aircraft and batteries by serial number; present unmatched equipment for review rather than guessing. Require the pilot to select which flights belong to the active organization. Preserve pilot identity and organization attribution across retries and workspace changes. Record actual sync outcomes and actionable errors without exposing credentials.

Acceptance requires a real authorized account test: retrieve flight history, download and parse at least one actual record, confirm pilot/aircraft/battery mapping, import into the selected organization, then repeat sync without duplicate flight time. Until that succeeds, the app must not label personal account synchronization as connected or working.
