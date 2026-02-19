import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { FormsModule } from '@angular/forms';
import { ReportStore } from '../report.store';
import { ReportListItem } from '../report.models';
import { ReportCardComponent } from './report-card.component';

/**
 * Report gallery page with card grid layout showing SVG chart thumbnails.
 * Features category and entity type filters, search, responsive card grid,
 * loading skeletons, empty state, and pagination.
 *
 * Card grid is consistent with workflow/template card grids (locked decision).
 */
@Component({
  selector: 'app-report-gallery',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    ReportCardComponent,
  ],
  providers: [ReportStore],
  templateUrl: './report-gallery.component.html',
  styleUrl: './report-gallery.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportGalleryComponent implements OnInit {
  readonly store = inject(ReportStore);
  private readonly router = inject(Router);

  readonly categoryFilter = signal<string>('');
  readonly entityTypeFilter = signal<string>('');
  readonly searchFilter = signal<string>('');

  readonly entityTypes = [
    { value: '', label: 'All Entity Types' },
    { value: 'Contact', label: 'Contact' },
    { value: 'Company', label: 'Company' },
    { value: 'Deal', label: 'Deal' },
    { value: 'Lead', label: 'Lead' },
    { value: 'Activity', label: 'Activity' },
    { value: 'Quote', label: 'Quote' },
    { value: 'Request', label: 'Request' },
    { value: 'Product', label: 'Product' },
  ];

  /** Computed list of category options from loaded categories */
  readonly categoryOptions = computed(() => {
    const cats = this.store.categories();
    return [
      { value: '', label: 'All Categories' },
      ...cats.map((c) => ({ value: c.id, label: c.name })),
    ];
  });

  /** Skeleton items for loading state */
  readonly skeletonItems = [1, 2, 3, 4, 5, 6];

  ngOnInit(): void {
    this.store.loadCategories();
    this.loadReports();
  }

  onCategoryChange(value: string): void {
    this.categoryFilter.set(value);
    this.loadReports();
  }

  onEntityTypeChange(value: string): void {
    this.entityTypeFilter.set(value);
    this.loadReports();
  }

  onSearchChange(value: string): void {
    this.searchFilter.set(value);
    this.loadReports();
  }

  onPageChange(event: PageEvent): void {
    this.store.loadReports({
      categoryId: this.categoryFilter() || undefined,
      entityType: this.entityTypeFilter() || undefined,
      search: this.searchFilter() || undefined,
      page: event.pageIndex + 1,
      pageSize: event.pageSize,
    });
  }

  onCardClick(report: ReportListItem): void {
    this.router.navigate(['/reports', report.id]);
  }

  private loadReports(): void {
    this.store.loadReports({
      categoryId: this.categoryFilter() || undefined,
      entityType: this.entityTypeFilter() || undefined,
      search: this.searchFilter() || undefined,
    });
  }
}
