import { Component, ElementRef, viewChild, AfterViewInit, OnDestroy } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-map-view',
  imports: [],
  templateUrl: './map-view.html',
  styleUrl: './map-view.scss',
})
  
export class MapView implements AfterViewInit, OnDestroy {
  mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private map!: L.Map;

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
  }

  ngOnDestroy() {
    this.map?.remove();

  }
}
