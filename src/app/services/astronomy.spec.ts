import { describe, it, expect } from 'vitest';
import { getDarknessWindow } from './astronomy';
import { Site } from '../models/site';
import { DateTime } from 'luxon';

// a minimal test site — only the fields the function uses
const manitoulin: Site = {
  id: 'manitoulin-eco-park',
  name: 'Manitoulin Eco Park',
  description: '',
  coordinates: { lat: 45.6621, lng: -81.9679 },
  nearestTown: { driveDistanceKm: 16, name: 'Manitowaning' },
  timezone: 'America/Toronto',
  bortle: 2,
};

describe('getDarknessWindow', () => {
  const augNight = new Date(Date.UTC(2026, 7, 12, 12, 0, 0)); // Aug 12 2026, noon UTC

  // LAYER 1 — property/invariant tests (robust)
  it('returns times in the site timezone', () => {
    const w = getDarknessWindow(manitoulin, augNight);
    expect(w.hasTrueDarkness).toBe(true);
    expect(w.start?.zoneName).toBe('America/Toronto');
    expect(w.end?.zoneName).toBe('America/Toronto');
  });

  it('darkness ends after it starts', () => {
    const w = getDarknessWindow(manitoulin, augNight);
    expect(w.end! > w.start!).toBe(true);
  });

  it('darkness starts in the evening and ends before dawn', () => {
    const w = getDarknessWindow(manitoulin, augNight);
    expect(w.start!.hour).toBeGreaterThanOrEqual(21); // after 9pm site time
    expect(w.end!.hour).toBeLessThanOrEqual(6);        // before 6am site time
  });

  // LAYER 2 — accuracy test against a known value (precise)
  it('matches known astronomical twilight times for Manitoulin', () => {
    const augNight5 = new Date(Date.UTC(2026, 7, 5, 12, 0));
    const w = getDarknessWindow(manitoulin, augNight5);

    // From dqydj astronomical twilight calc for 45.6621,-81.9679 on Aug 5:
    //   night begins (PM astronomical band ENDS): ~10:58 PM
    //   night ends   (AM astronomical band STARTS): ~4:12 AM
    // Assert within a few minutes to absorb differing constants between tools.

    const expectedStart = DateTime.fromISO('2026-08-05T22:58', { zone: 'America/Toronto' });
    const expectedEnd = DateTime.fromISO('2026-08-06T04:14', { zone: 'America/Toronto' });

    const startDiffMin = Math.abs(w.start!.diff(expectedStart, 'minutes').minutes);
    expect(startDiffMin).toBeLessThanOrEqual(5);

    const endDiffMin = Math.abs(w.end!.diff(expectedEnd, 'minutes').minutes);
    expect(endDiffMin).toBeLessThanOrEqual(5);
  });

  //testing no true darkness:
  it('reports no true darkness at high latitude in the summer', () => {
    const arcticSite: Site = { ...manitoulin, coordinates: { lat: 69, lng: 18 }, timezone: 'Europe/Oslo' };
    const midsummer = new Date(Date.UTC(2026, 5, 21, 12, 0));
    const w = getDarknessWindow(arcticSite, midsummer);
    expect(w.hasTrueDarkness).toBe(false);
    expect(w.start).toBeNull();
    expect(w.end).toBeNull();
  });
});