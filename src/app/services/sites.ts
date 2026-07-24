import { computed, Injectable, signal } from '@angular/core';
import { Site } from '../models/site';
import { SITES } from '../data/sites';

@Injectable({ providedIn: 'root' })
export class SitesService {
  readonly sites = signal<Site[]>(SITES);
  private _selectedSiteId = signal<string | null>(null);
  readonly selectedSiteId = this._selectedSiteId.asReadonly();
  readonly selectedSite = computed(() => 
    this.sites().find(s => s.id === this.selectedSiteId()) ?? null
  );
  selectSite(id: string) {
    this._selectedSiteId.set(id);
  }
}