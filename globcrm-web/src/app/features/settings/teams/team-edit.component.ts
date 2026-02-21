import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatListModule } from '@angular/material/list';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { PermissionService } from '../../../core/permissions/permission.service';
import { ApiService } from '../../../core/api/api.service';
import {
  TeamDetailDto,
  TeamMemberDto,
  RoleDto,
} from '../../../core/permissions/permission.models';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

interface DirectoryUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  avatarColor: string | null;
}

interface DirectoryResponse {
  items: DirectoryUser[];
  totalCount: number;
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-team-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    TranslocoPipe,
  ],
  templateUrl: './team-edit.component.html',
  styleUrl: './team-edit.component.scss',
})
export class TeamEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly transloco = inject(TranslocoService);

  mode = signal<'create' | 'edit'>('create');
  teamId = signal<string | null>(null);
  isLoading = signal(false);
  isSaving = signal(false);
  errorMessage = signal<string | null>(null);

  teamForm!: FormGroup;
  roles = signal<RoleDto[]>([]);
  members = signal<TeamMemberDto[]>([]);

  ngOnInit(): void {
    this.teamForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: [''],
      defaultRoleId: [null as string | null],
    });

    // Load roles for the default role dropdown
    this.permissionService.getRoles().subscribe({
      next: (roles) => this.roles.set(roles),
      error: () => {}, // Silently fail -- dropdown will be empty
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.mode.set('edit');
      this.teamId.set(id);
      this.loadTeam(id);
    }
  }

  private loadTeam(id: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.permissionService.getTeam(id).subscribe({
      next: (team: TeamDetailDto) => {
        this.teamForm.patchValue({
          name: team.name,
          description: team.description || '',
          defaultRoleId: team.defaultRoleId || null,
        });
        this.members.set(team.members);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Failed to load team.');
        this.isLoading.set(false);
      },
    });
  }

  onSave(): void {
    if (this.teamForm.invalid) {
      this.teamForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const { name, description, defaultRoleId } = this.teamForm.value;

    if (this.mode() === 'create') {
      this.permissionService
        .createTeam({
          name,
          description: description || null,
          defaultRoleId: defaultRoleId || null,
        })
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            this.snackBar.open(this.transloco.translate('settings.teamEdit.createSuccess'), 'Close', {
              duration: 3000,
            });
            this.router.navigate(['/settings/teams']);
          },
          error: (err) => {
            this.isSaving.set(false);
            this.errorMessage.set(err.message || 'Failed to create team.');
          },
        });
    } else {
      const id = this.teamId()!;
      this.permissionService
        .updateTeam(id, {
          name,
          description: description || null,
          defaultRoleId: defaultRoleId || null,
        })
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            this.snackBar.open(this.transloco.translate('settings.teamEdit.saveSuccess'), 'Close', {
              duration: 3000,
            });
            this.router.navigate(['/settings/teams']);
          },
          error: (err) => {
            this.isSaving.set(false);
            this.errorMessage.set(err.message || 'Failed to update team.');
          },
        });
    }
  }

  onAddMember(): void {
    const dialogRef = this.dialog.open(AddMemberDialogComponent, {
      width: '500px',
      data: { teamId: this.teamId() },
    });

    dialogRef.afterClosed().subscribe((added: boolean) => {
      if (added) {
        // Reload team to refresh member list
        this.loadTeam(this.teamId()!);
      }
    });
  }

  onRemoveMember(member: TeamMemberDto): void {
    const teamId = this.teamId()!;
    this.permissionService.removeTeamMember(teamId, member.userId).subscribe({
      next: () => {
        this.snackBar.open(
          `${member.firstName} ${member.lastName} removed from team.`,
          'Close',
          { duration: 3000 }
        );
        // Reload team to refresh member list
        this.loadTeam(teamId);
      },
      error: (err) => {
        this.snackBar.open(
          err.message || 'Failed to remove member.',
          'Close',
          { duration: 5000 }
        );
      },
    });
  }

  getInitials(member: TeamMemberDto): string {
    return (
      (member.firstName?.charAt(0) || '') +
      (member.lastName?.charAt(0) || '')
    ).toUpperCase();
  }

  get pageTitle(): string {
    return this.mode() === 'create'
      ? this.transloco.translate('settings.teamEdit.createTitle')
      : this.transloco.translate('settings.teamEdit.editTitle');
  }
}

// ---- Add Member Dialog ----

@Component({
  selector: 'app-add-member-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Add Team Member</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Search users</mat-label>
        <input
          matInput
          [formControl]="searchControl"
          [matAutocomplete]="auto"
          placeholder="Type to search by name or email..."
        />
        <mat-icon matSuffix>search</mat-icon>
        <mat-autocomplete
          #auto="matAutocomplete"
          (optionSelected)="onUserSelected($event.option.value)"
          [displayWith]="displayFn"
        >
          @for (user of searchResults(); track user.id) {
            <mat-option [value]="user">
              <div class="user-option">
                <div
                  class="user-avatar"
                  [style.background-color]="user.avatarColor || '#7c4dff'"
                >
                  {{ getInitials(user) }}
                </div>
                <div class="user-info">
                  <span class="user-name">{{ user.firstName }} {{ user.lastName }}</span>
                  <span class="user-email">{{ user.email }}</span>
                </div>
              </div>
            </mat-option>
          }
          @if (isSearching()) {
            <mat-option disabled>
              <mat-spinner diameter="20"></mat-spinner>
              Searching...
            </mat-option>
          }
          @if (!isSearching() && searchControl.value && searchResults().length === 0 && hasSearched()) {
            <mat-option disabled>No users found.</mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
      .user-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 4px 0;
      }
      .user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        font-weight: 500;
        flex-shrink: 0;
      }
      .user-info {
        display: flex;
        flex-direction: column;
      }
      .user-name {
        font-size: 14px;
        font-weight: 500;
      }
      .user-email {
        font-size: 12px;
        color: var(--color-text-secondary);
      }
    `,
  ],
})
export class AddMemberDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<AddMemberDialogComponent>
  );
  private readonly data: { teamId: string } = inject(MAT_DIALOG_DATA);
  private readonly permissionService = inject(PermissionService);
  private readonly apiService = inject(ApiService);
  private readonly snackBar = inject(MatSnackBar);

  searchControl = new FormControl('');
  searchResults = signal<DirectoryUser[]>([]);
  isSearching = signal(false);
  hasSearched = signal(false);

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => {
          if (typeof value !== 'string' || !value.trim()) {
            this.searchResults.set([]);
            this.hasSearched.set(false);
            return of(null);
          }
          this.isSearching.set(true);
          const params = new HttpParams().set('search', value.trim());
          return this.apiService.get<DirectoryResponse>(
            '/api/team-directory',
            params
          );
        })
      )
      .subscribe({
        next: (result) => {
          this.isSearching.set(false);
          if (result) {
            this.searchResults.set(result.items);
            this.hasSearched.set(true);
          }
        },
        error: () => {
          this.isSearching.set(false);
          this.searchResults.set([]);
        },
      });
  }

  onUserSelected(user: DirectoryUser): void {
    this.permissionService
      .addTeamMember(this.data.teamId, user.id)
      .subscribe({
        next: () => {
          this.snackBar.open(
            `${user.firstName} ${user.lastName} added to team.`,
            'Close',
            { duration: 3000 }
          );
          this.searchControl.setValue('');
          this.searchResults.set([]);
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.snackBar.open(
            err.message || 'Failed to add member.',
            'Close',
            { duration: 5000 }
          );
        },
      });
  }

  displayFn(user: DirectoryUser | string): string {
    if (typeof user === 'string') return user;
    return user ? `${user.firstName} ${user.lastName}` : '';
  }

  getInitials(user: DirectoryUser): string {
    return (
      (user.firstName?.charAt(0) || '') + (user.lastName?.charAt(0) || '')
    ).toUpperCase();
  }
}
