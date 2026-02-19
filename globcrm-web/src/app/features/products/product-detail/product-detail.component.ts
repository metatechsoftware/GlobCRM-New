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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';
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
    MatProgressSpinnerModule,
    MatDialogModule,
    HasPermissionDirective,
    CustomFieldFormComponent,
    ConfirmDeleteDialogComponent,
  ],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: product.name, type: 'product' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.productService.delete(product.id).subscribe({
          next: () => {
            this.router.navigate(['/products']);
          },
          error: () => {},
        });
      }
    });
  }
}
