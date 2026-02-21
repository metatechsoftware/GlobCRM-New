import { Injectable, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Custom MatPaginatorIntl that reactively updates paginator labels
 * when the active Transloco language changes.
 *
 * Uses selectTranslateObject() which waits for the translation file
 * to be loaded before emitting, avoiding the race condition where
 * langChanges$ fires before HTTP translation fetch completes.
 */
@Injectable()
export class TranslatedPaginatorIntl extends MatPaginatorIntl {
  private readonly translocoService = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    super();

    this.translocoService.selectTranslateObject('common.paginator')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((labels: Record<string, string>) => {
        this.itemsPerPageLabel = labels['itemsPerPage'] || 'Items per page';
        this.nextPageLabel = labels['nextPage'] || 'Next page';
        this.previousPageLabel = labels['previousPage'] || 'Previous page';
        this.firstPageLabel = labels['firstPage'] || 'First page';
        this.lastPageLabel = labels['lastPage'] || 'Last page';

        const ofLabel = labels['of'] || 'of';
        this.getRangeLabel = (page: number, pageSize: number, length: number) => {
          if (length === 0 || pageSize === 0) {
            return `0 ${ofLabel} ${length}`;
          }
          const startIndex = page * pageSize;
          const endIndex = Math.min(startIndex + pageSize, length);
          return `${startIndex + 1} \u2013 ${endIndex} ${ofLabel} ${length}`;
        };

        this.changes.next();
      });
  }
}
