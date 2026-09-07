'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
import type { Flight } from '@/lib/domain/models';
import { flightLocation } from '@/lib/flight/location';
import { Button } from '@/components/ui/button';
export default function FlightGlobe({
  flights,
  onOpen,
}: {
  flights: Flight[];
  onOpen: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null),
    map = useRef<MapboxMap | null>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [selected, setSelected] = useState<string[]>([]);
  const located = flights.filter((f) => flightLocation(f));
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    import('mapbox-gl')
      .then(({ default: mapbox }) => {
        if (disposed || !root.current) return;
        const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        if (!token) {
          setError(
            'Mapbox is not configured. Flight logs remain available in List view.',
          );
          return;
        }
        const m = new mapbox.Map({
          container: root.current,
          accessToken: token,
          style: 'mapbox://styles/mapbox/dark-v11',
          projection: 'globe',
          center: [45, 24],
          zoom: 1.3,
        });
        map.current = m;
        m.addControl(new mapbox.NavigationControl(), 'top-right');
        m.on('load', () => {
          m.setFog({
            color: '#101d28',
            'high-color': '#153647',
            'space-color': '#050b13',
            'star-intensity': 0.4,
          });
          m.addSource('flights', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          m.addLayer({
            id: 'flight-halos',
            type: 'circle',
            source: 'flights',
            paint: {
              'circle-radius': 13,
              'circle-color': '#cdef8f',
              'circle-opacity': 0.14,
            },
          });
          m.addLayer({
            id: 'flight-dots',
            type: 'circle',
            source: 'flights',
            paint: {
              'circle-radius': 5,
              'circle-color': '#d5f59d',
              'circle-stroke-color': '#10221b',
              'circle-stroke-width': 2,
            },
          });
          m.on('click', 'flight-dots', (e) => {
            setSelected([
              ...new Set(
                (e.features || []).map((f) =>
                  String(
                    (f as unknown as { properties?: { id?: string } })
                      .properties?.id,
                  ),
                ),
              ),
            ]);
          });
          m.on('mouseenter', 'flight-dots', () => {
            m.getCanvas().style.cursor = 'pointer';
          });
          m.on('mouseleave', 'flight-dots', () => {
            m.getCanvas().style.cursor = '';
          });
          setReady(true);
        });
        m.on('error', (e) => {
          if (
            e.error?.message?.includes('token') ||
            e.error?.message?.includes('Unauthorized')
          )
            setError(
              'Mapbox could not authorize this map. Check the map token.',
            );
        });
        observer = new ResizeObserver(() => m.resize());
        observer.observe(root.current);
      })
      .catch(() =>
        setError(
          'The globe could not load. Switch to List view to open your flights.',
        ),
      );
    return () => {
      disposed = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    (map.current?.getSource('flights') as GeoJSONSource)?.setData({
      type: 'FeatureCollection',
      features: flights.flatMap((f) => {
        const p = flightLocation(f);
        return p
          ? [
              {
                type: 'Feature' as const,
                properties: { id: f.id },
                geometry: { type: 'Point' as const, coordinates: p },
              },
            ]
          : [];
      }),
    });
  }, [flights, ready]);
  const choices = flights.filter((f) => selected.includes(f.id));
  return (
    <section className="glass flight-globe">
      <div className="row">
        <div>
          <span className="eyebrow">FLIGHT ATLAS</span>
          <h2>Your operations, around the world</h2>
          <p>
            {located.length} located flights · {flights.length - located.length}{' '}
            without coordinates. Select a dot to explore flights at that
            location.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => map.current?.flyTo({ center: [45, 24], zoom: 1.3 })}
        >
          Reset globe
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div
        ref={root}
        className="flight-globe-canvas"
        aria-label="Globe of recorded flight locations"
      />
      {choices.length > 0 && (
        <div className="globe-flight-choices">
          <h3>{choices.length} flights at this location</h3>
          {choices.map((f) => (
            <Button key={f.id} variant="outline" onClick={() => onOpen(f.id)}>
              {f.mission || f.id} · {f.date} · {f.pilot}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
