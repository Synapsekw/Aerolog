'use client';
import { useApp } from './app-provider';
import { Input } from '@/components/ui/input';
export default function EquipmentMetadataFields({
  draft,
  update,
  battery = false,
}: {
  draft: any;
  update: (key: string, value: any) => void;
  battery?: boolean;
}) {
  const app = useApp();
  const sites = app
    .items('site')
    .filter(
      (s) =>
        s.id === draft.storageSiteId ||
        (!s.archived && s.purpose !== 'Operating area'),
    );
  return (
    <fieldset className="equipment-metadata-fields">
      <legend>Equipment identity and storage</legend>
      <div className="form-grid">
        {(['manufacturer', 'productModel', 'firmware'] as const).map((key) => (
          <label className="field" key={key}>
            {
              {
                manufacturer: 'Manufacturer',
                productModel: 'Product model / battery type',
                firmware: 'Firmware version',
              }[key]
            }
            <Input
              value={draft[key] || ''}
              onChange={(e) => update(key, e.target.value)}
            />
          </label>
        ))}
        {battery && (
          <label className="field">
            Serial number
            <Input
              value={draft.serial || ''}
              onChange={(e) => update('serial', e.target.value)}
            />
          </label>
        )}
        {battery &&
          (['ratedCapacityMah', 'nominalVoltage'] as const).map((key) => (
            <label className="field" key={key}>
              {key === 'ratedCapacityMah'
                ? 'Rated capacity (mAh)'
                : 'Nominal voltage (V)'}
              <Input
                type="number"
                min="0"
                step="any"
                value={draft[key] ?? ''}
                onChange={(e) =>
                  update(
                    key,
                    e.target.value === '' ? null : Number(e.target.value),
                  )
                }
              />
            </label>
          ))}
      </div>
      <label className="field">
        Assigned storage site
        <select
          value={draft.storageSiteId || ''}
          onChange={(e) => update('storageSiteId', e.target.value)}
        >
          <option value="">Not assigned</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.archived ? ' (archived)' : ''}
            </option>
          ))}
        </select>
      </label>
      <p className="fine-print">
        Use the product label or verified specification for rated values.
        Storage assignments do not change when a flight is imported.
      </p>
    </fieldset>
  );
}
