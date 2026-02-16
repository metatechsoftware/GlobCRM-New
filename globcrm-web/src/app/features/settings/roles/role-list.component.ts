import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PermissionService } from '../../../core/permissions/permission.service';
import { RoleDto } from '../../../core/permissions/permission.models';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.scss',
})
export class RoleListComponent implements OnInit {
  private readonly permissionService = inject(PermissionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  roles = signal<RoleDto[]>([]);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  displayedColumns = [
    'name',
    'description',
    'type',
    'permissionCount',
    'assignedUserCount',
    'actions',
  ];

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.permissionService.getRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Failed to load roles.');
        this.isLoading.set(false);
      },
    });
  }

  getRoleTypeLabel(role: RoleDto): string {
    if (role.isSystem) return 'System';
    if (role.isTemplate) return 'Template';
    return 'Custom';
  }

  getRoleTypeColor(role: RoleDto): string {
    if (role.isSystem) return 'warn';
    if (role.isTemplate) return 'accent';
    return 'primary';
  }

  onClone(role: RoleDto): void {
    const dialogRef = this.dialog.open(CloneRoleDialogComponent, {
      width: '400px',
      data: { roleName: role.name },
    });

    dialogRef.afterClosed().subscribe((newName: string | undefined) => {
      if (!newName) return;

      this.permissionService.cloneRole(role.id, newName).subscribe({
        next: (cloned) => {
          this.snackBar.open(
            `Role "${cloned.name}" cloned successfully.`,
            'Close',
            { duration: 3000 }
          );
          this.loadRoles();
        },
        error: (err) => {
          this.snackBar.open(
            err.message || 'Failed to clone role.',
            'Close',
            { duration: 5000 }
          );
        },
      });
    });
  }

  onDelete(role: RoleDto): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: role.name, type: 'role' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.permissionService.deleteRole(role.id).subscribe({
        next: () => {
          this.snackBar.open(
            `Role "${role.name}" deleted.`,
            'Close',
            { duration: 3000 }
          );
          this.loadRoles();
        },
        error: (err) => {
          this.snackBar.open(
            err.message || 'Failed to delete role.',
            'Close',
            { duration: 5000 }
          );
        },
      });
    });
  }

  onEdit(role: RoleDto): void {
    this.router.navigate(['/settings/roles', role.id]);
  }
}

// ---- Clone Role Dialog ----

@Component({
  selector: 'app-clone-role-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Clone Role</h2>
    <mat-dialog-content>
      <p>Create a new role based on "{{ data.roleName }}".</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>New Role Name</mat-label>
        <input matInput [(ngModel)]="newName" placeholder="Enter role name" maxlength="100" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!newName.trim()"
        (click)="dialogRef.close(newName.trim())"
      >
        Clone
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class CloneRoleDialogComponent {
  readonly dialogRef = inject(MatDialogRef<CloneRoleDialogComponent>);
  readonly data: { roleName: string } = inject(MAT_DIALOG_DATA);
  newName = '';
}

// ---- Confirm Delete Dialog ----

@Component({
  selector: 'app-confirm-delete-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Confirm Delete</h2>
    <mat-dialog-content>
      <p>Are you sure you want to delete the {{ data.type }} "{{ data.name }}"?</p>
      <p>This action cannot be undone.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="warn" [mat-dialog-close]="true">Delete</button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDeleteDialogComponent {
  readonly data: { name: string; type: string } = inject(MAT_DIALOG_DATA);
}
