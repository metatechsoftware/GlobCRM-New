import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RolePermissionDto } from '../../../core/permissions/permission.models';

/** All entity types in the CRM system */
const ENTITY_TYPES = [
  'Contact',
  'Company',
  'Deal',
  'Activity',
  'Quote',
  'Request',
  'Product',
] as const;

/** CRUD operations */
const OPERATIONS = ['View', 'Create', 'Edit', 'Delete'] as const;

/** Permission scope options */
const SCOPES = ['none', 'own', 'team', 'all'] as const;

type Scope = (typeof SCOPES)[number];

/** Display labels for scopes */
const SCOPE_LABELS: Record<Scope, string> = {
  none: 'None',
  own: 'Own',
  team: 'Team',
  all: 'All',
};

/** CSS classes for scope color coding */
const SCOPE_CLASSES: Record<Scope, string> = {
  none: 'scope-none',
  own: 'scope-own',
  team: 'scope-team',
  all: 'scope-all',
};

interface MatrixCell {
  entityType: string;
  operation: string;
  scope: Scope;
}

@Component({
  selector: 'app-permission-matrix',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './permission-matrix.component.html',
  styleUrl: './permission-matrix.component.scss',
})
export class PermissionMatrixComponent implements OnInit {
  /** Input permissions (initial state) */
  permissions = input<RolePermissionDto[]>([]);

  /** Output: emitted on any permission change */
  permissionsChanged = output<RolePermissionDto[]>();

  /** Internal matrix state: 2D map [entityType][operation] -> scope */
  matrix = signal<Record<string, Record<string, Scope>>>({});

  /** Quick-set values for each operation column */
  quickSet = signal<Record<string, Scope | ''>>({
    View: '',
    Create: '',
    Edit: '',
    Delete: '',
  });

  readonly entityTypes = ENTITY_TYPES;
  readonly operations = OPERATIONS;
  readonly scopes = SCOPES;
  readonly scopeLabels = SCOPE_LABELS;
  readonly scopeClasses = SCOPE_CLASSES;

  /** Flat list of all permissions derived from the matrix */
  flatPermissions = computed<RolePermissionDto[]>(() => {
    const m = this.matrix();
    const result: RolePermissionDto[] = [];
    for (const entityType of ENTITY_TYPES) {
      for (const operation of OPERATIONS) {
        const scope = m[entityType]?.[operation] ?? 'none';
        result.push({ entityType, operation, scope });
      }
    }
    return result;
  });

  constructor() {
    // Sync input permissions to matrix when they change
    effect(() => {
      const perms = this.permissions();
      this.initializeMatrix(perms);
    });
  }

  ngOnInit(): void {
    // Matrix is initialized via effect on permissions input
  }

  /** Build the 2D matrix from a flat permission array */
  private initializeMatrix(perms: RolePermissionDto[]): void {
    const m: Record<string, Record<string, Scope>> = {};

    // Initialize all cells to 'none'
    for (const entityType of ENTITY_TYPES) {
      m[entityType] = {};
      for (const operation of OPERATIONS) {
        m[entityType][operation] = 'none';
      }
    }

    // Apply provided permissions
    for (const p of perms) {
      if (m[p.entityType] && OPERATIONS.includes(p.operation as any)) {
        m[p.entityType][p.operation] = p.scope as Scope;
      }
    }

    this.matrix.set(m);
  }

  /** Get the scope for a specific cell */
  getScope(entityType: string, operation: string): Scope {
    return this.matrix()[entityType]?.[operation] ?? 'none';
  }

  /** Get the CSS class for a scope value */
  getScopeClass(scope: Scope): string {
    return this.scopeClasses[scope] || 'scope-none';
  }

  /** Update a single cell */
  onCellChange(entityType: string, operation: string, scope: Scope): void {
    this.matrix.update((m) => {
      const updated = { ...m };
      updated[entityType] = { ...updated[entityType], [operation]: scope };
      return updated;
    });
    this.emitChanges();
  }

  /** Quick-set all entities for a given operation to the selected scope */
  onQuickSet(operation: string, scope: Scope | ''): void {
    if (!scope) return;

    this.matrix.update((m) => {
      const updated = { ...m };
      for (const entityType of ENTITY_TYPES) {
        updated[entityType] = { ...updated[entityType], [operation]: scope };
      }
      return updated;
    });

    // Reset the quick-set dropdown after applying
    this.quickSet.update((qs) => ({ ...qs, [operation]: '' }));
    this.emitChanges();
  }

  /** Emit the current flat permissions */
  private emitChanges(): void {
    this.permissionsChanged.emit(this.flatPermissions());
  }

  /** Get quick-set value for an operation */
  getQuickSetValue(operation: string): Scope | '' {
    return this.quickSet()[operation] ?? '';
  }
}
