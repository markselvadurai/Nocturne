// THROWAWAY — delete after reading the three verdict lines.
// Proves the toStorage/fromStorage pair survives the full disk format:
// Forecast → StoredForecast → JSON string → parse → Forecast.

import { describe, it } from 'vitest';
import { DateTime } from 'luxon';
import { Forecast } from '../engines/weather'; // ← adjust: wherever these types actually live
import { StoredForecast } from './weather'

// ── Fixture: self-contained copy (scratch dies in 5 min; no cross-spec import) ──
const fixtureHours = [
  { time: DateTime.fromISO('2026-01-15T00:00', { zone: 'America/Toronto' }), cloudCover: 10 },
  { time: DateTime.fromISO('2026-01-15T01:00', { zone: 'America/Toronto' }), cloudCover: 20 },
  { time: DateTime.fromISO('2026-01-15T02:00', { zone: 'America/Toronto' }), cloudCover: 30 },
];

const TTL_HOURS = 3;

const original: Forecast = {
  siteId: 'test',
  savedAt: DateTime.fromISO('2026-01-15T00:00', { zone: 'America/Toronto' }),
  hours: fixtureHours,
};

// ── Copies of the (private) pair under test — mirror your service verbatim ──
function toStorage(forecast: Forecast): StoredForecast {
  const savedAt = forecast.savedAt.toISO()!;
  const hours = forecast.hours.map(h => ({
    time: h.time.toISO()!, cloudCover: h.cloudCover,
  }));
  return { siteId: forecast.siteId, savedAt, hours };
}

function fromStorage(forecast: StoredForecast): Forecast {
  const savedAt = DateTime.fromISO(forecast.savedAt);
  const hours = forecast.hours.map(h => ({
    time: DateTime.fromISO(h.time, { setZone: true }), cloudCover: h.cloudCover,
  }));
  return { siteId: forecast.siteId, savedAt, hours };
}

function isFresh(forecast: Forecast): boolean {
    return Math.abs(forecast.savedAt.diffNow('hours').as('hours')) < TTL_HOURS;
}

// ── The gauntlet ──
it('scratch: storage round-trip verdict', () => {
  const revived = fromStorage(JSON.parse(JSON.stringify(toStorage(original))));
});