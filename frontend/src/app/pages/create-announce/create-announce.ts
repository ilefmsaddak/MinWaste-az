import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AnnounceFormComponent
} from '../../components/announce-form/announce-form';
import { AnnounceFormData } from '../../models/models';
import { ItemService } from '../../services/item.service';
import { NavBar } from '../../components/nav-bar/nav-bar';

@Component({
  selector: 'app-create-announce',
  standalone: true,
  imports: [CommonModule, AnnounceFormComponent, NavBar],
  templateUrl: './create-announce.html',
  styleUrl: './create-announce.css',
})
export class CreateAnnouncePage {
  successMessage: string | null = null;
  errorMessage: string | null = null;
  isLoading = false;

  constructor(private itemService: ItemService) {}

  onFormSubmit(formData: AnnounceFormData): void {
    console.log('Announce Form Data:', formData);
    this.isLoading = true;
    this.successMessage = null;
    this.errorMessage = null;

    this.itemService.createItem(formData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.successMessage = `Announcement "${response.title}" created successfully!`;
        this.errorMessage = null;

        // Clear success message after 5 seconds
        setTimeout(() => {
          this.successMessage = null;
        }, 5000);

        console.log('Item created:', response);
      },
      error: (error: any) => {
        this.isLoading = false;
        console.error('Error creating item:', error);

        const body = error?.error;
        const msg = body?.message;
        if (Array.isArray(msg)) {
          this.errorMessage = msg.join(' • ');
        } else if (typeof msg === 'string') {
          this.errorMessage = msg;
        } else if (error?.message) {
          this.errorMessage = error.message;
        } else if (error?.statusText) {
          this.errorMessage = `Error: ${error.statusText}`;
        } else {
          this.errorMessage =
            'An error occurred while creating the announcement. Please try again.';
        }
        this.successMessage = null;
      }
    });
  }
}

