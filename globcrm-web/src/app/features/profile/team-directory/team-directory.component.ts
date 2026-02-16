import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import {
  ProfileService,
  TeamMemberDto,
  PaginatedResult,
} from '../profile.service';

@Component({
  selector: 'app-team-directory',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatCardModule,
    MatPaginatorModule,
    AvatarComponent,
  ],
  templateUrl: './team-directory.component.html',
})
export class TeamDirectoryComponent implements OnInit, OnDestroy {
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject = new Subject<string>();

  readonly loading = signal<boolean>(true);
  readonly members = signal<TeamMemberDto[]>([]);
  readonly totalCount = signal<number>(0);
  readonly searchQuery = signal<string>('');
  readonly selectedDepartment = signal<string>('');
  readonly page = signal<number>(1);
  readonly pageSize = signal<number>(12);
  readonly departments = signal<string[]>([]);

  ngOnInit(): void {
    // Debounce search input
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((query) => {
        this.searchQuery.set(query);
        this.page.set(1);
        this.loadMembers();
      });

    this.loadMembers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(value: string): void {
    this.searchSubject.next(value);
  }

  onDepartmentChange(department: string): void {
    this.selectedDepartment.set(department);
    this.page.set(1);
    this.loadMembers();
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.loadMembers();
  }

  viewProfile(member: TeamMemberDto): void {
    this.router.navigate(['/profile', member.id]);
  }

  private loadMembers(): void {
    this.loading.set(true);
    this.profileService
      .getTeamDirectory({
        search: this.searchQuery() || undefined,
        department: this.selectedDepartment() || undefined,
        page: this.page(),
        pageSize: this.pageSize(),
      })
      .subscribe({
        next: (result) => {
          this.members.set(result.items);
          this.totalCount.set(result.totalCount);

          // Extract unique departments from results for filter dropdown
          const depts = new Set<string>();
          for (const member of result.items) {
            if (member.department) {
              depts.add(member.department);
            }
          }
          // Merge with existing departments
          const current = new Set(this.departments());
          for (const d of depts) {
            current.add(d);
          }
          this.departments.set(Array.from(current).sort());

          this.loading.set(false);
        },
        error: () => {
          this.members.set([]);
          this.loading.set(false);
        },
      });
  }
}
