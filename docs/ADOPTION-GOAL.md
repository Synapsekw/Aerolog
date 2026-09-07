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
