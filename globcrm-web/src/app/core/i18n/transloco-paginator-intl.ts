import { Injectable, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Custom MatPaginatorIntl that reactively updates paginator labels
 * when the active Transloco language changes.
 *
 * Subscribes to `langChanges$` and translates all paginator labels,
 * including the range label function, then notifies subscribers
 * via `this.changes.next()`.
 */
@Injectable()
export class TranslatedPaginatorIntl extends MatPaginatorIntl {
  private readonly translocoService = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    super();

    this.translocoService.langChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.itemsPerPageLabel = this.translocoService.translate('common.paginator.itemsPerPage');
        this.nextPageLabel = this.translocoService.translate('common.paginator.nextPage');
        this.previousPageLabel = this.translocoService.translate('common.paginator.previousPage');
        this.firstPageLabel = this.translocoService.translate('common.paginator.firstPage');
        this.lastPageLabel = this.translocoService.translate('common.paginator.lastPage');

        this.getRangeLabel = (page: number, pageSize: number, length: number) => {
          const ofLabel = this.translocoService.translate('common.paginator.of');
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
