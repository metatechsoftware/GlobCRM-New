import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ApiError {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(path: string, params?: HttpParams): Observable<T> {
    return this.http
      .get<T>(`${this.baseUrl}${path}`, { params })
      .pipe(catchError(this.handleError));
  }

  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http
      .post<T>(`${this.baseUrl}${path}`, body)
      .pipe(catchError(this.handleError));
  }

  put<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http
      .put<T>(`${this.baseUrl}${path}`, body)
      .pipe(catchError(this.handleError));
  }

  patch<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http
      .patch<T>(`${this.baseUrl}${path}`, body)
      .pipe(catchError(this.handleError));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<T>(`${this.baseUrl}${path}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const apiError: ApiError = {
      status: error.status,
      message: error.error?.message ?? error.message ?? 'An unexpected error occurred',
      errors: error.error?.errors,
    };
    return throwError(() => apiError);
  }
}
