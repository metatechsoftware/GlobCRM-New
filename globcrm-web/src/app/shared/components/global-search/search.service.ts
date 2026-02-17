import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { SearchResponse } from './search.models';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly api = inject(ApiService);

  search(term: string, maxPerType: number = 5): Observable<SearchResponse> {
    const params = new HttpParams()
      .set('q', term)
      .set('maxPerType', maxPerType.toString());

    return this.api.get<SearchResponse>('/api/search', params);
  }
}
