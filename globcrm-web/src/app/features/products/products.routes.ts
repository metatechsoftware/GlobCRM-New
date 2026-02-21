import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { ProductListComponent } from './product-list/product-list.component';

export const PRODUCT_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('products')],
    children: [
      { path: '', component: ProductListComponent },
      {
        path: 'new',
        loadComponent: () =>
          import('./product-form/product-form.component').then(
            (m) => m.ProductFormComponent,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./product-detail/product-detail.component').then(
            (m) => m.ProductDetailComponent,
          ),
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('./product-form/product-form.component').then(
            (m) => m.ProductFormComponent,
          ),
      },
    ],
  },
];
