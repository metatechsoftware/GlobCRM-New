import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CustomFieldService } from '../../../core/custom-fields/custom-field.service';
import {
  CustomFieldDefinition,
  CustomFieldSection,
} from '../../../core/custom-fields/custom-field.models';
import { CustomFieldEditDialogComponent } from './custom-field-edit-dialog.component';

interface FieldGroup {
  sectionId: string | null;
  sectionName: string;
  sortOrder: number;
  fields: CustomFieldDefinition[];
}

const ENTITY_TYPES = [
  'Contact',
  'Company',
  'Deal',
  'Activity',
  'Quote',
  'Request',
  'Product',
];

@Component({
  selector: 'app-custom-field-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatTableModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatChipsModule,
    MatSlideToggleModule,
    MatDialogModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  templateUrl: './custom-field-list.component.html',
})
export class CustomFieldListComponent implements OnInit {
  private readonly fieldService = inject(CustomFieldService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly entityTypes = ENTITY_TYPES;
  readonly displayedColumns = ['label', 'name', 'fieldType', 'required', 'sortOrder', 'actions'];

  readonly selectedEntityType = signal<string>('Contact');
  readonly fields = signal<CustomFieldDefinition[]>([]);
  readonly sections = signal<CustomFieldSection[]>([]);
  readonly showDeleted = signal<boolean>(false);
  readonly loading = signal<boolean>(false);
  readonly showSectionManager = signal<boolean>(false);
  readonly newSectionName = signal<string>('');

  readonly fieldGroups = computed<FieldGroup[]>(() => {
    const allFields = this.fields();
    const allSections = this.sections();

    const sectionMap = new Map<string, CustomFieldSection>();
    for (const s of allSections) {
      sectionMap.set(s.id, s);
    }

    const grouped = new Map<string | null, CustomFieldDefinition[]>();
    for (const field of allFields) {
      const key = field.sectionId;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(field);
    }

    const groups: FieldGroup[] = [];

    // Named sections first (sorted by section sortOrder)
    for (const section of allSections.sort((a, b) => a.sortOrder - b.sortOrder)) {
      const sectionFields = grouped.get(section.id) ?? [];
      if (sectionFields.length > 0) {
        groups.push({
          sectionId: section.id,
          sectionName: section.name,
          sortOrder: section.sortOrder,
          fields: sectionFields.sort((a, b) => a.sortOrder - b.sortOrder),
        });
        grouped.delete(section.id);
      }
    }

    // General section (fields with no sectionId)
    const generalFields = grouped.get(null) ?? [];
    if (generalFields.length > 0) {
      groups.unshift({
        sectionId: null,
        sectionName: 'General',
        sortOrder: -1,
        fields: generalFields.sort((a, b) => a.sortOrder - b.sortOrder),
      });
    }

    // Any orphaned section fields
    for (const [key, fields] of grouped) {
      if (key !== null && fields.length > 0) {
        const section = sectionMap.get(key);
        groups.push({
          sectionId: key,
          sectionName: section?.name ?? 'Unknown Section',
          sortOrder: section?.sortOrder ?? 999,
          fields: fields.sort((a, b) => a.sortOrder - b.sortOrder),
        });
      }
    }

    return groups;
  });

  ngOnInit(): void {
    this.loadData();
  }

  onEntityTypeChange(entityType: string): void {
    this.selectedEntityType.set(entityType);
    this.loadData();
  }

  onTabChange(index: number): void {
    this.selectedEntityType.set(this.entityTypes[index]);
    this.loadData();
  }

  toggleShowDeleted(): void {
    this.showDeleted.update((v) => !v);
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const entityType = this.selectedEntityType();

    this.fieldService.getSections(entityType).subscribe({
      next: (sections) => this.sections.set(sections),
      error: () => this.sections.set([]),
    });

    this.fieldService.getFieldsByEntityType(entityType).subscribe({
      next: (fields) => {
        this.fields.set(fields);
        this.loading.set(false);
      },
      error: () => {
        this.fields.set([]);
        this.loading.set(false);
      },
    });
  }

  openAddDialog(): void {
    const dialogRef = this.dialog.open(CustomFieldEditDialogComponent, {
      width: '640px',
      maxHeight: '90vh',
      data: {
        mode: 'create' as const,
        entityType: this.selectedEntityType(),
        sections: this.sections(),
        existingFields: this.fields(),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadData();
        this.snackBar.open('Field created successfully', 'Close', { duration: 3000 });
      }
    });
  }

  openEditDialog(field: CustomFieldDefinition): void {
    const dialogRef = this.dialog.open(CustomFieldEditDialogComponent, {
      width: '640px',
      maxHeight: '90vh',
      data: {
        mode: 'edit' as const,
        field,
        entityType: this.selectedEntityType(),
        sections: this.sections(),
        existingFields: this.fields(),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadData();
        this.snackBar.open('Field updated successfully', 'Close', { duration: 3000 });
      }
    });
  }

  deleteField(field: CustomFieldDefinition): void {
    if (!confirm(`Are you sure you want to delete "${field.label}"?`)) {
      return;
    }
    this.fieldService.deleteField(field.id).subscribe({
      next: () => {
        this.loadData();
        this.snackBar.open('Field deleted', 'Close', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to delete field', 'Close', { duration: 3000 });
      },
    });
  }

  restoreField(field: CustomFieldDefinition): void {
    this.fieldService.restoreField(field.id).subscribe({
      next: () => {
        this.loadData();
        this.snackBar.open('Field restored', 'Close', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to restore field', 'Close', { duration: 3000 });
      },
    });
  }

  toggleSectionManager(): void {
    this.showSectionManager.update((v) => !v);
  }

  getFieldTypeColor(type: string): string {
    const colors: Record<string, string> = {
      Text: 'primary',
      Number: 'accent',
      Date: 'primary',
      Dropdown: 'accent',
      Checkbox: 'primary',
      MultiSelect: 'accent',
      Currency: 'primary',
      File: 'accent',
      Relation: 'primary',
    };
    return colors[type] ?? 'primary';
  }
}
