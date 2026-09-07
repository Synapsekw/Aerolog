'use client';
export default function FlightEquipmentProvenance({ flight }: { flight: any }) {
  const source = flight.equipmentIdentitySource;
  if (!source || typeof source !== 'object') return null;
  const fields = [
    ['aircraft', 'Aircraft name'],
    ['aircraftId', 'Aircraft ID'],
    ['equipmentIds', 'Equipment IDs'],
    ['battery', 'Primary battery'],
    ['batteryIds', 'Battery IDs'],
  ];
  const display = (value: unknown) =>
    Array.isArray(value)
      ? value.join(', ')
      : typeof value === 'string' && value
        ? value
        : 'Not supplied';
  return (
    <details className="glass equipment-bulk-editor">
      <summary>Original equipment references</summary>
      <p>
        Incoming references are retained alongside the equipment identities used
        for usage accounting. Imported telemetry and original source files
        remain unchanged.
      </p>
      <div
        className="report-table-scroll"
        role="region"
        aria-label="Flight equipment identity provenance"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Incoming log</th>
              <th>Recorded equipment</th>
            </tr>
          </thead>
          <tbody>
            {fields
              .filter(([key]) => source[key] != null || flight[key] != null)
              .map(([key, label]) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  <td>{display(source[key])}</td>
                  <td>{display(flight[key])}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
