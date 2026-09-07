# Full DroneLogbook workflow adoption goal

User objective: “Go ahead and implement all. run it as a goal”. Source scope: DRONELOGBOOK-WORKFLOW-PLAN.md. Preserve AeroLog UI and existing records; local Git/testing only. Goal active until every scoped requirement is implemented and verified. Do not replace missing workflows with mock-only screens.

## Completion ledger

- [ ] Navigation: category children, active counts, per-category filters, collapsed/mobile behavior, discoverable organization management.
- [ ] Kits: org-scoped persisted item relationships, compatibility/availability checks, assignment preview, immutable mission snapshots.
- [ ] Inventory passports: full-page history/attachments, typed model metadata, storage sites separate from observed locations.
- [ ] Battery ledger: dated device and baseline counters, measured capacities and cycles without double accounting.
- [ ] Maintenance: model profiles, hours/flights/days/cycles intervals, earliest-due semantics, component replacement history, technician/cost/date work orders.
- [ ] Readiness: actionable dashboard queue and authoritative server mission blockers.
- [ ] Planning: customer/project/site hierarchy, multi-aircraft, operational roles, flight links, resource-conflict calendar.
- [ ] Templates/documents: versioned risk/checklist/custom-form templates, reusable documents with expiry and approval, immutable submitted package.
- [ ] Mission review: exact submission approval, changed plans require re-review, planned-vs-flown tracks with boundary warnings.
- [ ] Personnel: separate access/operational roles, qualifications/evidence/expiry, explicit aircraft permissions, organization currency policies and external time labeling.
- [ ] Safety: incident records with flights/assets/personnel/evidence and follow-up actions.
- [ ] Reports: pilot/aircraft/battery/org operations PDFs and data exports, background persisted jobs, exact accounting and provenance.
- [ ] Integration presentation: explicit per-source capabilities and honest unsupported channels.
- [ ] Follow-on scope from source plan: scoped sharing/iCal, cross-org equipment sharing, reviewed bulk edits/merges, financial fields/reports; additional connectors only when a supported interface is verified.
- [ ] Verification: unit/DB/API acceptance, org isolation and permissions, rendered workflows at desktop/mobile; no loss or resurrection of Ivan records.

## Work log

### Canonical equipment identity foundation — 7 September 2026

- Added typed canonical-ID/family resolution that retains input identities, handles chains and refuses cycles/conflicting mappings. Asset and battery namespaces remain distinct.
- Migration 044 adds immutable org-scoped identity aliases with composite source/target foreign keys, cycle checks under the org lock and authenticated read-only RLS. Original equipment rows cannot be deleted while referenced. No production alias mappings were created.
- Unit tests passed chain/kind/source preservation and cycle/conflict rejection. Rollback DB tests passed retained source rows, chain creation, missing-target/cycle rejection, immutable mappings and authenticated read-only access. TypeScript/diff checks passed.
- This is consolidation infrastructure, not enabled merge execution. Reader/history integration, future usage routing and explicit counter reconciliation are still needed before the apply path is exposed. Mac remains locked on browser recheck; goal active.

### Merge-review API acceptance — 7 September 2026

- Extended isolated integration coverage for the merge-review endpoint: pilots/technicians are denied, another organization cannot review the equipment, and identical selections are rejected.
- Manager response contains expected mission/flight dependencies, the associated sharing relationship, serial conflict and review hash. Raw source payloads are omitted. Equipment JSON and revisions are exactly unchanged after the request.
- All 35 integration checks passed; temporary accounts, organizations, shares and records were cleaned up. This verifies review only, not consolidation execution.
- Actual merges/counter reconciliation, operational handover and browser acceptance remain open. Goal active.

### Authoritative merge-review context — 7 September 2026

- Merge comparison now loads server context under the organization lock, with current record revisions, saved-report ID matches and equipment-sharing relationships. Browser selections are disabled while the request is pending; review displays its capture time.
- Migration 043 projects only the relationship/identity/counter fields needed for review and checks active manager/org access. Raw source payloads, notes and geometry are omitted. API returns comparison results and a review hash; this is not yet an executable merge token.
- Rollback regression passed updated revisions, captured report/share dependencies, reduced payload and pilot/wrong-org/private-RPC restrictions. Production build and final TypeScript passed.
- Actual consolidation, counter reconciliation, unknown legacy relationships, operational handover and visual acceptance remain open. No equipment or history was merged. Goal active.

### Inventory merge review foundation — 7 September 2026

- Added a clearly read-only duplicate comparison on Inventory/Batteries. Managers choose two same-kind records and inspect identity/metadata/counter differences, category/serial conflicts and loaded-record dependencies before any consolidation.
- Dependency review covers typed flight IDs (explicit identity wins over names), mission kit snapshots, services, inspection plans/events, evidence targets, documents, incidents and aircraft permissions. It preserves source records and does not sum counters or rewrite history.
- Focused tests passed mixed-kind identity isolation, explicit-ID precedence, historical dependency coverage, serial conflicts and rejection of invalid selections; production build and final TypeScript passed.
- No apply/delete path is exposed yet. Server-side merge planning, report/share dependencies, counter reconciliation and execution remain required before this workflow is complete. Operational handover and visual acceptance also remain open; goal active.

### Cross-organization equipment API acceptance — 7 September 2026

- Added two-org sharing flows to the isolated API integration suite. Pilot creation, offering equipment not owned by the actor and owner-side acceptance are denied; recipient details remain null until acceptance.
- Accepted recipient sees the selected retired equipment's limited projection, not notes/source records, and its normal organization bootstrap remains empty. Owner firmware/revision changes appear on refresh; recipient cannot perform owner revocation, and owner revocation removes equipment details.
- All 34 integration checks passed, including prior bulk edits, evidence, missions, imports/accounting and access controls. Cleanup removes temporary share rows and recipient audit data before deleting test organizations/accounts. No real sharing relationship was created.
- Operational equipment handover, broad merge behavior and application visual acceptance remain open. Goal active.

### Cross-organization equipment directory — 7 September 2026

- Added manager equipment offers targeted to an exact recipient organization ID, recipient acceptance/decline, expiry and owner revocation. Inventory/Batteries show a paged sharing panel and the organization's copyable ID; no messages are sent externally.
- Migration 042 and service-only RPCs check current org/manager access. Accepted recipients receive a minimal live projection of identity/model/firmware/status/counters, not owner flight records, notes or maintenance attachments. Owner manager membership loss also removes equipment visibility.
- Rollback regression passed pending invisibility, acceptance, live updates, preserved retired status, private-note exclusion, expiry/revocation, org guard and RPC privileges. Temporary recipient org/profile context and equipment were fully rolled back. Production build/TypeScript passed.
- This is the directory/access foundation, not a loan/reservation or mission authorization mechanism. Operational handover, API/browser acceptance and broader merge workflows remain open. Goal active.

### Bulk-edit API integration acceptance — 7 September 2026

- Extended the isolated-organization integration runner with separate retired-aircraft/quarantined-battery bulk fixtures. Technician edits update both revisions/manufacturer fields while retaining operational status and cycles; pilot/observer requests are denied.
- Real API requests reject mixed stale revisions (409), attempted cycle edits and unknown storage sites, preserving both records at their prior revisions with no partial firmware change.
- All 32 integration checks passed, including existing evidence, mission review/PDF, imports, usage accounting, maintenance and tenant isolation. Temporary test records/accounts/organization were cleaned up. The first attempt caught a duplicated fixture serial; cleanup succeeded before retrying with a unique serial.
- CUA recheck still reports the Mac locked. No browser acceptance is claimed. Broader merge/sharing work and final source-plan acceptance remain open; goal active.

### Reviewed bulk equipment metadata — 7 September 2026

- Added a bulk editor on Inventory/Batteries: search/select up to 100 equipment records, choose storage site/manufacturer/product model/firmware, inspect per-item before/after values, then apply the frozen selection/revisions. Removed selections must be reviewed again. Storage previews show site names and IDs.
- API and migration 041 permit fleet roles and only the four metadata fields. The transactional RPC validates every revision before invoking existing audited equipment saves; invalid metadata/site or stale records abort the batch. Counters, operational statuses and identities are outside this edit surface.
- Rollback database regression passed mixed-kind updates, stale-batch atomicity, preserved retired/quarantined states and counters, invalid site/field/duplicate and pilot rejection. Initial migration syntax error rolled back; corrected and applied. Production build and final TypeScript/diff checks passed.
- Browser workflow acceptance and broader bulk edit/merge coverage remain open, along with cross-org equipment sharing and remaining source-plan acceptance. Goal active.

### Inspection calendar subscriptions — 7 September 2026

- Added inspection selection to shared calendars. Migration 040 derives each day-interval due date from the latest signed rule event or original plan baseline; counter-only rules are omitted. Shared titles include equipment/rule names, while findings and other detailed evidence remain excluded.
- Feed descriptions explicitly state that counters may make work due earlier. These are calendar deadlines, not a claim of current equipment readiness.
- Rollback fixture verifies February 1 signed baseline plus 30 days produces March 3, only the selected category appears, counter-only rules are absent and private findings are not projected. Existing calendar role/org/expiry/revocation regression also passes. Production build/TypeScript passed.
- The first migration attempt rolled back on a reserved alias syntax error; corrected alias and applied successfully. No operational inspection records changed. External calendar-client and browser acceptance, equipment sharing and bulk workflows remain open; goal active.

### Calendar link management paging — 7 September 2026

- Removed the newest-100 management cutoff. Manager listing now pages 25 links with stable created-time/ID ordering, next-page detection, refresh and loading/empty states; old links remain reachable for revocation.
- List responses are ignored after effect cleanup and the sharing panel remounts on organization changes. New links return to the first page; expiry UI rejects fractional/invalid day values.
- Actual API regression inserted 101 temporary already-revoked fixtures, visited every page with no duplicates or exposed token hashes, and verified invalid-page/anonymous rejection. All 101 fixtures were deleted. Production build/TypeScript and diff checks passed.
- Inspection feeds, calendar-client/browser acceptance, cross-org equipment sharing and reviewed bulk workflows remain open. Goal active.

### Scoped revocable calendar subscriptions — 7 September 2026

- Calendar managers/admins can create labeled date-range subscription links for missions, maintenance and/or flight logs with an expiry up to one year, and revoke them. Only a SHA-256 token digest is stored; the original URL is shown once. Manager UI explains bearer access, fields shared, refresh/cache limitations and local-server-only reachability.
- Migration 039 adds private share storage and service-only management/feed RPCs with current org/role checks. Feed projects only ID/type/title/date/time/duration/status; no crew, equipment details, geometry or attachment data. Expiry, revocation and creator membership/manager-role loss stop serving the feed.
- Rollback database regression passed minimal projection, category scope, pilot/cross-org rejection, expiry, membership revocation, explicit revocation and private RPC privileges. Live API create → unauthenticated iCalendar download → revoke → 404 passed; the QA link remains revoked. Production build/TypeScript passed.
- Inspection subscriptions, management pagination beyond the newest 100 links, third-party calendar client acceptance and browser UI checks remain follow-ups. Cross-org equipment sharing and reviewed bulk workflows remain open. Goal active.

### Project cost filtering and exports — 7 September 2026

- Financial previews and saved CSV/PDF jobs support all-project, explicit-project-ID and unallocated scopes. Ledger exports include the work order's captured project name/reference/revision; names are not used for attribution. Archived projects remain selectable for historical reports.
- Optional scope preserves older snapshot export bytes when no project data exists. The prior saved financial PDF still passes stored hash and byte-for-byte reproduction (13,847 bytes).
- Focused tests passed same-name project separation, unallocated costs, identity/revision export and existing date/cost tests. Updated rollback saved-cost regression includes project selection and captured project details; snapshot bytes remain identical after service edits/recovery. Production build/TypeScript passed.
- Rendered and visually inspected the project-scoped PDF: project identity/revision, scope, totals and source ledger fit without clipping. Application browser acceptance remains open, alongside sharing/bulk workflows and remaining source-plan requirements. Goal active.

### Explicit work-order project attribution — 7 September 2026

- Maintenance work orders now offer optional project selection and display their captured project name. Unallocated organization overhead remains explicit; no equipment/flight-name guessing allocates costs.
- Migration 038 validates active same-organization projects when assigning and stamps project ID/name/reference/revision. Retaining a previously assigned project preserves its snapshot even after rename/archive; clearing attribution removes the snapshot.
- Rollback regression passed authoritative replacement of forged snapshots, archive/history preservation, unavailable-project rejection, unallocation and existing cost validation. Production build/TypeScript passed. No real work orders or project assignments changed.
- Project-aware financial report filtering/export remains the next dependency; current financial outputs do not yet expose these new project fields. Sharing/bulk workflows and browser acceptance remain open. Goal active.

### Saved maintenance cost PDFs — 7 September 2026

- Added PDF format to organization maintenance cost jobs. Dedicated renderer includes per-currency completed/open totals, missing-data counts and the full equipment/work-order ledger with IDs/revisions. Uses snapshot metadata and embedded font; existing flight PDF rendering stays unchanged.
- Rendered and inspected all three pages of a 12-work-order fixture with long descriptions, accented names, mixed currencies and missing/zero costs. Improved word wrapping after the first render; final pages have no clipping. QA data stays in ignored local files.
- Actual saved PDF job `43488ebd-651a-4d80-adf2-1720e436184a` completed: one existing work order, 13,847 bytes. Private storage download hash and exact snapshot regeneration passed. Request validation, production build and final TypeScript checks passed.
- Project financial attribution, scoped sharing, reviewed bulk workflows and final application browser acceptance remain open. Goal active.

### Persisted organization cost CSV jobs — 7 September 2026

- Organization maintenance costs can now be queued through the shared saved-report API/UI. Migration 037 captures service-only source snapshots for this report type. Existing org authorization, private attachments, leases, resumption and hashes apply unchanged.
- Added a separate job request union so flight report calculations remain unchanged. Financial CSV summaries retain service counts, per-currency totals and data-quality counts; financial PDF is explicitly unsupported pending implementation.
- Rollback DB test verifies original task/cost/date/revision and identical CSV after source edits and expired-lease recovery. Request validation test and production build/TypeScript passed.
- Actual local API job `36e8e0b4-bd2a-4656-9d8a-57e8a5742efd` completed for 2026: one existing work order, 905-byte CSV. Download SHA-256 and exact frozen-snapshot regeneration both passed. No operational work order was changed; only the requested report artifact was created.
- Project attribution, financial PDF, sharing, bulk workflows and final browser acceptance remain open. Goal remains active.

### Reporting regression checkpoint — 7 September 2026

- Full current unit suite passed: 72 tests, including calendar time handling, organization costs and maintenance decimal totals alongside existing flight/import/readiness tests.
- Downloaded Ivan's saved CSV job `ec7100a4-d165-4dfb-9a91-92275da9e3f3` and PDF job `45659336-aef5-4f6f-a847-8e998191ff0b` through the read-only verifier. Both match stored SHA-256 and byte-for-byte regeneration from frozen snapshots: 20 flights / 29,599 seconds; CSV 8,003 bytes and PDF 22,461 bytes.
- Report-job database regression passed idempotency, frozen sources, exclusive lease/recovery, stale-worker rejection, artifact validation and RLS. All fixtures rolled back.
- Reviewed current report API/worker: persisted jobs still accept flight reports only. Organization financial preview/download is not yet a persisted financial job; this remains explicit open scope along with sharing, bulk workflows and visual acceptance. Goal remains active.

### Organization maintenance cost report — 7 September 2026

- Reports now includes an expandable organization maintenance cost preview with date filters, per-currency completed/open totals, paged work-order/equipment ledger and CSV download containing every row, source revision and cost reference. Uses the current organization's already-authorized records.
- Preview freezes primitive source values and organization name/time. Completion timestamps use UTC dates; open jobs use due dates. Invalid/undated records and unknown costs are reported explicitly. Stable equipment kind/ID remains separate from historical display names.
- Two focused tests passed for mixed equipment identities, date boundaries, invalid dates, all-page CSV inclusion, formula escaping and frozen values after source edits. Production build/TypeScript passed after correcting a test fixture's object typing. No operational records changed.
- Persisted financial jobs/PDF, project financial attribution, live sharing and reviewed bulk workflows remain open. Browser acceptance remains unverified; goal active.

### Maintenance cost preview totals — 7 September 2026

- Equipment-history report previews now aggregate recorded maintenance amounts per currency, separately for completed/open work, with work-order counts and explicit missing-cost/currency/invalid-amount counts. Recorded zero costs remain included. Totals use all filtered history rows, not only the visible page.
- Decimal arithmetic preserves source decimal values without binary floating-point summation errors; three-decimal currencies are not rounded to two decimals. Amounts are described as recorded work-order costs, not payment or recognized expenses. Existing saved CSV/PDF renderer output is unchanged.
- Focused tests passed for currency separation, open/completed split, exact decimal sums, zero versus missing, invalid values and exclusion of non-service events. Fixed the initial build's BigInt-literal target incompatibility using constructor syntax; production build and TypeScript then passed.
- Broader organization/project financial reporting and saved financial summary exports remain open, alongside sharing/bulk workflows and visual acceptance. Goal remains active.

### Responsive report/calendar containment — 7 September 2026

- Restricted report grid tracks and catalog panels to the available width, kept wide tables inside their scroll regions, constrained long native select labels, and allowed report pagination to wrap. Calendar agenda names now wrap and narrow weekday headings use reduced padding.
- Flight and equipment-history tables are keyboard-focusable labeled regions with visible focus styling; pagination uses labeled navigation landmarks.
- Production build, TypeScript and diff checks passed. Rechecked CUA: Mac remains locked. These are code-level layout corrections; no desktop/mobile visual pass or download acceptance is claimed. The broader goal remains active and useful local work is still available.

### Timed mission calendar export — 7 September 2026

- Mission events now export UTC start/end derived from organization wall time and planned elapsed duration, including overnight/year rollover. Other calendar records remain date reminders because they have no scheduled time in this view.
- Invalid zones, missing durations and DST gaps/repeated wall times fall back explicitly to date reminders; the download notification counts affected missions. No uncertain offset is silently selected. Resolving ambiguous local mission schedules in planning remains a follow-up.
- Four calendar serializer tests pass, including Dubai/UTC overnight conversions, New York summer offset, DST gaps and overlaps, identity/scope and UTF-8 escaping. Production build and TypeScript passed. Browser/download acceptance and live scoped calendar sharing remain open; full goal remains active.

### Calendar snapshot export — 7 September 2026

- Added an iCalendar download scoped to the calendar's displayed dates and selected category, including inspection dates. Stable organization/type/record UIDs distinguish records; exported entries are private, transparent all-day reminders with original schedule text and status in the description.
- This is explicitly a date-only snapshot, not a live subscription or timed event feed. Scoped revocable sharing, timed calendar semantics and cross-organization equipment sharing remain open.
- Serializer follows RFC 5545 text escaping, CRLF, UTF-8 octet folding and exclusive all-day end dates. Focused tests verify category/range exclusion, year rollover, invalid dates, organization identity, Unicode and property-injection resistance. Tests, TypeScript and production build passed.
- Browser download/visual acceptance remains unverified because the Mac was locked. No operational data changed. Goal remains active.

7 September: inspected clean current worktree and active goal. Existing member removal, battery browser and globe are present. Began direct inventory navigation with per-category in-session filter restoration and active counts. Inventory parent expands/collapses independently; battery destination is singular; Organization opens existing team/settings management. Backend scope not yet implemented; no completion claim.

Kit foundation added: `aerolog_save_kit` RPC and `/api/kits`, with org lock/context, fleet-role authorization, existence checks, optimistic revision and audit. Migration 015 applied. Rollback-only test created a kit and verified stale revision rejection; no test kit retained. UI supports selection/search, selected-content readiness preview, editing and archiving. Assignment/snapshots, compatibility metadata, availability checks and comprehensive permission/API tests remain open.

Mission kit assignment added to the equipment step, including readiness/counter/battery compatibility preview. Applied kit selections flow through mission saves; migration 016 generates authoritative equipment/serial snapshots and preserves their original kit version on later edits and review. Rollback-only `scripts/test-kit-snapshots-db.mjs` proves forged snapshots are replaced, changing a kit leaves the saved mission snapshot identical, and removing equipment without unlinking the kit fails. Existing submission validation checks overlapping assignments. Multi-aircraft kits are explicitly blocked pending the multi-aircraft planning work; typed compatibility and full-page passports remain open.

Validation for kit assignment: production build, 34 unit tests and 38 organization API checks passed. Browser verified kit equipment search and mission wizard's kit selection without persisting a test draft. Follow-up found during UI verification: historical crew entries for disabled memberships still appear in new mission assignment choices; exclude known disabled members in UI and authoritative submission validation while retaining historical crew records.

Multi-aircraft and operational roles: mission schema/UI/PDF include secondary aircraft and payload operator, ground support, instructor and second pilot assignments. Kits with multiple aircraft now populate the mission. Migration 017 updates the existing command's battery compatibility test, adds resource checks at submission/approval, checks all additional aircraft and crew, and extends snapshot membership checks. Known disabled members are excluded from new mission crew options and rejected by server validation; history is preserved.

`test-mission-resources-db.mjs` (all fixtures rolled back) verifies secondary-aircraft conflicts, additional-role crew conflicts, missing aircraft, batteries incompatible with assigned aircraft, disabled members, adjacent windows, and successful multi-aircraft submission through the normal RPC. Existing snapshot DB checks still pass. Unit tests 36 pass; production build passed before the subsequent calendar UI addition.

Operations calendar added: month/week, date navigation, mission/maintenance/flight filters, per-day agenda and detail links. Conflict summaries use all mission aircraft and operational roles. Browser verified the week view and maintenance filter against actual local records. Calendar typecheck passed; final build remains part of the full-goal acceptance. Inspection events will join the calendar after inspection profiles/history exist. Scoped sharing and iCal remain open.

Inspection profiles/history increment: migration 018 applied. Model/family profiles contain multiple Inspect/Replace component rules with hours/flights/cycles/days thresholds. Assignment captures profile version, current-date starting baseline and flight-count watermark; subsequent known logged usage increments the declared baseline count without substituting partial import totals for lifetime totals. Unknown/decreasing counters require review. Signed inspection events are append-only, retain actor/role/component/findings/replacement serial and reset only the matching rule. New baselines establish a forward schedule and do not certify prior maintenance.

`/api/inspections` validates typed payloads and uses a service-only write RPC that rechecks active actor role and organization under the org lock; direct authenticated RPC execution is denied. Submission/approval trigger blocks assigned equipment with due inspection rules or missing counters. UI includes profile editor, equipment assignment, remaining-limit cards and signed history; dashboard surfaces inspection blockers. Profile changes do not rewrite assigned versions. Browser inspected the editor without saving a test profile.

Validation: 40 unit tests, production build, 38 organization API checks pass. `test-inspections-db.mjs` rolls back fixtures and proves captured version stability, due-hour threshold, mission rejection, signed reset, immutable event and private RPC privilege. Work still open includes battery dated reading ledger and reconciliation, additional work-order fields, full-page passports, inspection calendar events, complete readiness review UX, and the remaining planning/personnel/reporting/sharing scope.

Battery ledger and full-page passports: migration 019 applied. Dated device/manual/baseline records are append-only and retain provenance. Optional register reconciliation assigns absolute cycles/health/temperature, never adds imported counts; rejects lower cycles, duplicate records, future measurements and readings older than applied measurements or charge-condition events. History-only entries preserve register values. Reconciliation does not promote operational status. Capacity ratio remains separate from reported state of health. New trend views cover health, cycles, temperature, voltage and full capacity.

Assets/batteries now open as full-page passports with flight links, maintenance, signed inspections, readings/telemetry and private equipment attachments; removed obsolete drawer implementations. Last flight location is explicitly distinguished from storage location. Equipment-file upload validates type/size/target, stores privately, and rechecks active org/role in a service-only attachment RPC. Actual storage sites and typed model metadata remain upcoming under inventory relationships.

Validation: 42 unit tests, typecheck and production build pass. `test-battery-readings-db.mjs` rolls back fixtures and verifies no counter double counting, no unverified status promotion, history-only baseline handling, old/lower/duplicate rejection, private RPC and attachment path validation, including older-than-charge-event protection. Browser verified a battery opens as an article rather than a dialog, passport tabs and measurement units; discarded the unsaved verification form. Full equipment upload/download API and mobile visual checks remain for broader acceptance.

### Customer / project / site catalog — 7 September 2026

- Added organization-scoped customers, projects (customer, reference, schedule and optional contract revenue) and sites (operating/storage/both, project relation, map geometry), with search, archive filters and paged cards. Create/edit is restricted to managers/admins and uses captured revisions.
- Mission planning can select a project and operating site. Site selection copies its boundary into the mission's editable planned area. Storage-only and mismatched project sites are rejected by the database.
- Mission context is stamped from authoritative catalog records when drafting/submitting and preserved through review/approval. Customer/project/site details appear in mission review and PDF packages. Later catalog edits do not rewrite submitted history.
- Migration 020 applied. Rollback DB tests passed for relationships, revision conflicts, pilot rejection, invalid sites, authoritative snapshots and service-only RPC. All fixtures rolled back. Typecheck, 42 unit tests and production build passed; browser opened project and site forms without saving fixture data.
- The wider adoption goal remains open: versioned forms/documents, personnel qualifications/permissions, incidents and report jobs still need implementation and acceptance checks. Storage-site records exist; assigning physical inventory to them is still pending.

### Equipment identity and storage — 7 September 2026

- Added explicit manufacturer, product model, firmware and storage-site fields to aircraft/accessories/payloads/controllers and batteries. Battery rated capacity/nominal voltage are separate from measured readings; grouping prefers explicitly recorded product model and keeps legacy inference as a fallback.
- Equipment editing offers active storage/both-purpose sites. Passports show assigned storage separately from last flight location; site cards link assigned equipment. Inventory and battery pages filter by storage site or unassigned.
- New battery forms leave health/temperature unknown and condition Unverified; compatibility is initially unassigned. Source imports were not rewritten.
- Migration 021 validates metadata and organization-scoped storage references through the existing save RPC. Archived sites cannot receive new assignments; existing assignments can be edited or cleared. A regression test caught and fixed BEFORE INSERT behavior on the save RPC's upsert.
- DB regression fixtures rolled back. Typecheck, 42 unit tests and production build passed. Browser verified battery filters and the expanded register form; no equipment changes saved during UI QA.
- Remaining larger adoption work includes reusable forms/documents, personnel qualifications/permissions, incidents, report jobs and the full final acceptance audit.

### Versioned mission forms — 7 September 2026

- Added Form templates navigation/library with manager-only create/edit/duplicate/archive. Supports required checklist checks, typed custom fields (text, number, date, choice, check) and reusable hazard/control starting points.
- Mission preparation attaches template versions and records answers; risk templates copy suggestions into the editable assessment with controls unreviewed. Templates are never regulatory certification. Mission review and PDF include completed forms.
- Database captures authoritative template snapshots; existing missions retain their original template after library edits. New stale selections are rejected. Required checks/answers, types, allowed choices and unknown fields are validated, with forms locked through submission/review.
- Migration 022 applied. DB tests exercise normal mission save RPC, required-field rejection, invalid values, stale versions, snapshot forgery and submitted-answer locking, with fixtures rolled back. Unit suite now 44 tests; typecheck/production build passed. Browser verified template editor with an unsaved checklist field.
- Migration 023 fixes catalog snapshots during INSERT ... ON CONFLICT: reviewed project/site context is preserved before both trigger phases, including archived sites. Catalog rollback regression passed for this path.
- Goal remains active. Central document controls, qualifications/permissions, incidents, reports/jobs and remaining acceptance criteria are not yet complete.

### Incident reporting and follow-up — 7 September 2026

- Added Incidents list, filters and report/detail editor with severity, dated occurrence, narrative, damage, cause, resolution, linked flight/project/site, equipment and personnel.
- Follow-up actions have assigned active members, due dates, completion notes and server-attributed completion. Closure requires all actions complete and a resolution. Managers investigate/close/reopen; reporters may edit their own initial reports. All changes preserve reporter identity and audit before/after state.
- Added private incident evidence upload/download, with role/ownership, organization, target/path and closed-incident guards. Equipment condition is deliberately managed separately; incident closure does not release an aircraft or battery.
- Migration 024 applied. Database regression verifies ownership, manager closure, incomplete action rejection, reference isolation, revisions, attribution, evidence guards and private RPC; fixtures rolled back. 46 unit tests, typecheck and production build passed. Browser verified the report editor; no test incident retained.
- Outstanding: document controls, personnel qualifications/aircraft permissions/currency, reports/jobs and full adoption acceptance audit.

### Personnel aircraft permissions and qualifications — 7 September 2026

- Crew profiles now explicitly select Not configured, All aircraft or Selected aircraft. Empty selected lists authorize no aircraft. No existing person was silently granted all-aircraft access.
- Added qualifications/endorsements with issuer/reference, issue/expiry, required-for-operations setting and linked private evidence. Managers upload evidence to a saved person, then attach it to that person's qualification. Evidence cannot be borrowed from another person or organization.
- Mission guard checks all required qualifications against the planned date and evidence, and checks primary pilots, second pilots and instructors against every mission aircraft. Existing primary-certificate and membership checks remain. Profiles without configured aircraft access need a manager's selection before future submissions/approvals.
- Migration 025 applied. Rollback tests passed for absent policy, empty allowlist, additional aircraft, second pilot, expiry/evidence and identity isolation. Existing mission/catalog/form DB fixture tests explicitly configure test-pilot access and pass. Unit suite 48 tests; typecheck and production build passed. Browser verified the crew authorization editor without saving operational permissions.
- Remaining personnel work: recency/currency policies and externally recorded time, unified qualifications matrix/readiness queue, and acceptance review of historical versus active crew display. Central document controls and report jobs also remain outstanding.

### Pilot recency and external time — 7 September 2026

- Added per-person company recency policy (preceding calendar days, minimum flights/minutes, explicit inclusion of external time). Policies start disabled rather than inventing a regulatory requirement. Mission checks evaluate the preceding days, excluding the mission date, for primary/secondary pilots and instructors.
- Added an external-time ledger with source, date, flight/time totals, verification notes and personnel evidence. Manager verification is stamped server-side. Saved entries cannot be silently edited or deleted; source flight totals stay separate from AeroLog's imported flights.
- Crew detail shows local/external contributions and whether the configured policy is met. Crew editing provides policy settings and pending external entries. No external time or policy was added to real profiles during this pass.
- Migration 026 applied. DB checks passed for recency gating, evidence, explicit external inclusion, day boundary and immutable entries; fixtures rolled back. 50 unit tests and production build passed, including type checking. Browser verified crew recency summary.
- Follow-up before full acceptance: support auditable void/replacement for mistaken external ledger entries; qualifications matrix/readiness queue; active-versus-historical personnel presentation. Central document controls and reports/jobs remain outstanding.

### Audited external-time correction — 7 September 2026

- Managers can void an external entry from crew detail with a reason. Original evidence, date, source and totals remain; the server stamps who voided it and when, and writes a before/after audit entry.
- Voided entries no longer contribute to either external totals or recency eligibility. They cannot be restored or modified, and voiding cannot alter their original totals. A corrected replacement is entered as a new evidence-backed record.
- Migration 027 applied. Rollback currency regression verifies void attribution, retained totals, recency recalculation, stale-revision rejection and unvoid rejection. 51 unit tests, typecheck and production build passed. No real external entries were created or voided.
- Broader goal remains open: central document controls, reproducible report jobs, unified readiness/qualification presentation and complete acceptance audit.

### Central document register — 7 September 2026

- Added document register with category, linked organization/person/equipment/project/mission, valid-from/expiry, private files, archive filtering and immutable revision records. Managers save drafts, submit, approve or reject; the workspace self-approval rule applies. Editing an approved document creates a fresh draft/version.
- Mission package preparation selects exact document revisions. Submission checks active status, approval, dates and applicability to assigned entities. Submitted packages preserve the chosen document/file snapshot even when the register changes; review UI and PDF identify those versions.
- Migration 028 applied. Database tests cover manager permissions, self-review policy, required files, authoritative snapshots, stale selections, approved-but-expired rejection, unrelated mission scope and version retention. All fixtures and temporary test policy changes rolled back.
- 51 unit tests and production build/type checking passed. Browser verified document creation fields without saving a fixture document. Registered-document downloads use the existing organization-scoped signed-file endpoint.
- Remaining goal work includes reproducible report jobs, unified readiness/qualification views, final UI and workflow acceptance (including actual upload/download round-trips), and remaining items in the adoption plan.

### Kit package acceptance fix — 7 September 2026

- Extended the kit snapshot regression to use `aerolog_command('save', ...)`, matching the application. This reproduced a real failure after the kit library revision changed: the INSERT phase of an upsert treated the existing mission as new.
- Migration 029 makes the snapshot trigger load existing mission data before either upsert phase. Drafts retain their captured kit after library edits/archive, completed history stays immutable, and equipment removal still requires unlinking the kit.
- Expanded kit regression passed, alongside mission resource, mission form and document database regressions. All test fixtures rolled back; no operational records changed.
- The broader goal remains active; report generation and the remaining adoption acceptance checks are not yet complete.

### Shared report calculations and previews — 7 September 2026

- Added Reports navigation with organization, pilot, aircraft and battery flight-ledger previews, inclusive recorded-date range, paginated rows and CSV preview downloads. Calculations retain exact seconds and source record revisions, use explicit identities before names, avoid double-counting multi-pack references, and disclose undated/unattributed records.
- CSV includes period/entity/organization, generation time, calculation version, source IDs, hashes and revisions; text cells protect against spreadsheet formula execution. External time stays separate; battery linked flights are not labeled as charge cycles.
- Read-only live verification reproduced Ivan's 20 flights and 29,599 seconds with 20 source references. 54 unit tests, typecheck and production build passed; browser verified the organization report preview.
- This completes the shared calculation/preview layer only. Persisted queued report jobs, durable reproducible export artifacts and broader equipment/battery history sections remain to be implemented before the reporting deliverable is complete.

### Persisted report exports — 7 September 2026

- Added organization-scoped saved report jobs, frozen source summaries and membership identities, audit entries, private CSV artifacts and SHA-256 hashes. Generation runs after the local HTTP response; exclusive five-minute leases prevent duplicate workers, and failed/interrupted generation can resume using the original snapshot.
- Reports now show job status, requester, period, totals, attempts and download/resume actions. Fixed native date inputs so changed dates reach both the preview and queued request. Fixed the storage CSV MIME type after a real failed upload, then verified successful recovery of that same job.
- Full-history Ivan export `ec7100a4-d165-4dfb-9a91-92275da9e3f3` completed: 20 flights, 29,599 seconds, 8,003 bytes. Downloaded from storage, hash checked, and reproduced byte-for-byte from the frozen snapshot. Repeat with `node --import tsx scripts/verify-saved-report.mjs ec7100a4-d165-4dfb-9a91-92275da9e3f3` (read-only).
- Migration 030 applied. Database regression passed for idempotency, snapshot isolation from later source edits, exclusive/recoverable leases, stale worker rejection, artifact path validation and RLS; fixtures rolled back. Production build including TypeScript passed. Browser verified the full-history preview and queued the saved export.
- The goal remains open: broader equipment/battery history reports, readiness/qualification views, work-order enhancements, planned-versus-flown overlays and full adoption acceptance remain. Local generation is resumable, not an always-on external worker; orphan-upload cleanup and future calculation-version dispatch remain follow-ups.

### Crew qualification matrix — 7 September 2026

- Crew now opens a qualifications/aircraft-access matrix with a profile-card alternative. Active/inactive/all-personnel scope and name filtering separate current membership from operational credentials. Stable account links take precedence; name fallback only resolves a unique membership.
- Active members without a crew record remain visible with “Crew profile not recorded”; the UI does not fabricate certificates or aircraft permissions. Browser confirmed Danijel and Ivan in Active, Ivan's missing profile, and four historical members in Inactive. Historical profile cards now explicitly say inactive organization member instead of Available.
- Credential columns show each recorded qualification, issuer, expiry, required status and evidence validity using the existing qualification-state function. Current credentials expiring within 30 days receive an attention label. The matrix is horizontally scrollable for many qualifications.
- Production build and TypeScript passed. Current real data has no additional qualification entries, so populated matrix visual acceptance remains pending; this does not claim the entire personnel deliverable complete. Crew onboarding for members without operational profiles and the unified readiness queue still need work.

### Member-linked crew setup — 7 September 2026

- Active members without operational records have a manager-only “Set up crew profile” action in the matrix. It opens a draft with the stable account ID and locked member name, blank required certificate fields, Unavailable status and unconfigured aircraft permissions. No credentials or operational readiness are inferred from account membership.
- Migration 031 validates new membership links against an active member of the same organization, rejects mismatched names and duplicate linked profiles, and prevents reassignment/removal of established identity links. Upsert loads the existing record; unchanged historical links remain editable after access removal.
- Rollback DB regression passed for organization scope, identity mismatch, upsert retention, duplicates and immutable links. Production build/TypeScript passed. Browser verified Ivan's correctly linked unsaved draft and closed it without creating a real crew record.
- The broader goal remains active. Unified readiness, planned-versus-flown comparison, work-order costs and wider history reporting remain outstanding, alongside final workflow/visual acceptance.

### Unified dashboard attention — 7 September 2026

- Replaced the dashboard's truncated attention lists with one prioritized, paginated queue and category filters. It combines mission reviews, overdue services, battery/aircraft alerts, inspection thresholds, crew credentials/permissions and document approval/expiry.
- Inspection links open the affected equipment record rather than the generic inspection landing page. Documents open their exact register record. Existing mission/service/person/equipment links remain record-specific.
- Personnel attention excludes inactive linked members; document attention excludes archived entries. Expiry today is distinguished from already expired, and credentials expiring within 30 days surface ahead of expiry. Missing evidence stays explicit. This summarizes recorded issues and does not replace mission submission guards.
- 55 unit tests and production build/TypeScript passed. Browser verified category filtering and Danijel's unconfigured-aircraft-permission attention entry. Document populated-state navigation and full narrow-screen visual acceptance remain to be exercised.
- Remaining broader scope includes planned-versus-flown overlays, work-order enhancements, extended history reporting and final requirement-by-requirement acceptance.

### Planned area and recorded flight comparison — 7 September 2026

- Mission detail now combines the planned boundary with a selected actual flight track, lists flights linked by stable mission ID, and opens full flight analysis. No name-based matching or invented track is used.
- Added recorded-position outside-area counts with boundary-inclusive handling, reversed-ring support, and explicit rejection of missing/degenerate, polar and antimeridian-spanning inputs. Counts represent samples, not duration or every possible crossing between them. Altitude comparisons remain unavailable when reference datums cannot be reconciled.
- 57 unit tests passed and production build/TypeScript passed. Browser verified the unlinked-mission empty state. Real imported flights were not relinked merely for testing. Populated overlay visual QA, complex/self-intersecting polygon handling and broader final acceptance remain outstanding.
- Broader goal remains active: work-order enhancements, extended equipment/battery reporting and remaining workflow/UI checks still need completion.

### Boundary comparison correctness — 7 September 2026

- Boundary comparison now normalizes closed rings and consecutive duplicate positions without mutating source data, rejects self-crossings/nonadjacent touches/overlapping edges, and retains valid concave areas and straight intermediate vertices. Area calculation uses translated coordinates to reduce cancellation for small operating sites.
- Fixed initial Mapbox bounds to include both the mission area and the recorded track; previously a present track took precedence and could leave the planned area off-screen.
- All five focused geometry tests passed, covering edge inclusion, reversed rings, unavailable/degenerate data, closed rings, duplicate points, crossings/overlaps and concave regions. Production build/TypeScript passed. Populated overlay browser acceptance remains pending; no real mission links were changed.
- The broader adoption goal is still incomplete, including work-order enhancements, history reports and final acceptance checks.

### Maintenance cost records — 7 September 2026

- Work orders now accept a recorded amount, explicit currency code and invoice/cost reference. Blank means unknown; zero is a recorded no-cost service. Decimal values are preserved without forced two-decimal rounding, including three-decimal KWD amounts.
- Amount/currency/reference appear in work-order detail; equipment maintenance history shows recorded cost. Migration 032 adds database validation for numeric range, required currency and reference length; application schema enforces the same cost requirements.
- Focused schema and rollback database tests passed for unknown/zero/decimal persistence, invoice reference and invalid inputs. Production build/TypeScript passed. Browser verified blank cost fields and explanatory text; no real expenses were recorded.
- Broader maintenance acceptance remains open: lifecycle/status enhancements and fully typed battery/equipment targets need review. Extended history reporting and final adoption acceptance also remain.

### Typed maintenance equipment targets — 7 September 2026

- Work orders now select aircraft/equipment or batteries by kind and stable record ID. Equipment passports link history using both fields; legacy asset-name matching is retained only for records without IDs. Battery passports expose Schedule service.
- Migration 033 validates organization-scoped target existence and resolves unique legacy asset names when saving. Sign-off uses exact targets. Battery sign-off retains condition, health and counters; asset sign-off preserves Retired/Checked out and refuses interval reset when hours are unknown.
- Battery forms explain separate inspection/charge workflows and hide the irrelevant hourly reset field. Completion notifications distinguish battery sign-off from asset interval updates.
- Rollback regression exercised the actual command RPC for save and signed completion of both target kinds, retained costs, missing-target rejection, unchanged battery quarantine/cycles and retained aircraft retirement. Updated cost fixtures to include required equipment counters; both DB scripts passed. Production build/TypeScript passed. Browser verified selecting a TB65 and the battery-specific form; draft closed unsaved.
- Broader adoption goal remains active: maintenance lifecycle enhancements, extended history reports and final end-to-end/visual acceptance are still open.

### Maintenance work in progress — 7 September 2026

- Added Start work and an In progress status. Start actor/time are stamped server-side, preserved through edits/sign-off, and cannot be supplied as forged metadata. Started jobs cannot revert to scheduled states or change equipment targets.
- Migration 034 also checks pending/approved mission writes for equipment referenced by an In progress work order. This gate does not retroactively revoke already approved missions; final readiness acceptance must account for changes after approval.
- Extended rollback service regression covers actual save/start/sign-off commands, anti-spoof start stamping, rejected status reversal and retained start time. An isolated trigger probe verifies detection of active work for both asset and battery IDs. Full mission submission integration for this new gate remains to be tested. Production build/TypeScript passed.
- Corrected the service detail sign-off explanation to match battery behavior and preserved retired/checked-out asset states. No real jobs were started or completed during testing.
- Goal remains active; wider reports and remaining workflow/visual acceptance are still outstanding.

### Maintenance gate through mission submission — 7 September 2026

- Extended the mission resource regression through the actual `aerolog_command('save', ...)` submission path. In-progress work on a selected battery and an additional aircraft each blocks submission; signing off the corresponding work order allows the same request to succeed.
- Updated the disabled-membership fixture to reuse a historical crew profile rather than attempting a newly forbidden link to an inactive account. Temporary fixture credential adjustments and all mission/service writes are rolled back.
- The full mission-resource regression passed, covering resource conflicts, adjacent windows, disabled access, compatibility and the maintenance gate. Dashboard attention now includes every In progress work order, including those not overdue, without duplicating overdue entries. TypeScript passed.
- This closes the previously noted isolated-test limitation for new mission submissions. It does not imply existing approved missions are automatically revoked after maintenance starts. Final operational acceptance and the broader reporting/UI deliverables remain open.

### Equipment history in saved reports — 7 September 2026

- Aircraft and battery reports optionally include maintenance, inspection events, dated battery readings and charge events. History rows retain date basis, actor, record IDs/revisions, findings/readings and original cost currency. UTC dates are explicit for timestamped events; completed work uses completion date and open work uses due date.
- Migration 035 freezes history records alongside flight summaries when requested. Existing flight-only snapshots and CSV bytes remain unchanged. Report previews show the first 25 history rows; CSV includes the full selected period. More extensive preview paging remains a UI follow-up.
- Added history tests for exact equipment type/ID, completion-date selection, timezone boundaries, currency/decimal retention and optional history. All 62 unit tests and production build/TypeScript passed.
- Browser queued battery report `4c74473f-8816-4b30-9dff-558e25084415`; storage download hash and byte-for-byte snapshot reproduction passed (empty history for the selected battery/date range). Ivan's earlier 20-flight/29,599-second report still reproduces exactly. Populated real-history browser acceptance and snapshot regression for later history edits remain to be completed.
- Broader goal remains active, including the remaining workflow/visual acceptance and adoption-plan requirements.

### History report persistence and preview acceptance — 7 September 2026

- Added independent 25-row history pagination; previews no longer truncate access to later history rows. The frozen preview is retained while paging and CSV still contains all rows.
- New rollback report-history regression creates a typed aircraft/service source, queues and claims a report, edits the source task/cost/due date, expires the lease, and reclaims it. Original source revision, decimal cost and CSV bytes remain unchanged after recovery. Test passed; all fixtures rolled back.
- Production build/TypeScript passed. Browser verified a populated existing local-sample aircraft report: the airframe/propeller work order appears with scheduled due-date basis and technician, and one-page history disables both paging controls. No real work orders or flight links were altered.
- Remaining goal work includes broader end-to-end/visual checks, multi-page history browser acceptance, review of remaining adoption requirements and any gaps those checks uncover.

### Inspection due dates in operations calendar — 7 September 2026

- Added inspection entries/filter to the shared month/week calendar. Each calendar interval uses its latest signed rule baseline and links to the exact equipment kind/ID. Counter-based readiness status remains visible even when a calendar date lies ahead.
- Hours/flights/cycle-only rules are counted separately instead of receiving fabricated due dates. The calendar explains that counter thresholds may make work due sooner than a date interval.
- Focused test passed for signed-baseline reset, earlier cycle-triggered due status, meter-only omission and type-safe equipment identity. Production build/TypeScript passed. Browser verified the Inspections filter and empty-date explanation; populated inspection calendar visual acceptance remains open.
- Goal remains active. Calendar sharing/iCal, broader PDF reports and the remaining adoption/visual acceptance requirements still require work.

### Saved PDF reports — 7 September 2026

- Added CSV/PDF format selection to saved report jobs. PDFs use the same frozen report calculations/history, include full flight provenance, and retain snapshot time, calculation/renderer version and page numbering. Migration 036 validates the appropriate artifact extension per requested format.
- Added an embedded DejaVu font with its upstream license (`https://dejavu-fonts.github.io/License.html`) and the PDF fontkit adapter. Rendering stays in the local Node app. All four pages of Ivan's 20-flight QA PDF were rendered with Poppler and visually inspected for clipping, source IDs, totals and pagination.
- Saved PDF job `45659336-aef5-4f6f-a847-8e998191ff0b` completed: 20 flights, 29,599 seconds, 22,461 bytes. Storage download hash and byte-for-byte regeneration from its frozen snapshot passed. The reusable saved-report verifier now supports both PDF and CSV.
- Existing report-job DB regression and production build/TypeScript passed. PDF history with lengthy findings and additional scripts/languages still needs broader visual acceptance; no jurisdiction-specific compliance format is claimed.
- Goal remains active; remaining adoption requirements and end-to-end/visual acceptance are not yet complete.

### Personnel totals and assignment completeness — 7 September 2026

- Replaced crew-card name-only flight sums with identity-first accounting. Explicit pilot IDs cannot fall back to matching names; ambiguous legacy names remain unattributed. Unique external crew without accounts retain name-based legacy attribution, and historical inactive accounts keep their hours.
- Crew detail now shows ledger totals, and the matrix shows organization member totals even without a crew profile. Browser verified Ivan's 20 flights / 8.22 hours alongside the explicit missing-profile state.
- Personnel mission assignments now include secondary pilots, instructors and other `crewAssignments` roles rather than only primary pilot/observer.
- Focused identity tests cover renamed/inactive accounts, unknown explicit IDs, duplicate names and external crew. Tests and production build/TypeScript passed. No memberships, credentials or flight records changed.
- The broader adoption goal remains active; sharing/bulk workflows and final comprehensive acceptance remain outstanding.

### Broad local workflow regression — 7 September 2026

- Reworked the integration runner to create its own temporary organization and disposable five-role accounts, instead of relying on disabled historical users in e&. Fixture pilots now explicitly authorize aircraft. Cleanup removes the isolated records, identities and organization.
- All 23 integration checks passed: authentication/roles, direct-write blocking, risk requirements, actual private-file upload/download, independent approval, submitted attachment locks, resource conflicts, optimistic concurrency, mission PDF/debrief, import accounting/deduplication, quarantine retention, maintenance sign-off, import preview, source archival, cross-org access, account provisioning and revocation.
- All 38 organization API checks passed, including branding, invitations, membership isolation, pilot attribution and stale-tab protection.
- Read-only post-run checks confirmed e& still has exactly two active members; Ivan retains exactly 20 flights, 29,599 seconds and 29,532 track points. No temporary test organizations remain.
- These checks cover the original core flows; newer document/incident/evidence uploads and complete desktop/mobile acceptance still need their own direct verification. Broader follow-on requirements remain open; goal not complete.

### Evidence upload/download workflow acceptance — 7 September 2026

- Expanded isolated API integration coverage to aircraft, battery, crew, document and incident evidence. Each test uploads a real text file through the public app endpoint, lists it, obtains an authorized signed URL and checks downloaded bytes exactly.
- Verified pilot/observer upload restrictions, document submission with the uploaded file, denied self-review and successful independent manager approval retaining the exact attachment ID. Closed incidents reject new evidence and leave no orphan upload in their storage folder.
- Cross-organization requests cannot obtain download URLs for any of the five new evidence types. Cleanup now removes all attachments in the isolated test organization, including the newer target-based records.
- All 30 integration checks passed and cleanup finished successfully. Tests use disposable data; no operational documents, incidents, credentials or equipment were modified.
- These API round-trips close the prior missing upload/download evidence for the newer modules. Their full browser UX, mobile layouts, sharing/bulk workflows and remaining adoption acceptance still need completion. Goal remains active.

### Canonical identity passport history — 7 September 2026

- Bootstrap now loads all organization-scoped equipment aliases in ordered 500-row pages and exposes them through the app store.
- Passports project flights, services, inspection plans/events, evidence and battery events across an equipment identity family without rewriting original records. Flights referencing multiple family members appear once. Explicit aircraft IDs take precedence over legacy names; ambiguous names remain unattributed.
- Linked source IDs and canonical identity are displayed. Battery readings and telemetry remain separate per source, preserving counter provenance rather than summing counters.
- Four focused identity/history tests, TypeScript, production build and diff checks passed. Actual authenticated e& bootstrap returned 792 records and zero aliases. No real equipment links or counters were changed.
- Merge execution, canonical operational write/readiness routing, handover semantics and broader browser/mobile acceptance remain open. Browser access is still blocked by the locked Mac; goal remains active.

### Recipient-controlled equipment view closure — 7 September 2026

- Added an `Ended` state and recipient `End shared view` control for accepted equipment directory shares. Ending removes the live equipment projection for both parties while retaining original acceptance and the ending actor/time.
- Owner revocation now applies only to pending/accepted shares. Terminal shares reject reopening and repeated mutations; terminal labels remain visible after expiry. Missing equipment no longer produces an object of null fields.
- Migration 045 passed a rollback preview covering wrong-side actions, retained acceptance, expiry precedence, terminal guards, audit and existing isolation checks, then was applied. TypeScript and production build passed.
- This records termination of a data view, not a physical return, reservation or operational handover. No real equipment sharing relationship was created or changed.
- All 36 isolated API integration checks passed, including recipient closure, denied owner-side end, retained timestamps, removal of details and rejected reopening. Temporary records/accounts/organizations were cleaned up successfully. Goal remains active; merge execution and final browser/mobile acceptance remain unfinished.

### Evidence-based merge counter proposal — 7 September 2026

- Inventory duplicate review now includes explicit source selection for the proposed hours/cycles register and a required evidence explanation. Preview retains source kind/ID/revision and never adds overlapping totals.
- Lower-than-other values are flagged for inspection-baseline reconciliation. Unknown aircraft hours remain unknown; missing/fractional/negative/non-finite/out-of-range battery cycles are rejected. Changing either selected record or refreshing review clears the proposal.
- Four focused merge/reconciliation tests and production build/TypeScript passed. No source records, counters, aliases or inspection baselines were changed. This is a proposal, not a merge execution endpoint.
- Goal remains active. Atomic merge application must still validate operational routing, readiness and inspection baselines; full desktop/mobile acceptance remains pending.
