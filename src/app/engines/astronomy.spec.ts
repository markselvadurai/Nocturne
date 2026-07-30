import { describe, it, expect } from 'vitest';
import { getDarknessWindow, getMoonOverlap } from './astronomy';
import { Site } from '../models/site';
import { DateTime, Interval } from 'luxon';

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
  const augNight = new Date(Date.UTC(2026, 7, 12, 12, 0, 0)); // Aug 12 2026, noon UTC
  const augNight5 = new Date(Date.UTC(2026, 7, 5, 12, 0));
describe('getDarknessWindow', () => {
 
  // ── LAYER 1: property/invariant tests ──
 
  it('returns times in the site timezone', () => {
    const w = getDarknessWindow(manitoulin, augNight);
    if (!w.hasTrueDarkness) throw new Error('expected darkness');
    expect(w.start.zoneName).toBe('America/Toronto');
    expect(w.end.zoneName).toBe('America/Toronto');
    expect(w.dusk.zoneName).toBe('America/Toronto');
    expect(w.dawn.zoneName).toBe('America/Toronto');
  });
 
  it('darkness ends after it starts', () => {
    const w = getDarknessWindow(manitoulin, augNight);
    if (!w.hasTrueDarkness) throw new Error('expected darkness');
    expect(w.end > w.start).toBe(true);
  });
 
  // Civil twilight brackets true darkness: the sun passes −6° before −18°
  // in the evening, and −18° before −6° at dawn. This ordering is the axis
  // contract the Night Strip renders against.
  it('civil twilight brackets the darkness window', () => {
    const w = getDarknessWindow(manitoulin, augNight);
    if (!w.hasTrueDarkness) throw new Error('expected darkness');
    expect(w.dusk < w.start).toBe(true);
    expect(w.end < w.dawn).toBe(true);
  });
 
  it('darkness starts in the evening and ends before dawn', () => {
    const w = getDarknessWindow(manitoulin, augNight);
    if (!w.hasTrueDarkness) throw new Error('expected darkness');
    expect(w.start.hour).toBeGreaterThanOrEqual(21); // after 9pm site time
    expect(w.end.hour).toBeLessThanOrEqual(6);       // before 6am site time
  });
 
  // ── LAYER 2: accuracy against independent sources ──
 
  it('matches known astronomical twilight times for Manitoulin', () => {
    const w = getDarknessWindow(manitoulin, augNight5);
    if (!w.hasTrueDarkness) throw new Error('expected darkness');
 
    // From dqydj astronomical twilight calc for 45.6621,-81.9679 on Aug 5:
    //   night begins (PM astronomical band ENDS): ~10:58 PM
    //   night ends   (AM astronomical band STARTS): ~4:12 AM
    // Assert within a few minutes to absorb differing constants between tools.
    const expectedStart = DateTime.fromISO('2026-08-05T22:58', { zone: 'America/Toronto' });
    const expectedEnd = DateTime.fromISO('2026-08-06T04:14', { zone: 'America/Toronto' });
 
    expect(Math.abs(w.start.diff(expectedStart, 'minutes').minutes)).toBeLessThanOrEqual(5);
    expect(Math.abs(w.end.diff(expectedEnd, 'minutes').minutes)).toBeLessThanOrEqual(5);
  });
 
  // ── No-true-darkness branch ──
 
  it('reports no true darkness at high latitude in the summer', () => {
    const arcticSite: Site = { ...manitoulin, coordinates: { lat: 69, lng: 18 }, timezone: 'Europe/Oslo' };
    const midsummer = new Date(Date.UTC(2026, 5, 21, 12, 0));
    const w = getDarknessWindow(arcticSite, midsummer);
    expect(w.hasTrueDarkness).toBe(false);
    expect(w.start).toBeNull();
    expect(w.end).toBeNull();
    // At 69°N midsummer the sun never reaches −6° either — the current
    // all-or-nothing branch nulls the civil pair along with the astro pair.
    expect(w.dusk).toBeNull();
    expect(w.dawn).toBeNull();
  });
});

/** Author a window on a given night, in the site's zone. */
const nightWindow = (isoStart: string, isoEnd: string) =>
  Interval.fromDateTimes(
    DateTime.fromISO(isoStart, { zone: manitoulin.timezone }) as DateTime<true>,
    DateTime.fromISO(isoEnd, { zone: manitoulin.timezone }) as DateTime<true>
  ) as Interval<true>;
 
// Six windows across a lunar month — same spread as before, but the bounds are
// ours, not the darkness engine's. Roughly plausible summer dark windows.
const testWindows = [
  nightWindow('2026-08-05T22:45', '2026-08-06T04:15'),
  nightWindow('2026-08-09T22:50', '2026-08-10T04:10'),
  nightWindow('2026-08-12T22:55', '2026-08-13T04:05'),
  nightWindow('2026-08-19T23:05', '2026-08-20T03:55'),
  nightWindow('2026-08-24T23:15', '2026-08-25T03:45'),
  nightWindow('2026-08-31T23:25', '2026-09-01T03:35'),
];

describe('getMoonOverlap', () => {
 
  // ── LAYER 1: invariants — hold for ANY window ──
 
  it.each(testWindows)('overlapFraction is a valid fraction for %s', (window) => {
    const w = getMoonOverlap(manitoulin, window);
    expect(w.overlapFraction).toBeGreaterThanOrEqual(0);
    expect(w.overlapFraction).toBeLessThanOrEqual(1);
  });
 
  it.each(testWindows)('overlapMinutes stays within the window for %s', (window) => {
    const w = getMoonOverlap(manitoulin, window);
    expect(w.overlapMinutes).toBeGreaterThanOrEqual(0);
    expect(w.overlapMinutes).toBeLessThanOrEqual(window.length('minutes'));
  });
 
  it.each(testWindows)('illuminationFraction is a valid fraction for %s', (window) => {
    const w = getMoonOverlap(manitoulin, window);
    expect(w.illuminationFraction).toBeGreaterThanOrEqual(0);
    expect(w.illuminationFraction).toBeLessThanOrEqual(1);
  });
 
  it.each(testWindows)('minutes and fraction agree for %s', (window) => {
    const w = getMoonOverlap(manitoulin, window);
    expect(w.overlapMinutes).toBeCloseTo(w.overlapFraction * window.length('minutes'), 5);
  });
 
  // ── Decoupling proof: nothing about this window is astronomical ──
 
  it('works on an arbitrary window that is not a darkness window', () => {
    const w = getMoonOverlap(manitoulin, nightWindow('2026-08-12T13:00', '2026-08-12T19:00'));
    expect(w.overlapFraction).toBeGreaterThanOrEqual(0);
    expect(w.overlapFraction).toBeLessThanOrEqual(1);
    expect(w.overlapMinutes).toBeCloseTo(w.overlapFraction * 360, 5); // 6h window
  });
 
  // ── LAYER 2: precision, against independent sources ──
 
  it('matches known moon overlap for Manitoulin, Apr 13 2027', () => {
    // Darkness window 22:00 → 03:41(+1) per dqydj; bounds hardcoded so this
    // test does not depend on the darkness engine.
    // Moonrise 11:37am day N, moonset 03:41am day N+1 (timeanddate.com).
    // Moon is already up at window open and sets at 03:41 → 22:00→03:41 = 341 min.
    const window = nightWindow('2027-04-13T22:00', '2027-04-14T04:57');
    const w = getMoonOverlap(manitoulin, window);
    expect(Math.abs(w.overlapMinutes - 341)).toBeLessThanOrEqual(5);
  });
});