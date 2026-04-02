import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BadgeAdminService, CreateBadgeDto } from '../../services/badge-admin.service';

@Component({
  selector: 'app-create-badge-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-badge-form.html',
  styleUrl: './create-badge-form.scss'
})
export class CreateBadgeFormComponent {
  @Output() badgeCreated = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @Input() isVisible = signal(false);

  formData = signal<CreateBadgeDto>({
    name: '',
    description: '',
    icon: '🏆',
    pointsRequired: 0
  });

  isSubmitting = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  // Common emoji icons for badges
  commonEmojis = [
    '🎯', '🌍', '⭐', '💪', '♻️', '🏆', '⚡', '👑', '🚀', '💎', '🌟',
    '🔥', '🎁', '🏅'
   , '🎯','✅','🤝','🌱',
    '❤️', '💚', '💙', '💛', '💜', '🧡', '💖', '💝', '💗',
    '☀️', '🌙', '⭐', '✨', '💫','☄️', '💥', '🌻',
    '🦁', '🐯', '🐻', '🐼', '🐨', '🐶', '🐱', '🦊', '🐰', '🦅'
  ];

  constructor(private badgeService: BadgeAdminService) {}

  selectEmoji(emoji: string): void {
    const current = this.formData();
    this.formData.set({ ...current, icon: emoji });
  }

  updateFormField(field: keyof CreateBadgeDto, value: string | number): void {
    const current = this.formData();
    this.formData.set({ ...current, [field]: value });
  }

  onNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.updateFormField('name', input.value);
  }

  onDescriptionInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.updateFormField('description', textarea.value);
  }

  onPointsInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.updateFormField('pointsRequired', +input.value);
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

  clearForm(): void {
    this.formData.set({
      name: '',
      description: '',
      icon: '🏆',
      pointsRequired: 0
    });
    this.error.set(null);
    this.success.set(null);
  }

  submitForm(): void {
    if (!this.isFormValid()) {
      this.error.set('Please fill in all required fields');
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);
    this.success.set(null);

    this.badgeService.createBadge(this.formData()).subscribe({
      next: (response) => {
        this.success.set(`Badge "${response.name}" created successfully!`);
        this.clearForm();
        this.isSubmitting.set(false);
        
        setTimeout(() => {
          this.badgeCreated.emit();
          this.closeModal();
        }, 1500);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errorMessage = error?.error?.message || 'Failed to create badge. Please try again.';
        this.error.set(errorMessage);
      }
    });
  }

  closeModal(): void {
    this.clearForm();
    this.closed.emit();
  }
}
