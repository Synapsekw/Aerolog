'use client';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Label,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
const weekly = [
  { day: 'Mon', hours: 8.2, previous: 6.3 },
  { day: 'Tue', hours: 12.8, previous: 9 },
  { day: 'Wed', hours: 9.4, previous: 7.8 },
  { day: 'Thu', hours: 16.6, previous: 10.8 },
  { day: 'Fri', hours: 13.2, previous: 9.4 },
  { day: 'Sat', hours: 18.4, previous: 13.8 },
  { day: 'Sun', hours: 7.8, previous: 5.5 },
];
const monthly = [
  { day: 'Week 1', hours: 18.4, previous: 13.1 },
  { day: 'Week 2', hours: 22.6, previous: 19.4 },
  { day: 'Week 3', hours: 19.8, previous: 16.2 },
  { day: 'Week 4', hours: 25.6, previous: 21.8 },
];
const utilization = [
  { name: 'M350 RTK', hours: 38.6, color: '#d0f68b' },
  { name: 'Mavic 3T', hours: 24.2, color: '#7ed4c3' },
  { name: 'Mavic 3E', hours: 18.4, color: '#94a9ef' },
  { name: 'M300 RTK', hours: 5.2, color: '#b9a1d9' },
];
export default function DashboardCharts() {
  const [period, setPeriod] = useState('Week');
  return (
    <div className="dashboard-charts">
      <section className="glass activity-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">FLIGHT INTELLIGENCE</span>
            <h2>Time in the sky</h2>
          </div>
          <Tabs value={period} onValueChange={(v) => setPeriod(String(v))}>
            <TabsList>
              <TabsTrigger value="Week">Week</TabsTrigger>
              <TabsTrigger value="Month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="chart-summary">
          <strong>
            86.4<span>hrs</span>
          </strong>
          <span className="trend">
            <TrendingUp size={14} /> +
            {((86.4 / (period === 'Week' ? 62.6 : 70.5) - 1) * 100).toFixed(1)}%{' '}
            <small>vs previous {period.toLowerCase()}</small>
          </span>
          <span className="chart-legend">
            <i /> This {period.toLowerCase()}
            <i className="muted-dot" /> Previous
          </span>
        </div>
        <ChartContainer
          className="activity-chart"
          config={{
            hours: { label: 'Flight hours', color: '#d0f68b' },
            previous: { label: 'Previous period', color: '#84969b' },
          }}
        >
          <AreaChart
            accessibilityLayer
            data={period === 'Week' ? weekly : monthly}
            margin={{ top: 15, right: 12, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="activityGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c7f28a" stopOpacity={0.32} />
                <stop offset="95%" stopColor="#7ed4c3" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#ffffff0b"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tickMargin={12}
              fontSize={12}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={7}
              fontSize={11}
              tickFormatter={(v) => `${v}h`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="previous"
              stroke="#73898d"
              strokeWidth={1.5}
              strokeDasharray="4 5"
              fill="transparent"
            />
            <Area
              type="monotone"
              dataKey="hours"
              stroke="#d0f68b"
              strokeWidth={2.5}
              fill="url(#activityGlow)"
              activeDot={{
                r: 5,
                fill: '#d0f68b',
                stroke: '#23302c',
                strokeWidth: 3,
              }}
            />
          </AreaChart>
        </ChartContainer>
        <div className="chart-foot">
          <span>Sample operational analytics</span>
          <span>
            Peak activity{' '}
            <b>{period === 'Week' ? 'Saturday · 18.4h' : 'Week 4 · 25.6h'}</b>
          </span>
        </div>
      </section>
      <section className="glass utilization-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">FLEET PERFORMANCE</span>
            <h2>Aircraft utilization</h2>
          </div>
          <ArrowUpRight size={17} className="muted" />
        </div>
        <div className="utilization-total">
          <strong>4</strong>
          <span>
            active aircraft
            <br />
            <small>this month</small>
          </span>
        </div>
        <ChartContainer
          className="utilization-chart"
          config={{ hours: { label: 'Flight hours', color: '#c9ed83' } }}
        >
          <BarChart
            accessibilityLayer
            data={utilization}
            layout="vertical"
            margin={{ top: 0, right: 38, left: 0, bottom: 0 }}
            barSize={13}
          >
            <CartesianGrid horizontal={false} stroke="#ffffff08" />
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              axisLine={false}
              tickLine={false}
              width={82}
              fontSize={12}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar
              dataKey="hours"
              radius={[0, 5, 5, 0]}
              background={{ fill: '#ffffff05', radius: 5 }}
              label={{
                position: 'right',
                fill: '#b9c8c6',
                fontSize: 11,
                formatter: (v: any) => `${v}h`,
              }}
            >
              {utilization.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <div className="utilization-note">
          <span className="orb" />
          <span>
            Matrice 350 RTK leads the fleet
            <small>44.7% of total flight hours</small>
          </span>
        </div>
      </section>
    </div>
  );
}
