import { Component, OnInit, Output, EventEmitter, ViewChild, ElementRef, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import L from 'leaflet';

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

@Component({
  selector: 'app-location-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './location-picker.html',
  styleUrls: ['./location-picker.css']
})
export class LocationPickerComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  @Output() locationSelected = new EventEmitter<LocationData>();
  @Input() initialLocation?: string;
  @Input() initialLatitude?: number;
  @Input() initialLongitude?: number;

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  isExpanded = false;
  isLoadingLocation = false;
  isSearching = false;
  selectedLocation: string = '';
  selectedCoordinates: { lat: number; lng: number } | null = null;
  mapInitialized = false;
  searchQuery: string = '';
  searchResults: any[] = [];
  showSearchResults = false;

  private readonly DEFAULT_LAT = 35.7462; // Tunisia center
  private readonly DEFAULT_LNG = 10.7589;
  private readonly ZOOM_LEVEL = 13;

  ngOnInit(): void {
    // Initialize with input values if provided
    this.initializeWithInputs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialLocation'] || changes['initialLatitude'] || changes['initialLongitude']) {
      this.initializeWithInputs();
    }
  }

  private initializeWithInputs(): void {
    if (this.initialLocation) {
      this.selectedLocation = this.initialLocation;
    }
    if (this.initialLatitude !== undefined && this.initialLongitude !== undefined) {
      this.selectedCoordinates = {
        lat: this.initialLatitude,
        lng: this.initialLongitude
      };
    }
  }

  toggleMap(): void {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      // Destroy previous map instance if exists
      if (this.map) {
        this.map.remove();
        this.map = null;
        this.mapInitialized = false;
      }
      setTimeout(() => this.initializeMap(), 100);
    }
  }

  private initializeMap(): void {
    if (this.mapInitialized || !this.mapContainer) return;

    try {
      // Use existing coordinates if available, otherwise default to Tunisia center
      const initialLat = this.selectedCoordinates?.lat || this.DEFAULT_LAT;
      const initialLng = this.selectedCoordinates?.lng || this.DEFAULT_LNG;

      this.map = L.map(this.mapContainer.nativeElement).setView(
        [initialLat, initialLng],
        this.ZOOM_LEVEL
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.map);

      this.map.on('click', (event: L.LeafletMouseEvent) => this.onMapClick(event));

      // If location already selected, show marker
      if (this.selectedCoordinates) {
        this.addMarker(this.selectedCoordinates.lat, this.selectedCoordinates.lng);
      }

      this.mapInitialized = true;
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  private onMapClick(event: L.LeafletMouseEvent): void {
    const { lat, lng } = event.latlng;
    this.selectedCoordinates = { lat, lng };
    this.addMarker(lat, lng);
    this.reverseGeocode(lat, lng);
  }

  private addMarker(lat: number, lng: number): void {
    if (!this.map) return;

    // Remove old marker
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }

    // Create green custom marker icon
    const greenIcon = L.icon({
      iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxMiIgZmlsbD0iIzIyOGI2OCIvPjwvc3ZnPg==',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    this.marker = L.marker([lat, lng], { icon: greenIcon })
      .addTo(this.map)
      .bindPopup(`<div class="popup"><strong>Selected Location</strong><br>${lat.toFixed(4)}, ${lng.toFixed(4)}</div>`);

    this.marker.openPopup();
    this.map.setView([lat, lng], this.ZOOM_LEVEL);
  }

  private reverseGeocode(lat: number, lng: number): void {
    // Use Nominatim reverse geocoding (OpenStreetMap)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;

    fetch(url)
      .then(response => response.json())
      .then(data => {
        this.selectedLocation = data.address?.city || 
                               data.address?.town || 
                               data.address?.municipality ||
                               data.address?.county ||
                               `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        
        this.emitLocation();
      })
      .catch(error => {
        console.error('Geocoding error:', error);
        this.selectedLocation = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        this.emitLocation();
      });
  }

  useCurrentLocation(): void {
    this.isLoadingLocation = true;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          this.selectedCoordinates = { lat: latitude, lng: longitude };
          
          if (!this.mapInitialized) {
            this.initializeMap();
          }
          
          this.addMarker(latitude, longitude);
          this.reverseGeocode(latitude, longitude);
          this.isLoadingLocation = false;
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Unable to access your location. Please enable location services or select manually.');
          this.isLoadingLocation = false;
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
      this.isLoadingLocation = false;
    }
  }

  private emitLocation(): void {
    if (this.selectedCoordinates) {
      this.locationSelected.emit({
        latitude: this.selectedCoordinates.lat,
        longitude: this.selectedCoordinates.lng,
        address: this.selectedLocation
      });
    }
  }

  closeMap(): void {
    // Emit the location before closing
    this.emitLocation();
    this.isExpanded = false;
    this.searchQuery = '';
    this.searchResults = [];
    this.showSearchResults = false;
  }

  clearLocation(): void {
    this.selectedLocation = '';
    this.selectedCoordinates = null;
    if (this.marker && this.map) {
      this.map.removeLayer(this.marker);
      this.marker = null;
    }
    this.searchQuery = '';
    this.searchResults = [];
    this.showSearchResults = false;
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  searchLocation(): void {
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      this.showSearchResults = false;
      return;
    }

    this.isSearching = true;
    this.showSearchResults = true;

    // Use Nominatim search API
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.searchQuery)}&limit=8`;

    fetch(url)
      .then(response => response.json())
      .then(data => {
        this.searchResults = data;
        this.isSearching = false;
      })
      .catch(error => {
        console.error('Search error:', error);
        this.isSearching = false;
        this.searchResults = [];
      });
  }

  selectSearchResult(result: any): void {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    this.selectedCoordinates = { lat, lng };
    this.selectedLocation = result.display_name.split(',')[0] || result.display_name;
    
    if (this.map) {
      this.addMarker(lat, lng);
    }
    
    this.searchQuery = '';
    this.searchResults = [];
    this.showSearchResults = false;
    this.emitLocation();
  }
}
