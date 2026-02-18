import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
  signal,
  input,
  output,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';

import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { ProductService } from '../product.service';
import {
  ProductDto,
  CreateProductRequest,
  UpdateProductRequest,
} from '../product.models';

/**
 * Product create/edit form component.
 * Standalone component for both create and edit modes.
 * Form fields: name, description, unitPrice, sku, category, isActive (edit only).
 * Includes custom field form integration.
 */
@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatCardModule,
    MatProgressSpinnerModule,
    CustomFieldFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.dialog-mode]': 'dialogMode()' },
  styles: `
    :host {
      display: block;
      padding: 24px;
    }

    :host.dialog-mode {
      padding: 0;
    }

    :host.dialog-mode .form-container {
      max-width: unset;
    }

    :host.dialog-mode mat-card {
      box-shadow: none;
      border: none;
    }

    .form-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }

    .form-header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 64px;
    }

    .form-container {
      max-width: 800px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px 16px;
    }

    .full-width {
      grid-column: span 2;
    }

    .active-checkbox {
      padding: 8px 0;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--color-border);
    }
  `,
  template: `
    <!-- Header -->
    @if (!dialogMode()) {
      <div class="form-header">
        <button mat-icon-button routerLink="/products" aria-label="Back to Products">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>{{ isEditMode ? 'Edit Product' : 'New Product' }}</h1>
      </div>
    }

    @if (isLoadingProduct()) {
      <div class="loading-container">
        <mat-spinner diameter="48"></mat-spinner>
      </div>
    } @else {
      <div class="form-container">
        <mat-card>
          <mat-card-content>
            <form [formGroup]="productForm" (ngSubmit)="onSubmit()">
              <div class="form-grid">
                <!-- Product Name -->
                <mat-form-field appearance="outline">
                  <mat-label>Product Name</mat-label>
                  <input matInput formControlName="name" required>
                  @if (productForm.controls['name'].hasError('required')) {
                    <mat-error>Product name is required</mat-error>
                  }
                  @if (productForm.controls['name'].hasError('maxlength')) {
                    <mat-error>Maximum 200 characters</mat-error>
                  }
                </mat-form-field>

                <!-- Unit Price -->
                <mat-form-field appearance="outline">
                  <mat-label>Unit Price</mat-label>
                  <span matPrefix>$&nbsp;</span>
                  <input matInput type="number" formControlName="unitPrice" step="0.01" min="0" required>
                  @if (productForm.controls['unitPrice'].hasError('required')) {
                    <mat-error>Unit price is required</mat-error>
                  }
                  @if (productForm.controls['unitPrice'].hasError('min')) {
                    <mat-error>Price must be 0 or greater</mat-error>
                  }
                </mat-form-field>

                <!-- SKU -->
                <mat-form-field appearance="outline">
                  <mat-label>SKU</mat-label>
                  <input matInput formControlName="sku">
                  @if (productForm.controls['sku'].hasError('maxlength')) {
                    <mat-error>Maximum 50 characters</mat-error>
                  }
                </mat-form-field>

                <!-- Category -->
                <mat-form-field appearance="outline">
                  <mat-label>Category</mat-label>
                  <input matInput formControlName="category">
                </mat-form-field>

                <!-- Description -->
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Description</mat-label>
                  <textarea matInput formControlName="description" rows="3"></textarea>
                </mat-form-field>

                <!-- Active checkbox (edit mode only) -->
                @if (isEditMode) {
                  <div class="active-checkbox">
                    <mat-checkbox formControlName="isActive">Active</mat-checkbox>
                  </div>
                }
              </div>

              <!-- Custom fields -->
              <app-custom-field-form
                entityType="Product"
                [customFieldValues]="existingCustomFields"
                (valuesChanged)="onCustomFieldsChanged($event)" />

              <!-- Form actions -->
              @if (!dialogMode()) {
                <div class="form-actions">
                  <button mat-button type="button" routerLink="/products">Cancel</button>
                  <button mat-raised-button color="primary" type="submit"
                          [disabled]="productForm.invalid || isSaving()">
                    {{ isEditMode ? 'Save Changes' : 'Create Product' }}
                  </button>
                </div>
              }
            </form>
          </mat-card-content>
        </mat-card>
      </div>
    }
  `,
})
export class ProductFormComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly productService = inject(ProductService);

  /** Dialog mode inputs/outputs. */
  dialogMode = input(false);
  entityCreated = output<any>();
  entityCreateError = output<void>();

  isEditMode = false;
  productId: string | null = null;
  existingCustomFields: Record<string, any> | undefined;
  isSaving = signal(false);
  isLoadingProduct = signal(false);

  private customFieldValues: Record<string, any> = {};
  private loadSub: Subscription | null = null;

  productForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    unitPrice: [0, [Validators.required, Validators.min(0)]],
    sku: ['', [Validators.maxLength(50)]],
    category: [''],
    isActive: [true],
  });

  ngOnInit(): void {
    if (!this.dialogMode()) {
      this.productId = this.route.snapshot.paramMap.get('id');
      this.isEditMode = !!this.productId;
    }

    if (this.isEditMode && this.productId) {
      this.loadProduct(this.productId);
    }
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
  }

  private loadProduct(id: string): void {
    this.isLoadingProduct.set(true);
    this.loadSub = this.productService.getById(id).subscribe({
      next: (product) => {
        this.populateForm(product);
        this.isLoadingProduct.set(false);
      },
      error: () => {
        this.isLoadingProduct.set(false);
      },
    });
  }

  private populateForm(product: ProductDto): void {
    this.productForm.patchValue({
      name: product.name,
      description: product.description ?? '',
      unitPrice: product.unitPrice,
      sku: product.sku ?? '',
      category: product.category ?? '',
      isActive: product.isActive,
    });
    this.existingCustomFields = product.customFields;
  }

  onCustomFieldsChanged(values: Record<string, any>): void {
    this.customFieldValues = values;
  }

  onSubmit(): void {
    if (this.productForm.invalid) return;

    this.isSaving.set(true);
    const formValue = this.productForm.value;

    if (this.isEditMode && this.productId) {
      const request: UpdateProductRequest = {
        name: formValue.name,
        description: formValue.description || null,
        unitPrice: formValue.unitPrice,
        sku: formValue.sku || null,
        category: formValue.category || null,
        isActive: formValue.isActive,
        customFields: this.customFieldValues,
      };

      this.productService.update(this.productId, request).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.router.navigate(['/products', this.productId]);
        },
        error: () => {
          this.isSaving.set(false);
        },
      });
    } else {
      const request: CreateProductRequest = {
        name: formValue.name,
        description: formValue.description || null,
        unitPrice: formValue.unitPrice,
        sku: formValue.sku || null,
        category: formValue.category || null,
        customFields: this.customFieldValues,
      };

      this.productService.create(request).subscribe({
        next: (created) => {
          this.isSaving.set(false);
          if (this.dialogMode()) {
            this.entityCreated.emit(created);
          } else {
            this.router.navigate(['/products', created.id]);
          }
        },
        error: () => {
          this.isSaving.set(false);
          if (this.dialogMode()) {
            this.entityCreateError.emit();
          }
        },
      });
    }
  }

  /** Trigger form submission programmatically (used by dialog wrapper). */
  triggerSubmit(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }
    this.onSubmit();
  }
}
