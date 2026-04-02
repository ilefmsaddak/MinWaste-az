import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ItemResponse, ItemService } from '../../services/item.service';
import { LocationPickerComponent } from '../location-picker/location-picker';

@Component({
  selector: 'app-announce-list',
  standalone: true,
  imports: [CommonModule, FormsModule, LocationPickerComponent],
  templateUrl: './announce-list.html',
  styleUrl: './announce-list.css',
})
export class AnnounceListComponent implements OnInit {
  @Input() announces: ItemResponse[] = [];
  @Output() announceDeleted = new EventEmitter<string>();
  @Output() announceUpdated = new EventEmitter<ItemResponse>();

  editingId: string | null = null;
  expandedId: string | null = null;
  editFormData: { [key: string]: any } = {};
  currentEditingAnnounce: ItemResponse | null = null;
  deletingId: string | null = null;
  isSubmitting = false;
  errorMessage: string | null = null;

  categories = [
    'Clothes',
    'Food',
    'Medicaments',
    'Electronics',
    'Furniture',
    'Books',
    'Sports Equipment',
    'Other',
  ];

  constructor(private itemService: ItemService) {}

  ngOnInit(): void {}

  toggleExpand(announceId: string): void {
    this.expandedId = this.expandedId === announceId ? null : announceId;
  }

  startEdit(announce: ItemResponse): void {
    this.editingId = announce.id;
    this.currentEditingAnnounce = announce;
    this.editFormData = {
      title: announce.title,
      description: announce.description,
      category: announce.category,
      quantity: announce.quantity,
      priceType: announce.priceType.toLowerCase(),
      priceValue: announce.priceValue,
      locationAddr: announce.locationAddr,
      latitude: announce.locationLat,
      longitude: announce.locationLng,
      expiresAt: announce.expiresAt ? announce.expiresAt.split('T')[0] : '',
    };
  }
  cancelEdit(): void {
    this.editingId = null;
    this.currentEditingAnnounce = null;
    this.editFormData = {};
    this.errorMessage = null;
  }

  onLocationSelectedEdit(location: { latitude: number; longitude: number; address: string }): void {
    this.editFormData['locationAddr'] = location.address;
    this.editFormData['latitude'] = location.latitude;
    this.editFormData['longitude'] = location.longitude;
  }

  saveEdit(announceId: string): void {
    if (!this.editingId || !this.currentEditingAnnounce) return;

    this.isSubmitting = true;
    this.errorMessage = null;

    // Map form data to API format
    const priceTypeMap: { [key: string]: 'FREE' | 'UNIT' | 'BULK' } = {
      'free': 'FREE',
      'unit': 'UNIT',
      'wholesale': 'BULK'
    };

    const updateData: any = {
      title: this.editFormData['title'],
      description: this.editFormData['description'],
      category: this.editFormData['category'],
      locationAddr: this.editFormData['locationAddr'],
      locationLat: Number(this.editFormData['latitude']),
      locationLng: Number(this.editFormData['longitude']),
      quantity: Number(this.editFormData['quantity']),
      priceType: priceTypeMap[this.editFormData['priceType']?.toLowerCase()] || 'FREE',
      priceValue: Number(this.editFormData['priceValue']) || 0,
      expiresAt: this.editFormData['expiresAt'] || undefined,
      status: this.currentEditingAnnounce.status.toUpperCase(),
    };

    this.itemService.updateItem(announceId, updateData).subscribe({
      next: (updatedAnnounce) => {
        this.isSubmitting = false;
        this.announceUpdated.emit(updatedAnnounce);
        this.editingId = null;
        this.currentEditingAnnounce = null;
        this.editFormData = {};
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Error updating announcement:', error);
        this.errorMessage = error.error?.message || 'Failed to update announcement';
      },
    });
  }

  confirmDelete(announceId: string): void {
    this.deletingId = announceId;
  }

  cancelDelete(): void {
    this.deletingId = null;
  }

  deleteAnnounce(announceId: string): void {
    this.isSubmitting = true;

    this.itemService.deleteItem(announceId).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.announceDeleted.emit(announceId);
        this.deletingId = null;
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Error deleting announcement:', error);
        this.errorMessage = error.error?.message || 'Failed to delete announcement';
      },
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return 'badge-active';
      case 'EXPIRED':
        return 'badge-expired';
      case 'UNAVAILABLE':
        return 'badge-unavailable';
      default:
        return 'badge-default';
    }
  }

  getFormattedDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getDeletingAnnounce() {
    return this.announces.find(a => a.id === this.deletingId);
  }
}
