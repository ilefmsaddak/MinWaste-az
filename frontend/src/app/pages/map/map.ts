import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet.heat';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { NavBar } from '../../components/nav-bar/nav-bar';
import { AnnonceData, AnnonceDataService } from '../../services/annonce-data.service';
import { SlugService } from '../../services/slug.service';

@Component({
  selector: 'app-map-page',
  standalone: true,
  imports: [CommonModule, NavBar],
  templateUrl: './map.html',
  styleUrl: './map.scss',
})
export class MapPage implements OnInit, AfterViewInit, OnDestroy {
  annoncesWithLocation: AnnonceData[] = [];
  isLoading = false;
  error: string | null = null;

  private map: L.Map | null = null;
  private markersLayer: L.LayerGroup = L.layerGroup();
  private heatLayer: L.Layer | null = null;
  private annoncesSubscription: Subscription | null = null;

  constructor(
    private readonly annonceDataService: AnnonceDataService,
    private readonly router: Router,
    private readonly slugService: SlugService,
  ) {}

  ngOnInit(): void {
    this.loadAnnonces();
  }

  ngAfterViewInit(): void {
    // Don't initialize map here - it will be initialized when data is loaded
  }

  ngOnDestroy(): void {
    this.annoncesSubscription?.unsubscribe();
    this.map?.remove();
  }

  loadAnnonces(): void {
    this.isLoading = true;
    this.error = null;

    this.annoncesSubscription = this.annonceDataService.getAnnonces().subscribe({
      next: (annonces) => {
        this.annoncesWithLocation = annonces.filter(
          (annonce) =>
            annonce.location !== undefined &&
            Number.isFinite(annonce.location.lat) &&
            Number.isFinite(annonce.location.lng)
        );

        this.isLoading = false;
        
        // Initialize map only after data is loaded and DOM is updated
        setTimeout(() => {
          this.initMap();
          this.refreshMapLayers();
        }, 0);
      },
      error: (err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.error = `Failed to load annonce locations: ${message}`;
        this.isLoading = false;
      },
    });
  }

  initMap(): void {
    if (this.map) {
      return;
    }

    // Verify that container exists before initializing
    const container = document.getElementById('annonces-map');
    if (!container) {
      console.warn('Map container not found, skipping initialization');
      return;
    }

    this.map = L.map('annonces-map', {
      center: [36.8065, 10.1815],
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    this.markersLayer.addTo(this.map);
  }

  refreshMapLayers(): void {
    if (!this.map) {
      return;
    }

    this.markersLayer.clearLayers();

    if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer);
      this.heatLayer = null;
    }

    if (this.annoncesWithLocation.length === 0) {
      return;
    }

    const heatPoints: [number, number, number][] = [];

    this.annoncesWithLocation.forEach((annonce) => {
      const lat = annonce.location!.lat;
      const lng = annonce.location!.lng;
      const st = annonce.status.toLowerCase();
      const weight =
        st === 'pending' || st === 'published' || st === 'reserved' ? 1 : 0.45;

      heatPoints.push([lat, lng, weight]);

      const marker = L.circleMarker([lat, lng], {
        radius: 7,
        color: '#1d4ed8',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.9,
      });

      marker.bindTooltip(annonce.title, { direction: 'top', offset: [0, -6] });
      marker.on('click', () => {
        marker
          .bindPopup(this.buildPopupContent(annonce), {
            className: 'annonce-popup',
            closeButton: true,
            autoPan: true,
            maxWidth: 220,
          })
          .openPopup();
      });

      marker.on('popupopen', () => {
        const button = document.getElementById(`see-more-${annonce.id}`);
        if (!button) {
          return;
        }

        button.addEventListener('click', () => {
          const segment = this.slugService.generateSlug(
            annonce.title || 'item',
            annonce.id,
          );
          this.router.navigate(['/annonce', segment]);
        });
      });

      marker.addTo(this.markersLayer);
    });

    const heatFactory = L as unknown as {
      heatLayer: (latlngs: [number, number, number][], options?: Record<string, unknown>) => L.Layer;
    };

    this.heatLayer = heatFactory.heatLayer(heatPoints, {
      radius: 28,
      blur: 22,
      maxZoom: 15,
      minOpacity: 0.35,
      gradient: {
        0.2: '#22c55e',
        0.4: '#84cc16',
        0.6: '#f59e0b',
        0.9: '#ef4444',
      },
    });

    this.heatLayer.addTo(this.map);

    const latLngs = this.annoncesWithLocation.map((annonce) => [annonce.location!.lat, annonce.location!.lng]) as [number, number][];
    this.map.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24] });
  }

  getPhotoUrl(photos: string[]): string {
    return photos.length > 0 ? photos[0] : 'assets/placeholder.jpg';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Available',
      published: 'Available',
      reserved: 'Reserved',
      draft: 'Draft',
      expired: 'Expired',
      unavailable: 'Unavailable',
    };
    return labels[status.toLowerCase()] ?? status;
  }

  getPriceLabel(priceType: string): string {
    const labels: Record<string, string> = {
      free: 'Free',
      unit: 'Per unit',
      bulk: 'In bulk',
    };
    return labels[priceType.toLowerCase()] ?? priceType;
  }

  buildPopupContent(annonce: AnnonceData): string {
    const location = this.escapeHtml(annonce.location?.addr ?? 'Unknown location');
    const category = this.escapeHtml(annonce.category ?? 'Annonce');
    const title = this.escapeHtml(annonce.title);
    const statusRaw = annonce.status.toLowerCase();
    const status = this.escapeHtml(this.getStatusLabel(annonce.status));
    const price = this.escapeHtml(
      annonce.priceType.toLowerCase() === 'free'
        ? 'Free'
        : `${annonce.priceAmount ?? 0} DT · ${this.getPriceLabel(annonce.priceType)}`
    );
    const imageUrl = this.escapeHtml(this.getPhotoUrl(annonce.photos));

    return `
      <div class="popup-card">
        <div class="popup-image-wrap">
          <img class="popup-image" src="${imageUrl}" alt="${title}" />
        </div>
        <div class="popup-body">
          <p class="popup-category">${category}</p>
          <h3 class="popup-title">${title}</h3>
          <p class="popup-location">📍 ${location}</p>
          <div class="popup-meta">
            <span class="popup-chip popup-status status-${statusRaw}">${status}</span>
            <span class="popup-chip popup-price">${price}</span>
          </div>
        <button type="button" id="see-more-${annonce.id}" class="popup-btn">See more</button>
        </div>
      </div>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
