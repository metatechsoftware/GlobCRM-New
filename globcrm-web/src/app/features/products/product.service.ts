import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import {
  PagedResult,
  EntityQueryParams,
} from '../../shared/models/query.models';
import {
  ProductDto,
  CreateProductRequest,
  UpdateProductRequest,
} from './product.models';

/**
 * API service for Product entity CRUD operations.
 * Uses ApiService for HTTP calls with centralized error handling.
 * Products do not have a timeline endpoint.
 */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/products';

  getList(params: EntityQueryParams): Observable<PagedResult<ProductDto>> {
    const httpParams = this.buildQueryParams(params);
    return this.api.get<PagedResult<ProductDto>>(this.basePath, httpParams);
  }

  getById(id: string): Observable<ProductDto> {
    return this.api.get<ProductDto>(`${this.basePath}/${id}`);
  }

  create(request: CreateProductRequest): Observable<ProductDto> {
    return this.api.post<ProductDto>(this.basePath, request);
  }

  update(id: string, request: UpdateProductRequest): Observable<void> {
    return this.api.put<void>(`${this.basePath}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.basePath}/${id}`);
  }

  private buildQueryParams(params: EntityQueryParams): HttpParams {
    let httpParams = new HttpParams();

    if (params.page != null) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params.pageSize != null) {
      httpParams = httpParams.set('pageSize', params.pageSize.toString());
    }
    if (params.sortField != null) {
      httpParams = httpParams.set('sortField', params.sortField);
    }
    if (params.sortDirection != null) {
      httpParams = httpParams.set('sortDirection', params.sortDirection);
    }
    if (params.search != null && params.search !== '') {
      httpParams = httpParams.set('search', params.search);
    }
    if (params.filters != null && params.filters.length > 0) {
      httpParams = httpParams.set('filters', JSON.stringify(params.filters));
    }

    return httpParams;
  }
}
