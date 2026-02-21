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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';

import { TranslocoPipe } from '@jsverse/transloco';
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
    MatProgressSpinnerModule,
    CustomFieldFormComponent,
    TranslocoPipe,
  ],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.dialog-mode]': 'dialogMode()' },
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
