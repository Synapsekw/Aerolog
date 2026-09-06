'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { api } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Flight, Profile } from '@/lib/domain/models';
type Org = { id: string; name: string; logo_data: string | null };
export default function OrganizationPanel({
  organization,
  profile,
  flights = [],
  members = [],
  onChange,
}: {
  organization?: Org;
  profile?: Profile;
  flights?: Flight[];
  members?: Profile[];
  onChange: () => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [orgs, setOrgs] = useState<Org[]>([]),
    [name, setName] = useState(organization?.name || ''),
    [logo, setLogo] = useState<string | null>(organization?.logo_data || null),
    [newName, setNewName] = useState(''),
    [code, setCode] = useState(''),
    [email, setEmail] = useState(''),
    [role, setRole] = useState('pilot'),
    [invite, setInvite] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ organizations: Org[] }>('organizations')
      .then((r) => setOrgs(r.organizations))
      .catch((e) => setError(e.message));
  }, [organization?.id]);
  async function run(action: () => Promise<unknown>, refresh = true) {
    setBusy(true);
    setError('');
    try {
      await action();
      if (refresh) await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const send = (body: object) =>
    api('organizations', { method: 'POST', body: JSON.stringify(body) });
  const hours = (seconds: number) => (seconds / 3600).toFixed(2);
  return (
    <section className="glass organization-panel">
      <div className="row">
        <div>
          <span className="eyebrow">ORGANIZATION</span>
          <h2>{organization?.name || 'Choose your organization'}</h2>
        </div>
        {organization?.logo_data && (
          <Image
            width={64}
            height={64}
            unoptimized
            className="org-logo"
            src={organization.logo_data}
            alt={`${organization.name} logo`}
          />
        )}
      </div>
      <p>
        Keep each team’s missions, equipment and flight hours in its own
        workspace.
      </p>
      {orgs.length > 0 && (
        <label className="field">
          <span>Active organization</span>
          <select
            aria-label="Active organization"
            disabled={busy}
            value={organization?.id || ''}
            onChange={(e) =>
              void run(() => send({ action: 'switch', id: e.target.value }))
            }
          >
            <option value="" disabled>
              Select organization
            </option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {organization && (
        <>
          <div className="org-metrics">
            <div>
              <strong>
                {hours(flights.reduce((s, f) => s + f.durationSeconds, 0))} h
              </strong>
              <span>Organization flight time</span>
            </div>
            <div>
              <strong>{flights.length}</strong>
              <span>Recorded flights</span>
            </div>
            <div>
              <strong>{members.filter((m) => m.active).length}</strong>
              <span>Active members</span>
            </div>
          </div>
          <p className="fine-print">
            Totals include all flights recorded in this organization. Joining
            does not copy a pilot’s private history or another organization’s
            flights.
          </p>
          <div className="org-pilot-totals">
            {members.map((m) => {
              const own = flights.filter((f) =>
                (f as Flight & { pilotUserId?: string }).pilotUserId
                  ? (f as Flight & { pilotUserId?: string }).pilotUserId ===
                    m.id
                  : f.pilot === m.display_name &&
                    members.filter((p) => p.display_name === m.display_name)
                      .length === 1,
              );
              return (
                <div className="linked-item" key={m.id}>
                  <span>
                    {m.display_name}
                    <small>
                      {own.length} flights · {m.role}
                    </small>
                  </span>
                  <strong>
                    {hours(own.reduce((s, f) => s + f.durationSeconds, 0))} h
                  </strong>
                </div>
              );
            })}
          </div>
        </>
      )}
      {profile?.role === 'admin' && (
        <details>
          <summary>Organization branding</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() =>
                api('organizations', {
                  method: 'PATCH',
                  body: JSON.stringify({ name, logoData: logo }),
                }),
              );
            }}
          >
            <label className="field" htmlFor="org-name">
              <span>Organization name</span>
              <Input
                id="org-name"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field" htmlFor="org-logo">
              <span>Logo · PNG, JPEG or WebP, up to 200 KB</span>
              <Input
                id="org-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 200000) {
                    setError('Choose a logo smaller than 200 KB.');
                    return;
                  }
                  const r = new FileReader();
                  r.onload = () => {
                    if (typeof r.result === 'string') setLogo(r.result);
                  };
                  r.readAsDataURL(f);
                }}
              />
            </label>
            {logo && (
              <div className="row">
                <Image
                  width={64}
                  height={64}
                  unoptimized
                  src={logo}
                  alt="Logo preview"
                  className="org-logo"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setLogo(null)}
                >
                  Remove logo
                </Button>
              </div>
            )}
            <Button disabled={busy} type="submit">
              Save branding
            </Button>
          </form>
        </details>
      )}
      {profile?.role === 'admin' && (
        <details>
          <summary>Invite a member</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await send({ action: 'invite', email, role });
                setInvite(r.code);
              }, false);
            }}
          >
            <label className="field" htmlFor="org-email">
              <span>Member email</span>
              <Input
                id="org-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {['pilot', 'observer', 'technician', 'manager', 'admin'].map(
                  (r) => (
                    <option key={r}>{r}</option>
                  ),
                )}
              </select>
            </label>
            <Button type="submit" disabled={busy}>
              Create invitation code
            </Button>
          </form>
          {invite && (
            <div className="org-invite">
              <p>
                Share this code with {email}. They sign in with that email and
                use “Join an organization”. It expires in 7 days and works once.
                No email was sent.
              </p>
              <Input aria-label="Invitation code" readOnly value={invite} />
              <Button
                variant="outline"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(invite)
                    .catch(() => setError('Select and copy the code manually.'))
                }
              >
                Copy invitation code
              </Button>
            </div>
          )}
        </details>
      )}
      <details>
        <summary>Create an organization</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              send({ action: 'create', name: newName, displayName }),
            );
          }}
        >
          <label className="field" htmlFor="org-new-name-display">
            <span>Your name in this organization</span>
            <Input
              id="org-new-name-display"
              required
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label className="field" htmlFor="org-new-name">
            <span>New organization name</span>
            <Input
              id="org-new-name"
              required
              maxLength={100}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <p className="fine-print">
            You become its administrator. It starts with an empty logbook and
            inventory.
          </p>
          <Button disabled={busy} type="submit">
            Create organization
          </Button>
        </form>
      </details>
      <details>
        <summary>Join an organization</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              send({ action: 'join', code: code.trim(), displayName }),
            );
          }}
        >
          <label className="field" htmlFor="org-code-display">
            <span>Your name in this organization</span>
            <Input
              id="org-code-display"
              required
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label className="field" htmlFor="org-code">
            <span>Invitation code</span>
            <Input
              id="org-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <p className="fine-print">
            Sign in using the email address on the invitation.
          </p>
          <Button disabled={busy} type="submit">
            Join organization
          </Button>
        </form>
      </details>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </section>
  );
}
