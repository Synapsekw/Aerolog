'use client';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Plus,
  Search,
  Download,
  MapPin,
  Clock,
  Drone,
  Battery,
  Users,
  ShieldCheck,
  Check,
  FileText,
  Wind,
  Activity,
  Wrench,
  Plug,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  Link2,
  Unplug,
  CheckCircle2,
  Radio,
  Package,
  Compass,
  Upload,
  Trash2,
  Play,
  Pause,
} from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Airspace, Status } from './shared';
export type Mission = {
  id: string;
  name: string;
  location: string;
  date: string;
  time: string;
  type: string;
  status: string;
  pilot: string;
  observer: string;
  aircraft: string;
  equipment: string[];
  notes: string;
  risks: Risk[];
  history: string[];
};
type Risk = {
  hazard: string;
  likelihood: number;
  severity: number;
  mitigation: string;
  controlled: boolean;
};
type Asset = {
  id: string;
  name: string;
  category: string;
  serial: string;
  status: string;
  hours: number;
  pilot: string;
  next: number;
};
type Flight = {
  id: string;
  mission: string;
  pilot: string;
  aircraft: string;
  date: string;
  duration: string;
  distance: string;
  altitude: number;
  start: number;
  end: number;
  battery: string;
};
type Service = {
  id: string;
  asset: string;
  task: string;
  due: string;
  remaining: number;
  status: string;
  technician: string;
  notes: string;
};
const baseRisks: Risk[] = [
  {
    hazard: 'Pedestrians near the launch area',
    likelihood: 3,
    severity: 4,
    mitigation:
      'Establish a cordon and assign a visual observer to the launch area.',
    controlled: true,
  },
  {
    hazard: 'Wind gusts between buildings',
    likelihood: 3,
    severity: 3,
    mitigation:
      'Check on-site conditions, set operating limits and confirm an alternate landing area.',
    controlled: true,
  },
  {
    hazard: 'GNSS interference near structures',
    likelihood: 2,
    severity: 4,
    mitigation:
      'Maintain visual line of sight and review manual recovery procedures.',
    controlled: true,
  },
];
export const initialMissions: Mission[] = [
  [
    'DXB–024',
    'Marina facade inspection',
    'Dubai Marina',
    '2026-09-07',
    '06:30',
    'Inspection',
    'Pending approval',
    'Alex Morgan',
    'Sara Ahmed',
    'Matrice 350 RTK',
  ],
  [
    'DXB–025',
    'Solar park thermal survey',
    'Al Maktoum Solar Park',
    '2026-09-08',
    '07:00',
    'Thermal survey',
    'Approved',
    'Sara Ahmed',
    'Omar Hassan',
    'Mavic 3 Thermal',
  ],
  [
    'DXB–026',
    'Coastal mapping — sector B',
    'Jumeirah coastline',
    '2026-09-09',
    '06:00',
    'Mapping',
    'Draft',
    'Alex Morgan',
    'Omar Hassan',
    'Matrice 350 RTK',
  ],
  [
    'DXB–023',
    'Construction progress survey',
    'Dubai Creek Harbour',
    '2026-09-05',
    '07:15',
    'Mapping',
    'Completed',
    'Alex Morgan',
    'Sara Ahmed',
    'Matrice 350 RTK',
  ],
  [
    'DXB–022',
    'Warehouse roof inspection',
    'Jebel Ali',
    '2026-09-04',
    '08:00',
    'Inspection',
    'Completed',
    'Omar Hassan',
    'Sara Ahmed',
    'Mavic 3 Enterprise',
  ],
  [
    'DXB–027',
    'Harbor asset inspection',
    'Port Rashid',
    '2026-09-10',
    '06:30',
    'Inspection',
    'Pending approval',
    'Omar Hassan',
    'Alex Morgan',
    'Mavic 3 Enterprise',
  ],
].map(
  ([
    id,
    name,
    location,
    date,
    time,
    type,
    status,
    pilot,
    observer,
    aircraft,
  ]) => ({
    id,
    name,
    location,
    date,
    time,
    type,
    status,
    pilot,
    observer,
    aircraft,
    equipment: ['TB65–001', 'TB65–002', 'Zenmuse H30T'],
    notes:
      'Maintain VLOS. Confirm site access and brief all crew before takeoff. Planned operating height: 60 m AGL.',
    risks: baseRisks.map((r) => ({ ...r })),
    history: [
      'Mission created by ' + pilot,
      'Crew and equipment assigned',
      ...(status === 'Pending approval'
        ? ['Submitted for operations review']
        : status === 'Approved'
          ? ['Approved by Danijel Jovanovic']
          : []),
    ],
  }),
);
const initialAssets: Asset[] = [
  {
    id: 'AC–001',
    name: 'Matrice 350 RTK',
    category: 'Aircraft',
    serial: 'M350-2024-0142',
    status: 'Available',
    hours: 196,
    pilot: 'Alex Morgan',
    next: 200,
  },
  {
    id: 'AC–002',
    name: 'Mavic 3 Thermal',
    category: 'Aircraft',
    serial: 'M3T-2025-0037',
    status: 'Available',
    hours: 84,
    pilot: 'Sara Ahmed',
    next: 100,
  },
  {
    id: 'AC–003',
    name: 'Mavic 3 Enterprise',
    category: 'Aircraft',
    serial: 'M3E-2025-0091',
    status: 'Available',
    hours: 142,
    pilot: 'Omar Hassan',
    next: 200,
  },
  {
    id: 'AC–004',
    name: 'Matrice 300 RTK',
    category: 'Aircraft',
    serial: 'M300-2023-0105',
    status: 'Maintenance due',
    hours: 300,
    pilot: 'Unassigned',
    next: 300,
  },
  {
    id: 'PL–001',
    name: 'Zenmuse H30T',
    category: 'Payload',
    serial: 'H30T-2025-0064',
    status: 'Available',
    hours: 76,
    pilot: 'Alex Morgan',
    next: 100,
  },
  {
    id: 'RC–001',
    name: 'DJI RC Plus',
    category: 'Controller',
    serial: 'RCPLUS-2024-034',
    status: 'Checked out',
    hours: 122,
    pilot: 'Alex Morgan',
    next: 200,
  },
  {
    id: 'AC–005',
    name: 'D-RTK 2 Mobile Station',
    category: 'Accessory',
    serial: 'RTK2-2024-015',
    status: 'Available',
    hours: 98,
    pilot: 'Unassigned',
    next: 150,
  },
  {
    id: 'AC–006',
    name: 'BS65 Battery Station',
    category: 'Accessory',
    serial: 'BS65-2024-046',
    status: 'Available',
    hours: 164,
    pilot: 'Sara Ahmed',
    next: 200,
  },
];
const crew = [
  {
    name: 'Alex Morgan',
    initials: 'AM',
    role: 'Lead pilot',
    hours: 342,
    flights: 486,
    cert: 'UAS Pilot Certificate',
    expires: '14 May 2027',
    status: 'Available',
  },
  {
    name: 'Sara Ahmed',
    initials: 'SA',
    role: 'Pilot · Safety officer',
    hours: 218,
    flights: 312,
    cert: 'UAS Pilot Certificate',
    expires: '22 November 2026',
    status: 'Available',
  },
  {
    name: 'Omar Hassan',
    initials: 'OH',
    role: 'Pilot · Survey specialist',
    hours: 276,
    flights: 394,
    cert: 'UAS Pilot Certificate',
    expires: '18 March 2027',
    status: 'Available',
  },
];
const initialFlights: Flight[] = [
  {
    id: 'FL–0842',
    mission: 'Construction progress survey',
    pilot: 'Alex Morgan',
    aircraft: 'Matrice 350 RTK',
    date: '2026-09-05',
    duration: '24:36',
    distance: '4.82',
    altitude: 80,
    start: 98,
    end: 36,
    battery: 'TB65–001',
  },
  {
    id: 'FL–0841',
    mission: 'Construction progress survey',
    pilot: 'Alex Morgan',
    aircraft: 'Matrice 350 RTK',
    date: '2026-09-05',
    duration: '21:14',
    distance: '3.94',
    altitude: 75,
    start: 100,
    end: 41,
    battery: 'TB65–002',
  },
  {
    id: 'FL–0840',
    mission: 'Warehouse roof inspection',
    pilot: 'Omar Hassan',
    aircraft: 'Mavic 3 Enterprise',
    date: '2026-09-04',
    duration: '28:08',
    distance: '2.63',
    altitude: 45,
    start: 99,
    end: 28,
    battery: 'M3–003',
  },
  {
    id: 'FL–0839',
    mission: 'Solar array inspection',
    pilot: 'Sara Ahmed',
    aircraft: 'Mavic 3 Thermal',
    date: '2026-09-03',
    duration: '26:42',
    distance: '5.12',
    altitude: 60,
    start: 100,
    end: 31,
    battery: 'M3–004',
  },
  {
    id: 'FL–0838',
    mission: 'Marina site reconnaissance',
    pilot: 'Alex Morgan',
    aircraft: 'Matrice 350 RTK',
    date: '2026-09-02',
    duration: '18:22',
    distance: '2.17',
    altitude: 60,
    start: 97,
    end: 48,
    battery: 'TB65–001',
  },
  {
    id: 'FL–0837',
    mission: 'Coastal mapping — sector A',
    pilot: 'Omar Hassan',
    aircraft: 'Mavic 3 Enterprise',
    date: '2026-09-01',
    duration: '30:15',
    distance: '6.24',
    altitude: 100,
    start: 100,
    end: 24,
    battery: 'M3–003',
  },
];
const initialServices: Service[] = [
  {
    id: 'SV–014',
    asset: 'Matrice 350 RTK',
    task: '200-hour aircraft inspection',
    due: '2026-09-10',
    remaining: 4,
    status: 'Upcoming',
    technician: 'Alex Morgan',
    notes: 'Inspect propulsion system, landing gear, frame, and firmware.',
  },
  {
    id: 'SV–015',
    asset: 'Matrice 300 RTK',
    task: 'Propeller and motor inspection',
    due: '2026-09-05',
    remaining: 0,
    status: 'Overdue',
    technician: 'Omar Hassan',
    notes: 'Aircraft grounded until inspection and sign-off.',
  },
  {
    id: 'SV–016',
    asset: 'Zenmuse H30T',
    task: 'Gimbal calibration and lens inspection',
    due: '2026-09-20',
    remaining: 24,
    status: 'Scheduled',
    technician: 'Sara Ahmed',
    notes: 'Inspect lens and run gimbal calibration.',
  },
];
const initialBatteries = [
  {
    id: 'TB65–001',
    model: 'TB65',
    aircraft: 'Matrice 350 RTK',
    cycles: 84,
    health: 96,
    temp: 38,
    status: 'Healthy',
  },
  {
    id: 'TB65–002',
    model: 'TB65',
    aircraft: 'Matrice 350 RTK',
    cycles: 81,
    health: 95,
    temp: 37,
    status: 'Healthy',
  },
  {
    id: 'TB65–008',
    model: 'TB65',
    aircraft: 'Matrice 350 RTK',
    cycles: 212,
    health: 78,
    temp: 46,
    status: 'Attention required',
  },
  {
    id: 'M3–003',
    model: 'Mavic 3',
    aircraft: 'Mavic 3 Enterprise',
    cycles: 56,
    health: 98,
    temp: 34,
    status: 'Healthy',
  },
  {
    id: 'M3–004',
    model: 'Mavic 3',
    aircraft: 'Mavic 3 Thermal',
    cycles: 92,
    health: 93,
    temp: 39,
    status: 'Healthy',
  },
  {
    id: 'TB65–009',
    model: 'TB65',
    aircraft: 'Matrice 350 RTK',
    cycles: 128,
    health: 88,
    temp: 40,
    status: 'Healthy',
  },
];
const emptyMission = (): Mission => ({
  id: '',
  name: '',
  location: '',
  date: '2026-09-11',
  time: '06:30',
  type: 'Inspection',
  status: 'Draft',
  pilot: 'Alex Morgan',
  observer: 'Sara Ahmed',
  aircraft: 'Matrice 350 RTK',
  equipment: ['TB65–001', 'TB65–002'],
  notes: '',
  risks: baseRisks.map((r) => ({ ...r, controlled: false })),
  history: [],
});
function Pick({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: string[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger className="picker" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
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
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="glass mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function Summary({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="summary-list">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
function Empty() {
  return (
    <div className="empty-state">
      <Search />
      <h3>No matching records</h3>
      <p>Try another search or change the selected filter.</p>
    </div>
  );
}
function Chart({ battery = false }: { battery?: boolean }) {
  return (
    <div className="telemetry-chart">
      <div className="chart-labels">
        <span>{battery ? '100%' : '100m'}</span>
        <span>{battery ? '90%' : '50m'}</span>
        <span>{battery ? '75%' : '0m'}</span>
      </div>
      <svg
        viewBox="0 0 700 170"
        preserveAspectRatio="none"
        role="img"
        aria-label={
          battery
            ? 'Sample battery capacity declines from 100 to 78 percent across 212 cycles'
            : 'Sample flight altitude reaches 80 meters before returning to ground'
        }
      >
        <defs>
          <linearGradient
            id={battery ? 'batFill' : 'altFill'}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              stopColor={battery ? '#e6bd73' : '#c9ef89'}
              stopOpacity=".18"
            />
            <stop offset="1" stopColor="#c9ef89" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 75, 135].map((y) => (
          <path
            key={y}
            d={`M0 ${y}H700`}
            stroke="#ffffff0e"
            strokeDasharray="4 5"
          />
        ))}
        <path
          d={
            battery
              ? 'M0 16L40 20L80 18L120 25L160 27L200 33L240 38L280 36L320 43L360 54L400 62L440 67L480 78L520 82L560 101L600 107L640 129L700 140L700 170H0Z'
              : 'M0 150L20 148L50 32L80 26L120 28L150 32L180 27L240 28L280 30L320 28L370 31L410 28L450 32L480 45L510 35L540 36L600 34L630 40L670 148L700 150L700 170H0Z'
          }
          fill={`url(#${battery ? 'batFill' : 'altFill'})`}
        />
        <path
          d={
            battery
              ? 'M0 16L40 20L80 18L120 25L160 27L200 33L240 38L280 36L320 43L360 54L400 62L440 67L480 78L520 82L560 101L600 107L640 129L700 140'
              : 'M0 150L20 148L50 32L80 26L120 28L150 32L180 27L240 28L280 30L320 28L370 31L410 28L450 32L480 45L510 35L540 36L600 34L630 40L670 148L700 150'
          }
          fill="none"
          stroke={battery ? '#e6bd73' : '#c9ef89'}
          strokeWidth="2"
        />
      </svg>
      <div className="chart-axis">
        <span>{battery ? 'Cycle 0' : '00:00'}</span>
        <span>{battery ? '50' : '06:00'}</span>
        <span>{battery ? '100' : '12:00'}</span>
        <span>{battery ? '150' : '18:00'}</span>
        <span>{battery ? '212' : '24:36'}</span>
      </div>
    </div>
  );
}
function csv(name: string, rows: string[][]) {
  const blob = new Blob(
    [
      rows
        .map((r) =>
          r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(','),
        )
        .join('\n'),
    ],
    { type: 'text/csv;charset=utf-8;' },
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}
export default function Operations({
  page,
  setPage,
  newMissionKey,
  onMissionsChange,
}: {
  page: string;
  setPage: (s: string) => void;
  newMissionKey: number;
  onMissionsChange: (m: Mission[]) => void;
}) {
  const [missions, setMissions] = useState(initialMissions),
    [assets, setAssets] = useState(initialAssets),
    [flights, setFlights] = useState(initialFlights),
    [services, setServices] = useState(initialServices),
    [batteries, setBatteries] = useState(initialBatteries);
  useEffect(() => onMissionsChange(missions), [missions, onMissionsChange]);
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('All missions'),
    [view, setView] = useState('Grid'),
    [detail, setDetail] = useState<any>(null),
    [dialog, setDialog] = useState(''),
    [step, setStep] = useState(0),
    [draft, setDraft] = useState<Mission>(emptyMission),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [reviewNote, setReviewNote] = useState(''),
    [connected, setConnected] = useState<string[]>([]),
    [syncing, setSyncing] = useState(false),
    [syncTime, setSyncTime] = useState(''),
    [form, setForm] = useState<Record<string, string>>({}),
    [play, setPlay] = useState(false),
    [playback, setPlayback] = useState(0);
  const notify = (s: string) => setNotice(s);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 5000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  useEffect(() => {
    setSearch('');
    setFilter(
      page === 'Missions'
        ? 'All missions'
        : page === 'Inventory'
          ? 'All equipment'
          : 'All',
    );
    setDetail(null);
  }, [page]);
  useEffect(() => {
    if (newMissionKey) {
      setDraft(emptyMission());
      setStep(0);
      setError('');
      setDialog('mission');
    }
  }, [newMissionKey]);
  useEffect(() => {
    if (!play) return;
    const t = setInterval(
      () =>
        setPlayback((p) => {
          if (p >= 100) {
            setPlay(false);
            return 100;
          }
          return p + 2;
        }),
      300,
    );
    return () => clearInterval(t);
  }, [play]);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'start_mission_planning',
          title: 'Start a mission plan',
          description:
            'Open the mission planner with an optional name. Does not save or submit a mission.',
          inputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: (input: unknown) => {
            if (
              !input ||
              typeof input !== 'object' ||
              Array.isArray(input) ||
              Object.keys(input).some((k) => k !== 'name') ||
              ('name' in input && typeof input.name !== 'string')
            )
              throw Error('Expected an object with an optional name string.');
            flushSync(() => {
              setPage('Missions');
              setDraft({
                ...emptyMission(),
                name: (input as { name?: string }).name || '',
              });
              setStep(0);
              setError('');
              setDialog('mission');
            });
            return { opened: true, step: 'Mission details' };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, [setPage]);
  const openForm = (kind: string, values: Record<string, string> = {}) => {
    setForm(values);
    setError('');
    setDialog(kind);
  };
  const updateDraft = (key: keyof Mission, value: any) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const openMission = (m: Mission) => {
    setReviewNote('');
    setDetail({ kind: 'mission', ...m });
  };
  const saveMission = (submit: boolean) => {
    if (
      !draft.name.trim() ||
      !draft.location.trim() ||
      !draft.date ||
      !draft.time
    ) {
      setError('Add a mission name, location, date and time.');
      setStep(0);
      return;
    }
    if (draft.pilot === draft.observer) {
      setError('Choose a different person as the visual observer.');
      setStep(1);
      return;
    }
    if (
      submit &&
      (!draft.risks.length ||
        draft.risks.some((r) => !r.controlled || !r.mitigation.trim()))
    ) {
      setError(
        'Review every risk and confirm its mitigation before submitting.',
      );
      setStep(2);
      return;
    }
    const item = {
      ...draft,
      id:
        draft.id ||
        'DXB–' +
          String(
            28 +
              missions.filter(
                (m) => !initialMissions.some((i) => i.id === m.id),
              ).length,
          ).padStart(3, '0'),
      status: submit ? 'Pending approval' : 'Draft',
      history: [
        ...draft.history,
        submit
          ? 'Submitted to Danijel Jovanovic for operations review'
          : 'Draft saved',
      ],
    };
    setMissions((ms) =>
      ms.some((m) => m.id === item.id)
        ? ms.map((m) => (m.id === item.id ? item : m))
        : [item, ...ms],
    );
    setDialog('');
    setFilter('All missions');
    notify(
      submit
        ? 'Mission package submitted to the demo approval queue.'
        : 'Mission draft saved for this session.',
    );
    openMission(item);
  };
  const review = (status: string) => {
    if (status === 'Changes requested' && !reviewNote.trim()) {
      setError('Add a review note explaining the changes needed.');
      return;
    }
    const item = {
      ...detail,
      status,
      history: [
        ...detail.history,
        `${status} by Danijel Jovanovic${reviewNote ? ' · ' + reviewNote : ''}`,
      ],
    };
    setMissions((ms) => ms.map((m) => (m.id === item.id ? item : m)));
    setDetail(item);
    setError('');
    notify(
      status === 'Approved'
        ? 'Mission approved. The crew can now see the approved package.'
        : 'Mission returned to the planner with your notes.',
    );
  };
  const downloadPackage = (m: Mission) => {
    const text = `AEROLOG — DEMO MISSION PACKAGE\n${m.id} | ${m.name}\nStatus: ${m.status}\nLocation: ${m.location}\nSchedule: ${m.date} ${m.time} GST\nOperation: ${m.type}\nPilot: ${m.pilot}\nObserver: ${m.observer}\nAircraft: ${m.aircraft}\nEquipment: ${m.equipment.join(', ')}\n\nOPERATING NOTES\n${m.notes || 'No notes provided.'}\n\nRISK ASSESSMENT\n${m.risks.map((r) => `${r.hazard} — initial score ${r.likelihood * r.severity}/25\nMitigation: ${r.mitigation}\nControl reviewed: ${r.controlled ? 'Yes' : 'No'}`).join('\n\n')}\n\nREVIEW HISTORY\n${m.history.join('\n')}\n\nPrototype only. Approval in this workspace is a demonstration, not operational authorization.`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = m.id + '-mission-package.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  };
  const visibleMissions = missions.filter(
    (m) =>
      (filter === 'All missions' || filter === 'All' || m.status === filter) &&
      `${m.name} ${m.id} ${m.location} ${m.pilot}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const visibleAssets = assets.filter(
    (a) =>
      (filter === 'All equipment' ||
        filter === 'All' ||
        a.category === filter) &&
      `${a.id} ${a.name} ${a.serial}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const visibleFlights = flights.filter(
    (f) =>
      (filter === 'All' || f.pilot === filter) &&
      `${f.id} ${f.mission} ${f.aircraft} ${f.pilot}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const pending = missions.filter((m) => m.status === 'Pending approval');
  return (
    <div
      style={{ display: page === 'Overview' ? 'none' : 'block' }}
      className="operations-content"
    >
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            ×
          </button>
        </div>
      )}
      {page === 'Missions' && (
        <>
          <div className="section-tabs">
            <Tabs value={filter} onValueChange={(v) => setFilter(String(v))}>
              <TabsList variant="line">
                {[
                  'All missions',
                  'Draft',
                  'Pending approval',
                  'Approved',
                  'Completed',
                  'Changes requested',
                ].map((t) => (
                  <TabsTrigger value={t} key={t}>
                    {t}
                    {t === 'Pending approval' && (
                      <span className="tiny-count">{pending.length}</span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="toolbar">
            <div className="search-field">
              <Search size={16} />
              <Input
                aria-label="Search missions"
                placeholder="Search missions, locations, crew…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <span className="results-count">
              {visibleMissions.length} missions
            </span>
            <Tabs value={view} onValueChange={(v) => setView(String(v))}>
              <TabsList>
                <TabsTrigger value="Grid">Grid</TabsTrigger>
                <TabsTrigger value="List">List</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {visibleMissions.length === 0 ? (
            <Empty />
          ) : view === 'Grid' ? (
            <div className="mission-board">
              {visibleMissions.map((m) => (
                <button
                  className="glass mission-tile"
                  onClick={() => openMission(m)}
                  key={m.id}
                >
                  <div
                    className={
                      'tile-map ' +
                      (m.type === 'Thermal survey' ? 'thermal' : '')
                    }
                  >
                    <div className="terrain-lines" />
                    <MapPin size={28} />
                    <span>{m.location.toUpperCase()}</span>
                    <b>{m.id}</b>
                  </div>
                  <div className="tile-body">
                    <div className="row">
                      <span className="category-label">{m.type}</span>
                      <Status>{m.status}</Status>
                    </div>
                    <h3>{m.name}</h3>
                    <p>
                      <MapPin size={13} />
                      {m.location}
                    </p>
                    <div className="tile-meta">
                      <span>
                        <CalendarDays size={14} />
                        {m.date.slice(5)} · {m.time}
                      </span>
                      <span>
                        <Drone size={14} />
                        {m.aircraft}
                      </span>
                    </div>
                    <div className="tile-foot">
                      <span className="crew-chip">
                        <span className="avatar small">
                          {m.pilot
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </span>
                        {m.pilot}
                      </span>
                      <ArrowUpRight size={17} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="glass">
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      'Mission',
                      'Location',
                      'Schedule',
                      'Pilot',
                      'Status',
                      '',
                    ].map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMissions.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <button
                          className="table-link"
                          onClick={() => openMission(m)}
                        >
                          {m.name}
                          <small>{m.id}</small>
                        </button>
                      </TableCell>
                      <TableCell>{m.location}</TableCell>
                      <TableCell>
                        {m.date}
                        <small>{m.time} GST</small>
                      </TableCell>
                      <TableCell>{m.pilot}</TableCell>
                      <TableCell>
                        <Status>{m.status}</Status>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={'Open ' + m.name}
                          onClick={() => openMission(m)}
                        >
                          <ChevronRight />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
      {page === 'Flight logs' && (
        <>
          <div className="stats">
            <Metric
              label="Total flights"
              value={String(flights.length)}
              note="In the sample logbook"
            />
            <Metric
              label="Logged flight time"
              value={
                Math.floor(
                  flights.reduce(
                    (n, f) => n + Number(f.duration.split(':')[0]),
                    0,
                  ) / 60,
                ) +
                'h ' +
                (flights.reduce(
                  (n, f) => n + Number(f.duration.split(':')[0]),
                  0,
                ) %
                  60) +
                'm'
              }
              note="Across the sample logbook"
            />
            <Metric
              label="Distance covered"
              value={
                flights.reduce((n, f) => n + Number(f.distance), 0).toFixed(1) +
                ' km'
              }
              note="Mapped and inspected"
            />
            <Metric
              label="Flight completion"
              value="100%"
              note="All flights landed safely"
            />
          </div>
          <section className="glass">
            <div className="panel-heading">
              <div>
                <h2>Flight logbook</h2>
                <p>Every flight. Every detail. One complete record.</p>
              </div>
              <div className="actions">
                <Button
                  variant="outline"
                  onClick={() =>
                    csv('aerolog-flights.csv', [
                      [
                        'Flight',
                        'Mission',
                        'Pilot',
                        'Aircraft',
                        'Date',
                        'Duration',
                        'Distance (km)',
                        'Altitude (m)',
                        'Battery',
                      ],
                      ...visibleFlights.map((f) => [
                        f.id,
                        f.mission,
                        f.pilot,
                        f.aircraft,
                        f.date,
                        f.duration,
                        f.distance,
                        String(f.altitude),
                        f.battery,
                      ]),
                    ])
                  }
                >
                  <Download size={15} /> Export
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage('Integrations')}
                >
                  <RefreshCw size={15} /> DJI sync
                </Button>
              </div>
            </div>
            <div className="toolbar inset">
              <div className="search-field">
                <Search size={16} />
                <Input
                  aria-label="Search flight logs"
                  placeholder="Search flight logs…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Pick
                label="Pilot"
                value={filter}
                onChange={setFilter}
                options={['All', ...crew.map((c) => c.name)]}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    'Flight / Mission',
                    'Date',
                    'Pilot',
                    'Aircraft',
                    'Duration',
                    'Distance',
                    'Battery',
                    '',
                  ].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleFlights.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <button
                        className="table-link"
                        onClick={() => {
                          setDetail({ kind: 'flight', ...f });
                          setPlayback(0);
                          setPlay(false);
                        }}
                      >
                        <span className="log-id">
                          <Radio size={14} />
                          {f.id}
                        </span>
                        <small>{f.mission}</small>
                      </button>
                    </TableCell>
                    <TableCell>
                      {f.date.slice(5)}
                      <small>2026</small>
                    </TableCell>
                    <TableCell>{f.pilot}</TableCell>
                    <TableCell>{f.aircraft}</TableCell>
                    <TableCell className="numeric">{f.duration}</TableCell>
                    <TableCell>{f.distance} km</TableCell>
                    <TableCell>
                      <span className="battery-readout">
                        <Battery size={17} />
                        {f.start}% → {f.end}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={'View flight ' + f.id}
                        onClick={() => {
                          setDetail({ kind: 'flight', ...f });
                          setPlayback(0);
                          setPlay(false);
                        }}
                      >
                        <ArrowUpRight size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!visibleFlights.length && <Empty />}
            <div className="table-footer">
              {visibleFlights.length} flight records{' '}
              <span>Telemetry and paths are illustrative</span>
            </div>
          </section>
          <div className="insight-strip">
            <div className="round-icon">
              <Link2 />
            </div>
            <div>
              <h3>Bring your pilot history together</h3>
              <p>
                Preview individual DJI account connections and a unified flight
                logbook.
              </p>
            </div>
            <Button variant="ghost" onClick={() => setPage('Integrations')}>
              Manage connections <ArrowRight size={16} />
            </Button>
          </div>
        </>
      )}
      {page === 'Inventory' && (
        <>
          <div className="stats">
            <Metric
              label="Equipment"
              value={String(assets.length)}
              note="Aircraft, payloads and accessories"
            />
            <Metric
              label="Available"
              value={String(
                assets.filter((a) => a.status === 'Available').length,
              )}
              note="Ready for assignment"
            />
            <Metric
              label="Checked out"
              value={String(
                assets.filter((a) => a.status === 'Checked out').length,
              )}
              note="Currently with crew"
            />
            <Metric
              label="Service required"
              value={String(
                assets.filter((a) => a.status === 'Maintenance due').length,
              )}
              note="Unavailable for mission planning"
            />
          </div>
          <section className="glass">
            <div className="panel-heading">
              <h2>Equipment register</h2>
              <Button
                className="primary"
                onClick={() =>
                  openForm('asset', {
                    name: '',
                    category: 'Aircraft',
                    serial: '',
                    pilot: 'Unassigned',
                  })
                }
              >
                <Plus size={16} /> Add equipment
              </Button>
            </div>
            <div className="toolbar inset">
              <div className="search-field">
                <Search size={16} />
                <Input
                  aria-label="Search inventory"
                  placeholder="Find equipment by name or serial…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Pick
                label="Category"
                value={filter}
                onChange={setFilter}
                options={[
                  'All equipment',
                  'Aircraft',
                  'Payload',
                  'Controller',
                  'Accessory',
                ]}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    'Equipment',
                    'Category',
                    'Serial number',
                    'Status',
                    'Custodian',
                    'Usage',
                    '',
                  ].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleAssets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <button
                        className="equipment-name"
                        onClick={() => setDetail({ kind: 'asset', ...a })}
                      >
                        <span className="equipment-icon">
                          {a.category === 'Aircraft' ? (
                            <Drone />
                          ) : a.category === 'Payload' ? (
                            <Compass />
                          ) : (
                            <Package />
                          )}
                        </span>
                        <span>
                          {a.name}
                          <small>{a.id}</small>
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>{a.category}</TableCell>
                    <TableCell className="serial">{a.serial}</TableCell>
                    <TableCell>
                      <Status>{a.status}</Status>
                    </TableCell>
                    <TableCell>{a.pilot}</TableCell>
                    <TableCell>{a.hours} h</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={'Inspect ' + a.name}
                        onClick={() => setDetail({ kind: 'asset', ...a })}
                      >
                        <ChevronRight size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!visibleAssets.length && <Empty />}
            <div className="table-footer">
              {visibleAssets.length} items{' '}
              <button onClick={() => setPage('Batteries')}>
                View battery inventory <ArrowRight size={14} />
              </button>
            </div>
          </section>
        </>
      )}
      {page === 'Maintenance' && (
        <>
          <div className="stats">
            <Metric
              label="Overdue"
              value={String(
                services.filter((s) => s.status === 'Overdue').length,
              )}
              note="Grounded until signed off"
            />
            <Metric
              label="Upcoming services"
              value={String(
                services.filter((s) =>
                  ['Upcoming', 'Scheduled'].includes(s.status),
                ).length,
              )}
              note="Calendar and usage triggers"
            />
            <Metric
              label="Completed"
              value={String(
                services.filter((s) => s.status === 'Completed').length,
              )}
              note="Signed service records"
            />
            <Metric
              label="Nearest interval"
              value={
                Math.min(
                  ...assets
                    .filter((a) => a.next > a.hours)
                    .map((a) => a.next - a.hours),
                ) + ' hours'
              }
              note="Until the nearest usage service"
            />
          </div>
          <div className="toolbar">
            <Tabs value={filter} onValueChange={(v) => setFilter(String(v))}>
              <TabsList variant="line">
                {['All', 'Upcoming', 'Overdue', 'Completed'].map((t) => (
                  <TabsTrigger key={t} value={t}>
                    {t}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button
              className="primary"
              onClick={() =>
                openForm('service', {
                  asset: 'Matrice 350 RTK',
                  task: '',
                  due: '2026-09-15',
                  technician: 'Alex Morgan',
                  notes: '',
                })
              }
            >
              <Plus size={16} /> Schedule service
            </Button>
          </div>
          <div className="service-grid">
            {services
              .filter((s) => filter === 'All' || s.status === filter)
              .map((s) => (
                <section className="glass service-card" key={s.id}>
                  <div className="row">
                    <span
                      className={
                        'service-icon ' +
                        (s.status === 'Overdue' ? 'warning' : '')
                      }
                    >
                      <Wrench size={23} />
                    </span>
                    <Status>
                      {s.status === 'Overdue' ? 'Maintenance due' : s.status}
                    </Status>
                  </div>
                  <span className="category-label">
                    {s.id} / {s.asset}
                  </span>
                  <h3>{s.task}</h3>
                  <p>{s.notes}</p>
                  <div className="service-progress">
                    <div className="row">
                      <span>
                        {s.remaining === 0
                          ? 'Calendar service'
                          : `${200 - s.remaining} / 200 flight hours`}
                      </span>
                      <b>
                        {s.status === 'Completed'
                          ? 'Signed off'
                          : s.remaining === 0
                            ? 'Action required'
                            : `${s.remaining}h left`}
                      </b>
                    </div>
                    <Progress
                      value={
                        s.status === 'Completed'
                          ? 100
                          : Math.max(0, 100 - s.remaining / 2)
                      }
                    />
                  </div>
                  <div className="summary-inline">
                    <span>
                      <CalendarDays size={14} />
                      {s.due}
                    </span>
                    <span>{s.technician}</span>
                  </div>
                  <Button
                    variant="outline"
                    className="wide"
                    onClick={() => {
                      setDetail({ kind: 'service', ...s });
                      setReviewNote('');
                    }}
                  >
                    {s.status === 'Completed'
                      ? 'View service record'
                      : 'Open work order'}
                    <ArrowRight size={15} />
                  </Button>
                </section>
              ))}
          </div>
          {services.filter((s) => filter === 'All' || s.status === filter)
            .length === 0 && <Empty />}
          <section className="glass interval-panel">
            <div className="panel-heading">
              <h2>Equipment service intervals</h2>
              <span className="category-label">SAMPLE SERVICE POLICIES</span>
            </div>
            {assets.slice(0, 5).map((a) => (
              <div className="interval-row" key={a.id}>
                <span>
                  <Drone size={17} />
                  {a.name}
                </span>
                <Progress value={Math.min(100, (a.hours / a.next) * 100)} />
                <span>
                  {a.hours} / {a.next} h
                </span>
                <Status>
                  {a.hours >= a.next
                    ? 'Maintenance due'
                    : `${a.next - a.hours}h remaining`}
                </Status>
              </div>
            ))}
          </section>
        </>
      )}
      {page === 'Batteries' && (
        <>
          <div className="stats">
            <Metric
              label="Battery fleet"
              value={String(batteries.length)}
              note="Individually tracked power packs"
            />
            <Metric
              label="Average capacity"
              value={
                Math.round(
                  batteries.reduce((n, b) => n + b.health, 0) /
                    batteries.length,
                ) + '%'
              }
              note="Measured state of health"
            />
            <Metric
              label="Total charge cycles"
              value={String(batteries.reduce((n, b) => n + b.cycles, 0))}
              note="Lifetime usage recorded"
            />
            <Metric
              label="Needs attention"
              value={String(batteries.filter((b) => b.health < 80).length)}
              note="Below sample 80% threshold"
            />
          </div>
          <section className="battery-feature glass">
            <div>
              <span className="eyebrow">BATTERY INTELLIGENCE</span>
              <h2>
                Know your power.
                <br />
                <span>Before you take off.</span>
              </h2>
              <p>
                Track cycles, capacity and temperature across every pack. A
                connected history for future predictive insights.
              </p>
              <span className="future-label">
                <Activity size={14} /> Predictive AI · planned
              </span>
            </div>
            <div className="battery-focus">
              <div className="row">
                <div>
                  <span className="category-label">CAPACITY TREND</span>
                  <h3>TB65–008</h3>
                </div>
                <Status>Attention required</Status>
              </div>
              <Chart battery />
              <div className="row">
                <span>212 cycles · 78% remaining capacity</span>
                <button
                  onClick={() =>
                    setDetail({ kind: 'battery', ...batteries[2] })
                  }
                >
                  Inspect <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </section>
          <div className="toolbar">
            <h2>Power pack inventory</h2>
            <Button
              variant="outline"
              onClick={() =>
                openForm('cycle', {
                  battery: batteries[0].id,
                  temp: '38',
                  health: '96',
                  notes: '',
                })
              }
            >
              <Plus size={16} /> Record battery usage
            </Button>
          </div>
          <div className="battery-grid">
            {batteries.map((b) => (
              <button
                key={b.id}
                className="glass battery-card"
                onClick={() => setDetail({ kind: 'battery', ...b })}
              >
                <div className="row">
                  <Battery
                    size={24}
                    className={b.health < 80 ? 'text-amber' : 'text-lime'}
                  />
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
                    {b.health}
                    <span>%</span>
                  </strong>
                  <span>State of health</span>
                </div>
                <Progress value={b.health} />
                <div className="battery-card-foot">
                  <span>{b.cycles} cycles</span>
                  <span>{b.temp}°C last peak</span>
                  <ArrowUpRight size={17} />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      {page === 'Crew' && (
        <>
          <div className="stats">
            <Metric
              label="Active crew"
              value="3"
              note="Pilots and safety personnel"
            />
            <Metric
              label="Combined experience"
              value="836 h"
              note="Across the crew logbook"
            />
            <Metric
              label="Certifications"
              value="3 / 3"
              note="Valid in the sample records"
            />
            <Metric
              label="DJI demo accounts"
              value={String(connected.length)}
              note="Simulated connections"
            />
          </div>
          <div className="crew-grid">
            {crew.map((c) => (
              <section key={c.name} className="glass crew-card">
                <div className="row">
                  <span className="avatar crew-avatar">{c.initials}</span>
                  <Status>{c.status}</Status>
                </div>
                <h2>{c.name}</h2>
                <p>{c.role}</p>
                <div className="crew-numbers">
                  <div>
                    <b>{c.hours}h</b>
                    <span>Flight time</span>
                  </div>
                  <div>
                    <b>{c.flights}</b>
                    <span>Flights</span>
                  </div>
                </div>
                <div className="cert">
                  <ShieldCheck size={20} />
                  <div>
                    {c.cert}
                    <small>Valid until {c.expires}</small>
                  </div>
                </div>
                <div className="row crew-actions">
                  <span className="category-label">
                    {connected.includes(c.name)
                      ? 'DJI DEMO LINKED'
                      : 'DJI NOT LINKED'}
                  </span>
                  <Button
                    variant="ghost"
                    onClick={() => setDetail({ kind: 'crew', ...c })}
                  >
                    View profile <ArrowUpRight size={16} />
                  </Button>
                </div>
              </section>
            ))}
          </div>
          <section className="glass interval-panel">
            <div className="panel-heading">
              <h2>Upcoming crew assignments</h2>
            </div>
            {missions
              .filter((m) => m.status !== 'Completed')
              .slice(0, 5)
              .map((m) => (
                <button
                  className="assignment-row"
                  key={m.id}
                  onClick={() => {
                    setPage('Missions');
                    setTimeout(() => openMission(m), 50);
                  }}
                >
                  <span>
                    {m.name}
                    <small>
                      {m.date} · {m.time} GST
                    </small>
                  </span>
                  <span>
                    {m.pilot}
                    <small>Pilot in command</small>
                  </span>
                  <span>
                    {m.observer}
                    <small>Visual observer</small>
                  </span>
                  <Status>{m.status}</Status>
                  <ChevronRight size={16} />
                </button>
              ))}
          </section>
        </>
      )}
      {page === 'Integrations' && (
        <>
          <div className="integration-banner glass">
            <span className="integration-logo">dji</span>
            <div>
              <div className="row">
                <h2>DJI flight sync</h2>
                <Status>Demo mode</Status>
              </div>
              <p>
                Your pilots. Their flight history. One operational workspace.
              </p>
              <p className="integration-note">
                Live account linking will be enabled after credentials and a
                supported DJI integration are verified. This preview uses sample
                records and never requests a DJI password.
              </p>
            </div>
          </div>
          <div className="panel-heading no-inset">
            <div>
              <h2>Pilot connections</h2>
              <p>Each pilot owns their account connection.</p>
            </div>
            <Button
              variant="outline"
              disabled={syncing || connected.length === 0}
              onClick={() => {
                setSyncing(true);
                setTimeout(() => {
                  const f = {
                    ...initialFlights[0],
                    id: 'FL–DEMO–' + (flights.length + 1),
                    pilot: connected[0],
                    mission: 'DJI sample import',
                    date: '2026-09-06',
                  };
                  setFlights((fs) => [f, ...fs]);
                  setSyncing(false);
                  setSyncTime('Just now');
                  notify(
                    'One sample flight imported. No DJI service was contacted.',
                  );
                }, 1200);
              }}
            >
              <RefreshCw size={16} className={syncing ? 'spin' : ''} />
              {syncing ? 'Importing sample…' : 'Run demo sync'}
            </Button>
          </div>
          <section className="glass connections">
            {crew.map((c) => (
              <div className="connection-row" key={c.name}>
                <span className="avatar">{c.initials}</span>
                <div>
                  <h3>{c.name}</h3>
                  <p>{c.role}</p>
                </div>
                <Status>
                  {connected.includes(c.name)
                    ? 'Demo connected'
                    : 'Disconnected'}
                </Status>
                <span className="sync-time">
                  {connected.includes(c.name)
                    ? syncTime || 'Ready for sample sync'
                    : 'No account linked'}
                </span>
                <Button
                  variant="outline"
                  onClick={() =>
                    connected.includes(c.name)
                      ? openForm('disconnect', { pilot: c.name })
                      : openForm('connect', { pilot: c.name })
                  }
                >
                  {connected.includes(c.name) ? 'Disconnect' : 'Connect DJI'}
                  <Link2 size={14} />
                </Button>
              </div>
            ))}
          </section>
          <div className="integration-steps">
            <section className="glass">
              <span>01</span>
              <h3>Link a pilot account</h3>
              <p>Preview account authorization for the selected pilot.</p>
            </section>
            <section className="glass">
              <span>02</span>
              <h3>Bring flights into your logbook</h3>
              <p>
                Import a sample record to explore the synced log experience.
              </p>
            </section>
            <section className="glass">
              <span>03</span>
              <h3>Connect the operational history</h3>
              <p>
                Review flight telemetry alongside aircraft and battery records.
              </p>
            </section>
          </div>
        </>
      )}
      <Dialog
        open={dialog === 'mission'}
        onOpenChange={(o) => {
          if (!o) setDialog('');
        }}
      >
        <DialogContent className="planner-dialog">
          <DialogHeader>
            <span className="eyebrow">MISSION PLANNER</span>
            <DialogTitle>
              {draft.id ? 'Edit mission' : 'Plan your next mission'}
            </DialogTitle>
            <DialogDescription>
              Build a complete package for operations review.
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
                className={i === step ? 'current' : i < step ? 'done' : ''}
                key={s}
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
                    label="Mission name *"
                    value={draft.name}
                    onChange={(v) => updateDraft('name', v)}
                  />
                  <Pick
                    label="Operation type"
                    value={draft.type}
                    onChange={(v) => updateDraft('type', v)}
                    options={[
                      'Inspection',
                      'Mapping',
                      'Thermal survey',
                      'Training',
                    ]}
                  />
                  <Field
                    label="Location / site *"
                    value={draft.location}
                    onChange={(v) => updateDraft('location', v)}
                  />
                  <div className="form-grid">
                    <Field
                      label="Date *"
                      type="date"
                      value={draft.date}
                      onChange={(v) => updateDraft('date', v)}
                    />
                    <Field
                      label="Start time (GST) *"
                      type="time"
                      value={draft.time}
                      onChange={(v) => updateDraft('time', v)}
                    />
                  </div>
                </div>
                <label className="field">
                  <span>Operating notes and flight limits</span>
                  <Textarea
                    placeholder="Flight area, planned altitude, objectives, emergency landing area…"
                    value={draft.notes}
                    onChange={(e) => updateDraft('notes', e.target.value)}
                  />
                </label>
                <div className="info-box">
                  <MapPin size={18} />
                  <span>
                    Site selection is entered manually in this prototype. Map
                    boundaries and conditions shown elsewhere are illustrative.
                  </span>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <div className="form-grid">
                  <Pick
                    label="Pilot in command"
                    value={draft.pilot}
                    onChange={(v) => updateDraft('pilot', v)}
                    options={crew.map((c) => c.name)}
                  />
                  <Pick
                    label="Visual observer"
                    value={draft.observer}
                    onChange={(v) => updateDraft('observer', v)}
                    options={crew.map((c) => c.name)}
                  />
                </div>
                <Pick
                  label="Aircraft"
                  value={draft.aircraft}
                  onChange={(v) => updateDraft('aircraft', v)}
                  options={assets
                    .filter(
                      (a) =>
                        a.category === 'Aircraft' && a.status === 'Available',
                    )
                    .map((a) => a.name)}
                />
                <h3 className="form-section-label">Mission equipment</h3>
                <div className="equipment-options">
                  {[
                    ...batteries.filter((b) => b.health >= 80).map((b) => b.id),
                    ...assets
                      .filter(
                        (a) =>
                          a.category !== 'Aircraft' && a.status === 'Available',
                      )
                      .map((a) => a.name),
                  ].map((e) => (
                    <label key={e} className="check-row">
                      <Checkbox
                        checked={draft.equipment.includes(e)}
                        onCheckedChange={(checked) =>
                          updateDraft(
                            'equipment',
                            checked
                              ? [...draft.equipment, e]
                              : draft.equipment.filter((i) => i !== e),
                          )
                        }
                      />
                      <span>{e}</span>
                      <Status>Available</Status>
                    </label>
                  ))}
                </div>
                <div className="info-box">
                  <ShieldCheck size={18} />
                  <span>
                    Grounded aircraft and the flagged battery are excluded. Live
                    scheduling conflicts and certificate verification will be
                    connected in the production app.
                  </span>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div className="risk-heading">
                  <h3>Identify hazards. Confirm controls.</h3>
                  <span>Likelihood × severity · 1–5</span>
                </div>
                {draft.risks.map((r, i) => (
                  <section className="risk-edit" key={i}>
                    <div className="row">
                      <Input
                        aria-label={'Hazard ' + (i + 1)}
                        value={r.hazard}
                        onChange={(e) =>
                          updateDraft(
                            'risks',
                            draft.risks.map((r, j) =>
                              j === i ? { ...r, hazard: e.target.value } : r,
                            ),
                          )
                        }
                      />
                      <span className="risk-score">
                        {r.likelihood * r.severity}/25
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove hazard"
                        onClick={() =>
                          updateDraft(
                            'risks',
                            draft.risks.filter((_, j) => i !== j),
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                    <div className="form-grid risk-fields">
                      <Pick
                        label="Likelihood"
                        value={String(r.likelihood)}
                        options={['1', '2', '3', '4', '5']}
                        onChange={(v) =>
                          updateDraft(
                            'risks',
                            draft.risks.map((r, j) =>
                              j === i ? { ...r, likelihood: Number(v) } : r,
                            ),
                          )
                        }
                      />
                      <Pick
                        label="Severity"
                        value={String(r.severity)}
                        options={['1', '2', '3', '4', '5']}
                        onChange={(v) =>
                          updateDraft(
                            'risks',
                            draft.risks.map((r, j) =>
                              j === i ? { ...r, severity: Number(v) } : r,
                            ),
                          )
                        }
                      />
                    </div>
                    <Textarea
                      aria-label={'Mitigation for ' + r.hazard}
                      value={r.mitigation}
                      onChange={(e) =>
                        updateDraft(
                          'risks',
                          draft.risks.map((r, j) =>
                            j === i ? { ...r, mitigation: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <label className="check-row compact">
                      <Checkbox
                        checked={r.controlled}
                        onCheckedChange={(v) =>
                          updateDraft(
                            'risks',
                            draft.risks.map((r, j) =>
                              j === i ? { ...r, controlled: Boolean(v) } : r,
                            ),
                          )
                        }
                      />
                      I have reviewed this mitigation with the mission plan.
                    </label>
                  </section>
                ))}
                <Button
                  variant="outline"
                  onClick={() =>
                    updateDraft('risks', [
                      ...draft.risks,
                      {
                        hazard: 'Additional hazard',
                        likelihood: 2,
                        severity: 2,
                        mitigation: '',
                        controlled: false,
                      },
                    ])
                  }
                >
                  <Plus size={15} /> Add hazard
                </Button>
                <p className="fine-print">
                  Sample assessment method for UI exploration. Final scoring and
                  acceptance criteria must follow your operating procedures.
                </p>
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
                      {draft.location} · {draft.date}
                    </p>
                  </div>
                  <Status>Ready for review</Status>
                </div>
                <Summary
                  items={[
                    ['Operation', draft.type],
                    ['Schedule', draft.date + ' · ' + draft.time + ' GST'],
                    ['Pilot / observer', draft.pilot + ' / ' + draft.observer],
                    ['Aircraft', draft.aircraft],
                    [
                      'Equipment',
                      draft.equipment.join(', ') || 'None selected',
                    ],
                    [
                      'Risk assessment',
                      `${draft.risks.length} hazards · ${draft.risks.filter((r) => r.controlled).length} controls reviewed`,
                    ],
                    ['Approver', 'Danijel Jovanovic · Operations manager'],
                  ]}
                />
                <div className="info-box">
                  <ShieldCheck size={18} />
                  <span>
                    Submitting adds this package to the demo operations manager
                    queue. It does not send an email or authorize a real flight.
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
            <Button variant="ghost" onClick={() => saveMission(false)}>
              Save draft
            </Button>
            <div className="actions">
              {step > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setError('');
                    setStep((s) => s - 1);
                  }}
                >
                  <ArrowLeft size={15} /> Back
                </Button>
              )}
              <Button
                className="primary"
                onClick={() => {
                  setError('');
                  if (
                    step === 0 &&
                    (!draft.name.trim() ||
                      !draft.location.trim() ||
                      !draft.date ||
                      !draft.time)
                  ) {
                    setError('Enter a mission name, location, date and time.');
                    return;
                  }
                  if (step === 1 && draft.pilot === draft.observer) {
                    setError('Pilot and observer must be different people.');
                    return;
                  }
                  if (
                    step === 2 &&
                    (!draft.risks.length ||
                      draft.risks.some(
                        (r) =>
                          !r.hazard.trim() ||
                          !r.mitigation.trim() ||
                          !r.controlled,
                      ))
                  ) {
                    setError(
                      'Complete each hazard and mitigation, then confirm all controls.',
                    );
                    return;
                  }
                  step < 3 ? setStep((s) => s + 1) : saveMission(true);
                }}
              >
                {step === 3 ? 'Submit for approval' : 'Continue'}
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Sheet
        open={!!detail}
        onOpenChange={(o) => {
          if (!o) {
            setDetail(null);
            setError('');
            setPlay(false);
          }
        }}
      >
        <SheetContent className="detail-sheet">
          <SheetHeader>
            <span className="eyebrow">
              {detail?.kind === 'mission'
                ? 'MISSION PACKAGE'
                : detail?.kind === 'flight'
                  ? 'FLIGHT INTELLIGENCE'
                  : detail?.kind === 'battery'
                    ? 'BATTERY PASSPORT'
                    : detail?.kind === 'service'
                      ? 'MAINTENANCE RECORD'
                      : detail?.kind === 'crew'
                        ? 'CREW PROFILE'
                        : 'EQUIPMENT PROFILE'}
            </span>
            <SheetTitle>
              {detail?.name || detail?.task || detail?.id}
            </SheetTitle>
            <SheetDescription>
              {detail?.kind === 'flight'
                ? detail.mission
                : detail?.kind === 'battery'
                  ? detail.aircraft
                  : detail?.kind === 'mission'
                    ? detail.id + ' · ' + detail.location
                    : detail?.serial || detail?.role || detail?.asset}
            </SheetDescription>
          </SheetHeader>
          <div className="sheet-body">
            {detail?.kind === 'mission' && (
              <>
                <div className="row">
                  <Status>{detail.status}</Status>
                  <Button
                    variant="outline"
                    onClick={() => downloadPackage(detail)}
                  >
                    <Download size={15} /> Download package
                  </Button>
                </div>
                <Airspace />
                <Summary
                  items={[
                    ['Operation', detail.type],
                    ['Date & time', detail.date + ' · ' + detail.time + ' GST'],
                    ['Pilot in command', detail.pilot],
                    ['Visual observer', detail.observer],
                    ['Aircraft', detail.aircraft],
                    ['Equipment', detail.equipment.join(', ')],
                  ]}
                />
                <h3 className="detail-heading">Operating notes</h3>
                <p>{detail.notes || 'No operating notes added.'}</p>
                <h3 className="detail-heading">
                  Risk assessment <span>{detail.risks.length} hazards</span>
                </h3>
                {detail.risks.map((r: Risk, i: number) => (
                  <div className="risk-summary" key={i}>
                    <div className="row">
                      <h4>{r.hazard}</h4>
                      <span className="risk-score">
                        {r.likelihood * r.severity}/25
                      </span>
                    </div>
                    <p>{r.mitigation}</p>
                    <span className="control-status">
                      <Check size={13} />
                      {r.controlled
                        ? 'Control reviewed'
                        : 'Control review needed'}
                    </span>
                  </div>
                ))}
                <h3 className="detail-heading">Package history</h3>
                <div className="timeline">
                  {detail.history.map((h: string, i: number) => (
                    <div key={i}>
                      <i />
                      <p>{h}</p>
                    </div>
                  ))}
                </div>
                {detail.status === 'Pending approval' && (
                  <div className="review-box">
                    <span className="eyebrow">OPERATIONS MANAGER REVIEW</span>
                    <h3>Ready for your decision</h3>
                    <label className="field">
                      <span>Review note (required to request changes)</span>
                      <Textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="Add conditions, feedback or requested changes…"
                      />
                    </label>
                    {error && (
                      <p role="alert" className="error-message">
                        {error}
                      </p>
                    )}
                    <div className="actions">
                      <Button
                        variant="outline"
                        onClick={() => review('Changes requested')}
                      >
                        Request changes
                      </Button>
                      <Button
                        className="primary"
                        onClick={() => review('Approved')}
                      >
                        <ShieldCheck size={16} /> Approve mission
                      </Button>
                    </div>
                    <p className="fine-print">
                      Demo manager role. Production approvals will require
                      authenticated roles and an audit trail.
                    </p>
                  </div>
                )}
                {['Draft', 'Changes requested'].includes(detail.status) && (
                  <Button
                    className="primary wide"
                    onClick={() => {
                      setDraft({ ...detail });
                      setStep(0);
                      setDetail(null);
                      setError('');
                      setDialog('mission');
                    }}
                  >
                    Continue planning <ArrowRight size={16} />
                  </Button>
                )}
              </>
            )}
            {detail?.kind === 'flight' && (
              <>
                <div className="row">
                  <Status>Completed safely</Status>
                  <span className="category-label">SAMPLE TELEMETRY</span>
                </div>
                <Airspace />
                <div className="playback">
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={play ? 'Pause playback' : 'Play sample flight'}
                    onClick={() => {
                      if (playback >= 100) setPlayback(0);
                      setPlay(!play);
                    }}
                  >
                    {play ? <Pause size={16} /> : <Play size={16} />}
                  </Button>
                  <Progress value={playback} />
                  <span>
                    {Math.round((playback / 100) * 24)}:00 / {detail.duration}
                  </span>
                </div>
                <div className="detail-metrics">
                  <Metric
                    label="Duration"
                    value={detail.duration}
                    note="min : sec"
                  />
                  <Metric
                    label="Distance"
                    value={detail.distance}
                    note="kilometers"
                  />
                  <Metric
                    label="Max altitude"
                    value={String(detail.altitude)}
                    note="meters AGL"
                  />
                </div>
                <h3 className="detail-heading">
                  Altitude profile <span>Sample profile</span>
                </h3>
                <Chart />
                <Summary
                  items={[
                    ['Pilot', detail.pilot],
                    ['Aircraft', detail.aircraft],
                    ['Flight date', detail.date],
                    ['Battery pack', detail.battery],
                    ['Charge used', `${detail.start}% → ${detail.end}%`],
                    ['Takeoff / landing', 'Dubai · 07:15 / 07:39 GST'],
                    [
                      'Telemetry source',
                      detail.id.includes('DEMO')
                        ? 'Simulated DJI import'
                        : 'Sample flight record',
                    ],
                  ]}
                />
                <Button
                  variant="outline"
                  className="wide"
                  onClick={() => {
                    const b = batteries.find((b) => b.id === detail.battery);
                    if (b) setDetail({ kind: 'battery', ...b });
                  }}
                >
                  <Battery size={17} /> Open battery passport{' '}
                  <ArrowRight size={15} />
                </Button>
              </>
            )}
            {detail?.kind === 'asset' && (
              <>
                <div className="equipment-hero">
                  <Drone size={72} />
                  <span>{detail.category}</span>
                </div>
                <div className="row">
                  <Status>{detail.status}</Status>
                  <span className="serial">{detail.serial}</span>
                </div>
                <Summary
                  items={[
                    ['Asset ID', detail.id],
                    ['Custodian', detail.pilot],
                    ['Total usage', detail.hours + ' hours'],
                    ['Next service', detail.next + ' hours'],
                    [
                      'Service remaining',
                      Math.max(0, detail.next - detail.hours) + ' hours',
                    ],
                    ['Home base', 'Dubai operations hub'],
                  ]}
                />
                <h3 className="detail-heading">Service readiness</h3>
                <Progress
                  value={Math.min(100, (detail.hours / detail.next) * 100)}
                />
                <p>
                  {detail.next - detail.hours > 0
                    ? `${detail.next - detail.hours} hours until the next scheduled service.`
                    : 'Service interval reached. Unavailable for mission assignment.'}
                </p>
                <div className="sheet-actions">
                  <Button
                    variant="outline"
                    onClick={() =>
                      openForm('checkout', {
                        pilot:
                          detail.pilot === 'Unassigned'
                            ? 'Alex Morgan'
                            : detail.pilot,
                      })
                    }
                  >
                    {detail.status === 'Checked out'
                      ? 'Manage custody'
                      : 'Assign / check out'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const name = detail.name;
                      setDetail(null);
                      setPage('Maintenance');
                      openForm('service', {
                        asset: name,
                        task: '',
                        due: '2026-09-15',
                        technician: 'Alex Morgan',
                        notes: '',
                      });
                    }}
                  >
                    <Wrench size={15} /> Schedule service
                  </Button>
                </div>
                <h3 className="detail-heading">Linked missions</h3>
                {missions
                  .filter(
                    (m) =>
                      m.aircraft === detail.name ||
                      m.equipment.includes(detail.name),
                  )
                  .map((m) => (
                    <button
                      key={m.id}
                      className="linked-item"
                      onClick={() => openMission(m)}
                    >
                      <span>
                        {m.name}
                        <small>
                          {m.id} · {m.date}
                        </small>
                      </span>
                      <Status>{m.status}</Status>
                    </button>
                  ))}
              </>
            )}
            {detail?.kind === 'battery' && (
              <>
                <div className="battery-passport">
                  <Battery size={50} />
                  <strong>
                    {detail.health}
                    <span>%</span>
                  </strong>
                  <div>
                    State of health<Status>{detail.status}</Status>
                  </div>
                </div>
                {detail.health < 80 && (
                  <div className="warning-box">
                    <AlertTriangle size={20} />
                    <div>
                      <h3>Inspect before returning to service</h3>
                      <p>
                        Capacity is below the demo 80% threshold. This battery
                        is excluded from mission equipment selection.
                      </p>
                    </div>
                  </div>
                )}
                <Summary
                  items={[
                    ['Battery ID', detail.id],
                    [
                      'Model / aircraft',
                      detail.model + ' / ' + detail.aircraft,
                    ],
                    ['Charge cycles', String(detail.cycles)],
                    ['Last peak temperature', detail.temp + '°C'],
                    ['Measured capacity', detail.health + '% of reference'],
                    ['Cell imbalance', '32 mV · sample measurement'],
                  ]}
                />
                <h3 className="detail-heading">
                  Capacity over time <span>Illustrative trend</span>
                </h3>
                <Chart battery />
                <h3 className="detail-heading">Recent usage</h3>
                {flights
                  .filter((f) => f.battery === detail.id)
                  .map((f) => (
                    <button
                      className="linked-item"
                      key={f.id}
                      onClick={() => setDetail({ kind: 'flight', ...f })}
                    >
                      <span>
                        {f.id}
                        <small>
                          {f.date} · {f.duration}
                        </small>
                      </span>
                      <span>
                        {f.start}% → {f.end}% <ArrowUpRight size={14} />
                      </span>
                    </button>
                  ))}
                {!flights.some((f) => f.battery === detail.id) && (
                  <p>No linked flights in this sample logbook.</p>
                )}
                <Button
                  className="primary wide"
                  onClick={() =>
                    openForm('cycle', {
                      battery: detail.id,
                      temp: String(detail.temp),
                      health: String(detail.health),
                      notes: '',
                    })
                  }
                >
                  <Plus size={16} /> Record usage
                </Button>
                <div className="info-box">
                  <Activity size={18} />
                  <span>
                    Future predictions can use cycle history, temperature,
                    capacity and cell balance. No AI prediction is running in
                    this prototype.
                  </span>
                </div>
              </>
            )}
            {detail?.kind === 'service' && (
              <>
                <Status>
                  {detail.status === 'Overdue'
                    ? 'Maintenance due'
                    : detail.status}
                </Status>
                <Summary
                  items={[
                    ['Equipment', detail.asset],
                    ['Scheduled date', detail.due],
                    ['Assigned technician', detail.technician],
                    ['Work order', detail.id],
                  ]}
                />
                <h3 className="detail-heading">Scope of work</h3>
                <p>
                  {detail.notes || 'Complete inspection and document findings.'}
                </p>
                {detail.status !== 'Completed' ? (
                  <>
                    <label className="field service-notes">
                      <span>Service findings and work completed *</span>
                      <Textarea
                        placeholder="Record inspections, parts replaced and any remaining issues…"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                      />
                    </label>
                    {error && (
                      <p className="error-message" role="alert">
                        {error}
                      </p>
                    )}
                    <Button
                      className="primary wide"
                      onClick={() => {
                        if (!reviewNote.trim()) {
                          setError(
                            'Document the work completed before signing off.',
                          );
                          return;
                        }
                        const item = {
                          ...detail,
                          status: 'Completed',
                          notes: detail.notes + '\nCompleted: ' + reviewNote,
                        };
                        setServices((ss) =>
                          ss.map((s) => (s.id === item.id ? item : s)),
                        );
                        setAssets((as) =>
                          as.map((a) =>
                            a.name === detail.asset
                              ? {
                                  ...a,
                                  status: 'Available',
                                  next: Math.max(a.next, a.hours) + 100,
                                }
                              : a,
                          ),
                        );
                        setDetail(item);
                        setError('');
                        notify(
                          'Service signed off. Equipment readiness and the next usage interval were updated.',
                        );
                      }}
                    >
                      <CheckCircle2 size={16} /> Complete & sign off
                    </Button>
                    <p className="fine-print">
                      Demo sign-off as {detail.technician}. Advances the sample
                      usage interval by 100 hours.
                    </p>
                  </>
                ) : (
                  <div className="info-box">
                    <ShieldCheck size={18} />
                    <span>
                      Signed by {detail.technician}. The aircraft or equipment
                      has returned to available status.
                    </span>
                  </div>
                )}
              </>
            )}
            {detail?.kind === 'crew' && (
              <>
                <div className="crew-profile-hero">
                  <span className="avatar crew-avatar">{detail.initials}</span>
                  <div>
                    <h2>{detail.name}</h2>
                    <p>{detail.role}</p>
                  </div>
                  <Status>{detail.status}</Status>
                </div>
                <Summary
                  items={[
                    ['Total flight time', detail.hours + ' hours'],
                    ['Lifetime flights', String(detail.flights)],
                    ['Certification', detail.cert],
                    ['Certificate expiry', detail.expires],
                    [
                      'DJI connection',
                      connected.includes(detail.name)
                        ? 'Demo connected'
                        : 'Not linked',
                    ],
                  ]}
                />
                <h3 className="detail-heading">Assigned missions</h3>
                {missions
                  .filter(
                    (m) =>
                      m.pilot === detail.name || m.observer === detail.name,
                  )
                  .map((m) => (
                    <button
                      className="linked-item"
                      key={m.id}
                      onClick={() => openMission(m)}
                    >
                      <span>
                        {m.name}
                        <small>
                          {m.date} ·{' '}
                          {m.pilot === detail.name
                            ? 'Pilot in command'
                            : 'Visual observer'}
                        </small>
                      </span>
                      <Status>{m.status}</Status>
                    </button>
                  ))}
                <Button
                  variant="outline"
                  className="wide"
                  onClick={() => {
                    setDetail(null);
                    setPage('Integrations');
                  }}
                >
                  <Link2 size={16} /> Manage DJI connection
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Dialog
        open={!!dialog && dialog !== 'mission'}
        onOpenChange={(o) => {
          if (!o) setDialog('');
        }}
      >
        <DialogContent className="form-dialog">
          <DialogHeader>
            <DialogTitle>
              {
                {
                  asset: 'Add equipment',
                  service: 'Schedule maintenance',
                  cycle: 'Record battery usage',
                  checkout: 'Equipment custody',
                  connect: 'Connect a DJI account',
                  disconnect: 'Disconnect demo account',
                }[dialog]
              }
            </DialogTitle>
            <DialogDescription>
              {dialog === 'connect'
                ? 'Preview the account connection for ' + form.pilot
                : dialog === 'disconnect'
                  ? 'Existing imported flight records will remain in the logbook.'
                  : 'Changes are stored in this demo session.'}
            </DialogDescription>
          </DialogHeader>
          {dialog === 'asset' && (
            <>
              <Field
                label="Equipment name *"
                value={form.name || ''}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <Pick
                label="Category"
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                options={['Aircraft', 'Payload', 'Controller', 'Accessory']}
              />
              <Field
                label="Serial number *"
                value={form.serial || ''}
                onChange={(v) => setForm({ ...form, serial: v })}
              />
              <Pick
                label="Custodian"
                value={form.pilot}
                onChange={(v) => setForm({ ...form, pilot: v })}
                options={['Unassigned', ...crew.map((c) => c.name)]}
              />
              <Button
                className="primary"
                onClick={() => {
                  if (!form.name?.trim() || !form.serial?.trim()) {
                    setError('Enter an equipment name and serial number.');
                    return;
                  }
                  if (
                    assets.some(
                      (a) =>
                        a.serial.toLowerCase() === form.serial.toLowerCase(),
                    )
                  ) {
                    setError('That serial number already exists.');
                    return;
                  }
                  setAssets((a) => [
                    ...a,
                    {
                      id: 'EQ–' + String(a.length + 1).padStart(3, '0'),
                      name: form.name,
                      serial: form.serial,
                      category: form.category,
                      pilot: form.pilot,
                      status: 'Available',
                      hours: 0,
                      next: 100,
                    },
                  ]);
                  setDialog('');
                  notify('Equipment added to the register.');
                }}
              >
                Add equipment
              </Button>
            </>
          )}
          {dialog === 'service' && (
            <>
              <Pick
                label="Equipment"
                value={form.asset}
                onChange={(v) => setForm({ ...form, asset: v })}
                options={assets.map((a) => a.name)}
              />
              <Field
                label="Service task *"
                value={form.task || ''}
                onChange={(v) => setForm({ ...form, task: v })}
              />
              <Field
                label="Due date *"
                type="date"
                value={form.due}
                onChange={(v) => setForm({ ...form, due: v })}
              />
              <Pick
                label="Technician"
                value={form.technician}
                onChange={(v) => setForm({ ...form, technician: v })}
                options={crew.map((c) => c.name)}
              />
              <label className="field">
                <span>Work instructions</span>
                <Textarea
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              <Button
                className="primary"
                onClick={() => {
                  if (!form.task?.trim() || !form.due) {
                    setError('Add a service task and due date.');
                    return;
                  }
                  setServices((s) => [
                    ...s,
                    {
                      id: 'SV–' + (17 + s.length - 3),
                      asset: form.asset,
                      task: form.task,
                      due: form.due,
                      technician: form.technician,
                      notes: form.notes,
                      remaining: 0,
                      status: form.due < '2026-09-06' ? 'Overdue' : 'Scheduled',
                    },
                  ]);
                  setDialog('');
                  notify('Maintenance work order scheduled.');
                }}
              >
                Schedule service
              </Button>
            </>
          )}
          {dialog === 'cycle' && (
            <>
              <Pick
                label="Battery"
                value={form.battery}
                options={batteries.map((b) => b.id)}
                onChange={(v) => {
                  const b = batteries.find((b) => b.id === v)!;
                  setForm({
                    ...form,
                    battery: v,
                    temp: String(b.temp),
                    health: String(b.health),
                  });
                }}
              />
              <div className="form-grid">
                <Field
                  label="Peak temperature (°C) *"
                  type="number"
                  value={form.temp}
                  onChange={(v) => setForm({ ...form, temp: v })}
                />
                <Field
                  label="Measured capacity (%) *"
                  type="number"
                  value={form.health}
                  onChange={(v) => setForm({ ...form, health: v })}
                />
              </div>
              <p>
                This records one additional charge cycle and updates the latest
                condition reading.
              </p>
              <Button
                className="primary"
                onClick={() => {
                  const health = Number(form.health),
                    temp = Number(form.temp);
                  if (
                    !form.health ||
                    !form.temp ||
                    !Number.isFinite(health) ||
                    health < 0 ||
                    health > 100 ||
                    !Number.isFinite(temp) ||
                    temp < -20 ||
                    temp > 100
                  ) {
                    setError(
                      'Use a capacity from 0–100% and a temperature from −20–100°C.',
                    );
                    return;
                  }
                  const update = (b: (typeof initialBatteries)[number]) => ({
                    ...b,
                    cycles: b.cycles + 1,
                    health,
                    temp,
                    status: health < 80 ? 'Attention required' : 'Healthy',
                  });
                  setBatteries((bs) =>
                    bs.map((b) => (b.id === form.battery ? update(b) : b)),
                  );
                  if (detail?.kind === 'battery' && detail.id === form.battery)
                    setDetail({ ...detail, ...update(detail) });
                  setDialog('');
                  notify('Battery cycle and condition reading recorded.');
                }}
              >
                Record cycle
              </Button>
            </>
          )}
          {dialog === 'checkout' && (
            <>
              <Pick
                label="Assigned custodian"
                value={form.pilot}
                onChange={(v) => setForm({ ...form, pilot: v })}
                options={crew.map((c) => c.name)}
              />
              <div className="actions">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (detail.status === 'Maintenance due') {
                      setError(
                        'Complete maintenance before returning this equipment to service.',
                      );
                      return;
                    }
                    setAssets((as) =>
                      as.map((a) =>
                        a.id === detail.id
                          ? { ...a, status: 'Available', pilot: 'Unassigned' }
                          : a,
                      ),
                    );
                    setDetail({
                      ...detail,
                      status: 'Available',
                      pilot: 'Unassigned',
                    });
                    setDialog('');
                    notify('Equipment checked back in.');
                  }}
                >
                  Check in
                </Button>
                <Button
                  className="primary"
                  onClick={() => {
                    if (detail.status === 'Maintenance due') {
                      setError(
                        'This equipment is grounded pending maintenance.',
                      );
                      return;
                    }
                    setAssets((as) =>
                      as.map((a) =>
                        a.id === detail.id
                          ? { ...a, status: 'Checked out', pilot: form.pilot }
                          : a,
                      ),
                    );
                    setDetail({
                      ...detail,
                      status: 'Checked out',
                      pilot: form.pilot,
                    });
                    setDialog('');
                    notify('Custody assigned to ' + form.pilot + '.');
                  }}
                >
                  Confirm check-out
                </Button>
              </div>
            </>
          )}
          {dialog === 'connect' && (
            <>
              <div className="connect-brand">
                <span className="integration-logo">dji</span>
                <Link2 />
                <span className="aero-connect">A</span>
              </div>
              <div className="info-box">
                <ShieldCheck size={20} />
                <span>
                  This is a simulated connection. No credentials are collected
                  and no DJI account is accessed.
                </span>
              </div>
              <h3 className="form-section-label">Planned connection scope</h3>
              <ul className="scope-list">
                <li>
                  <Check size={16} /> Flight history and telemetry
                </li>
                <li>
                  <Check size={16} /> Aircraft and battery identifiers
                </li>
                <li>
                  <Check size={16} /> Pilot-specific sync status
                </li>
              </ul>
              <Button
                className="primary"
                onClick={() => {
                  setConnected((c) => [...new Set([...c, form.pilot])]);
                  setDialog('');
                  notify(
                    'Demo account linked for ' +
                      form.pilot +
                      '. Run demo sync to import a sample flight.',
                  );
                }}
              >
                Simulate account connection <ArrowRight size={16} />
              </Button>
              <p className="fine-print">
                The production authentication method will depend on the
                supported DJI API. A developer key alone has not yet been
                verified as sufficient.
              </p>
            </>
          )}
          {dialog === 'disconnect' && (
            <>
              <p>Disconnect the simulated DJI account for {form.pilot}?</p>
              <div className="actions">
                <Button variant="outline" onClick={() => setDialog('')}>
                  Cancel
                </Button>
                <Button
                  className="primary"
                  onClick={() => {
                    setConnected((c) => c.filter((n) => n !== form.pilot));
                    setDialog('');
                    notify('Demo account disconnected.');
                  }}
                >
                  Disconnect
                </Button>
              </div>
            </>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
