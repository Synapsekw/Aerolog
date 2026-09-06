'use client';
import Image from 'next/image';
import { useState } from 'react';
import { useApp } from './app-provider';
import MissionMap from './mission-map';
import Analytics from './live-analytics';
import OrganizationPanel from './organization-panel';
import { Status } from './shared';
import {
  LayoutDashboard,
  Map as MapIcon,
  Drone,
  BookOpen,
  Wrench,
  Battery,
  Users,
  Plug,
  ShieldCheck,
  Clock,
  Crosshair,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Bell,
  LogOut,
  Settings,
  History,
  Search,
  Download,
  Upload,
  RefreshCw,
  Check,
  FileText,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  newId,
  type Kind,
  type Mission,
  type Asset,
  type Battery as BatteryModel,
  type Flight,
  type Crew,
  type Service,
  durationLabel,
} from '@/lib/domain/models';
import { api, browserClient } from '@/lib/supabase-browser';
const navigation = [
  ['Overview', LayoutDashboard],
  ['Missions', MapIcon],
  ['Flight logs', BookOpen],
  ['Inventory', Drone],
  ['Maintenance', Wrench],
  ['Batteries', Battery],
  ['Crew', Users],
  ['Integrations', Plug],
  ['Audit trail', History],
  ['Settings', Settings],
] as const;
function Pick({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Select
        value={value || null}
        onValueChange={(v) => onChange(String(v || ''))}
      >
        <SelectTrigger className="picker" aria-label={label}>
          <SelectValue placeholder={'Select ' + label.toLowerCase()} />
        </SelectTrigger>
        <SelectContent>
          {options.map((v) => (
            <SelectItem value={v} key={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  disabled = false,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      <Input
        type={type}
        required={required}
        disabled={disabled}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Note({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Stat({
  label,
  value,
  note,
  Icon = Clock,
}: {
  label: string;
  value: string;
  note: string;
  Icon?: any;
}) {
  return (
    <div className="stat glass">
      <div className="stat-label">
        {label}
        <Icon size={18} />
      </div>
      <div className="stat-value">{value}</div>
      <small>{note}</small>
    </div>
  );
}
function Empty({
  label = 'No records yet',
  description = 'Add the first record to start building your operational history.',
}: {
  label?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <FileText />
      <h3>{label}</h3>
      <p>{description}</p>
    </div>
  );
}
function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
}
async function download(path: string, filename: string) {
  const {
    data: { session },
  } = await browserClient().auth.getSession();
  const r = await fetch('/api/' + path, {
    headers: { Authorization: 'Bearer ' + session?.access_token },
  });
  if (!r.ok) {
    const b = await r.json();
    throw Error(b.error);
  }
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function csv(rows: unknown[][]) {
  const text = rows
    .map((r) =>
      r
        .map(
          (v) =>
            '"' +
            (v == null
              ? ''
              : typeof v === 'object'
                ? JSON.stringify(v)
                : String(v)
            )
              .replace(/^[=+@-]/, "'$&")
              .replaceAll('"', '""') +
            '"',
        )
        .join(','),
    )
    .join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'aerolog-flight-log.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function NavigationItem(props: React.ComponentProps<typeof SidebarMenuButton>) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuButton
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        setOpenMobile(false);
      }}
    />
  );
}
export default function Workspace() {
  const app = useApp();
  const { profile, organization, items, command, busy, notify } = app;
  const date = () =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: organization.settings.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  const missions = items('mission') as Mission[],
    assets = items('asset') as Asset[],
    batteries = items('battery') as BatteryModel[],
    crew = items('crew') as Crew[],
    flights = items('flight') as Flight[],
    services = items('service') as Service[];
  const [page, setPage] = useState('Overview'),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('All'),
    [dialog, setDialog] = useState(''),
    [detail, setDetail] = useState<{ kind: Kind; id: string } | null>(null),
    [draft, setDraft] = useState<any>({}),
    [step, setStep] = useState(0),
    [error, setError] = useState(''),
    [note, setNote] = useState(''),
    [files, setFiles] = useState<any[]>([]),
    [uploading, setUploading] = useState(false),
    [importPreview, setImportPreview] = useState<any>(null),
    [importFile, setImportFile] = useState<File | null>(null),
    [accountResult, setAccountResult] = useState<any>(null);
  const record = detail
    ? items(detail.kind).find((x) => x.id === detail.id)
    : null;
  const manager = ['admin', 'manager'].includes(profile.role),
    fleet = ['admin', 'manager', 'technician'].includes(profile.role),
    planner = ['admin', 'manager', 'pilot'].includes(profile.role),
    readOnly = profile.role === 'observer';
  const pending = missions.filter((m) => m.status === 'Pending approval'),
    ready = assets.filter(
      (a) =>
        a.category === 'Aircraft' &&
        a.status !== 'Retired' &&
        a.status !== 'Maintenance due' &&
        a.hours != null && a.next != null && a.hours < a.next,
    ),
    aircraft = assets.filter(
      (a) => a.category === 'Aircraft' && a.status !== 'Retired',
    );
  const totalSeconds = flights.reduce((n, f) => n + f.durationSeconds, 0),
    totalDistance = flights.reduce((n, f) => n + Number(f.distance), 0);
  const overdue = services.filter(
    (s) => s.status !== 'Completed' && s.due < date(),
  );
  const batteryAlerts = batteries.filter(
    (b) =>
      b.status !== 'Retired' &&
      (b.health == null || b.temp == null || b.health < organization.settings.batteryMinHealth ||
        b.temp > organization.settings.batteryMaxTemperature ||
        b.status === 'Quarantined'),
  );
  const serviceAlerts = assets.filter(
    (a) => a.status !== 'Retired' && a.next != null && a.hours != null && a.next - a.hours <= 5,
  );
  const titles: Record<string, string> = {
    Overview: 'Your fleet, your people, your next move.',
    Missions: 'Plan with clarity. Fly with confidence.',
    'Flight logs': 'The complete story behind every flight.',
    Inventory: 'Every asset accounted for.',
    Maintenance: 'Keep your fleet ready for what’s next.',
    Batteries: 'A measured history of every power pack.',
    Crew: 'The people behind your operations.',
    Integrations: 'Connected services and flight-log import.',
    'Audit trail': 'An accountable history of operational decisions.',
    Settings: 'Workspace policies, access and local configuration.',
    Notifications: 'Operational changes that need your attention.',
  };
  function navigate(next: string) {
    setPage(next);
    setSearch('');
    setFilter('All');
    setDetail(null);
    setError('');
  }
  function edit(kind: Kind, data?: any) {
    setError('');
    setNote('');
    setImportPreview(null);
    setStep(0);
    const defaults: any = {
      mission: {
        id: newId('MSN'),
        name: '',
        location: '',
        date: date(),
        time: '08:00',
        durationMinutes: 60,
        type: 'Inspection',
        status: 'Draft',
        pilot:
          crew.find((c) => c.name === profile.display_name)?.name ||
          crew[0]?.name ||
          '',
        observer: crew.find((c) => c.name !== profile.display_name)?.name || '',
        aircraft: ready[0]?.name || '',
        equipment: [],
        notes: '',
        risks: [
          {
            hazard: 'People near the operating area',
            likelihood: 3,
            severity: 4,
            mitigation: '',
            controlled: false,
            residualLikelihood: 1,
            residualSeverity: 4,
          },
        ],
        history: [],
        geometry: [],
        altitude: 60,
      },
      asset: {
        id: newId('EQ'),
        name: '',
        category: 'Aircraft',
        serial: '',
        status: 'Available',
        hours: 0,
        pilot: 'Unassigned',
        next: 100,
        intervalHours: 100,
        notes: '',
      },
      battery: {
        id: newId('BAT'),
        model: '',
        aircraft: aircraft[0]?.name || '',
        cycles: 0,
        health: 100,
        temp: 25,
        status: 'Healthy',
        notes: '',
      },
      crew: {
        id: newId('CREW'),
        name: '',
        initials: '',
        role: 'Pilot',
        hours: 0,
        flights: 0,
        cert: '',
        expires: '',
        status: 'Available',
        email: '',
        notes: '',
      },
      service: {
        id: newId('SV'),
        asset: assets[0]?.name || '',
        task: '',
        due: date(),
        remaining: 0,
        status: 'Scheduled',
        technician: crew[0]?.name || profile.display_name,
        notes: '',
        intervalHours: 100,
      },
      flight: {
        id: newId('FL'),
        mission: 'Unassigned flight',
        pilot: profile.display_name,
        aircraft: aircraft[0]?.name || '',
        date: date(),
        durationSeconds: 600,
        duration: '10:00',
        distance: '0',
        altitude: 0,
        start: 100,
        end: 50,
        battery: '',
        source: 'Manual',
        telemetry: [],
        notes: '',
      },
    };
    setDraft(data ? structuredClone(data) : defaults[kind]);
    setDialog(kind);
    setDetail(null);
  }
  async function save(kind: Kind, action = 'save', doc = draft) {
    setError('');
    try {
      if (kind === 'crew') doc = { ...doc, initials: initials(doc.name) };
      if (kind === 'flight')
        doc = { ...doc, duration: durationLabel(Number(doc.durationSeconds)) };
      await command(action, kind, doc, note);
      setDialog('');
      setDetail({ kind, id: doc.id });
      notify('Saved to your workspace.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function act(action: string, data: any) {
    setError('');
    try {
      await command(action, detail!.kind, data, note);
      setNote('');
      notify(
        action === 'review'
          ? 'Review recorded.'
          : action === 'service_complete'
            ? 'Service signed off and interval updated.'
            : 'Record updated.',
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function open(kind: Kind, id: string) {
    setDetail({ kind, id });
    setNote('');
    setError('');
    setFiles([]);
    if (kind === 'mission') {
      try {
        setFiles((await api('files?mission=' + encodeURIComponent(id))).files);
      } catch (e) {
        notify((e as Error).message);
      }
    }
  }
  const update = (key: string, value: any) =>
    setDraft((d: any) => ({ ...d, [key]: value }));
  const kindByPage: Record<string, Kind> = {
    Missions: 'mission',
    Inventory: 'asset',
    Maintenance: 'service',
    Batteries: 'battery',
    Crew: 'crew',
    'Flight logs': 'flight',
  };
  const kind = kindByPage[page],
    visible = kind
      ? items(kind).filter(
          (d) =>
            Object.values(d)
              .filter((v) => typeof v === 'string')
              .join(' ')
              .toLowerCase()
              .includes(search.toLowerCase()) &&
            (filter === 'All' ||
              d.status === filter ||
              d.category === filter ||
              d.pilot === filter),
        )
      : [];
  const unread = app.notifications.filter(
    (n) => !n.read_by.includes(profile.id),
  );
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '232px',
          '--sidebar-width-icon': '72px',
        } as React.CSSProperties
      }
    >
      <Sidebar className="app-sidebar" collapsible="icon">
        <SidebarHeader>
          <div className="brand">
            <Crosshair />
            <span>
              AEROLOG<span className="brand-dot">®</span>
            </span>
          </div>
          <div className="workspace">
            <span className="workspace-icon">
              {organization.logo_data ? (
                <Image
                  width={32}
                  height={32}
                  unoptimized
                  src={organization.logo_data}
                  alt="Organization logo"
                  className="org-logo-small"
                />
              ) : (
                organization.name.slice(0, 1)
              )}
            </span>
            <div>
              {organization.name}
              <button
                className="org-switch-link"
                onClick={() => setPage('Settings')}
              >
                Manage organization ↗
              </button>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <p className="nav-label">WORKSPACE</p>
          <SidebarMenu>
            {navigation.map(([label, Icon]) => (
              <SidebarMenuItem key={label}>
                <NavigationItem
                  className="nav-item"
                  tooltip={label}
                  isActive={page === label}
                  onClick={() => navigate(label)}
                >
                  <Icon />
                  <span>{label}</span>
                  {label === 'Missions' && (
                    <b className="nav-count">{missions.length}</b>
                  )}
                </NavigationItem>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="fleet-online">
            <i />
            <span>{busy ? 'Saving changes…' : 'Supabase connected'}</span>
          </div>
          <div className="profile">
            <span className="avatar">{initials(profile.display_name)}</span>
            <div>
              {profile.display_name}
              <small>{profile.role}</small>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={() => void app.signOut()}
            >
              <LogOut size={15} />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger />
            <span>Workspace</span>
            <ChevronRight size={14} />
            <b>{page}</b>
          </div>
          <div className="topbar-right">
            {busy && <span className="busy-indicator">Saving…</span>}
            <span className="demo-badge">LOCAL TESTING</span>
            <Button
              className="notification-button"
              size="icon"
              variant="ghost"
              aria-label="Notifications"
              onClick={() => navigate('Notifications')}
            >
              <Bell size={17} />
              {unread.length > 0 && <b>{unread.length}</b>}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Refresh workspace"
              onClick={() => void app.refresh().catch((e) => notify(e.message))}
            >
              <RefreshCw size={16} />
            </Button>
          </div>
        </header>
        <div className="content">
          {detail?.kind === 'flight' && record ? (
            <article className="flight-page">
              <Button variant="outline" onClick={() => setDetail(null)}>← Back to flight logs</Button>
              <div className="page-heading"><div><div className="eyebrow">FLIGHT ANALYSIS</div><h1>{record.mission}</h1><p>{record.pilot} · {record.aircraft} · {record.date || 'Unknown date'}</p></div><Status>Recorded</Status></div>

                    <div style={{ marginTop: 20 }}>
                      {record.telemetry?.length > 1 ? (
                        <MissionMap
                          key={record.id}
                          track={record.telemetry.map((p: any) => [
                            p.longitude,
                            p.latitude,
                          ])}
                          height={480}
                        />
                      ) : record.flightTrack?.length > 1 ? (
                        <>
                          <MissionMap
                            key={record.id}
                            track={record.flightTrack.map((p: number[]) => [p[0], p[1]])}
                            height={480}
                          />
                          <p className="fine-print">Recorded flight path · DroneLogbook KML · No timestamps supplied</p>
                        </>
                      ) : record.plannedBoundary?.length >= 3 || record.siteLocation ? (
                        <>
                          <MissionMap
                            key={record.id}
                            points={record.plannedBoundary?.length >= 3
                              ? record.plannedBoundary
                              : [record.siteLocation]}
                            height={480}
                          />
                          <p className="fine-print">
                            {record.plannedBoundary?.length >= 3
                              ? 'Planned flight area from DroneLogbook. Actual flight track is unavailable.'
                              : 'Recorded site location from DroneLogbook. Actual flight track is unavailable.'}
                          </p>
                        </>
                      ) : (
                        <div className="info-box">
                          No position telemetry was recorded for this flight.
                        </div>
                      )}
                    </div>
                    <div className="detail-metrics">
                      <Stat
                        label="Duration"
                        value={record.duration}
                        note="min : sec"
                      />
                      <Stat
                        label="Distance"
                        value={record.distance + ' km'}
                        note="Recorded distance"
                      />
                      <Stat
                        label="Max altitude"
                        value={record.altitude + ' m'}
                        note="Above takeoff"
                      />
                    </div>
                    <FlightTelemetry frames={record.telemetry || []} track={record.flightTrack || []} altitudeMode={record.trackSource?.altitudeMode} />
                    {items('attachment')
                      .filter(
                        (a: any) => a.source && a.flights?.includes(record.id),
                      )
                      .map((a: any) => (
                        <Button
                          key={a.id}
                          variant="outline"
                          onClick={async () => {
                            try {
                              const r = await api<{ url: string }>(
                                'files/' + a.id,
                              );
                              window.open(
                                r.url,
                                '_blank',
                                'noopener,noreferrer',
                              );
                            } catch (e) {
                              notify((e as Error).message);
                            }
                          }}
                        >
                          <Download size={14} />
                          Source file · {a.name}
                        </Button>
                      ))}
                    <section className="flight-chart-card" style={{marginTop:24}}>
                      <h2>Linked equipment</h2>
                      <div className="row" style={{flexWrap:'wrap',gap:10}}>
                        {record.aircraftId && <Button variant="outline" onClick={() => void open('asset',record.aircraftId)}>{record.aircraft}</Button>}
                        {(record.equipmentIds || []).map((id: string) => {
                          const battery = batteries.find(b => b.id === id);
                          const asset = assets.find(a => a.id === id);
                          return <Button key={id} variant="outline" onClick={() => void open(battery ? 'battery' : 'asset',id)}>{battery?.model || asset?.name || id}</Button>;
                        })}
                        {!record.aircraftId && !record.equipmentIds?.length && <p>No inventory links available.</p>}
                      </div>
                    </section>
                    <dl className="summary-list">
                      {[
                        ['Pilot', record.pilot],
                        ['Aircraft', record.aircraft],
                        ['Date', record.date || 'Unknown date in source'],
                        ['Mission', record.mission],
                        ['Battery', batteries.find(b => b.id === record.battery)?.model || record.battery || 'Not recorded'],
                        [
                          'Battery use',
                          record.start != null
                            ? record.start + '% → ' + record.end + '%'
                            : 'Not available',
                        ],
                        ['Source', record.source],
                        ['Site', record.siteName || 'Not recorded'],
                        ['Source equipment', record.equipmentNames?.join(', ') || 'Not recorded'],
                        ['Flight app', record.sourceApp || 'Not recorded'],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p>{record.notes}</p>
                    {record.battery &&
                      batteries.some((b) => b.id === record.battery) && (
                        <Button
                          className="primary wide"
                          onClick={() => void open('battery', record.battery)}
                        >
                          Open battery passport
                        </Button>
                      )}
                    <p className="fine-print">
                      Flight records are immutable. Original import identifiers
                      prevent duplicate usage accounting.
                    </p>

            </article>
          ) : (<>

          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR OPERATIONS, IN SYNC</div>
              <h1>{page === 'Overview' ? 'Command center' : page}</h1>
              <p>{titles[page]}</p>
            </div>
            {planner && (
              <Button className="primary" onClick={() => edit('mission')}>
                <Plus size={16} /> Plan a mission
              </Button>
            )}
          </div>
          {page === 'Overview' && (
            <>
              <div className="stats">
                <Stat
                  label="Missions"
                  value={String(missions.length)}
                  note={pending.length + ' awaiting review'}
                  Icon={MapIcon}
                />
                <Stat
                  label="Logged flight time"
                  value={(totalSeconds / 3600).toFixed(1) + ' h'}
                  note={flights.length + ' recorded flights'}
                />
                <Stat
                  label="Fleet readiness"
                  value={
                    aircraft.length
                      ? Math.round((ready.length / aircraft.length) * 100) + '%'
                      : '—'
                  }
                  note={
                    ready.length +
                    ' of ' +
                    aircraft.length +
                    ' aircraft available'
                  }
                  Icon={Drone}
                />
                <Stat
                  label="Battery attention"
                  value={String(
                    batteries.filter(
                      (b) =>
                        b.health == null || b.temp == null || b.health < organization.settings.batteryMinHealth ||
                        b.temp > organization.settings.batteryMaxTemperature ||
                        b.status === 'Quarantined',
                    ).length,
                  )}
                  note={batteries.length + ' tracked power packs'}
                  Icon={Battery}
                />
              </div>
              <Analytics flights={flights} />
              <div className="overview-grid">
                <section className="glass map-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Mission area</h2>
                      <p>
                        {missions.find((m) => m.geometry?.length)?.location ||
                          'Plan a mission to define an operating area'}
                      </p>
                    </div>
                    <span className="live">
                      <i /> MAPBOX
                    </span>
                  </div>
                  <div style={{ padding: '0 14px 14px' }}>
                    <MissionMap
                      points={
                        missions.find((m) => m.geometry?.length)?.geometry || []
                      }
                    />
                  </div>
                  <div className="weather">
                    <span>
                      Airspace restrictions and live weather are not connected.
                    </span>
                  </div>
                </section>
                <section className="glass attention">
                  <div className="panel-heading">
                    <h2>Needs your attention</h2>
                    <span className="count">
                      {pending.length +
                        overdue.length +
                        batteryAlerts.length +
                        serviceAlerts.length}
                    </span>
                  </div>
                  {pending.slice(0, 3).map((m) => (
                    <button
                      className="attention-item"
                      key={m.id}
                      onClick={() => void open('mission', m.id)}
                    >
                      <span className="attention-icon">
                        <ShieldCheck size={18} />
                      </span>
                      <div>
                        <h3>{m.name}</h3>
                        <p>Awaiting operations review</p>
                        <span>
                          Review package <ArrowRight size={13} />
                        </span>
                      </div>
                    </button>
                  ))}
                  {overdue.slice(0, 2).map((s) => (
                    <button
                      className="attention-item"
                      key={s.id}
                      onClick={() => void open('service', s.id)}
                    >
                      <span className="attention-icon">
                        <Wrench size={18} />
                      </span>
                      <div>
                        <h3>{s.asset}</h3>
                        <p>{s.task}</p>
                        <span>Overdue · {s.due}</span>
                      </div>
                    </button>
                  ))}
                  {batteryAlerts.slice(0, 2).map((b) => (
                    <button
                      className="attention-item"
                      key={b.id}
                      onClick={() => void open('battery', b.id)}
                    >
                      <span className="attention-icon">
                        <Battery size={18} />
                      </span>
                      <div>
                        <h3>{b.id}</h3>
                        <p>
                          {b.health ?? '—'}% health · {b.temp == null ? 'Unknown' : b.temp + '°C'} · {b.status}
                        </p>
                        <span>Inspect battery</span>
                      </div>
                    </button>
                  ))}
                  {serviceAlerts.slice(0, 2).map((a) => (
                    <button
                      className="attention-item"
                      key={a.id}
                      onClick={() => void open('asset', a.id)}
                    >
                      <span className="attention-icon">
                        <Wrench size={18} />
                      </span>
                      <div>
                        <h3>{a.name}</h3>
                        <p>
                          {Math.max(0, (a.next ?? 0) - (a.hours ?? 0)).toFixed(1)} hours until
                          service
                        </p>
                        <span>
                          {a.next != null && a.hours != null && a.hours >= a.next
                            ? 'Maintenance due'
                            : 'Service approaching'}
                        </span>
                      </div>
                    </button>
                  ))}
                  {!pending.length &&
                    !overdue.length &&
                    !batteryAlerts.length &&
                    !serviceAlerts.length && (
                      <Empty
                        label="All caught up"
                        description="Approval requests and overdue services will appear here."
                      />
                    )}
                </section>
              </div>
              <section className="glass">
                <div className="panel-heading">
                  <h2>Upcoming missions</h2>
                  <Button variant="ghost" onClick={() => navigate('Missions')}>
                    All missions <ArrowUpRight size={15} />
                  </Button>
                </div>
                <div className="mission-cards">
                  {missions
                    .filter((m) => m.status !== 'Completed')
                    .slice(0, 3)
                    .map((m) => (
                      <button
                        className="mission-card"
                        key={m.id}
                        onClick={() => void open('mission', m.id)}
                      >
                        <div className="row">
                          <span className="mono">{m.id}</span>
                          <Status>{m.status}</Status>
                        </div>
                        <h3>{m.name}</h3>
                        <p>{m.location}</p>
                        <div className="mission-bottom">
                          <span>
                            {m.date} · {m.time}
                          </span>
                          <ArrowUpRight size={16} />
                        </div>
                      </button>
                    ))}
                </div>
                {!missions.length && (
                  <Empty
                    label="Your first mission starts here"
                    description="Use Plan a mission to assign crew, equipment and a risk assessment."
                  />
                )}
              </section>
            </>
          )}
          {kind && (
            <>
              <div className="toolbar">
                <div className="search-field">
                  <Search size={16} />
                  <Input
                    aria-label={'Search ' + page.toLowerCase()}
                    placeholder={'Search ' + page.toLowerCase() + '…'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="data-toolbar">
                  <Pick
                    label="Filter"
                    value={filter}
                    onChange={setFilter}
                    options={[
                      'All',
                      ...new Set(
                        items(kind)
                          .map((d) =>
                            page === 'Inventory'
                              ? d.category
                              : page === 'Flight logs'
                                ? d.pilot
                                : d.status,
                          )
                          .filter(Boolean),
                      ),
                    ]}
                  />
                  {page === 'Flight logs' && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() =>
                          csv([
                            [
                              'Flight',
                              'Mission',
                              'Pilot',
                              'Aircraft',
                              'Date',
                              'Seconds',
                              'Distance km',
                              'Battery',
                            ],
                            ...visible.map((f) => [
                              f.id,
                              f.mission,
                              f.pilot,
                              f.aircraft,
                              f.date,
                              f.durationSeconds,
                              f.distance,
                              f.battery,
                            ]),
                          ])
                        }
                      >
                        <Download size={15} /> CSV
                      </Button>
                      {planner && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            edit('flight');
                            setDialog('import');
                          }}
                        >
                          <Upload size={15} /> Import logs
                        </Button>
                      )}
                    </>
                  )}
                  {(kind === 'asset' || kind === 'service' || kind === 'battery'
                    ? fleet
                    : kind === 'crew'
                      ? manager
                      : planner) &&
                    kind !== 'mission' && (
                      <Button className="primary" onClick={() => edit(kind)}>
                        <Plus size={15} />
                        {kind === 'service'
                          ? 'Schedule service'
                          : kind === 'flight'
                            ? 'Log flight'
                            : 'Add ' + kind}
                      </Button>
                    )}
                </div>
              </div>
              {page === 'Missions' && (
                <div className="mission-board">
                  {visible.map((m) => (
                    <button
                      className="glass mission-tile"
                      key={m.id}
                      onClick={() => void open('mission', m.id)}
                    >
                      <div className="tile-map">
                        <MapIcon size={25} />
                        <span>{m.location}</span>
                        <b>{m.id}</b>
                      </div>
                      <div className="tile-body">
                        <div className="row">
                          <span className="category-label">{m.type}</span>
                          <Status>{m.status}</Status>
                        </div>
                        <h3>{m.name}</h3>
                        <p>
                          {m.date} · {m.time} · {m.durationMinutes || 60} min
                        </p>
                        <div className="tile-meta">
                          <span>
                            <Drone size={14} />
                            {m.aircraft}
                          </span>
                          <span>
                            <Users size={14} />
                            {m.pilot}
                          </span>
                        </div>
                        <div className="tile-foot">
                          <span>{m.risks.length} hazards assessed</span>
                          <ArrowUpRight size={17} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {page === 'Inventory' && (
                <section className="glass">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {[
                          'Equipment',
                          'Serial',
                          'Status',
                          'Custodian',
                          'Usage / service',
                          '',
                        ].map((h) => (
                          <TableHead key={h}>{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <button
                              className="equipment-name"
                              onClick={() => void open('asset', a.id)}
                            >
                              <span className="equipment-icon">
                                <Drone size={20} />
                              </span>
                              <span>
                                {a.name}
                                <small>
                                  {a.category} · {a.id}
                                </small>
                              </span>
                            </button>
                          </TableCell>
                          <TableCell>{a.serial || 'Not supplied'}</TableCell>
                          <TableCell>
                            <Status>
                              {a.next != null && a.hours != null && a.hours >= a.next ? 'Maintenance due' : a.status}
                            </Status>
                          </TableCell>
                          <TableCell>{a.pilot}</TableCell>
                          <TableCell>
                            {(a.hours == null ? 'Unknown' : a.hours.toFixed(1))} / {a.next ?? 'Unscheduled'} h
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={'Open ' + a.name}
                              onClick={() => void open('asset', a.id)}
                            >
                              <ChevronRight size={16} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
              )}
              {page === 'Flight logs' && (
                <>
                  <div className="stats">
                    <Stat
                      label="Recorded flights"
                      value={String(flights.length)}
                      note="Saved flight history"
                      Icon={BookOpen}
                    />
                    <Stat
                      label="Flight time"
                      value={(totalSeconds / 3600).toFixed(2) + ' h'}
                      note="From recorded durations"
                    />
                    <Stat
                      label="Distance"
                      value={totalDistance.toFixed(2) + ' km'}
                      note="Across all recorded flights"
                      Icon={MapIcon}
                    />
                    <Stat
                      label="Aircraft flown"
                      value={String(
                        new Set(flights.map((f) => f.aircraft)).size,
                      )}
                      note="Unique registered aircraft"
                      Icon={Drone}
                    />
                  </div>
                  <section className="glass">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {[
                            'Flight / mission',
                            'Pilot',
                            'Aircraft',
                            'Date',
                            'Duration',
                            'Distance',
                            'Source',
                            '',
                          ].map((h) => (
                            <TableHead key={h}>{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visible.map((f) => (
                          <TableRow key={f.id}>
                            <TableCell>
                              <button
                                className="table-link"
                                onClick={() => void open('flight', f.id)}
                              >
                                {f.id}
                                <small>{f.mission}</small>
                              </button>
                            </TableCell>
                            <TableCell>{f.pilot}</TableCell>
                            <TableCell>{f.aircraft}</TableCell>
                            <TableCell>{f.date || 'Unknown date'}</TableCell>
                            <TableCell>{f.duration}</TableCell>
                            <TableCell>{f.distance} km</TableCell>
                            <TableCell>{f.source}</TableCell>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={'Open ' + f.id}
                                onClick={() => void open('flight', f.id)}
                              >
                                <ArrowUpRight size={16} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </section>
                </>
              )}
              {page === 'Maintenance' && (
                <div className="service-grid">
                  {visible.map((s) => (
                    <section key={s.id} className="glass service-card">
                      <div className="row">
                        <span className="service-icon">
                          <Wrench size={22} />
                        </span>
                        <Status>
                          {s.status === 'Completed'
                            ? 'Completed'
                            : s.due < date()
                              ? 'Maintenance due'
                              : s.status}
                        </Status>
                      </div>
                      <span className="category-label">{s.asset}</span>
                      <h3>{s.task}</h3>
                      <p>{s.notes}</p>
                      <div className="summary-inline">
                        <span>{s.due}</span>
                        <span>{s.technician}</span>
                      </div>
                      <Button
                        variant="outline"
                        className="wide"
                        onClick={() => void open('service', s.id)}
                      >
                        {s.status === 'Completed'
                          ? 'View signed record'
                          : 'Open work order'}
                        <ArrowRight size={15} />
                      </Button>
                    </section>
                  ))}
                </div>
              )}
              {page === 'Batteries' && (
                <>
                  <section className="glass integration-state">
                    <h2>Battery condition history</h2>
                    <p>
                      Charge cycles, measured capacity, temperature and linked
                      flight usage are recorded over time. Predictive failure
                      analysis will require a validated historical dataset.
                    </p>
                  </section>
                  <div className="battery-grid">
                    {visible.map((b) => (
                      <button
                        key={b.id}
                        className="glass battery-card"
                        onClick={() => void open('battery', b.id)}
                      >
                        <div className="row">
                          <Battery size={24} />
                          <Status>{b.status}</Status>
                        </div>
                        <h3>
                          {b.id}
                          <small>
                            {b.model} · {b.aircraft}
                          </small>
                        </h3>
                        <div className="capacity">
                          <strong>
                            {b.health ?? '—'}
                            <span>%</span>
                          </strong>
                          <span>Measured health</span>
                        </div>
                        <Progress value={b.health ?? '—'} />
                        <div className="battery-card-foot">
                          <span>{b.cycles} cycles</span>
                          <span>{b.temp == null ? 'Unknown' : b.temp + '°C'} latest</span>
                          <ArrowUpRight size={16} />
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {page === 'Crew' && (
                <div className="crew-grid">
                  {visible.map((c) => (
                    <section className="glass crew-card" key={c.id}>
                      <div className="row">
                        <span className="avatar crew-avatar">{c.initials}</span>
                        <Status>
                          {c.expires < date()
                            ? 'Certificate review due'
                            : c.status}
                        </Status>
                      </div>
                      <h2>{c.name}</h2>
                      <p>{c.role}</p>
                      <div className="crew-numbers">
                        <div>
                          <b>
                            {(
                              flights
                                .filter((f) => f.pilot === c.name)
                                .reduce((n, f) => n + f.durationSeconds, 0) /
                              3600
                            ).toFixed(1)}
                            h
                          </b>
                          <span>Logged flight time</span>
                        </div>
                        <div>
                          <b>
                            {flights.filter((f) => f.pilot === c.name).length}
                          </b>
                          <span>Logged flights</span>
                        </div>
                      </div>
                      <div className="cert">
                        <ShieldCheck size={20} />
                        <div>
                          {c.cert}
                          <small>Expires {c.expires}</small>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        className="wide"
                        onClick={() => void open('crew', c.id)}
                      >
                        Open profile <ArrowUpRight size={16} />
                      </Button>
                    </section>
                  ))}
                </div>
              )}
              {!visible.length && (
                <Empty
                  label={
                    search || filter !== 'All'
                      ? 'No matching records'
                      : 'No ' + page.toLowerCase() + ' yet'
                  }
                />
              )}
            </>
          )}
          {page === 'Integrations' && (
            <>
              <section className="glass integration-banner">
                <span className="integration-logo">dji</span>
                <div>
                  <div className="row">
                    <h2>DJI flight records</h2>
                    <Status>
                      {app.status.djiKeyConfigured
                        ? 'App Key configured'
                        : 'App Key missing'}
                    </Status>
                  </div>
                  <p>{app.status.djiSyncMessage}</p>
                  <p className="integration-note">
                    Account credentials are configured locally but are not used
                    with undocumented login endpoints. Binary log parsing uses
                    the DJI keychain API for supported records.
                  </p>
                  <Button
                    className="primary wide"
                    onClick={() => {
                      edit('flight');
                      setDialog('import');
                    }}
                  >
                    <Upload size={16} /> Import a flight log
                  </Button>
                </div>
              </section>
              <div className="integration-steps">
                {[
                  [
                    'DJI Fly',
                    'File import available',
                    'Import flight-record TXT files from the phone or controller. Automatic DJI account download is not connected.',
                  ],
                  [
                    'DJI GO 4',
                    'File import available',
                    'Import exported flight-record TXT files. Compatibility depends on the record version; account history download is not connected.',
                  ],
                  [
                    'DJI Pilot 2 / Dock',
                    'Cloud connection pending',
                    'File imports share the same logbook. Live Cloud API access requires a configured platform gateway and supported equipment.',
                  ],
                  [
                    'DJI FlightHub 2',
                    'Organization API pending',
                    'FlightHub 2 has a separate OpenAPI for organization flight records. Organization authorization and the connector are still required.',
                  ],
                ].map(([title, status, description]) => (
                  <section className="glass" key={title}>
                    <h2>{title}</h2>
                    <Status>{status}</Status>
                    <p>{description}</p>
                  </section>
                ))}
              </div>
              <div className="integration-steps">
                {[
                  [
                    'Supabase',
                    'Connected',
                    'Authentication, persistent records, private files and role permissions.',
                  ],
                  [
                    'Mapbox',
                    app.status.mapbox ? 'Configured' : 'Not configured',
                    'Dark and satellite maps, editable mission boundaries and recorded flight tracks.',
                  ],
                  [
                    'Email',
                    app.status.smtp ? 'Configured' : 'Not configured',
                    'In-app notifications work now. Configure SMTP to deliver invitations, resets and email alerts.',
                  ],
                ].map(([title, status, description]) => (
                  <section key={title} className="glass">
                    <div className="row">
                      <h2>{title}</h2>
                      <Status>{status}</Status>
                    </div>
                    <p>{description}</p>
                  </section>
                ))}
              </div>
            </>
          )}
          {page === 'Audit trail' && (
            <section className="glass">
              <div className="panel-heading">
                <h2>Operational audit trail</h2>
                <span className="category-label">LATEST 150 EVENTS</span>
              </div>
              <div className="audit-list">
                {app.audit.map((e) => (
                  <div className="audit-row" key={e.id}>
                    <History size={17} />
                    <div>
                      <h3>
                        {e.actor_name} · {e.action.replaceAll('_', ' ')}
                      </h3>
                      <p>
                        {e.kind} / {e.record_id}
                      </p>
                      <small>{new Date(e.created_at).toLocaleString()}</small>
                    </div>
                    <Status>{e.after_data?.status || 'Recorded'}</Status>
                  </div>
                ))}
              </div>
              {!app.audit.length && (
                <Empty
                  label="The audit trail is ready"
                  description="Saved records, reviews, and service sign-offs will appear here."
                />
              )}
            </section>
          )}
          {page === 'Notifications' && (
            <section className="glass">
              <div className="audit-list">
                {app.notifications.map((n) => (
                  <div className="audit-row" key={n.id}>
                    <Bell size={17} />
                    <div>
                      <h3>{n.title}</h3>
                      <p>{n.body}</p>
                      <small>{new Date(n.created_at).toLocaleString()}</small>
                    </div>
                    <div className="actions">
                      {n.record_id && (
                        <Button
                          variant="outline"
                          onClick={() => void open('mission', n.record_id)}
                        >
                          Open
                        </Button>
                      )}
                      {!n.read_by.includes(profile.id) && (
                        <Button
                          variant="ghost"
                          onClick={() => void app.markRead(n.id)}
                        >
                          Mark read
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {!app.notifications.length && (
                <Empty label="No notifications yet" />
              )}
            </section>
          )}
          {page === 'Settings' && (
            <div className="settings-grid">
              <OrganizationPanel
                key={organization.id}
                organization={organization}
                profile={profile}
                flights={flights}
                members={app.profiles}
                onChange={app.refresh}
              />
              <section className="glass">
                <h2>Operational policies</h2>
                <p>Current workspace thresholds.</p>
                <dl className="summary-list">
                  <div>
                    <dt>Time zone</dt>
                    <dd>{organization.settings.timezone}</dd>
                  </div>
                  <div>
                    <dt>Battery minimum health</dt>
                    <dd>{organization.settings.batteryMinHealth}%</dd>
                  </div>
                  <div>
                    <dt>Battery maximum temperature</dt>
                    <dd>{organization.settings.batteryMaxTemperature}°C</dd>
                  </div>
                  <div>
                    <dt>Self approval</dt>
                    <dd>
                      {organization.settings.allowSelfApproval
                        ? 'Allowed'
                        : 'Requires a different reviewer'}
                    </dd>
                  </div>
                </dl>
                {profile.role === 'admin' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDraft({ ...organization.settings });
                      setError('');
                      setDialog('settings');
                    }}
                  >
                    Edit policies
                  </Button>
                )}
              </section>
              <section className="glass">
                <div className="row">
                  <h2>Workspace access</h2>
                  {profile.role === 'admin' && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDraft({ email: '', name: '', role: 'pilot' });
                        setError('');
                        setAccountResult(null);
                        setDialog('account');
                      }}
                    >
                      <Plus size={14} /> Add account
                    </Button>
                  )}
                </div>
                {app.profiles.map((p) => (
                  <div className="linked-item" key={p.id}>
                    <span>
                      {p.display_name}
                      <small>{p.active ? 'Active' : 'Disabled'}</small>
                    </span>
                    <Status>{p.role}</Status>
                    {profile.role === 'admin' && p.id !== profile.id && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setDraft({ ...p });
                          setError('');
                          setDialog('access');
                        }}
                      >
                        Manage
                      </Button>
                    )}
                  </div>
                ))}
                <p className="fine-print">
                  Initial test accounts are available from the local sign-in
                  page. New accounts receive a one-time temporary password for
                  local testing when email delivery is unavailable.
                </p>
              </section>
              <section className="glass">
                <h2>Account password</h2>
                <p>Change the password for your signed-in account.</p>
                <Button
                  variant="outline"
                  className="wide"
                  onClick={() => {
                    setDraft({ password: '', confirm: '' });
                    setError('');
                    setDialog('password');
                  }}
                >
                  Change password
                </Button>
              </section>
            </div>
          )}
          </>)}
          <div className="footer-note">
            <span>
              <i /> Local app · records saved in Supabase
            </span>
            <span>AEROLOG / READY FOR WHAT’S NEXT</span>
          </div>
        </div>
      </main>
      <Dialog
        open={dialog === 'mission'}
        onOpenChange={(o) => {
          if (!o && !busy) setDialog('');
        }}
      >
        <DialogContent className="planner-dialog mission-planner">
          <DialogHeader>
            <span className="eyebrow">MISSION PLANNER</span>
            <DialogTitle>{draft.name || 'Plan your next mission'}</DialogTitle>
            <DialogDescription>
              Prepare a mission package for operations review.
            </DialogDescription>
          </DialogHeader>
          <div className="wizard-steps">
            {[
              'Mission details',
              'Crew & equipment',
              'Risk assessment',
              'Review package',
            ].map((s, i) => (
              <div
                key={s}
                className={i === step ? 'current' : i < step ? 'done' : ''}
              >
                <span>{i < step ? <Check size={13} /> : i + 1}</span>
                {s}
              </div>
            ))}
          </div>
          <div className="wizard-body">
            {step === 0 && (
              <>
                <div className="form-grid">
                  <Field
                    label="Mission name"
                    value={draft.name}
                    onChange={(v) => update('name', v)}
                    required
                  />
                  <Pick
                    label="Operation"
                    value={draft.type}
                    options={[
                      'Inspection',
                      'Mapping',
                      'Thermal survey',
                      'Training',
                      'Photography',
                    ]}
                    onChange={(v) => update('type', v)}
                  />
                  <Field
                    label="Site / location"
                    value={draft.location}
                    onChange={(v) => update('location', v)}
                    required
                  />
                  <Field
                    label="Date"
                    type="date"
                    value={draft.date}
                    onChange={(v) => update('date', v)}
                    required
                  />
                  <Field
                    label="Start time"
                    type="time"
                    value={draft.time}
                    onChange={(v) => update('time', v)}
                    required
                  />
                  <Field
                    label="Duration (minutes)"
                    type="number"
                    value={draft.durationMinutes}
                    onChange={(v) => update('durationMinutes', Number(v))}
                  />
                  <Field
                    label="Planned altitude (m AGL)"
                    type="number"
                    value={draft.altitude}
                    onChange={(v) => update('altitude', Number(v))}
                  />
                </div>
                <MissionMap
                  points={draft.geometry || []}
                  onChange={(v) => update('geometry', v)}
                  height={300}
                />
                <Note
                  label="Operating limits, objectives and emergency landing area"
                  value={draft.notes}
                  onChange={(v) => update('notes', v)}
                />
              </>
            )}
            {step === 1 && (
              <>
                <div className="form-grid">
                  <Pick
                    label="Pilot in command"
                    value={draft.pilot}
                    options={crew
                      .filter((c) => c.status === 'Available')
                      .map((c) => c.name)}
                    onChange={(v) => update('pilot', v)}
                  />
                  <Pick
                    label="Visual observer"
                    value={draft.observer}
                    options={crew
                      .filter(
                        (c) =>
                          c.status === 'Available' && c.name !== draft.pilot,
                      )
                      .map((c) => c.name)}
                    onChange={(v) => update('observer', v)}
                  />
                </div>
                <Pick
                  label="Aircraft"
                  value={draft.aircraft}
                  options={ready.map((a) => a.name)}
                  onChange={(v) => update('aircraft', v)}
                />
                <h3 className="form-section-label">Mission equipment</h3>
                <div className="equipment-options">
                  {[
                    ...batteries
                      .filter(
                        (b) =>
                          b.aircraft === draft.aircraft &&
                          b.health != null && b.temp != null && b.status !== 'Unverified' && b.health >= organization.settings.batteryMinHealth &&
                          b.temp <=
                            organization.settings.batteryMaxTemperature &&
                          !['Quarantined', 'Retired'].includes(b.status),
                      )
                      .map((b) => b.id),
                    ...assets
                      .filter(
                        (a) =>
                          a.category !== 'Aircraft' &&
                          a.status === 'Available' &&
                          a.hours != null && a.next != null && a.hours < a.next,
                      )
                      .map((a) => a.name),
                  ].map((item) => (
                    <label className="check-row" key={item}>
                      <Checkbox
                        checked={draft.equipment?.includes(item)}
                        onCheckedChange={(v) =>
                          update(
                            'equipment',
                            v
                              ? [...draft.equipment, item]
                              : draft.equipment.filter(
                                  (x: string) => x !== item,
                                ),
                          )
                        }
                      />
                      {item}
                    </label>
                  ))}
                </div>
                <div className="info-box">
                  <ShieldCheck size={18} />
                  <span>
                    Aircraft service limits, crew certificate validity and
                    overlapping assignments are checked again when you submit.
                  </span>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div className="risk-heading">
                  <h3>Hazards and mitigation controls</h3>
                  <span>Likelihood × severity · 1–5</span>
                </div>
                {draft.risks?.map((r: any, i: number) => (
                  <div className="risk-edit" key={i}>
                    <Field
                      label={'Hazard ' + (i + 1)}
                      value={r.hazard}
                      onChange={(v) =>
                        update(
                          'risks',
                          draft.risks.map((x: any, j: number) =>
                            i === j ? { ...x, hazard: v } : x,
                          ),
                        )
                      }
                    />
                    <div className="form-grid">
                      {[
                        ['likelihood', 'Initial likelihood'],
                        ['severity', 'Initial severity'],
                        ['residualLikelihood', 'Residual likelihood'],
                        ['residualSeverity', 'Residual severity'],
                      ].map(([key, label]) => (
                        <Pick
                          key={key}
                          label={label}
                          value={String(r[key] || 1)}
                          options={['1', '2', '3', '4', '5']}
                          onChange={(v) =>
                            update(
                              'risks',
                              draft.risks.map((x: any, j: number) =>
                                i === j ? { ...x, [key]: Number(v) } : x,
                              ),
                            )
                          }
                        />
                      ))}
                    </div>
                    <Note
                      label="Mitigation"
                      value={r.mitigation}
                      onChange={(v) =>
                        update(
                          'risks',
                          draft.risks.map((x: any, j: number) =>
                            i === j ? { ...x, mitigation: v } : x,
                          ),
                        )
                      }
                    />
                    <label className="check-row compact">
                      <Checkbox
                        checked={r.controlled}
                        onCheckedChange={(v) =>
                          update(
                            'risks',
                            draft.risks.map((x: any, j: number) =>
                              i === j ? { ...x, controlled: Boolean(v) } : x,
                            ),
                          )
                        }
                      />
                      Control reviewed for this mission
                    </label>
                    <div className="row">
                      <span className="risk-score">
                        {r.likelihood * r.severity}/25 →{' '}
                        {(r.residualLikelihood || 1) *
                          (r.residualSeverity || 1)}
                        /25
                      </span>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          update(
                            'risks',
                            draft.risks.filter((_: any, j: number) => j !== i),
                          )
                        }
                      >
                        Remove hazard
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() =>
                    update('risks', [
                      ...draft.risks,
                      {
                        hazard: '',
                        likelihood: 2,
                        severity: 3,
                        mitigation: '',
                        controlled: false,
                        residualLikelihood: 1,
                        residualSeverity: 3,
                      },
                    ])
                  }
                >
                  <Plus size={15} /> Add hazard
                </Button>
              </>
            )}
            {step === 3 && (
              <>
                <div className="package-cover">
                  <FileText size={35} />
                  <div>
                    <span>MISSION PACKAGE</span>
                    <h3>{draft.name}</h3>
                    <p>
                      {draft.location} · {draft.date} · {draft.time}
                    </p>
                  </div>
                </div>
                <dl className="summary-list">
                  {[
                    ['Pilot / observer', draft.pilot + ' / ' + draft.observer],
                    ['Aircraft', draft.aircraft],
                    ['Equipment', draft.equipment?.join(', ') || 'None'],
                    [
                      'Risk controls',
                      draft.risks?.filter((r: any) => r.controlled).length +
                        ' of ' +
                        draft.risks?.length +
                        ' reviewed',
                    ],
                    ['Boundary', draft.geometry?.length + ' points'],
                    [
                      'Approval policy',
                      organization.settings.allowSelfApproval
                        ? 'Manager review'
                        : 'A different manager must approve',
                    ],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="info-box">
                  <ShieldCheck size={18} />
                  <span>
                    Submitting locks this package for review. Requested changes
                    can be edited and resubmitted; every revision is retained in
                    the audit trail.
                  </span>
                </div>
              </>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="wizard-footer">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void save('mission', 'save', { ...draft, status: 'Draft' })
              }
            >
              Save draft
            </Button>
            <div className="actions">
              {step > 0 && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setStep(step - 1);
                    setError('');
                  }}
                >
                  Back
                </Button>
              )}
              <Button
                className="primary"
                disabled={busy}
                onClick={() => {
                  setError('');
                  if (
                    step === 0 &&
                    (!draft.name?.trim() ||
                      !draft.location?.trim() ||
                      !draft.date ||
                      !draft.time)
                  ) {
                    setError(
                      'Enter the mission name, location, date and time.',
                    );
                    return;
                  }
                  if (
                    step === 1 &&
                    (!draft.pilot ||
                      !draft.observer ||
                      draft.pilot === draft.observer ||
                      !draft.aircraft)
                  ) {
                    setError(
                      'Select different crew members and an available aircraft.',
                    );
                    return;
                  }
                  if (
                    step === 2 &&
                    (!draft.risks.length ||
                      draft.risks.some(
                        (r: any) =>
                          !r.controlled ||
                          !r.hazard.trim() ||
                          !r.mitigation.trim(),
                      ))
                  ) {
                    setError('Complete every hazard and review each control.');
                    return;
                  }
                  if (step < 3) setStep(step + 1);
                  else
                    void save('mission', 'save', {
                      ...draft,
                      status: 'Pending approval',
                    });
                }}
              >
                {busy
                  ? 'Saving…'
                  : step === 3
                    ? 'Submit for approval'
                    : 'Continue'}
                <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Sheet
        open={!!detail && detail.kind !== 'flight'}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
      >
        <SheetContent className="detail-sheet">
          <SheetHeader>
            <span className="eyebrow">{detail?.kind.toUpperCase()} RECORD</span>
            <SheetTitle>
              {record?.name ||
                record?.task ||
                record?.id ||
                'Record unavailable'}
            </SheetTitle>
            <SheetDescription>
              {record?.location ||
                record?.aircraft ||
                record?.serial ||
                record?.asset ||
                record?.role ||
                detail?.id}
            </SheetDescription>
          </SheetHeader>
          <div className="sheet-body">
            {record && (
              <>
                <div className="row">
                  <Status>{record.status || 'Recorded'}</Status>
                  <span className="category-label">
                    Revision {app.revision(detail!.kind, record.id)}
                  </span>
                </div>
                {detail?.kind === 'mission' && (
                  <>
                    <div style={{ marginTop: 20 }}>
                      <MissionMap
                        key={record.id}
                        points={record.geometry || []}
                        height={260}
                      />
                    </div>
                    <dl className="summary-list">
                      {[
                        [
                          'Schedule',
                          record.date +
                            ' · ' +
                            record.time +
                            ' · ' +
                            record.durationMinutes +
                            ' min',
                        ],
                        ['Pilot', record.pilot],
                        ['Observer', record.observer],
                        ['Aircraft', record.aircraft],
                        ['Altitude', record.altitude + ' m AGL'],
                        ['Equipment', record.equipment.join(', ') || 'None'],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <h3 className="detail-heading">Operating notes</h3>
                    <p>{record.notes || 'No notes added.'}</p>
                    <h3 className="detail-heading">Risk assessment</h3>
                    {record.risks.map((r: any, i: number) => (
                      <div className="risk-summary" key={i}>
                        <div className="row">
                          <h4>{r.hazard}</h4>
                          <span className="risk-score">
                            {r.likelihood * r.severity}/25 →{' '}
                            {(r.residualLikelihood || r.likelihood) *
                              (r.residualSeverity || r.severity)}
                            /25
                          </span>
                        </div>
                        <p>{r.mitigation}</p>
                        <span className="control-status">
                          <Check size={13} />
                          {r.controlled ? 'Control reviewed' : 'Needs review'}
                        </span>
                      </div>
                    ))}
                    <h3 className="detail-heading">Package history</h3>
                    <div className="timeline">
                      {record.history.map((h: string, i: number) => (
                        <div key={i}>
                          <i />
                          <p>{h}</p>
                        </div>
                      ))}
                    </div>
                    {record.reviewNote && (
                      <div className="info-box">
                        Reviewer: {record.reviewNote}
                      </div>
                    )}
                    {record.debrief && (
                      <div className="info-box">Debrief: {record.debrief}</div>
                    )}
                    <div className="action-footer">
                      <Button
                        variant="outline"
                        onClick={() =>
                          void download(
                            'missions/' +
                              encodeURIComponent(record.id) +
                              '/pdf',
                            record.id + '-package.pdf',
                          ).catch((e) => notify(e.message))
                        }
                      >
                        <Download size={15} /> PDF package
                      </Button>
                      {planner &&
                        ['Draft', 'Changes requested'].includes(
                          record.status,
                        ) && (
                          <Button
                            className="primary"
                            onClick={() => edit('mission', record)}
                          >
                            Edit mission
                          </Button>
                        )}
                    </div>
                    <h3 className="detail-heading">Attachments</h3>
                    <div className="file-list">
                      {files.map((f) => (
                        <button
                          className="linked-item"
                          key={f.id}
                          onClick={async () => {
                            try {
                              const r = await api('files/' + f.id);
                              window.open(
                                r.url,
                                '_blank',
                                'noopener,noreferrer',
                              );
                            } catch (e) {
                              notify((e as Error).message);
                            }
                          }}
                        >
                          <span>
                            {f.name}
                            <small>{(f.size / 1024).toFixed(0)} KB</small>
                          </span>
                          <ArrowUpRight size={15} />
                        </button>
                      ))}
                    </div>
                    {!readOnly &&
                      ['Draft', 'Changes requested'].includes(
                        record.status,
                      ) && (
                        <label className="field">
                          <span>
                            {uploading
                              ? 'Uploading…'
                              : 'Attach PDF, image or site document (max 25 MB)'}
                          </span>
                          <Input
                            type="file"
                            disabled={uploading}
                            accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.json"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploading(true);
                              try {
                                const body = new FormData();
                                body.append('file', file);
                                body.append('mission', record.id);
                                await api('files', { method: 'POST', body });
                                setFiles(
                                  (
                                    await api(
                                      'files?mission=' +
                                        encodeURIComponent(record.id),
                                    )
                                  ).files,
                                );
                                notify('Attachment saved.');
                              } catch (e) {
                                notify((e as Error).message);
                              } finally {
                                setUploading(false);
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>
                      )}
                    {manager && record.status === 'Pending approval' && (
                      <div className="review-box">
                        <span className="eyebrow">
                          OPERATIONS MANAGER REVIEW
                        </span>
                        <Note
                          label="Review note (required for changes)"
                          value={note}
                          onChange={setNote}
                        />
                        <div className="actions">
                          <Button
                            disabled={busy}
                            variant="outline"
                            onClick={() =>
                              void act('review', {
                                ...record,
                                status: 'Changes requested',
                              })
                            }
                          >
                            Request changes
                          </Button>
                          <Button
                            disabled={busy}
                            className="primary"
                            onClick={() =>
                              void act('review', {
                                ...record,
                                status: 'Approved',
                              })
                            }
                          >
                            <ShieldCheck size={15} /> Approve mission
                          </Button>
                        </div>
                      </div>
                    )}
                    {planner && record.status === 'Approved' && (
                      <div className="review-box">
                        <Note
                          label="Post-flight debrief"
                          value={note}
                          onChange={setNote}
                        />
                        <Button
                          disabled={busy}
                          className="primary wide"
                          onClick={() => void act('mission_complete', record)}
                        >
                          Complete mission
                        </Button>
                      </div>
                    )}
                  </>
                )}
                {detail?.kind === 'asset' && (
                  <>
                    <div className="equipment-hero">
                      <Drone size={60} />
                      <span>{record.category}</span>
                    </div>
                    <dl className="summary-list">
                      {[
                        ['Serial number', record.serial || 'Not supplied'],
                        ['Source status', String(record.sourceRecord?.status ?? 'Not supplied')],
                        ['Custodian', record.pilot],
                        ['Usage', record.hours == null ? 'Not supplied' : record.hours.toFixed(2) + ' h'],
                        ['Next service', record.next == null ? 'Not configured' : record.next + ' h'],
                        [
                          'Remaining',
                          record.next == null || record.hours == null ? 'Not configured' : Math.max(0, record.next - record.hours).toFixed(1) + ' h',
                        ],
                        ['Service interval', record.intervalHours == null ? 'Not configured' : record.intervalHours + ' h'],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <Progress
                      value={record.next && record.hours != null ? Math.min(100, (record.hours / record.next) * 100) : 0}
                    />
                    <p>{record.notes}</p>
                    {fleet && (
                      <div className="action-footer">
                        <Button
                          className="primary"
                          onClick={() => edit('asset', record)}
                        >
                          Edit equipment / custody
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const name = record.name;
                            edit('service');
                            setDraft((d: any) => ({
                              ...d,
                              asset: name,
                              intervalHours: record.intervalHours,
                            }));
                          }}
                        >
                          Schedule service
                        </Button>
                      </div>
                    )}
                    <h3 className="detail-heading">Linked flight history</h3>
                    {flights
                      .filter((f) => f.aircraftId === record.id || f.equipmentIds?.includes(record.id) || f.aircraft === record.name)
                      .map((f) => (
                        <button
                          className="linked-item"
                          key={f.id}
                          onClick={() => void open('flight', f.id)}
                        >
                          {f.id}
                          <span>
                            {f.date} · {f.duration}
                          </span>
                        </button>
                      ))}
                  </>
                )}
                {detail?.kind === 'battery' && (
                  <>
                    <div className="battery-passport">
                      <Battery size={45} />
                      <strong>
                        {record.health ?? '—'}
                        <span>%</span>
                      </strong>
                      <div>
                        Measured state of health<Status>{record.status}</Status>
                      </div>
                    </div>
                    <div className="detail-grid">
                      <div>
                        <small>Charge cycles</small>
                        <strong>{record.cycles}</strong>
                      </div>
                      <div>
                        <small>Latest temperature</small>
                        <strong>{record.temp == null ? 'Unknown' : record.temp + '°C'}</strong>
                      </div>
                    </div>
                    <p>{record.notes}</p>
                    {fleet && (
                      <div className="action-footer">
                        <Button
                          className="primary"
                          onClick={() => {
                            setDraft({ ...record });
                            setDialog('cycle');
                            setNote('');
                            setError('');
                          }}
                        >
                          <Plus size={15} /> Record charge cycle
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => edit('battery', record)}
                        >
                          Edit / quarantine
                        </Button>
                      </div>
                    )}
                    <h3 className="detail-heading">Linked flights</h3>
                    {flights.filter(f => f.batteryIds?.includes(record.id) || f.battery === record.id).map(f => (
                      <button className="linked-item" key={f.id} onClick={() => void open('flight',f.id)}><span>{f.mission}<small>{f.date} · {f.duration}</small></span><ArrowUpRight size={16}/></button>
                    ))}
                    <h3 className="detail-heading">Measured capacity trend</h3>
                    <BatteryHistory
                      events={items('battery_event').filter(
                        (e) => e.battery === record.id,
                      )}
                      current={record.health ?? '—'}
                    />
                    <h3 className="detail-heading">
                      Usage and condition history
                    </h3>
                    {items('battery_event')
                      .filter((e) => e.battery === record.id)
                      .map((e) => (
                        <div className="linked-item" key={e.id}>
                          <span>
                            {e.flightId
                              ? 'Flight ' + e.flightId
                              : 'Charge cycle ' + e.cycles}
                            <small>
                              {new Date(e.date).toLocaleString()} ·{' '}
                              {e.recordedBy}
                            </small>
                            {e.notes && <small>{e.notes}</small>}
                          </span>
                          <span>
                            {e.health != null
                              ? e.health + '% health'
                              : e.start != null
                                ? e.start + '% → ' + e.end + '%'
                                : 'Usage recorded'}
                            {e.temp != null ? ' · ' + e.temp + '°C' : ''}
                          </span>
                        </div>
                      ))}
                  </>
                )}
                {detail?.kind === 'service' && (
                  <>
                    <dl className="summary-list">
                      {[
                        ['Equipment', record.asset],
                        ['Due', record.due],
                        ['Technician', record.technician],
                        ['Next interval', record.intervalHours + ' h'],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <h3 className="detail-heading">Work instructions</h3>
                    <p>{record.notes || 'No additional instructions.'}</p>
                    {record.status === 'Completed' ? (
                      <div className="info-box">
                        <ShieldCheck size={18} />
                        <div>
                          Signed by {record.signedBy}
                          <p>{record.completionNotes}</p>
                          <p>{new Date(record.completedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ) : (
                      fleet && (
                        <>
                          <Note
                            label="Work completed and findings"
                            value={note}
                            onChange={setNote}
                          />
                          <div className="action-footer">
                            <Button
                              variant="outline"
                              onClick={() => edit('service', record)}
                            >
                              Edit work order
                            </Button>
                            <Button
                              className="primary"
                              disabled={busy}
                              onClick={() =>
                                void act('service_complete', record)
                              }
                            >
                              <Check size={15} /> Complete & sign off
                            </Button>
                          </div>
                          <p className="fine-print">
                            Sign-off returns equipment to available status and
                            advances its service threshold by the configured
                            interval.
                          </p>
                        </>
                      )
                    )}
                  </>
                )}
                {detail?.kind === 'crew' && (
                  <>
                    <div className="crew-profile-hero">
                      <span className="avatar crew-avatar">
                        {record.initials}
                      </span>
                      <div>
                        <h2>{record.name}</h2>
                        <p>{record.role}</p>
                      </div>
                    </div>
                    <dl className="summary-list">
                      {[
                        ['Email', record.email || 'Not added'],
                        ['Certificate', record.cert],
                        ['Expires', record.expires],
                        ['Availability', record.status],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p>{record.notes}</p>
                    {manager && (
                      <Button
                        className="primary wide"
                        onClick={() => edit('crew', record)}
                      >
                        Edit crew profile
                      </Button>
                    )}
                    <h3 className="detail-heading">Mission assignments</h3>
                    {missions
                      .filter(
                        (m) =>
                          m.pilot === record.name || m.observer === record.name,
                      )
                      .map((m) => (
                        <button
                          className="linked-item"
                          key={m.id}
                          onClick={() => void open('mission', m.id)}
                        >
                          <span>
                            {m.name}
                            <small>{m.date}</small>
                          </span>
                          <Status>{m.status}</Status>
                        </button>
                      ))}
                  </>
                )}
                {error && (
                  <p className="error-message" role="alert">
                    {error}
                  </p>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Dialog
        open={!!dialog && dialog !== 'mission'}
        onOpenChange={(o) => {
          if (!o && !busy && !uploading) setDialog('');
        }}
      >
        <DialogContent
          className={
            'form-dialog ' + (dialog === 'import' ? 'import-dialog' : '')
          }
        >
          <DialogHeader>
            <DialogTitle>
              {
                {
                  asset: 'Equipment register',
                  battery: 'Battery register',
                  crew: 'Crew profile',
                  service: 'Maintenance work order',
                  flight: 'Record a flight',
                  cycle: 'Record battery charge cycle',
                  import: 'Import flight logs',
                  settings: 'Workspace policies',
                  account: 'Create workspace account',
                  access: 'Manage workspace access',
                  password: 'Change your password',
                }[dialog]
              }
            </DialogTitle>
            <DialogDescription>
              {dialog === 'import'
                ? 'Upload a DJI TXT record, normalized flight JSON, or CSV flight summary.'
                : 'Changes are saved to your connected workspace.'}
            </DialogDescription>
          </DialogHeader>
          {dialog === 'asset' && (
            <>
              <Field
                label="Equipment name"
                disabled={app.revision('asset', draft.id) > 0}
                required
                value={draft.name}
                onChange={(v) => update('name', v)}
              />
              <Pick
                label="Category"
                value={draft.category}
                options={['Aircraft', 'Payload', 'Controller', 'Accessory']}
                onChange={(v) => update('category', v)}
              />
              <Field
                label="Serial number"
                required
                value={draft.serial}
                onChange={(v) => update('serial', v)}
              />
              <Pick
                label="Status"
                value={draft.status}
                options={[
                  'Available',
                  'Checked out',
                  'Maintenance due',
                  'Retired',
                ]}
                onChange={(v) => update('status', v)}
              />
              <Pick
                label="Custodian"
                value={draft.pilot}
                options={['Unassigned', ...crew.map((c) => c.name)]}
                onChange={(v) => update('pilot', v)}
              />
              <div className="form-grid">
                <Field
                  label="Total usage (hours)"
                  type="number"
                  value={draft.hours}
                  onChange={(v) => update('hours', Number(v))}
                />
                <Field
                  label="Next service at (hours)"
                  type="number"
                  value={draft.next}
                  onChange={(v) => update('next', Number(v))}
                />
              </div>
              <Field
                label="Recurring interval (hours)"
                type="number"
                value={draft.intervalHours}
                onChange={(v) => update('intervalHours', Number(v))}
              />
              <Note
                label="Equipment notes"
                value={draft.notes}
                onChange={(v) => update('notes', v)}
              />
            </>
          )}
          {dialog === 'battery' && (
            <>
              <Field
                label="Battery ID / label"
                disabled={app.revision('battery', draft.id) > 0}
                required
                value={draft.id}
                onChange={(v) => update('id', v)}
              />
              <Field
                label="Model"
                required
                value={draft.model}
                onChange={(v) => update('model', v)}
              />
              <Pick
                label="Compatible aircraft"
                value={draft.aircraft}
                options={aircraft.map((a) => a.name)}
                onChange={(v) => update('aircraft', v)}
              />
              <div className="form-grid">
                <Field
                  label="Charge cycles"
                  type="number"
                  value={draft.cycles}
                  onChange={(v) => update('cycles', Number(v))}
                />
                <Field
                  label="Measured health (%)"
                  type="number"
                  value={draft.health}
                  onChange={(v) => update('health', Number(v))}
                />
                <Field
                  label="Latest temperature (°C)"
                  type="number"
                  value={draft.temp}
                  onChange={(v) => update('temp', Number(v))}
                />
              </div>
              <Pick
                label="Condition"
                value={draft.status}
                options={[
                  'Healthy',
                  'Attention required',
                  'Quarantined',
                  'Retired',
                ]}
                onChange={(v) => update('status', v)}
              />
              <Note
                label="Inspection notes"
                value={draft.notes}
                onChange={(v) => update('notes', v)}
              />
            </>
          )}
          {dialog === 'crew' && (
            <>
              <Field
                label="Full name"
                disabled={app.revision('crew', draft.id) > 0}
                required
                value={draft.name}
                onChange={(v) => update('name', v)}
              />
              <Field
                label="Email"
                type="email"
                value={draft.email}
                onChange={(v) => update('email', v)}
              />
              <Pick
                label="Operational role"
                value={draft.role}
                options={[
                  'Pilot',
                  'Visual observer',
                  'Safety officer',
                  'Operations manager',
                  'Maintenance technician',
                ]}
                onChange={(v) => update('role', v)}
              />
              <Field
                label="Certificate / qualification"
                required
                value={draft.cert}
                onChange={(v) => update('cert', v)}
              />
              <Field
                label="Certificate expiry"
                type="date"
                required
                value={draft.expires}
                onChange={(v) => update('expires', v)}
              />
              <Pick
                label="Availability"
                value={draft.status}
                options={['Available', 'Unavailable', 'Inactive']}
                onChange={(v) => update('status', v)}
              />
              <Note
                label="Notes"
                value={draft.notes}
                onChange={(v) => update('notes', v)}
              />
            </>
          )}
          {dialog === 'service' && (
            <>
              <Pick
                label="Equipment"
                value={draft.asset}
                options={assets.map((a) => a.name)}
                onChange={(v) => update('asset', v)}
              />
              <Field
                label="Service task"
                required
                value={draft.task}
                onChange={(v) => update('task', v)}
              />
              <Field
                label="Due date"
                type="date"
                required
                value={draft.due}
                onChange={(v) => update('due', v)}
              />
              <Pick
                label="Assigned technician"
                value={draft.technician}
                options={crew.map((c) => c.name)}
                onChange={(v) => update('technician', v)}
              />
              <Field
                label="Next interval after sign-off (hours)"
                type="number"
                value={draft.intervalHours}
                onChange={(v) => update('intervalHours', Number(v))}
              />
              <Note
                label="Work instructions"
                value={draft.notes}
                onChange={(v) => update('notes', v)}
              />
            </>
          )}
          {(dialog === 'flight' || dialog === 'import') && (
            <>
              <Pick
                label="Pilot"
                value={draft.pilot}
                options={
                  profile.role === 'pilot'
                    ? [profile.display_name]
                    : crew.map((c) => c.name)
                }
                onChange={(v) => update('pilot', v)}
              />
              <Pick
                label="Aircraft"
                value={draft.aircraft}
                options={aircraft.map((a) => a.name)}
                onChange={(v) => update('aircraft', v)}
              />
              <Pick
                label="Mission"
                value={draft.mission}
                options={['Unassigned flight', ...missions.map((m) => m.name)]}
                onChange={(v) => {
                  update('mission', v);
                  update('missionId', missions.find((m) => m.name === v)?.id);
                }}
              />
              {dialog === 'flight' ? (
                <>
                  <Field
                    label="Flight date"
                    type="date"
                    required
                    value={draft.date}
                    onChange={(v) => update('date', v)}
                  />
                  <div className="form-grid">
                    <Field
                      label="Duration (seconds)"
                      type="number"
                      value={draft.durationSeconds}
                      onChange={(v) => update('durationSeconds', Number(v))}
                    />
                    <Field
                      label="Distance (km)"
                      type="number"
                      value={draft.distance}
                      onChange={(v) => update('distance', v)}
                    />
                    <Field
                      label="Max altitude (m)"
                      type="number"
                      value={draft.altitude}
                      onChange={(v) => update('altitude', Number(v))}
                    />
                  </div>
                  <Pick
                    label="Battery"
                    value={draft.battery || 'Not recorded'}
                    options={['Not recorded', ...batteries.map((b) => b.id)]}
                    onChange={(v) =>
                      update('battery', v === 'Not recorded' ? '' : v)
                    }
                  />
                  <div className="form-grid">
                    <Field
                      label="Start charge (%)"
                      type="number"
                      value={draft.start}
                      onChange={(v) =>
                        update('start', v === '' ? null : Number(v))
                      }
                    />
                    <Field
                      label="End charge (%)"
                      type="number"
                      value={draft.end}
                      onChange={(v) =>
                        update('end', v === '' ? null : Number(v))
                      }
                    />
                  </div>
                  <Note
                    label="Flight notes"
                    value={draft.notes}
                    onChange={(v) => update('notes', v)}
                  />
                </>
              ) : (
                <>
                  <Pick
                    label="Flight app"
                    value={draft.sourceApp || 'Other'}
                    options={[
                      'DJI Fly',
                      'DJI GO 4',
                      'DJI Pilot 2',
                      'DJI FlightHub 2',
                      'Other',
                    ]}
                    onChange={(v) => update('sourceApp', v)}
                  />
                  <p className="fine-print">
                    This import is assigned to {organization.name}. Select the
                    pilot who flew these records; existing imports in this
                    organization are skipped.
                  </p>
                  <label className="field">
                    <span>
                      {uploading
                        ? 'Parsing flight log…'
                        : 'Flight log file (max 25 MB)'}
                    </span>
                    <Input
                      type="file"
                      accept=".txt,.json,.csv"
                      disabled={uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        setError('');
                        setImportPreview(null);
                        try {
                          const body = new FormData();
                          body.append('file', file);
                          const result = await api('imports/preview', {
                            method: 'POST',
                            body,
                          });
                          setImportPreview(result);
                          setImportFile(file);
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const url = URL.createObjectURL(
                        new Blob(
                          [
                            'date,durationSeconds,distanceKm,altitude,start,end,battery\n' +
                              date() +
                              ',600,1.5,60,98,65,\n',
                          ],
                          { type: 'text/csv' },
                        ),
                      );
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'flight-import-template.csv';
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    <Download size={14} /> Download CSV template
                  </Button>
                  {importPreview && (
                    <div className="info-box">
                      <FileText size={18} />
                      <div>
                        {importPreview.flights.length} flight record(s) parsed.
                        <p>
                          {importPreview.flights
                            .map(
                              (f: any) =>
                                f.date +
                                ' · ' +
                                f.duration +
                                ' · ' +
                                f.distance +
                                ' km',
                            )
                            .join('; ')}
                        </p>
                        {importPreview.warnings?.map((w: string) => (
                          <p key={w}>{w}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {dialog === 'cycle' && (
            <>
              <p>
                {draft.id} · currently {draft.cycles} cycles
              </p>
              <div className="form-grid">
                <Field
                  label="Measured capacity (%)"
                  type="number"
                  value={draft.health}
                  onChange={(v) => update('health', Number(v))}
                />
                <Field
                  label="Peak temperature (°C)"
                  type="number"
                  value={draft.temp}
                  onChange={(v) => update('temp', Number(v))}
                />
              </div>
              <Note
                label="Cycle / inspection notes"
                value={note}
                onChange={setNote}
              />
              <p className="fine-print">
                Records one completed charge cycle and appends a timestamped
                condition reading. Flight usage alone does not increment the
                charge-cycle counter.
              </p>
            </>
          )}
          {dialog === 'settings' && (
            <>
              <Field
                label="Time zone"
                value={draft.timezone}
                onChange={(v) => update('timezone', v)}
              />
              <Field
                label="Minimum battery health (%)"
                type="number"
                value={draft.batteryMinHealth}
                onChange={(v) => update('batteryMinHealth', Number(v))}
              />
              <Field
                label="Maximum battery temperature (°C)"
                type="number"
                value={draft.batteryMaxTemperature}
                onChange={(v) => update('batteryMaxTemperature', Number(v))}
              />
              <label className="check-row">
                <Checkbox
                  checked={draft.allowSelfApproval}
                  onCheckedChange={(v) =>
                    update('allowSelfApproval', Boolean(v))
                  }
                />
                Allow managers to approve their own missions
              </label>
            </>
          )}
          {dialog === 'account' &&
            (!accountResult ? (
              <>
                <Field
                  label="Full name"
                  value={draft.name}
                  onChange={(v) => update('name', v)}
                  required
                />
                <Field
                  label="Email"
                  type="email"
                  value={draft.email}
                  onChange={(v) => update('email', v)}
                  required
                />
                <Pick
                  label="Access role"
                  value={draft.role}
                  options={[
                    'admin',
                    'manager',
                    'pilot',
                    'technician',
                    'observer',
                  ]}
                  onChange={(v) => update('role', v)}
                />
              </>
            ) : (
              <div className="info-box">
                <div>
                  Account created. Share this temporary password directly with
                  the intended user.
                  <p>
                    <strong>{accountResult.temporaryPassword}</strong>
                  </p>
                  <p>
                    It is shown only here. The user can change it in Settings.
                  </p>
                </div>
              </div>
            ))}
          {dialog === 'access' && (
            <>
              <p>{draft.display_name}</p>
              <Pick
                label="Role"
                value={draft.role}
                options={[
                  'admin',
                  'manager',
                  'pilot',
                  'technician',
                  'observer',
                ]}
                onChange={(v) => update('role', v)}
              />
              <Pick
                label="Account status"
                value={draft.active ? 'Active' : 'Disabled'}
                options={['Active', 'Disabled']}
                onChange={(v) => update('active', v === 'Active')}
              />
              <p className="fine-print">
                Changes apply immediately to workspace access. Crew
                qualifications are managed separately.
              </p>
            </>
          )}
          {dialog === 'password' && (
            <>
              <Field
                label="New password (12+ characters)"
                type="password"
                value={draft.password}
                onChange={(v) => update('password', v)}
              />
              <Field
                label="Confirm new password"
                type="password"
                value={draft.confirm}
                onChange={(v) => update('confirm', v)}
              />
            </>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          {!accountResult || dialog !== 'account' ? (
            <Button
              className="primary wide"
              disabled={
                busy || uploading || (dialog === 'import' && !importPreview)
              }
              onClick={async () => {
                setError('');
                try {
                  if (dialog === 'import') {
                    setUploading(true);
                    let count = 0,
                      skipped = 0;
                    const known = new Set(
                      flights.map((f: any) => f.importHash).filter(Boolean),
                    );
                    for (const f of importPreview.flights) {
                      if (known.has(f.importHash)) {
                        skipped++;
                        continue;
                      }
                      await command('flight_import', 'flight', {
                        ...f,
                        sourceApp: draft.sourceApp || 'Other',
                        pilot: draft.pilot,
                        aircraft: draft.aircraft,
                        mission: draft.mission,
                        missionId: draft.missionId,
                      });
                      count++;
                      known.add(f.importHash);
                    }
                    if (importFile) {
                      const body = new FormData();
                      body.set('file', importFile);
                      body.set(
                        'flights',
                        JSON.stringify(
                          importPreview.flights.map(
                            (f: any) =>
                              flights.find((x) => x.importHash === f.importHash)
                                ?.id || f.id,
                          ),
                        ),
                      );
                      await api('imports/archive', { method: 'POST', body });
                      await app.refresh();
                    }
                    setDialog('');
                    navigate('Flight logs');
                    notify(
                      count +
                        ' flights imported. ' +
                        skipped +
                        ' duplicates skipped. Aircraft usage updated.',
                    );
                  } else if (dialog === 'cycle')
                    await save('battery', 'battery_cycle');
                  else if (dialog === 'settings') {
                    await api('commands', {
                      method: 'POST',
                      body: JSON.stringify({
                        command: 'settings',
                        payload: draft,
                      }),
                    });
                    await app.refresh();
                    setDialog('');
                    notify('Policies updated.');
                  } else if (dialog === 'account') {
                    setUploading(true);
                    setAccountResult(
                      await api('accounts', {
                        method: 'POST',
                        body: JSON.stringify(draft),
                      }),
                    );
                    await app.refresh();
                  } else if (dialog === 'access') {
                    await api('accounts', {
                      method: 'PATCH',
                      body: JSON.stringify({
                        id: draft.id,
                        role: draft.role,
                        active: draft.active,
                      }),
                    });
                    await app.refresh();
                    setDialog('');
                    notify('Workspace access updated.');
                  } else if (dialog === 'password') {
                    if (
                      draft.password.length < 12 ||
                      draft.password !== draft.confirm
                    )
                      throw Error(
                        'Use matching passwords of at least 12 characters.',
                      );
                    const { error } = await browserClient().auth.updateUser({
                      password: draft.password,
                    });
                    if (error) throw error;
                    setDialog('');
                    notify('Password updated.');
                  } else
                    await save(
                      dialog as Kind,
                      dialog === 'flight' ? 'flight_import' : 'save',
                    );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setUploading(false);
                }
              }}
            >
              {busy || uploading
                ? 'Saving…'
                : dialog === 'import'
                  ? 'Import flight records'
                  : dialog === 'cycle'
                    ? 'Record cycle'
                    : dialog === 'account'
                      ? 'Create account'
                      : 'Save changes'}
            </Button>
          ) : (
            <Button
              className="primary"
              onClick={() => {
                setDialog('');
                setAccountResult(null);
              }}
            >
              Done
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  LineChart,
  Line,
} from 'recharts';
function FlightTelemetry({ frames, track, altitudeMode }: { frames: any[]; track: number[][]; altitudeMode?: string }) {
  const timed = frames.length > 1;
  const altitude = timed ? frames : track.map((p, index) => ({ position: index + 1, altitude: p[2] }));
  const battery = frames.map(p => ({...p, battery: typeof p.battery === 'number' ? p.battery : null}));
  const hasBattery = battery.filter(p => p.battery != null).length > 1;
  const chart = (data: any[], field: string, color: string, label: string, percent = false) => (
    <ChartContainer className="flight-profile-chart" config={{[field]: {label, color}}}>
      <AreaChart data={data}>
        <CartesianGrid vertical={false} stroke="#ffffff10" />
        <XAxis dataKey={timed ? 'time' : 'position'} minTickGap={50} tickFormatter={v => timed ? (v / 60).toFixed(1) + ' min' : String(v)} />
        <YAxis width={52} domain={percent ? [0, 100] : ['auto', 'auto']} tickFormatter={v => v + (percent ? '%' : ' m')} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area type="linear" dataKey={field} stroke={color} fill={color + '25'} connectNulls={false} isAnimationActive={false} />
      </AreaChart>
    </ChartContainer>
  );
  return <div className="flight-chart-grid">
    <section className="flight-chart-card"><h2>Altitude profile</h2>
      <p>{timed ? 'Altitude over elapsed flight time' : 'Height by recorded route point · ' + (altitudeMode === 'relativeToGround' ? 'KML height relative to ground' : 'Source KML height')}</p>
      {altitude.length > 1 ? chart(altitude, 'altitude', '#d0f68b', 'Altitude (m)') : <div className="flight-chart-empty">No altitude samples available.</div>}
    </section>
    <section className="flight-chart-card"><h2>Battery drain</h2><p>Remaining charge over elapsed flight time</p>
      {hasBattery ? chart(battery, 'battery', '#7dd3fc', 'Remaining charge (%)', true) : <div className="flight-chart-empty"><Battery size={28} /><strong>No battery samples in this log</strong><span>KML contains the flight path and heights. Import a telemetry log with battery readings to see the drain curve.</span></div>}
    </section>
  </div>;
}
function BatteryHistory({
  events,
  current,
}: {
  events: any[];
  current: number | null;
}) {
  const data = events
    .filter((e) => e.health != null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((e) => ({
      date: new Date(e.date).toLocaleDateString(),
      health: e.health,
    }));
  if (!data.length)
    return (
      <p>
        No historical measurements yet. Current capacity: {current == null ? 'unknown' : current + '%'}. Record
        charge cycles to build the trend.
      </p>
    );
  return (
    <ChartContainer
      className="activity-chart"
      config={{ health: { label: 'Measured health (%)', color: '#d0f68b' } }}
    >
      <LineChart data={data}>
        <CartesianGrid vertical={false} stroke="#ffffff10" />
        <XAxis dataKey="date" minTickGap={40} />
        <YAxis domain={[0, 100]} width={35} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          type="monotone"
          dataKey="health"
          stroke="#d0f68b"
          dot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
