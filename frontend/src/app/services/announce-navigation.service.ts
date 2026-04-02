import { Injectable, signal } from '@angular/core';
import { ItemResponse } from './item.service';

@Injectable({
  providedIn: 'root'
})
export class AnnounceNavigationService {
  private selectedItem = signal<ItemResponse | null>(null);

  setSelectedItem(item: ItemResponse): void {
    this.selectedItem.set(item);
  }

  getSelectedItem(): ItemResponse | null {
    return this.selectedItem();
  }

  clearSelectedItem(): void {
    this.selectedItem.set(null);
  }
}
