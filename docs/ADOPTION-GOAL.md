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
