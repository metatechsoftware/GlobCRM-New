import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
} from '@angular/forms';
import {
  MatDialogRef,
  MatDialogModule,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { EmailService } from '../email.service';
import { SendEmailRequest } from '../email.models';

/**
 * Dialog data for compose/reply.
 * When replying to a thread, pass replyToThreadId and optionally prefill to/subject.
 */
export interface ComposeDialogData {
  replyToThreadId?: string;
  to?: string;
  subject?: string;
}

/**
 * MatDialog for composing and sending emails.
 * Supports new email composition and thread replies.
 * Rich text editor deferred to Phase 11 -- uses simple textarea.
 *
 * On send success: shows snackbar, closes dialog with result.
 * On send error: shows error snackbar, keeps dialog open.
 */
@Component({
  selector: 'app-email-compose',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .compose-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 500px;
    }

    .compose-form mat-form-field {
      width: 100%;
    }

    .compose-form textarea {
      min-height: 200px;
      resize: vertical;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }

    .send-btn {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .send-spinner {
      display: inline-flex;
    }
  `,
  template: `
    <h2 mat-dialog-title>
      {{ (isReply ? 'emails.compose.replyTitle' : 'emails.compose.title') | transloco }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="compose-form">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'emails.compose.to' | transloco }}</mat-label>
          <input matInput formControlName="to" type="email" [placeholder]="'emails.compose.toPlaceholder' | transloco">
          @if (form.controls.to.hasError('required') && form.controls.to.touched) {
            <mat-error>{{ 'emails.messages.recipientRequired' | transloco }}</mat-error>
          }
          @if (form.controls.to.hasError('email') && form.controls.to.touched) {
            <mat-error>{{ 'emails.messages.validEmail' | transloco }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ 'emails.compose.subject' | transloco }}</mat-label>
          <input matInput formControlName="subject" [placeholder]="'emails.compose.subjectPlaceholder' | transloco">
          @if (form.controls.subject.hasError('required') && form.controls.subject.touched) {
            <mat-error>{{ 'emails.messages.subjectRequired' | transloco }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ 'emails.compose.body' | transloco }}</mat-label>
          <textarea matInput formControlName="htmlBody"
                    [placeholder]="'emails.compose.bodyPlaceholder' | transloco"
                    rows="10"></textarea>
          @if (form.controls.htmlBody.hasError('required') && form.controls.htmlBody.touched) {
            <mat-error>{{ 'emails.messages.bodyRequired' | transloco }}</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button mat-dialog-close>{{ 'emails.compose.cancel' | transloco }}</button>
      <button mat-raised-button color="primary"
              [disabled]="form.invalid || sending()"
              (click)="onSend()">
        <span class="send-btn">
          @if (sending()) {
            <mat-spinner diameter="18" class="send-spinner"></mat-spinner>
            {{ 'emails.compose.sending' | transloco }}
          } @else {
            <mat-icon>send</mat-icon>
            {{ 'emails.compose.send' | transloco }}
          }
        </span>
      </button>
    </mat-dialog-actions>
  `,
})
export class EmailComposeComponent {
  private readonly dialogRef = inject(MatDialogRef<EmailComposeComponent>);
  private readonly emailService = inject(EmailService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  private readonly fb = inject(FormBuilder);
  private readonly dialogData: ComposeDialogData | null = inject(MAT_DIALOG_DATA, { optional: true });

  /** Whether this is a reply (thread context). */
  readonly isReply = !!this.dialogData?.replyToThreadId;

  /** Loading state for send button. */
  readonly sending = signal(false);

  /** Compose form with to, subject, body fields. */
  readonly form = this.fb.group({
    to: [this.dialogData?.to ?? '', [Validators.required, Validators.email]],
    subject: [this.dialogData?.subject ?? '', [Validators.required]],
    htmlBody: ['', [Validators.required]],
  });

  /** Send the email via EmailService. */
  onSend(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.sending.set(true);

    const request: SendEmailRequest = {
      to: this.form.value.to!,
      subject: this.form.value.subject!,
      htmlBody: this.form.value.htmlBody!,
      replyToThreadId: this.dialogData?.replyToThreadId,
    };

    this.emailService.send(request).subscribe({
      next: () => {
        this.snackBar.open(this.transloco.translate('emails.messages.sent'), 'OK', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.sending.set(false);
        const message = err?.error?.message ?? err?.message ?? this.transloco.translate('emails.messages.sendFailed');
        this.snackBar.open(message, 'OK', { duration: 5000 });
      },
    });
  }
}
