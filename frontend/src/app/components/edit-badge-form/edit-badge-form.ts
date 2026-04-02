import { Component, EventEmitter, Input, Output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BadgeAdminService, Badge } from '../../services/badge-admin.service';

@Component({
  selector: 'app-edit-badge-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-badge-form.html',
  styleUrl: './edit-badge-form.scss'
})
export class EditBadgeFormComponent {
  @Input() isVisible = signal(false);
  @Input() badge = signal<Badge | null>(null);
  @Output() badgeUpdated = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  formData = signal({
    name: '',
    description: '',
    icon: '🏆',
    pointsRequired: 0
  });

  isSubmitting = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  // Common emoji icons
  // Common emoji icons for badges
    commonEmojis = [
    '🎯', '🌍', '⭐', '💪', '♻️', '🏆', '⚡', '👑', '🚀', '💎', '🌟',
    '🔥', '🎁', '🏅'
   , '🎯','✅','🤝','🌱',
    '❤️', '💚', '💙', '💛', '💜', '🧡', '💖', '💝', '💗',
    '☀️', '🌙', '⭐', '✨', '💫','☄️', '💥', '🌻',
    '🦁', '🐯', '🐻', '🐼', '🐨', '🐶', '🐱', '🦊', '🐰', '🦅'
  ];

  constructor(private badgeService: BadgeAdminService) {
    // Auto-populate form when badge changes
    effect(() => {
      const badgeData = this.badge();
      if (badgeData) {
        this.formData.set({
          name: badgeData.name,
          description: badgeData.description,
          icon: badgeData.icon,
          pointsRequired: badgeData.pointsRequired
        });
        this.error.set(null);
        this.success.set(null);
      }
    });
  }

  selectEmoji(emoji: string): void {
    const current = this.formData();
    this.formData.set({ ...current, icon: emoji });
  }

  onNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const current = this.formData();
    this.formData.set({ ...current, name: input.value });
  }

  onDescriptionInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const current = this.formData();
    this.formData.set({ ...current, description: textarea.value });
  }

  onPointsInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const current = this.formData();
    this.formData.set({ ...current, pointsRequired: +input.value });
  }

  isFormValid(): boolean {
    const form = this.formData();
    return (
      form.name.trim().length > 0 &&
      form.description.trim().length > 0 &&
      form.icon.length > 0 &&
      form.pointsRequired > 0
    );
  }

  isFormChanged(): boolean {
    const badge = this.badge();
    if (!badge) return false;

    const form = this.formData();
    return (
      form.name !== badge.name ||
      form.description !== badge.description ||
      form.icon !== badge.icon ||
      form.pointsRequired !== badge.pointsRequired
    );
  }

  clearForm(): void {
    const badge = this.badge();
    if (badge) {
      this.formData.set({
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        pointsRequired: badge.pointsRequired
      });
    }
    this.error.set(null);
    this.success.set(null);
  }

  submitForm(): void {
    const badge = this.badge();
    if (!badge) return;

    if (!this.isFormValid()) {
      this.error.set('Please fill in all required fields');
      return;
    }

    if (!this.isFormChanged()) {
      this.error.set('No changes made to the badge');
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);
    this.success.set(null);

    this.badgeService.updateBadge(badge.id, this.formData()).subscribe({
      next: (response) => {
        this.success.set(`Badge "${response.name}" updated successfully!`);
        this.isSubmitting.set(false);

        setTimeout(() => {
          this.badgeUpdated.emit();
          this.closeModal();
        }, 1500);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errorMessage = error?.error?.message || 'Failed to update badge. Please try again.';
        this.error.set(errorMessage);
      }
    });
  }

  closeModal(): void {
    this.clearForm();
    this.closed.emit();
  }
}
