'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { Button } from '@/components/ui/button';
import { Layers, Undo2, Trash2, MapPin } from 'lucide-react';
type Point = [number, number];
const EMPTY_POINTS: Point[] = [];
export default function MissionMap({
  points = EMPTY_POINTS,
  onChange,
  track = EMPTY_POINTS,
  height = 310,
  selectedPoint,
  altitudeValues,
}: {
  points?: Point[];
  onChange?: (points: Point[]) => void;
  track?: Point[];
  height?: number;
  selectedPoint?: Point;
  altitudeValues?: number[];
}) {
  const styleReady = useRef(false);
  const root = useRef<HTMLDivElement>(null),
    map = useRef<MapboxMap | null>(null),
    latest = useRef(points),
    latestTrack = useRef(track),
    heights = useRef(altitudeValues),
    change = useRef(onChange),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [satellite, setSatellite] = useState(false);
  latest.current = points;
  latestTrack.current = track;
  heights.current = altitudeValues;
  change.current = onChange;
  function draw() {
    const m = map.current;
    if (!m || !styleReady.current) return;
    const p = latest.current;
    const features: any[] = [];
    if (p.length >= 3)
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[...p, p[0]]] },
      });
    if (p.length >= 2)
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: p },
      });
    p.forEach((coord, i) =>
      features.push({
        type: 'Feature',
        properties: { label: String(i + 1) },
        geometry: { type: 'Point', coordinates: coord },
      }),
    );
    const source = m.getSource('mission') as any;
    if (source) source.setData({ type: 'FeatureCollection', features });
    else {
      m.addSource('mission', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      });
      m.addLayer({
        id: 'mission-area',
        type: 'fill',
        source: 'mission',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#cdef8f', 'fill-opacity': 0.17 },
      });
      m.addLayer({
        id: 'mission-lines',
        type: 'line',
        source: 'mission',
        filter: ['!=', ['geometry-type'], 'Point'],
        paint: { 'line-color': '#d5f59d', 'line-width': 2 },
      });
      m.addLayer({
        id: 'mission-points',
        type: 'circle',
        source: 'mission',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#d7faa3',
          'circle-stroke-color': '#172725',
          'circle-stroke-width': 2,
        },
      });
    }
    const route = latestTrack.current;
    const h = heights.current;
    const routeData: any =
      h?.length === route.length
        ? {
            type: 'FeatureCollection',
            features: route
              .slice(1)
              .map((p, i) => ({
                type: 'Feature',
                properties: { altitude: h[i] },
                geometry: { type: 'LineString', coordinates: [route[i], p] },
              })),
          }
        : {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: route },
          };
    if (route.length > 1) {
      const existing = m.getSource('flight-track') as any;
      if (existing) existing.setData(routeData);
      else {
        m.addSource('flight-track', { type: 'geojson', data: routeData });
        m.addLayer({
          id: 'flight-track-halo',
          type: 'line',
          source: 'flight-track',
          paint: {
            'line-color': '#102527',
            'line-width': 6,
            'line-opacity': 0.8,
          },
        });
        m.addLayer({
          id: 'flight-track',
          type: 'line',
          source: 'flight-track',
          paint: { 'line-color': '#8ad8e0', 'line-width': 3 },
        });
      }
      const min = h?.length ? Math.min(...h) : 0,
        max = h?.length ? Math.max(...h) : 1;
      m.setPaintProperty(
        'flight-track',
        'line-color',
        h?.length === route.length
          ? [
              'interpolate',
              ['linear'],
              ['get', 'altitude'],
              min,
              '#7dd3fc',
              Math.max(min + 0.01, max),
              '#d0f68b',
            ]
          : '#8ad8e0',
      );
    }
  }
  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver;
    import('mapbox-gl')
      .then(({ default: mb }) => {
        if (disposed || !root.current) return;
        const center: Point = points[0] || track[0] || [55.14, 25.078];
        const m = new mb.Map({
          container: root.current,
          accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
          style:
            process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL ||
            'mapbox://styles/mapbox/dark-v11',
          center,
          zoom: 13,
          attributionControl: true,
        });
        map.current = m;
        m.addControl(new mb.NavigationControl(), 'top-right');
        m.on('load', () => {
          if (disposed) return;
          setReady(true);
          draw();
          const coords = track.length ? track : points;
          if (coords.length > 1) {
            const bounds = new mb.LngLatBounds();
            coords.forEach((p) => bounds.extend(p));
            m.fitBounds(bounds, { padding: 50, maxZoom: 16 });
          }
        });
        m.on('style.load', () => {
          styleReady.current = true;
          draw();
        });
        m.on('click', (e) => {
          if (change.current)
            change.current([...latest.current, [e.lngLat.lng, e.lngLat.lat]]);
        });
        m.on('error', () =>
          setError('Map layer could not load. Check the token and connection.'),
        );
        ro = new ResizeObserver(() => m.resize());
        ro.observe(root.current);
      })
      .catch(() => setError('Mapbox failed to load.'));
    return () => {
      disposed = true;
      ro?.disconnect();
      map.current?.remove();
      map.current = null;
      styleReady.current = false;
    };
  }, []);
  useEffect(() => {
    draw();
  }, [points, track, altitudeValues, ready]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !selectedPoint) return;
    const data: any = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: selectedPoint },
    };
    const source = m.getSource('inspection-point') as any;
    if (source) source.setData(data);
    else {
      m.addSource('inspection-point', { type: 'geojson', data });
      m.addLayer({
        id: 'inspection-point',
        type: 'circle',
        source: 'inspection-point',
        paint: {
          'circle-radius': 7,
          'circle-color': '#fff',
          'circle-stroke-color': '#39cdd2',
          'circle-stroke-width': 3,
        },
      });
    }
  }, [selectedPoint, ready]);
  return (
    <div className="real-map" style={{ height }}>
      <div ref={root} className="map-canvas" />
      {error && (
        <div className="map-error" role="alert">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}
      <div className="map-tools">
        <Button
          type="button"
          variant="outline"
          disabled={!ready}
          aria-pressed={satellite}
          onClick={() => {
            const next = !satellite;
            setSatellite(next);
            const m = map.current;
            if (!m) return;
            // Toggle imagery within the existing style so route sources never disappear.
            if (!m.getSource('satellite-imagery')) {
              m.addSource('satellite-imagery', {
                type: 'raster',
                url: 'mapbox://mapbox.satellite',
                tileSize: 256,
              });
              m.addLayer(
                {
                  id: 'satellite-imagery',
                  type: 'raster',
                  source: 'satellite-imagery',
                  paint: { 'raster-fade-duration': 200 },
                },
                'mission-area',
              );
            }
            m.setLayoutProperty(
              'satellite-imagery',
              'visibility',
              next ? 'visible' : 'none',
            );
          }}
        >
          <Layers size={14} />
          {satellite ? 'Dark map' : 'Satellite'}
        </Button>
        {onChange && (
          <>
            <Button
              type="button"
              variant="outline"
              aria-label="Undo boundary point"
              disabled={!points.length}
              onClick={() => onChange(points.slice(0, -1))}
            >
              <Undo2 size={14} />
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-label="Clear boundary"
              disabled={!points.length}
              onClick={() => onChange([])}
            >
              <Trash2 size={14} />
            </Button>
          </>
        )}
      </div>
      {onChange && (
        <span className="map-instruction">
          <MapPin size={13} />
          {points.length < 3
            ? 'Click the map to define the mission boundary (3+ points).'
            : points.length + ' boundary points · click to extend'}
        </span>
      )}
    </div>
  );
}
