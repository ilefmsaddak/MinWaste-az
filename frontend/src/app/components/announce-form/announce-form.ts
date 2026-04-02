import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AnnounceFormData } from '../../models/models';
import { LocationPickerComponent } from '../location-picker/location-picker';
import { AiService } from '../../services/ai.service';

@Component({
  selector: 'app-announce-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, LocationPickerComponent],
  templateUrl: './announce-form.html',
  styleUrl: './announce-form.css',
})
export class AnnounceFormComponent implements OnInit {
  @Output() formSubmit = new EventEmitter<AnnounceFormData>();

  form!: FormGroup;
  photoPreview: string | null = null;
  photoError: string | null = null;
  isDragActive = false;
  selectedFile: File | null = null;
  selectedLocation: { latitude: number; longitude: number; address: string } | null = null;
  isCorrectingDescription = false;
  descriptionCorrectionError: string | null = null;
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
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

  constructor(private fb: FormBuilder, private aiService: AiService) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  initializeForm(): void {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      category: ['', Validators.required],
      customCategory: [''],
      location: ['', [Validators.required, Validators.minLength(2)]],
      latitude: [null],
      longitude: [null],
      expiresAt: [''],
      quantity: [1, [Validators.required, Validators.min(1)]],
      priceType: ['free', Validators.required],
      price: [{ value: '', disabled: true }, [Validators.min(0)]],
    });

    // Update price field validation based on priceType
    this.form.get('priceType')?.valueChanges.subscribe((value: string) => {
      const priceControl = this.form.get('price');

      priceControl?.reset();

      if (value === 'unit' || value === 'wholesale') {
        priceControl?.enable();
        priceControl?.setValidators([Validators.required, Validators.min(0)]);
      } else {
        priceControl?.disable();
      }

      priceControl?.updateValueAndValidity({ emitEvent: false });
    });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.processFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragActive = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragActive = false;
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragActive = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  private processFile(file: File): void {
    this.photoError = null;

    if (!this.ALLOWED_TYPES.includes(file.type)) {
      this.photoError = 'Please upload a valid image format (PNG, JPG, GIF, WebP)';
      return;
    }

    if (file.size > this.MAX_FILE_SIZE) {
      this.photoError = 'File size must be less than 10MB';
      return;
    }

    // Store the file for later use
    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.photoPreview = e.target?.result as string;
      this.photoError = null;
    };
    reader.onerror = () => {
      this.photoError = 'Error reading file. Please try again.';
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.photoPreview = null;
    this.photoError = null;
    this.selectedFile = null;
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  onLocationSelected(location: { latitude: number; longitude: number; address: string }): void {
    this.selectedLocation = location;
    this.form.patchValue({
      location: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
    });
  }

  onSubmit(): void {
    if (this.form.valid) {
      const formValue = this.form.getRawValue();
      const announceData: AnnounceFormData = {
        title: formValue.title,
        description: formValue.description,
        category:
          formValue.category === 'Other' ? formValue.customCategory : formValue.category,
        location: formValue.location,
        latitude: formValue.latitude,
        longitude: formValue.longitude,
        expiresAt: formValue.expiresAt || undefined,
        quantity: formValue.quantity,
        priceType: formValue.priceType,
        photo: this.selectedFile || undefined,
        price: formValue.price || undefined,
      };
      this.formSubmit.emit(announceData);
      this.resetForm();
    }
  }

  resetForm(): void {
    this.form.reset({ priceType: 'free', quantity: 1 });
    this.photoPreview = null;
    this.selectedFile = null;
    this.selectedLocation = null;
  }

  get isOtherCategory(): boolean {
    return this.form.get('category')?.value === 'Other';
  }

  /**
   * Send the description to the AI service for improvement
   */
  correctDescription(): void {
    const descriptionControl = this.form.get('description');
    const description = descriptionControl?.value?.trim();

    if (!description) {
      this.descriptionCorrectionError = 'Please enter a description first.';
      return;
    }

    if (description.length < 10) {
      this.descriptionCorrectionError = 'Description must be at least 10 characters.';
      return;
    }

    this.isCorrectingDescription = true;
    this.descriptionCorrectionError = null;

    this.aiService.correctDescription(description).subscribe({
      next: (response: any) => {
        const correctedText = response.corrected?.trim();
        if (correctedText) {
          descriptionControl?.setValue(correctedText);
          descriptionControl?.markAsTouched();
        }
        this.isCorrectingDescription = false;
      },
      error: (error: any) => {
        this.descriptionCorrectionError = error.message || 'Failed to correct description';
        this.isCorrectingDescription = false;
        console.error('Description correction error:', error);
      }
    });
  }

  getErrorMessage(fieldName: string): string {
    const control = this.form.get(fieldName);
    if (control?.hasError('required')) {
      return `${fieldName} is required`;
    }
    if (control?.hasError('minlength')) {
      return `${fieldName} must be at least ${control.getError('minlength').requiredLength} characters`;
    }
    if (control?.hasError('min')) {
      return `${fieldName} must be greater than 0`;
    }
    return '';
  }
}
