import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PermissionService } from '../../../core/permissions/permission.service';
import {
  RoleDetailDto,
  RolePermissionDto,
} from '../../../core/permissions/permission.models';
import { PermissionMatrixComponent } from './permission-matrix.component';

@Component({
  selector: 'app-role-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PermissionMatrixComponent,
  ],
  templateUrl: './role-edit.component.html',
  styleUrl: './role-edit.component.scss',
})
export class RoleEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);
  private readonly snackBar = inject(MatSnackBar);

  mode = signal<'create' | 'edit'>('create');
  roleId = signal<string | null>(null);
  isLoading = signal(false);
  isSaving = signal(false);
  errorMessage = signal<string | null>(null);

  roleForm!: FormGroup;
  currentPermissions = signal<RolePermissionDto[]>([]);
  matrixPermissions = signal<RolePermissionDto[]>([]);

  ngOnInit(): void {
    this.roleForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: [''],
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.mode.set('edit');
      this.roleId.set(id);
      this.loadRole(id);
    }
  }

  private loadRole(id: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.permissionService.getRole(id).subscribe({
      next: (role: RoleDetailDto) => {
        this.roleForm.patchValue({
          name: role.name,
          description: role.description || '',
        });
        this.currentPermissions.set(role.permissions);
        this.matrixPermissions.set(role.permissions);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Failed to load role.');
        this.isLoading.set(false);
      },
    });
  }

  onPermissionsChanged(permissions: RolePermissionDto[]): void {
    this.matrixPermissions.set(permissions);
  }

  onSave(): void {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const { name, description } = this.roleForm.value;
    const permissions = this.matrixPermissions();

    if (this.mode() === 'create') {
      this.permissionService
        .createRole({ name, description: description || null, permissions })
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            this.snackBar.open('Role created successfully.', 'Close', {
              duration: 3000,
            });
            this.router.navigate(['/settings/roles']);
          },
          error: (err) => {
            this.isSaving.set(false);
            this.errorMessage.set(err.message || 'Failed to create role.');
          },
        });
    } else {
      const id = this.roleId()!;
      this.permissionService
        .updateRole(id, {
          name,
          description: description || null,
          permissions,
        })
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            this.snackBar.open('Role updated successfully.', 'Close', {
              duration: 3000,
            });
            this.router.navigate(['/settings/roles']);
          },
          error: (err) => {
            this.isSaving.set(false);
            this.errorMessage.set(err.message || 'Failed to update role.');
          },
        });
    }
  }

  get pageTitle(): string {
    return this.mode() === 'create' ? 'Create Role' : 'Edit Role';
  }
}
