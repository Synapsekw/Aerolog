import { FileText, ShieldCheck, Wrench } from 'lucide-react';

export const agents = [
  { name: 'Maintenance', role: 'Protect the next takeoff.', Icon: Wrench, color: '#e8b57c', description: 'Connect flight hours, battery cycles, service history, and aircraft manuals. Surface what needs attention before the next assignment.', evidence: ['Aircraft service history', 'Flight & battery logs', 'Manufacturer manuals'] },
  { name: 'Compliance', role: 'Give every flight its evidence.', Icon: ShieldCheck, color: '#93badf', description: 'Cross-check the executed flight against the document repository: government permits, dates, operating areas, aircraft, and crew credentials.', evidence: ['Government flight permits', 'Executed route & timestamps', 'Crew & aircraft documents'] },
  { name: 'Debrief', role: 'Turn the flight into a clear next step.', Icon: FileText, color: '#bcb1e5', description: 'Bring findings into a source-linked post-mission report. Draft the follow-ups, highlight gaps, and hand the review to your team.', evidence: ['Mission telemetry', 'Agent findings & sources', 'Post-mission report'] },
];

export const scenarios = [
  { id: 'routine', label: 'Routine return', flight: 'Coastal mapping', time: '21 min', state: 'Evidence connected', note: 'The planned review finds linked records for this sample flight.', findings: [
    { title: 'Service records aligned.', status: 'No issue flagged', detail: 'Flight time is added to the aircraft history. The next service task stays visible in the fleet schedule.', sources: ['Flight log · 21 min', 'Aircraft service record'], action: 'Keep the next service task on the schedule.' },
    { title: 'Permit linked to this flight.', status: 'Evidence found', detail: 'The sample government permit is matched to the recorded date, operating area, and aircraft. Crew credentials are attached to the mission.', sources: ['Government permit · linked', 'Flight route & crew record'], action: 'Present the linked evidence for operator review.' },
    { title: 'One mission. One clear record.', status: 'Draft prepared', detail: 'A post-mission summary brings together the flight, source documents, and agent findings in one reviewable record.', sources: ['Mission record', 'Maintenance & permit findings'], action: 'Send the draft to the operations team for approval.' },
  ] },
  { id: 'permit', label: 'Permit gap', flight: 'Marina inspection', time: '18 min', state: 'One gap to resolve', note: 'A missing document becomes a visible follow-up, with its source context.', findings: [
    { title: 'Aircraft history updated.', status: 'No issue flagged', detail: 'The completed flight is linked to the aircraft and battery records. No maintenance exception is identified in this sample.', sources: ['Completed flight log', 'Aircraft service record'], action: 'Keep the aircraft record ready for the next review.' },
    { title: 'A flight without a linked permit.', status: 'Review needed', detail: 'No government flight permit matching this mission is found in the repository. The agent flags the gap instead of assuming the flight was authorized.', sources: ['Executed flight · Marina', 'Document search · no match'], action: 'Ask the operations lead to attach and verify the permit.' },
    { title: 'The gap travels with the report.', status: 'Follow-up drafted', detail: 'The draft report includes the missing evidence, the completed checks, and a proposed follow-up for the operations lead.', sources: ['Permit search result', 'Post-mission report · draft'], action: 'Keep the compliance review open until the evidence is verified.' },
  ] },
  { id: 'service', label: 'Service due', flight: 'Solar park survey', time: '26 min', state: 'Attention before takeoff', note: 'A service finding carries through to the next mission’s readiness review.', findings: [
    { title: 'A service threshold is reached.', status: 'Review needed', detail: 'The new flight hours reach a scheduled service threshold in this sample aircraft record. A maintenance task is proposed with the relevant manual reference.', sources: ['Accumulated flight hours', 'Service schedule & manual'], action: 'Request an engineer’s review before the aircraft is reassigned.' },
    { title: 'Mission documents connected.', status: 'Evidence found', detail: 'The executed route and timestamps are linked to the sample permit and mission documents. The maintenance finding remains visible alongside them.', sources: ['Government permit · linked', 'Executed route & timestamps'], action: 'Keep the operational evidence and maintenance review together.' },
    { title: 'A useful handoff to the team.', status: 'Follow-up drafted', detail: 'The draft debrief includes the service finding, its source reference, and the proposed maintenance task for human approval.', sources: ['Maintenance finding', 'Service task · proposed'], action: 'Have the maintenance lead confirm the work and release decision.' },
  ] },
];

