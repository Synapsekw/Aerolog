# AEROLOG — Drone Operations UI Prototype

An interactive React / Vinext prototype using shadcn primitives and Recharts. Includes a responsive glass workspace, collapsible navigation, mission planning and risk assessment, demo operations approvals, equipment custody, maintenance scheduling and sign-off, battery condition records, crew profiles, and a flight logbook with telemetry previews.

## Run

- `npm install`
- `npm run dev`
- `npm run build`
- `npx tsc --noEmit`

## Demo scope

All operational records are sample data. Edits are in-memory and persist only within the current page session. Approval and technician actions simulate roles; there is no production role authorization. Mission packages download as text and flight logs export as CSV. Maps, weather, analytics, telemetry, and battery trends are illustrative. Maintenance policies and risk scales are sample policies, not operational guidance.

DJI connection and sync are explicit simulations. No passwords are collected or DJI endpoints called. The eventual production integration requires verification of the supported DJI account and log-access APIs; possession of a developer key alone has not been confirmed sufficient. Predictive battery AI is presented as a future capability.

## Validation

TypeScript checking and a production build are required. Browser interaction and viewport testing were not requested and have not been performed. The optional, feature-detected `start_mission_planning` WebMCP tool opens the visible wizard, validates input, and is removed when its component unmounts. No supported WebMCP execution context was available to verify that optional contract end-to-end.
