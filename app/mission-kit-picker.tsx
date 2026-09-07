'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { kitAssignment, kitContents, type Kit } from '@/lib/operations/kits';
import { Button } from '@/components/ui/button';
export default function MissionKitPicker({
  draft,
  onApply,
}: {
  draft: any;
  onApply: (patch: any) => void;
}) {
  const app = useApp(),
    [selected, setSelected] = useState('');
  const kits = app.items('kit').filter((k) => !k.archived) as Kit[],
    kit = kits.find((k) => k.id === selected);
  const preview = kit
    ? kitAssignment(
        kit,
        app.items('asset'),
        app.items('battery'),
        draft.aircraft,
        app.organization.settings,
      )
    : null;
  return (
    <section className="mission-kit-picker">
      <label className="field">
        <span>Apply an inventory kit</span>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select a kit…</option>
          {kits.map((k) => (
            <option value={k.id} key={k.id}>
              {k.name} · {k.items.length} items
            </option>
          ))}
        </select>
      </label>
      {kit && preview && (
        <>
          <h3>Kit contents</h3>
          {kitContents(kit, app.items('asset'), app.items('battery')).map(
            (i) => (
              <p key={i.kind + i.id}>
                {i.name} · {i.status}
              </p>
            ),
          )}
          {preview.blockers.length > 0 && (
            <ul>
              {preview.blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={preview.blockers.length > 0}
            onClick={() => {
              onApply({
                aircraft: preview.aircraft,
                equipment: [
                  ...new Set([
                    ...(draft.equipment || []),
                    ...preview.equipment,
                  ]),
                ],
                kitSelections: [
                  ...(draft.kitSelections || []).filter(
                    (k: any) => k.id !== kit.id,
                  ),
                  {
                    id: kit.id,
                    revision:
                      app.records.find(
                        (r) => String(r.kind) === 'kit' && r.id === kit.id,
                      )?.revision || 1,
                  },
                ],
              });
              setSelected('');
            }}
          >
            Apply kit to mission
          </Button>
          <p className="fine-print">
            Adds these items to the mission. Availability is checked on
            submission. The saved package retains an equipment snapshot.
          </p>
        </>
      )}
      {draft.kitSelections?.map((k: any) => (
        <div className="row" key={k.id}>
          <span>
            Applied kit: {kits.find((x) => x.id === k.id)?.name || k.id} ·
            version {k.revision}
          </span>
          <Button
            variant="ghost"
            type="button"
            onClick={() =>
              onApply({
                kitSelections: draft.kitSelections.filter(
                  (x: any) => x.id !== k.id,
                ),
              })
            }
          >
            Unlink kit
          </Button>
        </div>
      ))}
    </section>
  );
}
