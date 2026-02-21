import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    HasPermissionDirective,
    TranslocoPipe,
  ],
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.scss',
})
export class RoleListComponent implements OnInit {
  private readonly permissionService = inject(PermissionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  roles = signal<RoleDto[]>([]);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

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
    if (role.isSystem) return this.transloco.translate('settings.roles.system');
    if (role.isTemplate) return this.transloco.translate('settings.roles.template');
    return this.transloco.translate('settings.roles.custom');
  }

  getRoleIcon(role: RoleDto): string {
    if (role.isSystem) return 'admin_panel_settings';
    if (role.isTemplate) return 'content_copy';
    return 'shield';
  }

  getRoleAccentColor(role: RoleDto): string {
    if (role.isSystem) return 'var(--color-primary)';
    if (role.isTemplate) return 'var(--color-secondary)';
    return 'var(--color-accent)';
  }

  getRoleAccentSoft(role: RoleDto): string {
    if (role.isSystem) return 'var(--color-primary-soft)';
    if (role.isTemplate) return 'var(--color-secondary-soft)';
    return 'var(--color-accent-soft)';
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
            this.transloco.translate('settings.roles.cloneSuccess', { name: cloned.name }),
            'Close',
            { duration: 3000 }
          );
          this.loadRoles();
        },
        error: (err) => {
          this.snackBar.open(
            err.message || this.transloco.translate('settings.roles.cloneFailed'),
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
            this.transloco.translate('settings.roles.deleteSuccess', { name: role.name }),
            'Close',
            { duration: 3000 }
          );
          this.loadRoles();
        },
        error: (err) => {
          this.snackBar.open(
            err.message || this.transloco.translate('settings.roles.deleteFailed'),
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
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'settings.roles.cloneDialog.title' | transloco }}</h2>
    <mat-dialog-content>
      <p>{{ 'settings.roles.cloneDialog.message' | transloco: { roleName: data.roleName } }}</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ 'settings.roles.cloneDialog.newName' | transloco }}</mat-label>
        <input matInput [(ngModel)]="newName" [placeholder]="'settings.roles.cloneDialog.newNamePlaceholder' | transloco" maxlength="100" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'settings.roles.cloneDialog.cancel' | transloco }}</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!newName.trim()"
        (click)="dialogRef.close(newName.trim())"
      >
        {{ 'settings.roles.cloneDialog.clone' | transloco }}
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
