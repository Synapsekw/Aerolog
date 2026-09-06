"""Parse a local DJI flight record. Credentials stay in the child environment."""
import sys, os, json, math
from pydjirecord import DJILog
try:
    log = DJILog.from_bytes(sys.stdin.buffer.read(25 * 1024 * 1024 + 1))
    chains = log.fetch_keychains(os.environ.get('DJI_APP_KEY', ''), cache=False) if log.version >= 13 else None
    frames = log.frames(chains)
    points = []
    stride = max(1, math.ceil(len(frames) / 15000))
    for f in frames[::stride]:
        o, b = f.osd, f.battery
        if not o.is_gpd_used or o.gps_level < 3 or (o.latitude == 0 and o.longitude == 0):
            continue
        points.append(dict(time=o.fly_time, longitude=o.longitude, latitude=o.latitude, altitude=o.height,
                           battery=b.charge_level, temperature=b.temperature, voltage=b.voltage, speed=o.h_speed))
    detail = log.details
    result = dict(date=detail.start_time.date().isoformat(), durationSeconds=max([f.osd.fly_time for f in frames] or [detail.total_time]),
                  distanceMeters=frames[-1].osd.cumulative_distance if frames else detail.total_distance,
                  altitude=max([f.osd.height for f in frames] or [detail.max_height]),
                  aircraft=detail.aircraft_name or 'Unassigned aircraft',
                  start=frames[0].battery.charge_level if frames else None,
                  end=frames[-1].battery.charge_level if frames else None,
                  peakTemperature=max([f.battery.temperature for f in frames] or [0]), telemetry=points,
                  notes='Parsed DJI record v' + str(log.version) + '. Aircraft serial: ' + (detail.aircraft_sn or 'not recorded'))
    print(json.dumps(result, allow_nan=False))
except Exception:
    # Never echo provider responses, headers or account details into logs.
    print(json.dumps({'error': 'DJI record could not be decoded. Check the file version and Open API flight-record parsing entitlement.'}))
    sys.exit(1)
