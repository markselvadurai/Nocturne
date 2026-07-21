import * as SunCalc from 'suncalc';
import { DateTime } from 'luxon';
import { Site } from '../models/site';

export interface DarknessWindow {
    start: DateTime | null;
    end: DateTime | null;
    hasTrueDarkness: boolean;
}

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
    // @types/suncalc types these as Date, but suncalc returns null when the sun
    // never reaches -18° below horizon (no astronomical darkness — high latitudes
    // in summer). Guarding despite the optimistic types.
}