import { Component, output, signal } from '@angular/core';

@Component({
  selector: 'app-banner',
  imports: [],
  templateUrl: './banner.html',
  styleUrl: './banner.scss',
})
export class Banner {
  filterClick = output<string>();
  activeFilter = signal<string>('for-you');

  onFilterClick(section: string) {
    this.activeFilter.set(section);
    this.filterClick.emit(section);
  }
}
