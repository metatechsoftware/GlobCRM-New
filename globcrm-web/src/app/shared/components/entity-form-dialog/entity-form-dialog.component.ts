import {
  Component,
  ChangeDetectionStrategy,
  inject,
  viewChild,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ContactFormComponent } from '../../../features/contacts/contact-form/contact-form.component';
import { CompanyFormComponent } from '../../../features/companies/company-form/company-form.component';
import { DealFormComponent } from '../../../features/deals/deal-form/deal-form.component';
import { ActivityFormComponent } from '../../../features/activities/activity-form/activity-form.component';
import { ProductFormComponent } from '../../../features/products/product-form/product-form.component';
import { LeadFormComponent } from '../../../features/leads/lead-form/lead-form.component';
import {
  EntityFormDialogData,
  EntityFormDialogResult,
  CreateDialogEntityType,
} from './entity-form-dialog.models';

@Component({
  selector: 'app-entity-form-dialog',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    ContactFormComponent,
    CompanyFormComponent,
    DealFormComponent,
    ActivityFormComponent,
    ProductFormComponent,
    LeadFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .dialog-form-content {
      min-height: 200px;
      max-height: 65vh;
      overflow-y: auto;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
  template: `
    <h2 mat-dialog-title>New {{ data.entityType }}</h2>

    <mat-dialog-content class="dialog-form-content">
      @switch (data.entityType) {
        @case ('Contact') {
          <app-contact-form
            [dialogMode]="true"
            (entityCreated)="onEntityCreated($event)"
            (entityCreateError)="onCreateError()" />
        }
        @case ('Company') {
          <app-company-form
            [dialogMode]="true"
            (entityCreated)="onEntityCreated($event)"
            (entityCreateError)="onCreateError()" />
        }
        @case ('Deal') {
          <app-deal-form
            [dialogMode]="true"
            (entityCreated)="onEntityCreated($event)"
            (entityCreateError)="onCreateError()" />
        }
        @case ('Activity') {
          <app-activity-form
            [dialogMode]="true"
            (entityCreated)="onEntityCreated($event)"
            (entityCreateError)="onCreateError()" />
        }
        @case ('Product') {
          <app-product-form
            [dialogMode]="true"
            (entityCreated)="onEntityCreated($event)"
            (entityCreateError)="onCreateError()" />
        }
        @case ('Lead') {
          <app-lead-form
            [dialogMode]="true"
            (entityCreated)="onEntityCreated($event)"
            (entityCreateError)="onCreateError()" />
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions class="dialog-actions">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-stroked-button
              [disabled]="isSaving()"
              (click)="submitAndClose()">
        @if (isSaving() && pendingAction() === 'close') {
          <mat-spinner diameter="18"></mat-spinner>
        }
        Create & Close
      </button>
      <button mat-raised-button color="primary"
              [disabled]="isSaving()"
              (click)="submitAndView()">
        @if (isSaving() && pendingAction() === 'view') {
          <mat-spinner diameter="18"></mat-spinner>
        }
        Create & View
      </button>
    </mat-dialog-actions>
  `,
})
export class EntityFormDialogComponent {
  readonly data = inject<EntityFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<EntityFormDialogComponent>);
  private readonly snackBar = inject(MatSnackBar);

  /** ViewChild references for each entity form. */
  private readonly contactForm = viewChild(ContactFormComponent);
  private readonly companyForm = viewChild(CompanyFormComponent);
  private readonly dealForm = viewChild(DealFormComponent);
  private readonly activityForm = viewChild(ActivityFormComponent);
  private readonly productForm = viewChild(ProductFormComponent);
  private readonly leadForm = viewChild(LeadFormComponent);

  /** Track saving state and which action button was clicked. */
  isSaving = signal(false);
  pendingAction = signal<'close' | 'view' | null>(null);

  /** Stored created entity for dialog result. */
  private createdEntity: any = null;

  /** Get the active form component based on entity type. */
  private getActiveForm(): { triggerSubmit: () => void } | undefined {
    switch (this.data.entityType) {
      case 'Contact': return this.contactForm();
      case 'Company': return this.companyForm();
      case 'Deal': return this.dealForm();
      case 'Activity': return this.activityForm();
      case 'Product': return this.productForm();
      case 'Lead': return this.leadForm();
    }
  }

  submitAndClose(): void {
    this.pendingAction.set('close');
    this.isSaving.set(true);
    const form = this.getActiveForm();
    if (form) {
      form.triggerSubmit();
    }
  }

  submitAndView(): void {
    this.pendingAction.set('view');
    this.isSaving.set(true);
    const form = this.getActiveForm();
    if (form) {
      form.triggerSubmit();
    }
  }

  onEntityCreated(entity: any): void {
    this.isSaving.set(false);
    this.createdEntity = entity;
    const action = this.pendingAction() ?? 'close';
    this.snackBar.open(`${this.data.entityType} created successfully`, 'Close', {
      duration: 3000,
    });
    this.dialogRef.close({
      entity: this.createdEntity,
      action,
    } as EntityFormDialogResult);
  }

  onCreateError(): void {
    this.isSaving.set(false);
    this.pendingAction.set(null);
    this.snackBar.open(`Failed to create ${this.data.entityType.toLowerCase()}`, 'Close', {
      duration: 5000,
    });
  }
}
