import * as SunCalc from 'suncalc';
import { DateTime, Interval } from 'luxon';
import { Site } from '../models/site';

export type DarknessWindow = 
  | {
        hasTrueDarkness: true;
        start: DateTime;
        end: DateTime;
    }
  | {
        hasTrueDarkness: false;
        start: null;
        end: null;
    };

export type MoonOverlap =
  | {
      hasTrueDarkness: true;
      overlapMinutes: number;
      overlapFraction: number;
      illuminationFraction: number;
    }
  | {
      hasTrueDarkness: false;
      overlapMinutes: null;
      overlapFraction: null;
      illuminationFraction: null;
    };

export function getDarknessWindow(site: Site, date: Date) : DarknessWindow {
    const times = SunCalc.getTimes(date, site.coordinates.lat, site.coordinates.lng);

    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const nextDayTimes = SunCalc.getTimes(nextDay, site.coordinates.lat, site.coordinates.lng)
    const nightStart = times.night;
    const nightEnd = nextDayTimes.nightEnd;
    const hasTrueDarkness = nightStart != null && nightEnd != null

    if (!hasTrueDarkness) {
        return { start: null, end: null, hasTrueDarkness: false };
    }

    return {
        start: DateTime.fromJSDate(nightStart).setZone(site.timezone),
        end: DateTime.fromJSDate(nightEnd).setZone(site.timezone),
        hasTrueDarkness: true
    };
}

export function getMoonOverlap(site: Site, date: Date) : MoonOverlap {
    const darkness = getDarknessWindow(site, date);

    if (!darkness.hasTrueDarkness) {
         return { overlapMinutes: null, overlapFraction: null, illuminationFraction: null, hasTrueDarkness: false };
    }

    let isUp = SunCalc.getMoonPosition(darkness.start.toJSDate(), site.coordinates.lat, site.coordinates.lng).altitude >= 0.133;
    let segmentStart = darkness.start;
    let overlapValue = 0;
    const darknessInterval = Interval.fromDateTimes(darkness.start, darkness.end);
    const day1 = SunCalc.getMoonTimes(date, site.coordinates.lat, site.coordinates.lng);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const day2 = SunCalc.getMoonTimes(nextDay, site.coordinates.lat, site.coordinates.lng);
    const tz = site.timezone;
    const overlapEvents: DateTime[] = [];

    const addIfInWindow = (d: Date | undefined) => {
    if (!d) return;
    const dt = DateTime.fromJSDate(d, { zone: tz });
    if (darknessInterval.contains(dt)) overlapEvents.push(dt);
    };

    addIfInWindow(day1.rise);
    addIfInWindow(day1.set);
    addIfInWindow(day2.rise);
    addIfInWindow(day2.set);

    overlapEvents.sort((a, b) => a.toMillis() - b.toMillis());

    for (const transition of overlapEvents) {
        if (isUp) {
            overlapValue += transition.toMillis() - segmentStart.toMillis();
        }
        isUp = !isUp;
        segmentStart = transition;
    }
    if (isUp) overlapValue = overlapValue + darkness.end.toMillis() - segmentStart.toMillis();

    const windowMs = darknessInterval.length('millisecond');

    const overlapMinutes = overlapValue / 60000;
    const overlapFraction = ( overlapValue / windowMs );

    return { overlapMinutes: overlapMinutes, overlapFraction: overlapFraction, illuminationFraction: SunCalc.getMoonIllumination(darkness.start.toJSDate()).fraction, hasTrueDarkness: true};
}