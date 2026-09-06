import test from 'node:test';
import assert from 'node:assert/strict';
import {
  flightSamples,
  nearestSample,
  chartSamples,
} from '../lib/flight/analysis';
test('KML retains untimed point positions', () => {
  const { samples, timed } = flightSamples({
    flightTrack: [
      [48, 28, 5],
      [49, 29, 20],
    ],
  });
  assert.equal(timed, false);
  assert.equal(samples[1].x, 2);
  assert.equal(samples[1].time, undefined);
});
test('irregular timestamps use time rather than proportional sample position', () => {
  const { samples, timed } = flightSamples({
    telemetry: [0, 1, 90, 100].map((time) => ({
      time,
      longitude: 48,
      latitude: 28,
      altitude: 5,
    })),
  });
  assert(timed);
  assert.equal(nearestSample(samples, 50), 2);
});
test('nonmonotonic times cannot enable misleading playback', () => {
  assert.equal(
    flightSamples({
      telemetry: [2, 1].map((time) => ({
        time,
        longitude: 48,
        latitude: 28,
        altitude: 5,
      })),
    }).timed,
    false,
  );
});
test('display reduction retains voltage dip and altitude peak', () => {
  const { samples } = flightSamples({
    telemetry: Array.from({ length: 2000 }, (_, i) => ({
      time: i,
      longitude: 48,
      latitude: 28,
      altitude: i === 517 ? 110 : 40,
      voltage: i === 512 ? 10 : 20,
    })),
  });
  const data = chartSamples(samples, 10);
  assert(data.some((p) => p.index === 512));
  assert(data.some((p) => p.index === 517));
  assert.equal(data.at(-1)?.index, 1999);
});
test('display reduction preserves missing reading boundaries', () => {
  const { samples } = flightSamples({
    telemetry: Array.from({ length: 2000 }, (_, i) => ({
      time: i,
      longitude: 48,
      latitude: 28,
      altitude: 40,
      voltage: i === 517 ? undefined : 20,
    })),
  });
  const data = chartSamples(samples, 10);
  for (const index of [516, 517, 518])
    assert(data.some((p) => p.index === index));
});
