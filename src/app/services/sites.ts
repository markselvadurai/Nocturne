import { computed, inject, Injectable, signal } from '@angular/core';
import { Site } from '../models/site';
import { SITES } from '../data/sites';
import { getDarknessWindow, getMoonOverlap } from '../engines/astronomy';
import { DateTime, Duration, Interval } from 'luxon';
import { WeatherService } from './weather';
import { computeScore, NightScore } from '../engines/scorer';
import { avgCloudDuring, CloudCoverResult, Forecast } from '../engines/weather';

type CloudData =
  | {
      cloudDataAvailable: true;
      cloudAvg: number;
    }
  | {
      cloudDataAvailable: false;
      cloudAvg: null;
    };

export type NightInfo =
  | { hasTrueDarkness: false }
  | ({
      hasTrueDarkness: true;

      darknessWindow: { start: DateTime; end: DateTime };
      civilDusk: DateTime;
      civilDawn: DateTime;
      moonSegments: Interval<true>[];
      darkDuration: string;
      moonIllumination: number;
      moonOverlapDisplay: string;
      score: number;
      tier: 'clear' | 'marginal' | 'poor';
      cloudHours : { time: DateTime; cloudCover: number }[]
    } & CloudData);

  export type ScoredNight = Extract<NightInfo, { hasTrueDarkness: true }>;

@Injectable({ providedIn: 'root' })
export class SitesService {
  readonly sites = signal<Site[]>(SITES);
  private weather = inject(WeatherService)
  private _selectedSiteId = signal<string | null>(null);
  readonly selectedSiteId = this._selectedSiteId.asReadonly();
  readonly selectedSite = computed(() => 
    this.sites().find(s => s.id === this.selectedSiteId()) ?? null
  );
  selectSite(id: string) {
    this._selectedSiteId.set(id);
  }

  readonly nightInfo = computed<NightInfo | null>(() => {
    const site = this.selectedSite();
    if (!site) return null;
    const TIER_CLEAR = 65;
    const TIER_MARGINAL = 35;
    const forecast = this.weather.siteForecast().get(site.id);

    const date = new Date(); // "tonight" = now; re-derives on selection only (v1 tradeoff)
    const darkness = getDarknessWindow(site, date);

    if (!darkness.hasTrueDarkness) return { hasTrueDarkness: false };
    const interval = Interval.fromDateTimes(darkness.start, darkness.end) as Interval<true>;
    const civilInterval = Interval.fromDateTimes(darkness.dusk, darkness.dawn) as Interval<true>;

    const clouds = this.weather.cloudsFor(site, interval);
    const cloudData: CloudData = clouds.available ? { cloudDataAvailable: true, cloudAvg: Math.round(clouds.avgCloud) } : { cloudDataAvailable: false, cloudAvg: null };

    const moon = getMoonOverlap(site, interval);
    const moonDisplay = getMoonOverlap(site, civilInterval);
    const moonOverlapDisplay = moon.overlapMinutes > 0 ? Duration.fromObject({ minutes: moon.overlapMinutes }).toFormat("h'h' m'm'") : 'Out of the way ✅';
    const result = computeScore(interval.length('hours'), moon.overlapFraction, moon.illuminationFraction, clouds);
    const score = result.score;

    return {
      hasTrueDarkness: true,
      darknessWindow: { start: darkness.start, end: darkness.end },
      civilDusk: darkness.dusk,
      civilDawn: darkness.dawn,
      moonSegments: moonDisplay.segments,
      darkDuration: darkness.end.diff(darkness.start).toFormat("h'h' m'm'"),
      moonIllumination: Math.round(moon.illuminationFraction * 100),
      moonOverlapDisplay,
      score,
      tier: score >= TIER_CLEAR ? 'clear' : score >= TIER_MARGINAL ? 'marginal' : 'poor',
       cloudHours: forecast?.hours.filter(h => civilInterval.contains(h.time)) ?? [],
      ...cloudData
    };
  });
}