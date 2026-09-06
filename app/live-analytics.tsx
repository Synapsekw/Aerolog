'use client';
import { useState } from 'react';
import type { Flight } from '@/lib/domain/models';
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
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
export default function Analytics({ flights }: { flights: Flight[] }) {
  const [period, setPeriod] = useState('7 days');
  const days = period === '7 days' ? 7 : 30;
  const data = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      day: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      hours: Number(
        (
          flights
            .filter((f) => f.date === key)
            .reduce((n, f) => n + f.durationSeconds, 0) / 3600
        ).toFixed(2),
      ),
    };
  });
  const names = [...new Set(flights.map((f) => f.aircraft))],
    usage = names
      .map((name) => ({
        name,
        hours: Number(
          (
            flights
              .filter((f) => f.aircraft === name)
              .reduce((n, f) => n + f.durationSeconds, 0) / 3600
          ).toFixed(2),
        ),
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);
  return (
    <div className="dashboard-charts">
      <section className="glass">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">FLIGHT INTELLIGENCE</span>
            <h2>Time in the sky</h2>
          </div>
          <Tabs value={period} onValueChange={(v) => setPeriod(String(v))}>
            <TabsList>
              {['7 days', '30 days'].map((p) => (
                <TabsTrigger key={p} value={p}>
                  {p}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="chart-summary">
          <strong>
            {data.reduce((n, d) => n + d.hours, 0).toFixed(1)}
            <span>hrs</span>
          </strong>
          <span className="category-label">LAST {period.toUpperCase()}</span>
        </div>
        <ChartContainer
          className="activity-chart"
          config={{ hours: { label: 'Flight hours', color: '#d0f68b' } }}
        >
          <AreaChart
            data={data}
            margin={{ left: -15, right: 20, bottom: 0, top: 20 }}
          >
            <defs>
              <linearGradient id="flightGlow" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#c7f28a" stopOpacity={0.3} />
                <stop offset="1" stopColor="#c7f28a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#ffffff0c" />
            <XAxis
              dataKey="day"
              minTickGap={40}
              axisLine={false}
              tickLine={false}
            />
            <YAxis axisLine={false} tickLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey="hours"
              type="monotone"
              stroke="#d0f68b"
              strokeWidth={2.5}
              fill="url(#flightGlow)"
            />
          </AreaChart>
        </ChartContainer>
        <div className="chart-foot">Calculated from saved flight records</div>
      </section>
      <section className="glass">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">FLEET PERFORMANCE</span>
            <h2>Aircraft utilization</h2>
          </div>
        </div>
        {usage.length ? (
          <ChartContainer
            className="activity-chart"
            config={{ hours: { label: 'Flight hours', color: '#cdef95' } }}
          >
            <BarChart
              data={usage}
              layout="vertical"
              margin={{ left: 0, right: 20, top: 10, bottom: 10 }}
              barSize={14}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={125}
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="hours" radius={[0, 5, 5, 0]}>
                {usage.map((u, i) => (
                  <Cell
                    key={u.name}
                    fill={['#d0f68b', '#8ed8cf', '#a7b4ed', '#c8a4d9'][i % 4]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="empty-state">
            <h3>No flights recorded</h3>
            <p>Aircraft utilization appears after your first flight.</p>
          </div>
        )}
        <div className="chart-foot">
          {flights.length} flights across {names.length} aircraft
        </div>
      </section>
    </div>
  );
}
