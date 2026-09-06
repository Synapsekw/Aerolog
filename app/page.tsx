'use client';
import { useState } from 'react';
import { Airspace, Status } from './shared';
import Operations, { initialMissions, type Mission } from './operations';
import DashboardCharts from './dashboard-charts';
import {
  LayoutDashboard,
  Map,
  Drone,
  BookOpen,
  Wrench,
  Battery,
  Users,
  Plug,
  ArrowUpRight,
  ArrowRight,
  Plus,
  ChevronRight,
  Bell,
  Search,
  Wind,
  Sun,
  ShieldCheck,
  Clock,
  Crosshair,
  Layers,
  Check,
  Activity,
  CalendarDays,
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
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
const navigation = [
  ['Overview', LayoutDashboard],
  ['Missions', Map],
  ['Flight logs', BookOpen],
  ['Inventory', Drone],
  ['Maintenance', Wrench],
  ['Batteries', Battery],
  ['Crew', Users],
  ['Integrations', Plug],
] as const;
export default function Home() {
  const [page, setPage] = useState('Overview');
  const [newMissionKey, setNewMissionKey] = useState(0);
  const [dashboardMissions, setDashboardMissions] =
    useState<Mission[]>(initialMissions);
  const subtitles: Record<string, string> = {
    Overview: 'Your fleet, your people, your next move.',
    Missions: 'Plan with clarity. Fly with confidence.',
    'Flight logs': 'The complete story behind every flight.',
    Inventory: 'Every asset accounted for. Every mission equipped.',
    Maintenance: 'Keep your fleet ready for what’s next.',
    Batteries: 'A deeper understanding of every charge cycle.',
    Crew: 'The people behind your operations.',
    Integrations: 'Connect your flight data to the bigger picture.',
  };
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
            <span className="workspace-icon">S</span>
            <div>
              Skyline Operations<small>Enterprise workspace</small>
            </div>
            <ChevronRight size={14} />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <p className="nav-label">WORKSPACE</p>
          <SidebarMenu>
            {navigation.map(([label, Icon]) => (
              <SidebarMenuItem key={label}>
                <SidebarMenuButton
                  isActive={page === label}
                  onClick={() => setPage(label)}
                  className="nav-item"
                  tooltip={label}
                >
                  <Icon />
                  <span>{label}</span>
                  {label === 'Missions' && (
                    <b className="nav-count">{dashboardMissions.length}</b>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="fleet-online">
            <i />
            <span>Fleet systems operational</span>
          </div>
          <div className="profile">
            <span className="avatar">DJ</span>
            <div>
              Danijel Jovanovic<small>Operations manager</small>
            </div>
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
            <span className="demo-badge">DEMO WORKSPACE</span>
            <span className="date">
              <CalendarDays size={15} /> Sep 6, 2026
            </span>
            <span className="avatar small">DJ</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR OPERATIONS, IN SYNC</div>
              <h1>{page === 'Overview' ? 'Command center' : page}</h1>
              <p>{subtitles[page]}</p>
            </div>
            <Button
              className="primary"
              onClick={() => {
                setPage('Missions');
                setNewMissionKey((k) => k + 1);
              }}
            >
              <Plus size={17} /> Plan a mission
            </Button>
          </div>
          <div style={{ display: page === 'Overview' ? 'block' : 'none' }}>
            <div className="stats">
              {[
                [
                  'Missions in workspace',
                  String(dashboardMissions.length),
                  'Planned, approved and completed',
                  Map,
                ],
                ['Flight time', '86.4', 'hours this month', Clock],
                ['Fleet readiness', '75%', '3 of 4 aircraft ready', Drone],
                [
                  'Safety record',
                  '100%',
                  'incident-free missions',
                  ShieldCheck,
                ],
              ].map(([label, value, note, Icon]: any) => (
                <div className="stat glass" key={label}>
                  <div className="stat-label">
                    {label}
                    <Icon size={18} />
                  </div>
                  <div className="stat-value">
                    {value}
                    <svg viewBox="0 0 100 35">
                      <path d="M0 30L10 24L20 27L30 19L40 22L50 10L60 16L70 7L80 12L90 3L100 5" />
                    </svg>
                  </div>
                  <small>{note}</small>
                </div>
              ))}
            </div>
            <DashboardCharts />
            <div className="overview-grid">
              <section className="glass map-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Operational airspace</h2>
                    <p>Dubai, United Arab Emirates</p>
                  </div>
                  <span className="live">
                    <i /> MISSION PREVIEW
                  </span>
                </div>
                <Airspace />
                <div className="weather">
                  <span>
                    <Sun size={19} /> 32°C <small>Clear skies</small>
                  </span>
                  <span>
                    <Wind size={18} /> 12 km/h <small>NW</small>
                  </span>
                  <span>
                    <Activity size={17} /> 10 km <small>Visibility</small>
                  </span>
                  <Status>Sample conditions</Status>
                </div>
              </section>
              <section className="glass attention">
                <div className="panel-heading">
                  <h2>Needs your attention</h2>
                  <span className="count">3</span>
                </div>
                {[
                  [
                    'Mission package ready',
                    'Marina facade inspection',
                    'Review package',
                    'Missions',
                    ShieldCheck,
                  ],
                  [
                    'Battery health alert',
                    'TB65–008 · 78% capacity',
                    'Inspect battery',
                    'Batteries',
                    Battery,
                  ],
                  [
                    'Service approaching',
                    'Matrice 350 RTK · 4h remaining',
                    'View maintenance',
                    'Maintenance',
                    Wrench,
                  ],
                ].map(([title, sub, action, target, Icon]: any) => (
                  <button
                    key={title}
                    className="attention-item"
                    onClick={() => setPage(target)}
                  >
                    <span className="attention-icon">
                      <Icon size={18} />
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{sub}</p>
                      <span>
                        {action} <ArrowRight size={13} />
                      </span>
                    </div>
                  </button>
                ))}
              </section>
            </div>
            <section className="glass missions-preview">
              <div className="panel-heading">
                <div>
                  <h2>Upcoming missions</h2>
                  <p>From planning to takeoff, all in one place.</p>
                </div>
                <Button variant="ghost" onClick={() => setPage('Missions')}>
                  All missions <ArrowUpRight size={16} />
                </Button>
              </div>
              <div className="mission-cards">
                {dashboardMissions
                  .filter((m) => m.status !== 'Completed')
                  .slice(0, 3)
                  .map((m) => [
                    m.id,
                    m.name,
                    m.location,
                    m.date.slice(5) + ' · ' + m.time,
                    m.status,
                  ])
                  .map(([id, title, place, date, status]) => (
                    <button
                      className="mission-card"
                      key={id}
                      onClick={() => setPage('Missions')}
                    >
                      <div className="row">
                        <span className="mono">{id}</span>
                        <Status>{status}</Status>
                      </div>
                      <h3>{title}</h3>
                      <p>
                        <Map size={14} />
                        {place}
                      </p>
                      <div className="mission-bottom">
                        <span>
                          <Clock size={14} />
                          {date}
                        </span>
                        <ArrowUpRight size={18} />
                      </div>
                    </button>
                  ))}
              </div>
            </section>
          </div>
          <Operations
            page={page}
            setPage={setPage}
            newMissionKey={newMissionKey}
            onMissionsChange={setDashboardMissions}
          />
          <div className="footer-note">
            <span>
              <i /> Demo data · changes last for this session.
            </span>
            <span>AEROLOG / READY FOR WHAT’S NEXT</span>
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
}
