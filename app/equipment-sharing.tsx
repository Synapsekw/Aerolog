'use client';
import { useEffect, useState } from 'react';
import { useApp } from './app-provider';
import { api } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
export default function EquipmentSharing() {
  const app = useApp(),
    [shares, setShares] = useState<any[]>([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [refresh, setRefresh] = useState(0),
    [target, setTarget] = useState(''),
    [recipient, setRecipient] = useState(''),
    [days, setDays] = useState(30),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const allowed = ['admin', 'manager'].includes(app.profile.role);
  useEffect(() => {
    let stopped = false;
    if (allowed)
      void api('equipment-shares?page=' + page)
        .then((r) => {
          if (!stopped) {
            setShares(r.shares);
            setMore(r.hasMore);
          }
        })
        .catch((e) => {
          if (!stopped) setError(e.message);
        });
    return () => {
      stopped = true;
    };
  }, [allowed, app.organization.id, page, refresh]);
  if (!allowed) return null;
  const items = app.records.filter(
    (r) =>
      ['asset', 'battery'].includes(r.kind) &&
      !(app.equipmentAliases || []).some(
        (alias) => alias.kind === r.kind && alias.source_id === r.id,
      ),
  );
  async function action(body: any) {
    setBusy(true);
    setError('');
    try {
      await api('equipment-shares', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setRefresh((v) => v + 1);
      app.notify('Equipment share updated');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="glass equipment-bulk-editor">
      <summary>Equipment shared with organizations</summary>
      <p>
        Offer another organization a live view of selected equipment identity,
        model, firmware, status and usage counters. They must accept before
        details are visible. Ownership, editing rights, flight records and
        maintenance evidence remain with the owner. Either organization can end
        an accepted view; this does not record an equipment return.
      </p>
      <p className="fine-print">
        This directory does not reserve equipment or authorize it for missions.
        Coordinate operational handover with the owner; the displayed status is
        not a readiness clearance.
      </p>
      <label className="field">
        Your organization ID — give this to an equipment owner
        <input
          readOnly
          value={app.organization.id}
          onFocus={(e) => e.target.select()}
        />
      </label>
      <div className="form-grid">
        <label className="field">
          Owned equipment
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Select equipment…</option>
            {items.map((r) => (
              <option key={r.kind + ':' + r.id} value={r.kind + ':' + r.id}>
                {r.data.name || r.data.sourceName || r.data.model || r.id} ·{' '}
                {r.kind}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Recipient organization ID
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value.trim())}
          />
        </label>
        <label className="field">
          Expires in days
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </label>
      </div>
      <Button
        disabled={
          busy ||
          !target ||
          !recipient ||
          recipient === app.organization.id ||
          !Number.isInteger(days) ||
          days < 1 ||
          days > 365
        }
        onClick={() => {
          const separator = target.indexOf(':');
          void action({
            action: 'create',
            kind: target.slice(0, separator),
            equipmentId: target.slice(separator + 1),
            recipientOrg: recipient,
            expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
          });
        }}
      >
        Offer equipment view
      </Button>
      {error && <p role="alert">{error}</p>}
      {shares.map((s) => (
        <article className="inspection-rule" key={s.id}>
          <h3>
            {s.owner_name} → {s.recipient_name}
          </h3>
          <p>
            {s.kind} · {s.equipment_id} · {s.availability} · expires{' '}
            {s.expires_at}
          </p>
          {s.availability === 'Accepted' && s.equipment && (
            <>
              <h4>{s.equipment.name}</h4>
              <p>
                Serial: {s.equipment.serial || 'Not recorded'} · Status:{' '}
                {s.equipment.status || 'Unknown'}
              </p>
              <p>
                Manufacturer: {s.equipment.manufacturer || 'Unknown'} · Model:{' '}
                {s.equipment.productModel || 'Unknown'} · Firmware:{' '}
                {s.equipment.firmware || 'Unknown'}
              </p>
              <p>
                Hours: {s.equipment.hours ?? 'Unknown'} · Cycles:{' '}
                {s.equipment.cycles ?? 'Unknown'} · source revision{' '}
                {s.equipment.revision}
              </p>
            </>
          )}
          <p className="fine-print">
            {s.ended_at ? `View ended ${s.ended_at}` : ''}
          </p>
          <div className="row report-pagination">
            {s.recipient_org === app.organization.id &&
              s.availability === 'Pending' && (
                <>
                  <Button
                    disabled={busy}
                    onClick={() => void action({ action: 'accept', id: s.id })}
                  >
                    Accept view
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void action({ action: 'decline', id: s.id })}
                  >
                    Decline
                  </Button>
                </>
              )}
            {s.recipient_org === app.organization.id &&
              s.status === 'Accepted' && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void action({ action: 'end', id: s.id })}
                >
                  End shared view
                </Button>
              )}
            {s.owner_org === app.organization.id &&
              ['Pending', 'Accepted'].includes(s.status) && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void action({ action: 'revoke', id: s.id })}
                >
                  Revoke access
                </Button>
              )}
          </div>
        </article>
      ))}
      {!shares.length && <p>No equipment offers on this page.</p>}
      <nav className="row report-pagination" aria-label="Equipment share pages">
        <Button
          variant="outline"
          disabled={busy || !page}
          onClick={() => setPage(page - 1)}
        >
          Newer offers
        </Button>
        <span>Page {page + 1}</span>
        <Button
          variant="outline"
          disabled={busy || !more}
          onClick={() => setPage(page + 1)}
        >
          Older offers
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => setRefresh((v) => v + 1)}
        >
          Refresh offers
        </Button>
      </nav>
    </details>
  );
}
