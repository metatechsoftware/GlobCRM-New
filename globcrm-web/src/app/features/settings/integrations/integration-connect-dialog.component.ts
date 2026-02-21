import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import {
  IntegrationCatalogItem,
  CredentialFieldDef,
} from './integration.models';

export interface ConnectDialogData {
  catalogItem: IntegrationCatalogItem;
}

export interface ConnectDialogResult {
  credentials: Record<string, string>;
}

@Component({
  selector: 'app-integration-connect-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="cd-title">
      <img
        [src]="data.catalogItem.iconPath"
        [alt]="data.catalogItem.name"
        class="cd-title__icon"
      />
      Connect {{ data.catalogItem.name }}
    </h2>

    <mat-dialog-content class="cd-content">
      <p class="cd-content__desc">
        Enter your credentials to connect {{ data.catalogItem.name }} with GlobCRM.
      </p>

      <form [formGroup]="form" class="cd-form">
        @for (field of data.catalogItem.credentialFields; track field.key) {
          <mat-form-field appearance="outline" class="cd-form__field">
            <mat-label>{{ field.label }}</mat-label>
            <input
              matInput
              [formControlName]="field.key"
              [type]="field.type"
              [placeholder]="field.placeholder ?? ''"
            />
            @if (form.get(field.key)?.hasError('required') && form.get(field.key)?.touched) {
              <mat-error>{{ field.label }} is required</mat-error>
            }
          </mat-form-field>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="cd-actions">
      <button mat-button mat-dialog-close class="cd-actions__cancel">
        Cancel
      </button>
      <button
        mat-flat-button
        class="cd-actions__connect"
        [disabled]="form.invalid"
        (click)="onSubmit()"
      >
        <mat-icon>power</mat-icon>
        Connect
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .cd-title {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .cd-title__icon {
        width: 28px;
        height: 28px;
        object-fit: contain;
      }

      .cd-content {
        min-width: 380px;
      }

      .cd-content__desc {
        font-size: 13.5px;
        color: var(--color-text-secondary);
        margin: 0 0 20px;
        line-height: 1.5;
      }

      .cd-form {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .cd-form__field {
        width: 100%;
      }

      .cd-actions__connect {
        background: var(--color-primary) !important;
        color: var(--color-primary-fg) !important;
        font-weight: 600;
      }

      .cd-actions__connect mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 4px;
      }
    `,
  ],
})
export class IntegrationConnectDialogComponent implements OnInit {
  readonly data = inject<ConnectDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<IntegrationConnectDialogComponent>);

  form!: FormGroup;

  ngOnInit(): void {
    const controls: Record<string, FormControl> = {};
    for (const field of this.data.catalogItem.credentialFields) {
      controls[field.key] = new FormControl('', field.required ? Validators.required : []);
    }
    this.form = new FormGroup(controls);
  }

  onSubmit(): void {
    if (this.form.valid) {
      const credentials: Record<string, string> = this.form.value;
      this.dialogRef.close({ credentials } as ConnectDialogResult);
    }
  }
}
