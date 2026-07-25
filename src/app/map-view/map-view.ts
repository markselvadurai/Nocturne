import { Component, ElementRef, viewChild, AfterViewInit, OnDestroy, inject, signal, effect } from '@angular/core';
import * as L from 'leaflet';
import { SitesService } from '../services/sites';
import { WeatherService } from '../services/weather';

@Component({
  selector: 'app-map-view',
  imports: [],
  templateUrl: './map-view.html',
  styleUrl: './map-view.scss',
})
  
export class MapView implements AfterViewInit, OnDestroy {
  protected sitesService = inject(SitesService);
  mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private map!: L.Map;
  markers = new Map<string, L.Marker>();
  mapReady = signal(false);

  constructor() {
    effect(() => {
      if(!this.mapReady()) return;

      this.markers.forEach(m => m.remove());
      this.markers.clear();
      for (const site of this.sitesService.sites()) {
          const latlng = new L.LatLng(site.coordinates.lat, site.coordinates.lng);
          const siteMark = new L.Marker(latlng);
          this.markers.set(site.id, siteMark);
          siteMark.addTo(this.map);
          siteMark.on('click', () => this.sitesService.selectSite(site.id));
        }
    })
  }

  ngAfterViewInit() {
    this.map = new L.Map(this.mapContainer().nativeElement, {
      zoom: 9,
      center: [43.65, -79.38]
    });
    const tiles = new L.TileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    })
    tiles.addTo(this.map);
    this.mapReady.set(true);
  }

  ngOnDestroy() {
    this.map?.remove();
  }
}
