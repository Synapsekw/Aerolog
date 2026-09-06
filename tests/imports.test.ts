import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTextImport } from '../lib/domain/imports';
void test('CSV uses seconds and kilometres, preserves quoted notes and unknown battery charge', () => {
  const r = parseTextImport(
    'date,durationSeconds,distanceKm,notes\n2026-09-06,125,1.25,"wind, light"\n',
    'csv',
  ).flights[0];
  assert.equal(r.duration, '2:05');
  assert.equal(r.distance, '1.25');
  assert.equal(r.notes, 'wind, light');
  assert.equal(r.start, null);
});
void test('duplicate source records have deterministic hashes independent of generated IDs', () => {
  const csv = 'date,durationSeconds\n2026-09-06,100';
  const a = parseTextImport(csv, 'csv').flights[0],
    b = parseTextImport(csv, 'csv').flights[0];
  assert.equal(a.importHash, b.importHash);
  assert.notEqual(a.id, b.id);
});
void test('invalid flight durations fail instead of reducing fleet hours', () => {
  assert.throws(() =>
    parseTextImport('date,durationSeconds\n2026-09-06,-100', 'csv'),
  );
  assert.throws(() =>
    parseTextImport('date,durationSeconds\n2026-02-30,100', 'csv'),
  );
});
void test('normalized JSON converts metres and preserves telemetry', () => {
  const r = parseTextImport(
    JSON.stringify({
      date: '2026-09-06',
      durationSeconds: 120,
      distanceMeters: 2500,
      telemetry: [
        { time: 1, longitude: 55, latitude: 25, altitude: 60, battery: 80 },
      ],
    }),
    'json',
  ).flights[0];
  assert.equal(r.distance, '2.5');
  assert.equal(r.telemetry[0].battery, 80);
});
void test('telemetry CSV imports one flight with explicit unit conversion and irregular times', () => {
  const csv='time(millisecond),datetime(utc),latitude,longitude,altitude(feet),speed(mph),battery_percent,voltage,battery_temperature(f)\n0,2026-09-06 10:00:00,25,55,100,10,98,24,86\n1000,2026-09-06 10:00:01,25.0001,55,120,20,97,23.9,87\n10000,2026-09-06 10:00:10,25.0002,55,110,0,95,23.7,88';
  const {flights}=parseTextImport(csv,'csv');
  assert.equal(flights.length,1);
  const f=flights[0];
  assert.equal(f.startedAt,'2026-09-06T10:00:00Z');
  assert.equal(f.durationSeconds,10);
  assert.equal(f.telemetry.length,3);
  assert.equal(f.telemetry[0].altitude,30.48);
  assert.equal(f.telemetry[0].speed,4.4704);
  assert.equal(f.telemetry[0].temperature,30);
  assert.equal(f.telemetry[2].time,10);
  assert(Number(f.distance)>0.022 && Number(f.distance)<0.023);
});
void test('telemetry adapter rejects unknown units and clock resets',()=>{
  const prefix='time(millisecond),datetime(utc),latitude,longitude,altitude(furlongs)\n';
  const rows='0,2026-09-06 10:00:00,25,55,100\n1000,2026-09-06 10:00:01,25,55,110';
  assert.throws(()=>parseTextImport(prefix+rows,'csv'),/Unsupported unit/);
  assert.throws(()=>parseTextImport((prefix+rows).replace('furlongs','meters').replace('1000,2026','0,2026'),'csv'),/strictly increasing/);
});
void test('normalized imports retain separate battery packs and exact identity',()=>{
  const record={date:'2026-09-06',startedAt:'2026-09-06T10:00:00+04:00',aircraftSerial:'DRONE-1',batterySerials:['PACK-1','PACK-2'],durationSeconds:20,telemetry:[{time:1,longitude:55,latitude:25,altitude:4,batteryPacks:[{serial:'PACK-1',fullCapacityMah:5000,designCapacityMah:6000,cellVoltages:[4.1,4.0]},{serial:'PACK-2',fullCapacityMah:5500,designCapacityMah:6000}]}]};
  const f=parseTextImport(JSON.stringify(record),'json').flights[0];
  assert.equal(f.aircraftSerial,'DRONE-1');
  assert.equal(f.startedAt,record.startedAt);
  assert.deepEqual(f.batterySerials,record.batterySerials);
  assert.equal(f.telemetry[0].batteryPacks?.[0].fullCapacityMah,5000);
  assert.equal(f.telemetry[0].batteryPacks?.[1].fullCapacityMah,5500);
});
