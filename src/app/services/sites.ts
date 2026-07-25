import { computed, inject, Injectable, signal } from '@angular/core';
import { Site } from '../models/site';
import { SITES } from '../data/sites';
import { getDarknessWindow, getMoonOverlap } from '../engines/astronomy';
import { DateTime, Duration, Interval } from 'luxon';
import { WeatherService } from './weather';
import { computeScore, NightScore } from '../engines/scorer';
import { avgCloudDuring, CloudCoverResult } from '../engines/weather';

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
      darkDuration: string;
      moonIllumination: number;
      moonOverlapDisplay: string;
      score: number;
    } & CloudData);

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

    const date = new Date(); // "tonight" = now; re-derives on selection only (v1 tradeoff)
    const darkness = getDarknessWindow(site, date);

    if (!darkness.hasTrueDarkness) return { hasTrueDarkness: false };
    const interval = Interval.fromDateTimes(darkness.start, darkness.end);

    const clouds = this.weather.cloudsFor(site, interval);
    const cloudData: CloudData = clouds.available ? { cloudDataAvailable: true, cloudAvg: Math.round(clouds.avgCloud) } : { cloudDataAvailable: false, cloudAvg: null };

    const moon = getMoonOverlap(site, date);
    if (!moon.hasTrueDarkness) return { hasTrueDarkness: false }; 

    const moonOverlapDisplay = moon.overlapMinutes > 0 ? Duration.fromObject({ minutes: moon.overlapMinutes }).toFormat("h'h' m'm'") : 'Out of the way ✅';
    const result = computeScore(interval.length('hours'), moon.overlapFraction, moon.illuminationFraction, clouds);
    const score = result.score;

    return {
      hasTrueDarkness: true,
      darknessWindow: { start: darkness.start, end: darkness.end },
      darkDuration: darkness.end.diff(darkness.start).toFormat("h'h' m'm'"),
      moonIllumination: Math.round(moon.illuminationFraction * 100),
      moonOverlapDisplay,
      score,
      ...cloudData
    };
  });
}