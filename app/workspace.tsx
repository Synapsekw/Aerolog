'use client';
import Image from 'next/image';
import { useState, useRef } from 'react';
import { useApp } from './app-provider';
import MissionMap from './mission-map';
import MissionFlightComparison from './mission-flight-comparison';
import FlightAnalysis from './flight-analysis';
import Analytics from './live-analytics';
import OrganizationPanel from './organization-panel';
import TeamDirectory from './team-directory';
import KitBrowser from './kit-browser';
import MissionKitPicker from './mission-kit-picker';
import OperationsCalendar from './operations-calendar';
import InspectionManager from './inspection-manager';
import EquipmentPassport from './equipment-passport';
import OperationsCatalog from './operations-catalog';
import FormTemplateManager from './form-template-manager';
import IncidentManager from './incident-manager';
import DocumentRegister from './document-register';
import ReportCenter from './report-center';
import MissionDocuments from './mission-documents';
import CrewCredentials from './crew-credentials';
import ReadinessQueue from './readiness-queue';
import { personnelDocumentAttention } from '@/lib/operations/readiness';
import CrewMatrix from './crew-matrix';
import MissionForms from './mission-forms';
import EquipmentMetadataFields from './equipment-metadata-fields';
import {
  inspectionDue,
  inspectionMeters,
  type InspectionPlan,
} from '@/lib/operations/inspections';
import { crewCanBeAssigned } from '@/lib/operations/assignments';
import BatteryBrowser from './battery-browser';
import FlightGlobe from './flight-globe';
import ImportReview from './import-review';
import { duplicateMatches } from '@/lib/flight/duplicates';
import { Status } from './shared';
import {
  Camera,
  CalendarDays,
  Gamepad2,
  Package,
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
  ['Calendar', CalendarDays],
  ['Projects', Package],
  ['Sites', MapIcon],
  ['Customers', Users],
  ['Form templates', FileText],
  ['Documents', FileText],
  ['Reports', BookOpen],
  ['Flight logs', BookOpen],
  ['Inventory', Drone],
  ['Maintenance', Wrench],
  ['Inspections', ShieldCheck],
  ['Crew', Users],
  ['Incidents', ShieldCheck],
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
  const assignableCrew = crew.filter((c) => crewCanBeAssigned(c, app.profiles));
  const inspectionAlerts = (
    items('inspection_plan') as InspectionPlan[]
  ).flatMap((plan) =>
    inspectionDue(
      plan,
      items('inspection_event'),
      inspectionMeters(
        plan,
        [
          ...assets.map((a) => ({ ...a, kind: 'asset' })),
          ...batteries.map((b) => ({ ...b, kind: 'battery' })),
        ],
        flights,
      ),
      date(),
    )
      .filter((d) => d.status !== 'Within limits')
      .map((d) => ({ ...d, plan })),
  );
  const [documentFocus, setDocumentFocus] = useState('');
  const [storageFilter, setStorageFilter] = useState('all');
  const [inventoryCategory, setInventoryCategory] = useState('Aircraft');
  const [inventoryExpanded, setInventoryExpanded] = useState(true);
  const inventoryViews = useRef<
    Record<string, { search: string; filter: string; page: number }>
  >({});
  const [inventoryPage, setInventoryPage] = useState(1);
  const [flightView, setFlightView] = useState('list');
  const inventoryCategories = [
    { key: 'Aircraft', label: 'Aircraft', Icon: Drone },
    { key: 'Battery', label: 'Batteries', Icon: Battery },
    { key: 'Payload', label: 'Payloads', Icon: Camera },
    { key: 'Controller', label: 'Controllers', Icon: Gamepad2 },
    { key: 'Accessory', label: 'Accessories', Icon: Package },
  ];
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
    [importAllowNew, setImportAllowNew] = useState<Set<string>>(new Set()),
    [importEnrich, setImportEnrich] = useState<Record<string, string>>({}),
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
        a.hours != null &&
        a.next != null &&
        a.hours < a.next,
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
      (b.health == null ||
        b.temp == null ||
        b.health < organization.settings.batteryMinHealth ||
        b.temp > organization.settings.batteryMaxTemperature ||
        b.status === 'Quarantined'),
  );
  const serviceAlerts = assets.filter(
    (a) =>
      a.status !== 'Retired' &&
      a.next != null &&
      a.hours != null &&
      a.next - a.hours <= 5,
  );
  const titles: Record<string, string> = {
    Overview: 'Your fleet, your people, your next move.',
    Missions: 'Plan with clarity. Fly with confidence.',
    'Flight logs': 'The complete story behind every flight.',
    Inventory: 'Every asset accounted for.',
    Maintenance: 'Keep your fleet ready for what’s next.',
    Batteries: 'A measured history of every power pack.',
    Crew: 'The people behind your operations.',
    Incidents: 'Report, investigate and follow through.',
    Documents: 'Versioned evidence, expiry and review.',
    Reports: 'Traceable flight totals across your organization.',
    Integrations: 'Connected services and flight-log import.',
    'Audit trail': 'An accountable history of operational decisions.',
    Settings: 'Workspace policies, access and local configuration.',
    Kits: 'Reusable equipment sets for mission preparation.',
    Calendar: 'Missions, maintenance and flight history in one schedule.',
    Projects: 'Customers, missions and flight activity connected.',
    Sites: 'Reusable operating areas and storage locations.',
    Customers: 'The organizations you deliver operations for.',
    'Form templates': 'Reusable checks, risk assessments and custom forms.',
    Inspections:
      'Inspection intervals, component replacements and signed history.',
    Notifications: 'Operational changes that need your attention.',
  };
  function rememberInventory() {
    if (page === 'Inventory' || page === 'Batteries')
      inventoryViews.current[
        page === 'Batteries' ? 'Battery' : inventoryCategory
      ] = { search, filter, page: inventoryPage };
  }
  function navigateInventory(category: string) {
    rememberInventory();
    const saved = inventoryViews.current[category];
    setInventoryCategory(category);
    setPage(category === 'Battery' ? 'Batteries' : 'Inventory');
    setSearch(saved?.search || '');
    setFilter(saved?.filter || 'All');
    setInventoryPage(saved?.page || 1);
    setDetail(null);
    setError('');
  }
  function navigate(next: string) {
    if (next === 'Inventory') {
      navigateInventory(inventoryCategory);
      return;
    }
    rememberInventory();
    if (next !== 'Documents') setDocumentFocus('');
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
          assignableCrew.find((c) => c.name === profile.display_name)?.name ||
          assignableCrew[0]?.name ||
          '',
        observer:
          assignableCrew.find((c) => c.name !== profile.display_name)?.name ||
          '',
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
        aircraft: 'Unassigned',
        cycles: 0,
        health: null,
        temp: null,
        status: 'Unverified',
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
            ? (data.targetKind === 'battery' ? 'Battery service signed off. Counters and condition retained.' : 'Service signed off and interval updated.')
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
    Inventory: inventoryCategory === 'Battery' ? 'battery' : 'asset',
    Maintenance: 'service',
    Batteries: 'battery',
    Crew: 'crew',
    'Flight logs': 'flight',
  };
  const kind = kindByPage[page],
    visible = kind
      ? items(kind).filter(
          (d) =>
            (page !== 'Inventory' ||
              inventoryCategory === 'Battery' ||
              d.category === inventoryCategory) &&
            (!['asset', 'battery'].includes(kind) ||
              storageFilter === 'all' ||
              (storageFilter === 'unassigned'
                ? !d.storageSiteId
                : d.storageSiteId === storageFilter)) &&
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
  const inventoryPageCount = Math.max(1, Math.ceil(visible.length / 24));
  const currentInventoryPage = Math.min(inventoryPage, inventoryPageCount);
  const inventoryRows = visible.slice(
    (currentInventoryPage - 1) * 24,
    currentInventoryPage * 24,
  );
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
            <Image
              src="/aerolog-mark.svg"
              width={38}
              height={38}
              className="aerolog-mark"
              alt=""
            />
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
            {navigation.map(([label, Icon]) =>
              label === 'Inventory' ? (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton
                    className="nav-item"
                    tooltip="Inventory"
                    aria-expanded={inventoryExpanded}
                    isActive={page === 'Inventory' || page === 'Batteries'}
                    onClick={() => setInventoryExpanded(!inventoryExpanded)}
                  >
                    <Icon />
                    <span>Inventory</span>
                    <ChevronRight
                      className={
                        inventoryExpanded
                          ? 'inventory-chevron expanded'
                          : 'inventory-chevron'
                      }
                    />
                  </SidebarMenuButton>
                  {inventoryExpanded && (
                    <SidebarMenu
                      className="inventory-subnav"
                      aria-label="Inventory categories"
                    >
                      {inventoryCategories.map(
                        ({ key, label: title, Icon: CategoryIcon }) => (
                          <SidebarMenuItem key={key}>
                            <NavigationItem
                              className="nav-item"
                              tooltip={title}
                              isActive={
                                key === 'Battery'
                                  ? page === 'Batteries'
                                  : page === 'Inventory' &&
                                    inventoryCategory === key
                              }
                              onClick={() => navigateInventory(key)}
                            >
                              <CategoryIcon />
                              <span>{title}</span>
                              <b className="nav-count">
                                {key === 'Battery'
                                  ? batteries.filter(
                                      (b) => b.status !== 'Retired',
                                    ).length
                                  : assets.filter(
                                      (a) =>
                                        a.category === key &&
                                        a.status !== 'Retired',
                                    ).length}
                              </b>
                            </NavigationItem>
                          </SidebarMenuItem>
                        ),
                      )}
                      <SidebarMenuItem>
                        <NavigationItem
                          className="nav-item"
                          tooltip="Kits"
                          isActive={page === 'Kits'}
                          onClick={() => navigate('Kits')}
                        >
                          <Package />
                          <span>Kits</span>
                        </NavigationItem>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  )}
                </SidebarMenuItem>
              ) : (
                <SidebarMenuItem key={label}>
                  <NavigationItem
                    className="nav-item"
                    tooltip={
                      label === 'Settings' ? 'Organization & settings' : label
                    }
                    isActive={page === label}
                    onClick={() => navigate(label)}
                  >
                    <Icon />
                    <span>{label === 'Settings' ? 'Organization' : label}</span>
                    {label === 'Missions' && (
                      <b className="nav-count">{missions.length}</b>
                    )}
                  </NavigationItem>
                </SidebarMenuItem>
              ),
            )}
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
          {detail && ['asset', 'battery'].includes(detail.kind) && record ? (
            <EquipmentPassport
              key={detail.kind + record.id}
              kind={detail.kind as 'asset' | 'battery'}
              record={record}
              onBack={() => setDetail(null)}
              onEdit={() => edit(detail.kind, record)}
              onService={() => {
                edit('service');
                setDraft((d: any) => ({
                  ...d,
                  asset: record.name || record.sourceName || record.model || record.id,
                  targetKind: detail.kind, targetId: record.id,
                  intervalHours: record.intervalHours || 100,
                }));
              }}
              onCycle={() => {
                setDraft({ ...record });
                setDialog('cycle');
                setNote('');
                setError('');
              }}
              onOpen={(k, id) => void open(k, id)}
              onInspections={() => navigate('Inspections')}
            />
          ) : detail?.kind === 'flight' && record ? (
            <article className="flight-page">
              <Button variant="outline" onClick={() => setDetail(null)}>
                ← Back to flight logs
              </Button>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">FLIGHT ANALYSIS</div>
                  <h1>{record.mission}</h1>
                  <p>
                    {record.pilot} · {record.aircraft} ·{' '}
                    {record.date || 'Unknown date'}
                  </p>
                </div>
                <Status>Recorded</Status>
              </div>

              <FlightAnalysis key={record.id} flight={record} />
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

              {items('attachment')
                .filter((a: any) => a.source && a.flights?.includes(record.id))
                .map((a: any) => (
                  <Button
                    key={a.id}
                    variant="outline"
                    onClick={async () => {
                      try {
                        const r = await api<{ url: string }>('files/' + a.id);
                        window.open(r.url, '_blank', 'noopener,noreferrer');
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    }}
                  >
                    <Download size={14} />
                    Source file · {a.name}
                  </Button>
                ))}
              <section className="flight-chart-card" style={{ marginTop: 24 }}>
                <h2>Linked equipment</h2>
                <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
                  {record.aircraftId && (
                    <Button
                      variant="outline"
                      onClick={() => void open('asset', record.aircraftId)}
                    >
                      {record.aircraft}
                    </Button>
                  )}
                  {(record.equipmentIds || []).map((id: string) => {
                    const battery = batteries.find((b) => b.id === id);
                    const asset = assets.find((a) => a.id === id);
                    return (
                      <Button
                        key={id}
                        variant="outline"
                        onClick={() =>
                          void open(battery ? 'battery' : 'asset', id)
                        }
                      >
                        {battery?.model || asset?.name || id}
                      </Button>
                    );
                  })}
                  {!record.aircraftId && !record.equipmentIds?.length && (
                    <p>No inventory links available.</p>
                  )}
                </div>
              </section>
              <dl className="summary-list">
                {[
                  ['Pilot', record.pilot],
                  ['Aircraft', record.aircraft],
                  ['Date', record.date || 'Unknown date in source'],
                  ['Mission', record.mission],
                  [
                    'Battery',
                    batteries.find((b) => b.id === record.battery)?.model ||
                      record.battery ||
                      'Not recorded',
                  ],
                  [
                    'Battery use',
                    record.start != null
                      ? record.start + '% → ' + record.end + '%'
                      : 'Not available',
                  ],
                  ['Source', record.source],
                  ['Site', record.siteName || 'Not recorded'],
                  [
                    'Source equipment',
                    record.equipmentNames?.join(', ') || 'Not recorded',
                  ],
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
          ) : (
            <>
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
                          ? Math.round((ready.length / aircraft.length) * 100) +
                            '%'
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
                            b.health == null ||
                            b.temp == null ||
                            b.health < organization.settings.batteryMinHealth ||
                            b.temp >
                              organization.settings.batteryMaxTemperature ||
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
                            {missions.find((m) => m.geometry?.length)
                              ?.location ||
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
                            missions.find((m) => m.geometry?.length)
                              ?.geometry || []
                          }
                        />
                      </div>
                      <div className="weather">
                        <span>
                          Airspace restrictions and live weather are not
                          connected.
                        </span>
                      </div>
                    </section>
                    <ReadinessQueue entries={[
                      ...personnelDocumentAttention(crew, app.profiles, items('document'), date()),
                      ...pending.map(m => ({key:'mission:'+m.id,category:'Missions',title:m.name,reason:'Awaiting operations review',kind:'mission',id:m.id,priority:1})),
                      ...overdue.filter(s => s.status !== 'In progress').map(s => ({key:'service:'+s.id,category:'Equipment',title:s.task,reason:'Service overdue: '+s.due,kind:'service',id:s.id,priority:0})),
                      ...services.filter(s => s.status === 'In progress').map(s => ({key:'service:'+s.id,category:'Equipment',title:s.task,reason:'Work in progress · ' + s.asset + (s.due < date() ? ' · overdue' : ''),kind:'service',id:s.id,priority:0})),
                      ...batteryAlerts.map(b => ({key:'battery:'+b.id,category:'Equipment',title:b.sourceName||b.model||b.id,reason:b.status,kind:'battery',id:b.id,priority:1})),
                      ...serviceAlerts.map(a => ({key:'asset:'+a.id,category:'Equipment',title:a.name,reason:a.hours != null && a.next != null && a.hours >= a.next ? 'Maintenance due' : 'Maintenance approaching',kind:'asset',id:a.id,priority:a.hours != null && a.next != null && a.hours >= a.next ? 0 : 2})),
                      ...inspectionAlerts.map(d => ({key:'inspection:'+d.plan.id+':'+d.rule.id,category:'Inspections',title:d.plan.profileSnapshot.name,reason:d.rule.name+' · '+d.status,kind:d.plan.targetKind,id:d.plan.targetId,priority:d.status === 'Due' ? 0 : 1})),
                    ]} onOpen={(kind,id) => {
                      if(kind === 'document') {setDocumentFocus(id);navigate('Documents');}
                      else void open(kind as Kind,id);
                    }} />
                  </div>
                  <section className="glass">
                    <div className="panel-heading">
                      <h2>Upcoming missions</h2>
                      <Button
                        variant="ghost"
                        onClick={() => navigate('Missions')}
                      >
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
              {page === 'Reports' && <ReportCenter key={organization.id} />}
              {page === 'Documents' && (
                <DocumentRegister key={organization.id+documentFocus} initialId={documentFocus} />
              )}
              {page === 'Incidents' && (
                <IncidentManager
                  key={organization.id}
                  onOpen={(kind, id) => void open(kind, id)}
                />
              )}
              {page === 'Form templates' && (
                <FormTemplateManager key={organization.id} />
              )}
              {['Projects', 'Sites', 'Customers'].includes(page) && (
                <OperationsCatalog
                  key={organization.id + page}
                  kind={
                    page === 'Projects'
                      ? 'project'
                      : page === 'Sites'
                        ? 'site'
                        : 'customer'
                  }
                  onMission={(id) => void open('mission', id)}
                  onEquipment={(kind, id) => void open(kind, id)}
                />
              )}
              {page === 'Inspections' && (
                <InspectionManager key={organization.id} today={date()} />
              )}
              {page === 'Calendar' && (
                <OperationsCalendar
                  today={date()}
                  missions={missions}
                  services={services}
                  flights={flights}
                  onOpen={(kind, id) => void open(kind, id)}
                />
              )}
              {page === 'Kits' && <KitBrowser key={organization.id} />}
              {kind && (
                <>
                  {page === 'Inventory' && (
                    <div
                      className="inventory-categories"
                      aria-label="Equipment categories"
                    >
                      {inventoryCategories.map(({ key, label, Icon }) => (
                        <button
                          key={key}
                          className={
                            'inventory-category ' +
                            (inventoryCategory === key ? 'selected' : '')
                          }
                          aria-pressed={inventoryCategory === key}
                          onClick={() => navigateInventory(key)}
                        >
                          <Icon size={23} />
                          <span>
                            {label}
                            <strong>
                              {key === 'Battery'
                                ? batteries.length
                                : assets.filter((a) => a.category === key)
                                    .length}
                            </strong>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="toolbar">
                    <div className="search-field">
                      <Search size={16} />
                      <Input
                        aria-label={'Search ' + page.toLowerCase()}
                        placeholder={'Search ' + page.toLowerCase() + '…'}
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setInventoryPage(1);
                        }}
                      />
                    </div>
                    <div className="data-toolbar">
                      {['asset', 'battery'].includes(kind) && (
                        <label className="field">
                          Storage site
                          <select
                            value={storageFilter}
                            onChange={(e) => {
                              setStorageFilter(e.target.value);
                              setInventoryPage(1);
                            }}
                          >
                            <option value="all">All storage sites</option>
                            <option value="unassigned">Not assigned</option>
                            {items('site').map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                                {s.archived ? ' (archived)' : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <Pick
                        label="Filter"
                        value={filter}
                        onChange={(value) => {
                          setFilter(value);
                          setInventoryPage(1);
                        }}
                        options={[
                          'All',
                          ...new Set(
                            items(kind)
                              .map((d) =>
                                page === 'Inventory'
                                  ? d.status
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
                      {(kind === 'asset' ||
                      kind === 'service' ||
                      kind === 'battery'
                        ? fleet
                        : kind === 'crew'
                          ? manager
                          : planner) &&
                        kind !== 'mission' && (
                          <Button
                            className="primary"
                            onClick={() => edit(kind)}
                          >
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
                              {m.date} · {m.time} · {m.durationMinutes || 60}{' '}
                              min
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
                    <section className="glass inventory-section">
                      <div className="panel-heading">
                        <div>
                          <h2>
                            {
                              inventoryCategories.find(
                                (c) => c.key === inventoryCategory,
                              )?.label
                            }
                          </h2>
                          <p>{visible.length} matching items</p>
                        </div>
                        <span className="category-label">
                          {Math.min(
                            visible.length,
                            (currentInventoryPage - 1) * 24 + 1,
                          )}
                          –{Math.min(visible.length, currentInventoryPage * 24)}{' '}
                          of {visible.length}
                        </span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {[
                              'Equipment',
                              'Serial',
                              'Status',
                              inventoryCategory === 'Battery'
                                ? 'Assigned aircraft'
                                : 'Custodian',
                              inventoryCategory === 'Battery'
                                ? 'Cycles / health'
                                : 'Usage / service',
                              '',
                            ].map((h) => (
                              <TableHead key={h}>{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inventoryRows.map((a) => {
                            const isBattery = inventoryCategory === 'Battery';
                            const Icon = inventoryCategories.find(
                              (c) => c.key === inventoryCategory,
                            )!.Icon;
                            const title = isBattery ? a.model : a.name;
                            return (
                              <TableRow key={a.id}>
                                <TableCell>
                                  <button
                                    className="equipment-name"
                                    onClick={() =>
                                      void open(
                                        isBattery ? 'battery' : 'asset',
                                        a.id,
                                      )
                                    }
                                  >
                                    <span className="equipment-icon">
                                      <Icon size={20} />
                                    </span>
                                    <span>
                                      {title}
                                      <small>
                                        {a.externalSource || 'Local inventory'}
                                      </small>
                                    </span>
                                  </button>
                                </TableCell>
                                <TableCell>
                                  {a.serial || 'Not supplied'}
                                </TableCell>
                                <TableCell>
                                  <Status>
                                    {a.next != null &&
                                    a.hours != null &&
                                    a.hours >= a.next
                                      ? 'Maintenance due'
                                      : a.status}
                                  </Status>
                                </TableCell>
                                <TableCell>
                                  {isBattery ? a.aircraft : a.pilot}
                                </TableCell>
                                <TableCell>
                                  {isBattery
                                    ? a.cycles +
                                      ' cycles · ' +
                                      (a.health == null
                                        ? 'Health unknown'
                                        : a.health + '% health')
                                    : (a.hours == null
                                        ? 'Usage unknown'
                                        : a.hours.toFixed(1) + ' h') +
                                      ' · ' +
                                      (a.next == null
                                        ? 'Service not set'
                                        : 'Service at ' + a.next + ' h')}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={'Open ' + title}
                                    onClick={() =>
                                      void open(
                                        isBattery ? 'battery' : 'asset',
                                        a.id,
                                      )
                                    }
                                  >
                                    <ChevronRight size={16} />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <div className="inventory-pagination">
                        <span>
                          Page {currentInventoryPage} of {inventoryPageCount}
                        </span>
                        <Button
                          variant="outline"
                          disabled={currentInventoryPage <= 1}
                          onClick={() =>
                            setInventoryPage(currentInventoryPage - 1)
                          }
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          disabled={currentInventoryPage >= inventoryPageCount}
                          onClick={() =>
                            setInventoryPage(currentInventoryPage + 1)
                          }
                        >
                          Next
                        </Button>
                      </div>
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
                      <div
                        className="row"
                        role="group"
                        aria-label="Flight log view"
                        style={{
                          justifyContent: 'flex-start',
                          gap: 8,
                          marginBottom: 16,
                        }}
                      >
                        <Button
                          variant={
                            flightView === 'list' ? 'default' : 'outline'
                          }
                          aria-pressed={flightView === 'list'}
                          onClick={() => setFlightView('list')}
                        >
                          List view
                        </Button>
                        <Button
                          variant={
                            flightView === 'globe' ? 'default' : 'outline'
                          }
                          aria-pressed={flightView === 'globe'}
                          onClick={() => setFlightView('globe')}
                        >
                          Globe view
                        </Button>
                      </div>
                      {flightView === 'globe' && (
                        <FlightGlobe
                          flights={visible}
                          onOpen={(id) => void open('flight', id)}
                        />
                      )}
                      <section className="glass" hidden={flightView !== 'list'}>
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
                                <TableCell>
                                  {f.date || 'Unknown date'}
                                </TableCell>
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
                    <BatteryBrowser
                      batteries={visible}
                      onOpen={(id) => void open('battery', id)}
                    />
                  )}
                  {page === 'Crew' && (
                    <CrewMatrix onOpen={(id) => void open('crew', id)} onCreate={(member) => edit('crew', {
                      id: newId('CREW'), name: member.display_name, authUserId: member.id,
                      initials: initials(member.display_name), role: 'Pilot', hours: 0, flights: 0,
                      cert: '', expires: '', status: 'Unavailable', email: '', notes: '',
                      aircraftPermission: 'Not configured', authorizedAircraftIds: [], qualifications: [],
                    })}>
                    <div className="crew-grid">
                      {visible.map((c) => (
                        <section className="glass crew-card" key={c.id}>
                          <div className="row">
                            <span className="avatar crew-avatar">
                              {c.initials}
                            </span>
                            <Status>
                              {app.profiles.some((m) =>
                                !m.active && (c.authUserId ? m.id === c.authUserId : m.display_name === c.name),
                              )
                                ? 'Inactive organization member'
                                : !c.cert || !c.expires
                                  ? 'Credentials not recorded'
                                  : c.expires < date()
                                    ? 'Certificate review due'
                                    : c.status}
                            </Status>
                          </div>
                          <h2>{c.name}</h2>
                          <p>{c.role}</p>
                          <p className="fine-print">
                            Aircraft access:{' '}
                            {c.aircraftPermission || 'Not configured'}
                          </p>
                          <div className="crew-numbers">
                            <div>
                              <b>
                                {(
                                  flights
                                    .filter((f) => f.pilot === c.name)
                                    .reduce(
                                      (n, f) => n + f.durationSeconds,
                                      0,
                                    ) / 3600
                                ).toFixed(1)}
                                h
                              </b>
                              <span>Logged flight time</span>
                            </div>
                            <div>
                              <b>
                                {
                                  flights.filter((f) => f.pilot === c.name)
                                    .length
                                }
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
                    </CrewMatrix>
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
                        Account credentials are configured locally but are not
                        used with undocumented login endpoints. Binary log
                        parsing uses the DJI keychain API for supported records.
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
                          <small>
                            {new Date(e.created_at).toLocaleString()}
                          </small>
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
                          <small>
                            {new Date(n.created_at).toLocaleString()}
                          </small>
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
                  <TeamDirectory
                    members={app.profiles}
                    flights={flights}
                    profile={profile}
                    onManage={(member) => {
                      setDraft({ ...member });
                      setError('');
                      setDialog('access');
                    }}
                    onAdd={() => {
                      setDraft({ email: '', name: '', role: 'pilot' });
                      setError('');
                      setAccountResult(null);
                      setDialog('account');
                    }}
                  />
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
            </>
          )}
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
                  <label className="field">
                    Project
                    <select
                      value={draft.projectId || ''}
                      onChange={(e) =>
                        setDraft((d: any) => ({
                          ...d,
                          projectId: e.target.value,
                          siteId: '',
                        }))
                      }
                    >
                      <option value="">No project</option>
                      {items('project')
                        .filter((p) => !p.archived)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    Operating site
                    <select
                      value={draft.siteId || ''}
                      onChange={(e) => {
                        const site = items('site').find(
                          (s) => s.id === e.target.value,
                        );
                        setDraft((d: any) => ({
                          ...d,
                          siteId: e.target.value,
                          ...(site
                            ? { location: site.name, geometry: site.geometry }
                            : {}),
                        }));
                      }}
                    >
                      <option value="">Enter a one-off location</option>
                      {items('site')
                        .filter(
                          (s) =>
                            !s.archived &&
                            s.purpose !== 'Storage' &&
                            (!s.projectId || s.projectId === draft.projectId),
                        )
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
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
                <MissionKitPicker
                  draft={draft}
                  onApply={(patch) =>
                    setDraft((d: any) => ({ ...d, ...patch }))
                  }
                />
                <div className="form-grid">
                  <Pick
                    label="Pilot in command"
                    value={draft.pilot}
                    options={assignableCrew
                      .filter((c) => c.status === 'Available')
                      .map((c) => c.name)}
                    onChange={(v) => update('pilot', v)}
                  />
                  <Pick
                    label="Visual observer"
                    value={draft.observer}
                    options={assignableCrew
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
                  onChange={(v) =>
                    setDraft((d: any) => ({
                      ...d,
                      aircraft: v,
                      additionalAircraft: (d.additionalAircraft || []).filter(
                        (n: string) => n !== v,
                      ),
                    }))
                  }
                />
                <h3 className="form-section-label">Additional aircraft</h3>
                <div className="equipment-options">
                  {ready
                    .filter((a) => a.name !== draft.aircraft)
                    .map((a) => (
                      <label className="check-row" key={a.id}>
                        <Checkbox
                          checked={
                            draft.additionalAircraft?.includes(a.name) || false
                          }
                          onCheckedChange={(v) =>
                            update(
                              'additionalAircraft',
                              v
                                ? [...(draft.additionalAircraft || []), a.name]
                                : (draft.additionalAircraft || []).filter(
                                    (n: string) => n !== a.name,
                                  ),
                            )
                          }
                        />
                        {a.name}
                      </label>
                    ))}
                </div>
                <h3 className="form-section-label">
                  Additional operational roles
                </h3>
                {(draft.crewAssignments || []).map(
                  (assignment: any, index: number) => (
                    <div className="form-grid" key={index}>
                      <Pick
                        label="Crew member"
                        value={assignment.name}
                        options={assignableCrew.map((c) => c.name)}
                        onChange={(v) =>
                          update(
                            'crewAssignments',
                            draft.crewAssignments.map((a: any, i: number) =>
                              i === index ? { ...a, name: v } : a,
                            ),
                          )
                        }
                      />
                      <Pick
                        label="Operational role"
                        value={assignment.role}
                        options={[
                          'Payload operator',
                          'Ground support',
                          'Instructor',
                          'Second pilot',
                        ]}
                        onChange={(v) =>
                          update(
                            'crewAssignments',
                            draft.crewAssignments.map((a: any, i: number) =>
                              i === index ? { ...a, role: v } : a,
                            ),
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          update(
                            'crewAssignments',
                            draft.crewAssignments.filter(
                              (_: any, i: number) => i !== index,
                            ),
                          )
                        }
                      >
                        Remove role
                      </Button>
                    </div>
                  ),
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    update('crewAssignments', [
                      ...(draft.crewAssignments || []),
                      {
                        name: assignableCrew[0]?.name || '',
                        role: 'Ground support',
                      },
                    ])
                  }
                >
                  Add operational role
                </Button>
                <h3 className="form-section-label">Mission equipment</h3>
                <div className="equipment-options">
                  {[
                    ...batteries
                      .filter(
                        (b) =>
                          [
                            draft.aircraft,
                            ...(draft.additionalAircraft || []),
                          ].includes(b.aircraft) &&
                          b.health != null &&
                          b.temp != null &&
                          b.status !== 'Unverified' &&
                          b.health >= organization.settings.batteryMinHealth &&
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
                          a.hours != null &&
                          a.next != null &&
                          a.hours < a.next,
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
                <MissionForms
                  mission={draft}
                  onChange={(patch) =>
                    setDraft((d: any) => ({ ...d, ...patch }))
                  }
                />
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
                <MissionDocuments
                  mission={draft}
                  onChange={(patch) =>
                    setDraft((d: any) => ({ ...d, ...patch }))
                  }
                />
                <MissionForms mission={draft} />
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
                      'Additional aircraft',
                      draft.additionalAircraft?.join(', ') || 'None',
                    ],
                    [
                      'Operational roles',
                      draft.crewAssignments
                        ?.map((a: any) => `${a.name} (${a.role})`)
                        .join(', ') || 'None',
                    ],
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
        open={!!detail && !['flight', 'asset', 'battery'].includes(detail.kind)}
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
                      <MissionFlightComparison key={record.id} mission={record} onFlight={(id) => void open('flight', id)} />
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
                        [
                          'Customer',
                          record.contextSnapshot?.customer?.name || 'None',
                        ],
                        [
                          'Project',
                          record.contextSnapshot?.project?.name || 'None',
                        ],
                        [
                          'Operating site',
                          record.contextSnapshot?.site?.name ||
                            'One-off location',
                        ],
                        ['Pilot', record.pilot],
                        ['Observer', record.observer],
                        ['Aircraft', record.aircraft],
                        ['Altitude', record.altitude + ' m AGL'],
                        ['Equipment', record.equipment.join(', ') || 'None'],
                        [
                          'Additional aircraft',
                          record.additionalAircraft?.join(', ') || 'None',
                        ],
                        [
                          'Operational roles',
                          record.crewAssignments
                            ?.map((a: any) => `${a.name} (${a.role})`)
                            .join(', ') || 'None',
                        ],
                        [
                          'Kit snapshots',
                          record.kitSnapshots
                            ?.map(
                              (k: any) =>
                                `${k.name} · v${k.revision} · ${k.items.length} items`,
                            )
                            .join('; ') || 'No kit used',
                        ],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <h3 className="detail-heading">Operating notes</h3>
                    <p>{record.notes || 'No notes added.'}</p>
                    <MissionDocuments mission={record} />
                    <MissionForms mission={record} />
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
                {detail?.kind === 'service' && (
                  <>
                    <dl className="summary-list">
                      {[
                        ['Equipment', record.asset],
                        ['Due', record.due],
                        ['Technician', record.technician],
                        ['Next interval', record.targetKind === 'battery' ? 'Managed by battery inspection plan' : record.intervalHours + ' h'],
                        ['Recorded cost', record.cost == null ? 'Not recorded' : record.currency + ' ' + record.cost],
                        ['Cost reference', record.costReference || 'Not recorded'],
                        ['Work started', record.startedAt ? record.startedAt + ' · ' + record.startedBy : 'Not started'],
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
                          {record.status !== 'In progress' && <Button variant="outline" disabled={busy} onClick={() => void save('service', 'save', {...record, status: 'In progress'})}>Start work</Button>}
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
                            {record.targetKind === 'battery' ? 'Sign-off records findings without changing battery condition or counters.' : 'Sign-off advances the hourly service threshold. Retired and checked-out equipment retain their status.'}
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
                    <CrewCredentials person={record} />
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
                ? 'Upload a DJI TXT record, normalized flight JSON, summary CSV or Airdata telemetry CSV.'
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
                  'Unverified',
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
                  onChange={(v) => update('hours', v === '' ? null : Number(v))}
                />
                <Field
                  label="Next service at (hours)"
                  type="number"
                  value={draft.next}
                  onChange={(v) => update('next', v === '' ? null : Number(v))}
                />
              </div>
              <Field
                label="Recurring interval (hours)"
                type="number"
                value={draft.intervalHours}
                onChange={(v) =>
                  update('intervalHours', v === '' ? null : Number(v))
                }
              />
              <EquipmentMetadataFields draft={draft} update={update} />
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
                label="Battery display name"
                required
                value={draft.model}
                onChange={(v) => update('model', v)}
              />
              <Pick
                label="Compatible aircraft"
                value={draft.aircraft}
                options={['Unassigned', ...aircraft.map((a) => a.name)]}
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
                  onChange={(v) =>
                    update('health', v === '' ? null : Number(v))
                  }
                />
                <Field
                  label="Latest temperature (°C)"
                  type="number"
                  value={draft.temp}
                  onChange={(v) => update('temp', v === '' ? null : Number(v))}
                />
              </div>
              <Pick
                label="Condition"
                value={draft.status}
                options={[
                  'Healthy',
                  'Attention required',
                  'Quarantined',
                  'Unverified',
                  'Retired',
                ]}
                onChange={(v) => update('status', v)}
              />
              <EquipmentMetadataFields draft={draft} update={update} battery />
              <Note
                label="Inspection notes"
                value={draft.notes}
                onChange={(v) => update('notes', v)}
              />
            </>
          )}
          {dialog === 'crew' && (
            <>
              {draft.authUserId && <p className="fine-print">Linked to organization member {draft.name}. Enter verified credentials before saving. Availability starts as unavailable; aircraft permissions require explicit configuration.</p>}
              <Field
                label="Full name"
                disabled={app.revision('crew', draft.id) > 0 || Boolean(draft.authUserId)}
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
              <CrewCredentials person={draft} onChange={update} />
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
              <label className="field">Equipment
                <select value={draft.targetKind && draft.targetId ? draft.targetKind + ':' + draft.targetId : ''} onChange={(e) => {
                  const [targetKind, ...parts] = e.target.value.split(':');
                  const targetId = parts.join(':');
                  const target = items(targetKind).find(a => a.id === targetId);
                  setDraft((d: any) => ({...d, targetKind, targetId, asset: target?.name || target?.sourceName || target?.model || targetId}));
                }}>
                  <option value="">{draft.asset ? 'Select equipment · currently ' + draft.asset : 'Select equipment'}</option>
                  {['asset','battery'].map(k => <optgroup key={k} label={k === 'battery' ? 'Batteries' : 'Aircraft & equipment'}>{items(k).map(a => <option key={a.id} value={k+':'+a.id}>{a.name || a.sourceName || a.model} · {a.serial || a.id}</option>)}</optgroup>)}
                </select>
              </label>
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
              {draft.targetKind !== 'battery' && <Field
                label="Next interval after sign-off (hours)"
                type="number"
                value={draft.intervalHours}
                onChange={(v) =>
                  update('intervalHours', v === '' ? null : Number(v))
                }
              />}
              {draft.targetKind === 'battery' && <p className="fine-print">Battery sign-off records the work performed. Charge counters, inspection baselines and battery condition are updated separately from their own workflows.</p>}
              <div className="form-grid">
                <Field label="Recorded cost" type="number" value={draft.cost ?? ''} onChange={(v) => update('cost', v === '' ? null : Number(v))} />
                <Field label="Currency code" value={draft.currency || ''} onChange={(v) => update('currency', v.toUpperCase())} />
              </div>
              <Field label="Invoice / cost reference" value={draft.costReference || ''} onChange={(v) => update('costReference', v)} />
              <p className="fine-print">Leave cost blank when unknown. Use a three-letter currency code, such as AED or KWD. Zero means a recorded no-cost service.</p>
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
                options={['Unassigned', ...aircraft.map((a) => a.name)]}
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
                        : 'DJI record, telemetry CSV or JSON (max 25 MB)'}
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
                          setImportEnrich({});
                          setNote('');
                          setImportAllowNew(new Set());
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
                        <ImportReview
                          canEnrich={manager}
                          enrichmentTargets={importEnrich}
                          onEnrich={(id, target) =>
                            setImportEnrich((previous) => ({
                              ...previous,
                              [id]: target,
                            }))
                          }
                          incoming={importPreview.flights}
                          existing={flights}
                          allowNew={importAllowNew}
                          onAllowNew={(id, value) =>
                            setImportAllowNew((previous) => {
                              const next = new Set(previous);
                              if (value) next.add(id);
                              else next.delete(id);
                              return next;
                            })
                          }
                        />
                        {Object.values(importEnrich).some(Boolean) && (
                          <Note
                            label="Why these records are the same flight (minimum 20 characters)"
                            value={note}
                            onChange={setNote}
                          />
                        )}
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
                  onChange={(v) =>
                    update('health', v === '' ? null : Number(v))
                  }
                />
                <Field
                  label="Peak temperature (°C)"
                  type="number"
                  value={draft.temp}
                  onChange={(v) => update('temp', v === '' ? null : Number(v))}
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
              {draft.active && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={async () => {
                    setError('');
                    try {
                      await api('accounts', {
                        method: 'PATCH',
                        body: JSON.stringify({
                          id: draft.id,
                          role: draft.role,
                          active: false,
                        }),
                      });
                      await app.refresh();
                      setDialog('');
                      notify(
                        'Member removed from the organization. Flight history retained.',
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Remove from organization
                </Button>
              )}
              <p className="fine-print">
                Removal revokes organization access and preserves flight
                history. Disabled members can be restored here. Changes apply
                immediately to workspace access. Crew qualifications are managed
                separately.
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
                busy ||
                uploading ||
                (dialog === 'import' &&
                  (!importPreview ||
                    (Object.values(importEnrich).some(Boolean) &&
                      note.trim().length < 20)))
              }
              onClick={async () => {
                setError('');
                try {
                  if (dialog === 'import') {
                    setUploading(true);
                    let count = 0,
                      skipped = 0,
                      enriched = 0;
                    const imported = [...flights];
                    const archiveIds = new Set<string>();
                    let importFailure: Error | null = null;
                    try {
                      for (const [
                        index,
                        f,
                      ] of importPreview.flights.entries()) {
                        const matches = duplicateMatches(f, [
                          ...flights,
                          ...importPreview.flights.slice(0, index),
                        ]);
                        const target = importEnrich[f.id];
                        if (target) {
                          await api('imports/enrich', {
                            method: 'POST',
                            body: JSON.stringify({
                              targetId: target,
                              revision: app.revision('flight', target),
                              reason: note,
                              incoming: f,
                            }),
                          });
                          enriched++;
                          archiveIds.add(target);
                          continue;
                        }
                        const exact = matches.find((m) => m.kind === 'exact');
                        if (exact) {
                          skipped++;
                          const savedExact = duplicateMatches(f, imported).find(
                            (m) => m.kind === 'exact',
                          )?.flight;
                          if (savedExact) archiveIds.add(savedExact.id);
                          continue;
                        }
                        if (matches.length && !importAllowNew.has(f.id)) {
                          skipped++;
                          continue;
                        }
                        const saved = {
                          ...f,
                          sourceApp: draft.sourceApp || 'Other',
                          pilot: draft.pilot,
                          aircraft: draft.aircraft,
                          mission: draft.mission,
                          missionId: draft.missionId,
                        };
                        await command('flight_import', 'flight', saved);
                        count++;
                        imported.push(saved);
                        archiveIds.add(f.id);
                      }
                    } catch (failure) {
                      importFailure = failure as Error;
                    }
                    try {
                      if (importFile && archiveIds.size) {
                        const body = new FormData();
                        body.set('file', importFile);
                        body.set('flights', JSON.stringify([...archiveIds]));
                        await api('imports/archive', { method: 'POST', body });
                      }
                    } catch (failure) {
                      importFailure = new Error(
                        (importFailure ? importFailure.message + ' ' : '') +
                          'Saved records are retained, but source archiving failed: ' +
                          (failure as Error).message +
                          ' Retry this file to archive the source.',
                      );
                    } finally {
                      await app.refresh();
                    }
                    if (importFailure)
                      throw new Error(
                        `${count} imported, ${enriched} enriched before this error. ${importFailure.message}`,
                      );
                    setDialog('');
                    navigate('Flight logs');
                    notify(
                      count +
                        ' flights imported. ' +
                        skipped +
                        ' records skipped. ' +
                        enriched +
                        ' flights enriched without adding usage.',
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
