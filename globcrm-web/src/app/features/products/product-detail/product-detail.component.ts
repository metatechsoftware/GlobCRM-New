import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { ProductService } from '../product.service';
import { ProductDto } from '../product.models';

/**
 * Product detail page -- simpler than Company/Contact detail.
 * No timeline, no relational tabs. Just a single detail view with
 * core fields card and custom fields card.
 */
@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    RouterLink,
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    HasPermissionDirective,
    CustomFieldFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      padding: 24px;
    }

    .detail-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 8px;
    }

    .detail-header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
      flex: 1;
    }

    .detail-header-actions {
      display: flex;
      gap: 8px;
    }

    .detail-subheader {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      font-size: 14px;
    }

    .detail-subheader .separator {
      color: var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12));
    }

    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 64px;
    }

    .detail-content {
      display: flex;
      flex-direction: column;
      gap: 24px;
      max-width: 800px;
    }

    .fields-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .field-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .field-label {
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
    }

    .field-value {
      font-size: 14px;
      color: var(--mat-sys-on-surface, rgba(0, 0, 0, 0.87));
    }

    .description-field {
      grid-column: span 2;
    }
  `,
  template: `
    @if (isLoading()) {
      <div class="loading-container">
        <mat-spinner diameter="48"></mat-spinner>
      </div>
    } @else if (product()) {
      <!-- Header -->
      <div class="detail-header">
        <button mat-icon-button routerLink="/products" aria-label="Back to Products">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>{{ product()!.name }}</h1>
        <mat-chip [highlighted]="product()!.isActive"
                  [class]="product()!.isActive ? 'active-chip' : 'inactive-chip'">
          {{ product()!.isActive ? 'Active' : 'Inactive' }}
        </mat-chip>
        <div class="detail-header-actions">
          <button mat-raised-button color="primary"
                  *appHasPermission="'Product:Edit'"
                  [routerLink]="'edit'">
            <mat-icon>edit</mat-icon>
            Edit
          </button>
          <button mat-button color="warn"
                  *appHasPermission="'Product:Delete'"
                  (click)="deleteProduct()">
            <mat-icon>delete</mat-icon>
            Delete
          </button>
        </div>
      </div>

      <!-- Subheader -->
      <div class="detail-subheader">
        @if (product()!.sku) {
          <span>SKU: {{ product()!.sku }}</span>
          <span class="separator">|</span>
        }
        @if (product()!.category) {
          <span>{{ product()!.category }}</span>
          <span class="separator">|</span>
        }
        <span>{{ product()!.unitPrice | currency:'USD':'symbol':'1.2-2' }}</span>
      </div>

      <!-- Content -->
      <div class="detail-content">
        <!-- Core Fields Card -->
        <mat-card>
          <mat-card-header>
            <mat-card-title>Product Details</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="fields-grid">
              <div class="field-item">
                <span class="field-label">Name</span>
                <span class="field-value">{{ product()!.name }}</span>
              </div>
              <div class="field-item">
                <span class="field-label">SKU</span>
                <span class="field-value">{{ product()!.sku ?? '--' }}</span>
              </div>
              <div class="field-item">
                <span class="field-label">Category</span>
                <span class="field-value">{{ product()!.category ?? '--' }}</span>
              </div>
              <div class="field-item">
                <span class="field-label">Unit Price</span>
                <span class="field-value">{{ product()!.unitPrice | currency:'USD':'symbol':'1.2-2' }}</span>
              </div>
              <div class="field-item">
                <span class="field-label">Status</span>
                <span class="field-value">{{ product()!.isActive ? 'Active' : 'Inactive' }}</span>
              </div>
              @if (product()!.description) {
                <div class="field-item description-field">
                  <span class="field-label">Description</span>
                  <span class="field-value">{{ product()!.description }}</span>
                </div>
              }
              <div class="field-item">
                <span class="field-label">Created</span>
                <span class="field-value">{{ product()!.createdAt | date:'medium' }}</span>
              </div>
              <div class="field-item">
                <span class="field-label">Updated</span>
                <span class="field-value">{{ product()!.updatedAt | date:'medium' }}</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Custom Fields Card -->
        <mat-card>
          <mat-card-header>
            <mat-card-title>Custom Fields</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <app-custom-field-form
              entityType="Product"
              [readonly]="true"
              [customFieldValues]="product()!.customFields" />
          </mat-card-content>
        </mat-card>
      </div>
    } @else {
      <div class="loading-container">
        <p>Product not found.</p>
      </div>
    }
  `,
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  private readonly dialog = inject(MatDialog);

  product = signal<ProductDto | null>(null);
  isLoading = signal(true);

  private loadSub: Subscription | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadProduct(id);
    }
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
  }

  private loadProduct(id: string): void {
    this.isLoading.set(true);
    this.loadSub = this.productService.getById(id).subscribe({
      next: (product) => {
        this.product.set(product);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  deleteProduct(): void {
    const product = this.product();
    if (!product) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    this.productService.delete(product.id).subscribe({
      next: () => {
        this.router.navigate(['/products']);
      },
      error: (err) => {
        console.error('Failed to delete product:', err);
      },
    });
  }
}
