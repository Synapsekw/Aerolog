'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { Play, Pause, RotateCcw, Download } from 'lucide-react';
import MissionMap from './mission-map';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  flightSamples,
  nearestSample,
  chartSamples,
  trackGeoJSON,
} from '@/lib/flight/analysis';
export default function FlightAnalysis({ flight }: { flight: any }) {
  const { samples, timed } = useMemo(() => flightSamples(flight), [flight]);
  const data = useMemo(() => chartSamples(samples), [samples]);
  const path = useMemo(
    () => samples.map((p) => [p.longitude, p.latitude] as [number, number]),
    [samples],
  );
  const [cursor, setCursor] = useState(samples[0]?.x || 0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [color, setColor] = useState(false);
  const altitudes = useMemo(
    () => (color ? samples.map((p) => p.altitude) : undefined),
    [samples, color],
  );
  const first = samples[0]?.x || 0,
    last = samples.at(-1)?.x || 0;
  const sample = samples[nearestSample(samples, cursor)];
  useEffect(() => {
    if (!playing || !timed) return;
    let frame: number, previous: number | undefined;
    const tick = (now: number) => {
      if (previous !== undefined)
        setCursor((x) =>
          Math.min(last, x + ((now - previous!) / 1000) * speed),
        );
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, timed, speed, last]);
  useEffect(() => {
    if (cursor >= last) setPlaying(false);
  }, [cursor, last]);
  const exportRoute = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            trackGeoJSON(
              samples,
              flight.mission,
              flight.trackSource?.altitudeMode ||
                'source log height; datum unspecified',
            ),
            null,
            2,
          ),
        ],
        { type: 'application/geo+json' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = flight.id + '.geojson';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (samples.length < 2)
    return (
      <MissionMap
        points={
          flight.plannedBoundary?.length
            ? flight.plannedBoundary
            : flight.siteLocation
              ? [flight.siteLocation]
              : []
        }
        height={420}
      />
    );
  const fields = [
    ['altitude', 'Altitude profile', 'm', '#d0f68b'],
    ['battery', 'Battery drain', '%', '#7dd3fc'],
    ['voltage', 'Battery voltage', 'V', '#c4b5fd'],
    ['temperature', 'Battery temperature', '°C', '#fbbf24'],
    ['speed', 'Ground speed', 'm/s', '#5eead4'],
  ];
  return (
    <div className="flight-analysis">
      <MissionMap
        track={path}
        height={480}
        selectedPoint={sample ? [sample.longitude, sample.latitude] : undefined}
        altitudeValues={altitudes}
      />
      <section className="flight-chart-card analysis-controls">
        <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <strong>{timed ? 'Flight playback' : 'Route inspection'}</strong>
          <span className="fine-print">
            {timed
              ? 'Recorded sample times'
              : 'Untimed KML · point positions, not elapsed time'}
          </span>
          {timed && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  if (cursor >= last) setCursor(first);
                  setPlaying(!playing);
                }}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}{' '}
                {playing ? 'Pause' : 'Play'}
              </Button>
              <label>
                Speed{' '}
                <select
                  aria-label="Playback speed"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                >
                  {[0.5, 1, 2, 4, 8].map((n) => (
                    <option key={n} value={n}>
                      {n}×
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setPlaying(false);
              setCursor(first);
            }}
          >
            <RotateCcw size={16} />
            Reset
          </Button>
          <Button
            variant="outline"
            aria-pressed={color}
            onClick={() => setColor(!color)}
          >
            Color by altitude
          </Button>
          <Button variant="outline" onClick={exportRoute}>
            <Download size={16} />
            GeoJSON
          </Button>
        </div>
        <input
          className="route-slider"
          aria-label={timed ? 'Flight time' : 'Route point'}
          type="range"
          min={first}
          max={last}
          step={timed ? 0.1 : 1}
          value={cursor}
          onChange={(e) => {
            setPlaying(false);
            setCursor(Number(e.target.value));
          }}
        />
        <div className="analysis-values">
          <span>
            {timed
              ? `${(cursor - first).toFixed(1)} s`
              : `Point ${(sample?.index || 0) + 1} / ${samples.length}`}
          </span>
          <span>{sample?.altitude.toFixed(1)} m height</span>
          <span>
            {sample?.battery == null
              ? 'Battery unavailable'
              : sample.battery + '% battery'}
          </span>
          <span>
            {sample?.latitude.toFixed(6)}, {sample?.longitude.toFixed(6)}
          </span>
        </div>
      </section>
      <div className="flight-chart-grid">
        {fields.map(([key, title, unit, tint]) => {
          const present =
            samples.filter((p) => typeof (p as any)[key] === 'number').length >
            1;
          return (
            <section className="flight-chart-card" key={key}>
              <h2>{title}</h2>
              <p>
                {key === 'altitude' && !timed
                  ? 'Source KML height · ' +
                    (flight.trackSource?.altitudeMode || 'datum unspecified')
                  : timed
                    ? 'Recorded samples over flight time'
                    : 'No timed samples supplied'}
              </p>
              {present ? (
                <ChartContainer
                  className="flight-profile-chart"
                  config={{
                    [key]: { label: title + ' (' + unit + ')', color: tint },
                  }}
                >
                  <AreaChart
                    data={data}
                    onMouseMove={(state: any) => {
                      if (state.activeLabel != null) {
                        setPlaying(false);
                        setCursor(Number(state.activeLabel));
                      }
                    }}
                  >
                    <CartesianGrid vertical={false} stroke="#ffffff10" />
                    <XAxis
                      dataKey="x"
                      type="number"
                      domain={[first, last]}
                      minTickGap={45}
                      tickFormatter={(x) =>
                        timed
                          ? (x - first).toFixed(0) + 's'
                          : String(Math.round(x))
                      }
                    />
                    <YAxis
                      width={52}
                      domain={key === 'battery' ? [0, 100] : ['auto', 'auto']}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ReferenceLine x={cursor} stroke="#ffffff88" />
                    <Area
                      dataKey={key}
                      type="linear"
                      stroke={tint}
                      fill={tint + '25'}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flight-chart-empty">
                  <strong>No {title.toLowerCase()} samples</strong>
                  <span>
                    Import an original telemetry log with these readings to view
                    this chart.
                  </span>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
