import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpParams } from '@angular/common/http';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  Subject,
  debounceTime,
  switchMap,
  of,
  takeUntil,
  distinctUntilChanged,
  map,
  catchError,
} from 'rxjs';
import { EmailTemplateService } from '../email-template.service';
import { PreviewResponse } from '../email-template.models';
import { ApiService } from '../../../core/api/api.service';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';

export interface PreviewDialogData {
  templateId: string;
}

interface EntityOption {
  id: string;
  name: string;
  detail: string;
}

/**
 * Preview dialog for email templates with desktop/mobile toggle,
 * real entity selector for accurate merge field preview, and test send.
 * Opens as a MatDialog from the editor toolbar.
 */
@Component({
  selector: 'app-email-template-preview',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatAutocompleteModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    SafeHtmlPipe,
  ],
  templateUrl: './email-template-preview.component.html',
  styleUrl: './email-template-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailTemplatePreviewComponent implements OnInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<EmailTemplatePreviewComponent>);
  private readonly data: PreviewDialogData = inject(MAT_DIALOG_DATA);
  private readonly service = inject(EmailTemplateService);
  private readonly api = inject(ApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroy$ = new Subject<void>();

  // ---- State ----
  readonly deviceMode = signal<'desktop' | 'mobile'>('desktop');
  readonly entityType = signal<string>('sample');
  readonly entityId = signal<string | null>(null);
  readonly entitySearchQuery = signal('');
  readonly entityOptions = signal<EntityOption[]>([]);
  readonly selectedEntityName = signal('');

  readonly previewLoading = signal(false);
  readonly sendingTest = signal(false);
  readonly searchingEntities = signal(false);

  readonly renderedHtml = signal('');
  readonly renderedSubject = signal('');
  readonly iframeSrcdoc = signal<string>('');

  private readonly searchInput$ = new Subject<string>();

  readonly entityTypes = [
    { value: 'sample', label: 'Sample Data' },
    { value: 'Contact', label: 'Contact' },
    { value: 'Company', label: 'Company' },
    { value: 'Deal', label: 'Deal' },
    { value: 'Lead', label: 'Lead' },
  ];

  get templateId(): string {
    return this.data.templateId;
  }

  get showEntitySearch(): boolean {
    return this.entityType() !== 'sample';
  }

  ngOnInit(): void {
    this.loadPreview();
    this.setupEntitySearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---- Device Toggle ----

  onDeviceChange(mode: string): void {
    this.deviceMode.set(mode as 'desktop' | 'mobile');
  }

  // ---- Entity Type Change ----

  onEntityTypeChange(type: string): void {
    this.entityType.set(type);
    this.entityId.set(null);
    this.entitySearchQuery.set('');
    this.entityOptions.set([]);
    this.selectedEntityName.set('');

    if (type === 'sample') {
      this.loadPreview();
    }
  }

  // ---- Entity Search ----

  onEntitySearchInput(value: string): void {
    this.entitySearchQuery.set(value);
    this.searchInput$.next(value);
  }

  onEntitySelected(entity: EntityOption): void {
    this.entityId.set(entity.id);
    this.selectedEntityName.set(entity.name);
    this.entitySearchQuery.set(entity.name);
    this.loadPreview();
  }

  displayEntityFn(entity: EntityOption | string): string {
    if (typeof entity === 'string') return entity;
    return entity?.name ?? '';
  }

  // ---- Preview ----

  loadPreview(): void {
    this.previewLoading.set(true);

    const request: { entityType?: string | null; entityId?: string | null } = {};
    const type = this.entityType();
    if (type !== 'sample' && this.entityId()) {
      request.entityType = type;
      request.entityId = this.entityId();
    }

    this.service.previewTemplate(this.templateId, request).subscribe({
      next: (res: PreviewResponse) => {
        this.renderedHtml.set(res.renderedHtml);
        this.renderedSubject.set(res.renderedSubject);
        this.iframeSrcdoc.set(res.renderedHtml);
        this.previewLoading.set(false);
      },
      error: () => {
        this.snackBar.open('Failed to load preview', 'Close', { duration: 3000 });
        this.previewLoading.set(false);
      },
    });
  }

  // ---- Test Send ----

  sendTestEmail(): void {
    this.sendingTest.set(true);

    const request: { entityType?: string | null; entityId?: string | null } = {};
    const type = this.entityType();
    if (type !== 'sample' && this.entityId()) {
      request.entityType = type;
      request.entityId = this.entityId();
    }

    this.service.testSend(this.templateId, request).subscribe({
      next: () => {
        this.snackBar.open('Test email sent to your inbox!', 'Close', { duration: 4000 });
        this.sendingTest.set(false);
      },
      error: () => {
        this.snackBar.open('Failed to send test email', 'Close', { duration: 4000 });
        this.sendingTest.set(false);
      },
    });
  }

  // ---- Close ----

  close(): void {
    this.dialogRef.close();
  }

  // ---- Private ----

  private setupEntitySearch(): void {
    this.searchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query || query.length < 2) {
            return of([]);
          }
          this.searchingEntities.set(true);
          return this.searchEntities(this.entityType(), query);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((results) => {
        this.entityOptions.set(results);
        this.searchingEntities.set(false);
      });
  }

  private searchEntities(entityType: string, query: string) {
    const apiPaths: Record<string, string> = {
      Contact: '/api/contacts',
      Company: '/api/companies',
      Deal: '/api/deals',
      Lead: '/api/leads',
    };

    const path = apiPaths[entityType];
    if (!path) return of([]);

    const params = new HttpParams()
      .set('search', query)
      .set('page', '1')
      .set('pageSize', '10');

    return this.api.get<{ items: any[] }>(path, params).pipe(
      map((result) =>
        result.items.map((item) => this.mapToEntityOption(entityType, item)),
      ),
      catchError(() => of([])),
    );
  }

  private mapToEntityOption(entityType: string, item: any): EntityOption {
    switch (entityType) {
      case 'Contact':
        return {
          id: item.id,
          name: item.fullName ?? `${item.firstName} ${item.lastName}`,
          detail: item.email ?? '',
        };
      case 'Company':
        return {
          id: item.id,
          name: item.name,
          detail: item.industry ?? '',
        };
      case 'Deal':
        return {
          id: item.id,
          name: item.title,
          detail: item.stageName ?? '',
        };
      case 'Lead':
        return {
          id: item.id,
          name: item.fullName ?? `${item.firstName} ${item.lastName}`,
          detail: item.email ?? '',
        };
      default:
        return { id: item.id, name: item.name ?? item.id, detail: '' };
    }
  }
}
