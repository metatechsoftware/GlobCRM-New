import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatRadioModule } from '@angular/material/radio';
import {
  WorkflowNode,
  WorkflowActionType,
  EntityField,
} from '../../workflow.models';

interface ActionFormState {
  actionType: WorkflowActionType;
  continueOnError: boolean;
  // Update Field
  updateFieldName: string;
  updateFieldValue: string;
  useDynamicMapping: boolean;
  dynamicSourceField: string;
  // Send Notification
  notificationTitle: string;
  notificationMessage: string;
  recipientType: string;
  specificUserId: string;
  teamId: string;
  // Create Activity
  activitySubject: string;
  activityType: string;
  activityPriority: string;
  dueDateOffset: number;
  assigneeType: string;
  assigneeUserId: string;
  // Send Email
  emailTemplateId: string;
  emailRecipientField: string;
  // Fire Webhook
  webhookUrl: string;
  webhookHeaders: string;
  webhookPayload: string;
  // Enroll in Sequence
  sequenceId: string;
  // Wait
  waitDuration: number;
  waitUnit: string;
  // Branch
  branchConditions: any[];
}

@Component({
  selector: 'app-action-config',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatRadioModule,
  ],
  template: `
    <div class="config-panel">
      <div class="config-panel__header">
        <mat-icon class="config-panel__icon" [class]="iconClass()">{{ headerIcon() }}</mat-icon>
        <h3>{{ headerTitle() }}</h3>
      </div>

      <div class="config-panel__body">
        <!-- Node type: action -->
        @if (nodeType() === 'action') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Action Type</mat-label>
            <mat-select [ngModel]="form().actionType"
                        (ngModelChange)="updateFormField('actionType', $event)">
              <mat-option value="updateField">Update Field</mat-option>
              <mat-option value="sendNotification">Send Notification</mat-option>
              <mat-option value="createActivity">Create Activity</mat-option>
              <mat-option value="sendEmail">Send Email</mat-option>
              <mat-option value="fireWebhook">Fire Webhook</mat-option>
              <mat-option value="enrollInSequence">Enroll in Sequence</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-slide-toggle
            [ngModel]="form().continueOnError"
            (ngModelChange)="updateFormField('continueOnError', $event)"
            class="continue-toggle">
            Continue on error
          </mat-slide-toggle>
        }

        <!-- Update Field -->
        @if (showSection('updateField')) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Field to Update</mat-label>
            <mat-select [ngModel]="form().updateFieldName"
                        (ngModelChange)="updateFormField('updateFieldName', $event)">
              @for (field of entityFields(); track field.name) {
                <mat-option [value]="field.name">{{ field.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-slide-toggle
            [ngModel]="form().useDynamicMapping"
            (ngModelChange)="updateFormField('useDynamicMapping', $event)"
            class="dynamic-toggle">
            Dynamic mapping
          </mat-slide-toggle>

          @if (form().useDynamicMapping) {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Source Field</mat-label>
              <mat-select [ngModel]="form().dynamicSourceField"
                          (ngModelChange)="updateFormField('dynamicSourceField', $event)">
                @for (field of entityFields(); track field.name) {
                  <mat-option [value]="field.name">{{ field.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          } @else {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>New Value</mat-label>
              <input matInput
                     [ngModel]="form().updateFieldValue"
                     (ngModelChange)="updateFormField('updateFieldValue', $event)" />
            </mat-form-field>
          }
        }

        <!-- Send Notification -->
        @if (showSection('sendNotification')) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Title</mat-label>
            <input matInput
                   [ngModel]="form().notificationTitle"
                   (ngModelChange)="updateFormField('notificationTitle', $event)" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Message</mat-label>
            <textarea matInput
                      rows="3"
                      [ngModel]="form().notificationMessage"
                      (ngModelChange)="updateFormField('notificationMessage', $event)">
            </textarea>
          </mat-form-field>

          <div class="config-panel__section-label">Recipient</div>
          <mat-radio-group [ngModel]="form().recipientType"
                           (ngModelChange)="updateFormField('recipientType', $event)"
                           class="recipient-group">
            <mat-radio-button value="recordOwner">Record Owner</mat-radio-button>
            <mat-radio-button value="dealOwner">Deal Owner</mat-radio-button>
            <mat-radio-button value="specificUser">Specific User</mat-radio-button>
            <mat-radio-button value="team">Team</mat-radio-button>
          </mat-radio-group>

          @if (form().recipientType === 'specificUser') {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>User ID</mat-label>
              <input matInput
                     [ngModel]="form().specificUserId"
                     (ngModelChange)="updateFormField('specificUserId', $event)"
                     placeholder="Enter user ID" />
            </mat-form-field>
          }

          @if (form().recipientType === 'team') {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Team ID</mat-label>
              <input matInput
                     [ngModel]="form().teamId"
                     (ngModelChange)="updateFormField('teamId', $event)"
                     placeholder="Enter team ID" />
            </mat-form-field>
          }
        }

        <!-- Create Activity -->
        @if (showSection('createActivity')) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Subject</mat-label>
            <input matInput
                   [ngModel]="form().activitySubject"
                   (ngModelChange)="updateFormField('activitySubject', $event)" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Activity Type</mat-label>
            <mat-select [ngModel]="form().activityType"
                        (ngModelChange)="updateFormField('activityType', $event)">
              <mat-option value="Call">Call</mat-option>
              <mat-option value="Meeting">Meeting</mat-option>
              <mat-option value="Task">Task</mat-option>
              <mat-option value="Email">Email</mat-option>
              <mat-option value="Other">Other</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Priority</mat-label>
            <mat-select [ngModel]="form().activityPriority"
                        (ngModelChange)="updateFormField('activityPriority', $event)">
              <mat-option value="Low">Low</mat-option>
              <mat-option value="Medium">Medium</mat-option>
              <mat-option value="High">High</mat-option>
              <mat-option value="Urgent">Urgent</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Due date (days from now)</mat-label>
            <input matInput
                   type="number"
                   min="0"
                   [ngModel]="form().dueDateOffset"
                   (ngModelChange)="updateFormField('dueDateOffset', $event)" />
          </mat-form-field>

          <div class="config-panel__section-label">Assignee</div>
          <mat-radio-group [ngModel]="form().assigneeType"
                           (ngModelChange)="updateFormField('assigneeType', $event)"
                           class="recipient-group">
            <mat-radio-button value="recordOwner">Record Owner</mat-radio-button>
            <mat-radio-button value="dealOwner">Deal Owner</mat-radio-button>
            <mat-radio-button value="specificUser">Specific User</mat-radio-button>
          </mat-radio-group>

          @if (form().assigneeType === 'specificUser') {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>User ID</mat-label>
              <input matInput
                     [ngModel]="form().assigneeUserId"
                     (ngModelChange)="updateFormField('assigneeUserId', $event)"
                     placeholder="Enter user ID" />
            </mat-form-field>
          }
        }

        <!-- Send Email -->
        @if (showSection('sendEmail')) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Email Template ID</mat-label>
            <input matInput
                   [ngModel]="form().emailTemplateId"
                   (ngModelChange)="updateFormField('emailTemplateId', $event)"
                   placeholder="Enter template ID" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Recipient Field</mat-label>
            <mat-select [ngModel]="form().emailRecipientField"
                        (ngModelChange)="updateFormField('emailRecipientField', $event)">
              @for (field of entityFields(); track field.name) {
                <mat-option [value]="field.name">{{ field.label }}</mat-option>
              }
              <mat-option value="email">Email (default)</mat-option>
            </mat-select>
          </mat-form-field>
        }

        <!-- Fire Webhook -->
        @if (showSection('fireWebhook')) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>URL</mat-label>
            <input matInput
                   [ngModel]="form().webhookUrl"
                   (ngModelChange)="updateFormField('webhookUrl', $event)"
                   placeholder="https://..." />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Headers (JSON, optional)</mat-label>
            <textarea matInput
                      rows="2"
                      [ngModel]="form().webhookHeaders"
                      (ngModelChange)="updateFormField('webhookHeaders', $event)"
                      placeholder='{"Authorization": "Bearer ..."}'>
            </textarea>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Payload Template (optional)</mat-label>
            <textarea matInput
                      rows="4"
                      [ngModel]="form().webhookPayload"
                      (ngModelChange)="updateFormField('webhookPayload', $event)"
                      [placeholder]="webhookPayloadPlaceholder">
            </textarea>
          </mat-form-field>
        }

        <!-- Enroll in Sequence -->
        @if (showSection('enrollInSequence')) {
          @if (entityType() !== 'Contact') {
            <div class="config-panel__warning">
              <mat-icon>warning</mat-icon>
              <span>Sequence enrollment is only available for Contact entity type.</span>
            </div>
          }

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Sequence ID</mat-label>
            <input matInput
                   [ngModel]="form().sequenceId"
                   (ngModelChange)="updateFormField('sequenceId', $event)"
                   placeholder="Enter sequence ID" />
          </mat-form-field>
        }

        <!-- Wait Node Config -->
        @if (nodeType() === 'wait') {
          <div class="config-panel__row">
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Duration</mat-label>
              <input matInput
                     type="number"
                     min="1"
                     [ngModel]="form().waitDuration"
                     (ngModelChange)="updateFormField('waitDuration', $event)" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Unit</mat-label>
              <mat-select [ngModel]="form().waitUnit"
                          (ngModelChange)="updateFormField('waitUnit', $event)">
                <mat-option value="minutes">Minutes</mat-option>
                <mat-option value="hours">Hours</mat-option>
                <mat-option value="days">Days</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .config-panel {
      padding: 16px;
    }

    .config-panel__header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;

      h3 {
        margin: 0;
        font-size: var(--text-md);
        font-weight: var(--font-semibold);
      }
    }

    .config-panel__icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .action-icon { color: #10B981; }
    .branch-icon { color: #8B5CF6; }
    .wait-icon { color: #6B7280; }

    .config-panel__body {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .full-width {
      width: 100%;
    }

    .flex-1 {
      flex: 1;
    }

    .config-panel__row {
      display: flex;
      gap: 8px;
    }

    .config-panel__section-label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-secondary);
      margin-top: 4px;
    }

    .continue-toggle,
    .dynamic-toggle {
      margin: 4px 0;
    }

    .recipient-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 8px;

      mat-radio-button {
        font-size: var(--text-sm);
      }
    }

    .config-panel__warning {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--color-warning-soft);
      border-radius: var(--radius-sm);
      font-size: var(--text-sm);
      color: var(--color-warning-text);

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--color-warning);
      }
    }

    ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    ::ng-deep .mat-mdc-form-field-infix {
      min-height: 36px;
      padding: 6px 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionConfigComponent {
  readonly node = input.required<WorkflowNode>();
  readonly entityType = input<string>('');
  readonly entityFields = input<EntityField[]>([]);
  readonly configChanged = output<Record<string, any>>();

  readonly nodeType = computed(() => this.node().type);
  readonly webhookPayloadPlaceholder = '{"event": "{{triggerType}}", "entity": "{{entityId}}"}';

  readonly headerIcon = computed(() => {
    switch (this.nodeType()) {
      case 'action': return 'play_arrow';
      case 'wait': return 'hourglass_empty';
      default: return 'settings';
    }
  });

  readonly headerTitle = computed(() => {
    switch (this.nodeType()) {
      case 'action': return 'Action Configuration';
      case 'wait': return 'Wait Configuration';
      default: return 'Configuration';
    }
  });

  readonly iconClass = computed(() => {
    switch (this.nodeType()) {
      case 'action': return 'action-icon';
      case 'wait': return 'wait-icon';
      default: return '';
    }
  });

  readonly form = signal<ActionFormState>({
    actionType: 'updateField',
    continueOnError: false,
    updateFieldName: '',
    updateFieldValue: '',
    useDynamicMapping: false,
    dynamicSourceField: '',
    notificationTitle: '',
    notificationMessage: '',
    recipientType: 'recordOwner',
    specificUserId: '',
    teamId: '',
    activitySubject: '',
    activityType: 'Task',
    activityPriority: 'Medium',
    dueDateOffset: 1,
    assigneeType: 'recordOwner',
    assigneeUserId: '',
    emailTemplateId: '',
    emailRecipientField: 'email',
    webhookUrl: '',
    webhookHeaders: '',
    webhookPayload: '',
    sequenceId: '',
    waitDuration: 1,
    waitUnit: 'hours',
    branchConditions: [],
  });

  constructor() {
    effect(() => {
      const config = this.node().config;
      if (config) {
        this.form.update((f) => ({
          ...f,
          actionType: config['actionType'] ?? f.actionType,
          continueOnError: config['continueOnError'] ?? f.continueOnError,
          updateFieldName: config['fieldName'] ?? f.updateFieldName,
          updateFieldValue: config['value'] ?? f.updateFieldValue,
          useDynamicMapping: config['useDynamicMapping'] ?? f.useDynamicMapping,
          dynamicSourceField: config['dynamicSourceField'] ?? f.dynamicSourceField,
          notificationTitle: config['title'] ?? f.notificationTitle,
          notificationMessage: config['message'] ?? f.notificationMessage,
          recipientType: config['recipientType'] ?? f.recipientType,
          specificUserId: config['specificUserId'] ?? f.specificUserId,
          teamId: config['teamId'] ?? f.teamId,
          activitySubject: config['subject'] ?? f.activitySubject,
          activityType: config['activityType'] ?? f.activityType,
          activityPriority: config['priority'] ?? f.activityPriority,
          dueDateOffset: config['dueDateOffset'] ?? f.dueDateOffset,
          assigneeType: config['assigneeType'] ?? f.assigneeType,
          assigneeUserId: config['assigneeUserId'] ?? f.assigneeUserId,
          emailTemplateId: config['emailTemplateId'] ?? f.emailTemplateId,
          emailRecipientField: config['emailRecipientField'] ?? f.emailRecipientField,
          webhookUrl: config['url'] ?? f.webhookUrl,
          webhookHeaders: config['headers'] ?? f.webhookHeaders,
          webhookPayload: config['payloadTemplate'] ?? f.webhookPayload,
          sequenceId: config['sequenceId'] ?? f.sequenceId,
          waitDuration: config['duration'] ?? f.waitDuration,
          waitUnit: config['unit'] ?? f.waitUnit,
        }));
      }
    });
  }

  showSection(actionType: string): boolean {
    if (this.nodeType() === 'action') {
      return this.form().actionType === actionType;
    }
    return false;
  }

  updateFormField(field: keyof ActionFormState, value: any): void {
    this.form.update((f) => ({ ...f, [field]: value }));
    this.emitConfig();
  }

  private emitConfig(): void {
    const f = this.form();
    const config: Record<string, any> = {};

    if (this.nodeType() === 'action') {
      config['actionType'] = f.actionType;
      config['continueOnError'] = f.continueOnError;

      switch (f.actionType) {
        case 'updateField':
          config['fieldName'] = f.updateFieldName;
          config['useDynamicMapping'] = f.useDynamicMapping;
          if (f.useDynamicMapping) {
            config['dynamicSourceField'] = f.dynamicSourceField;
          } else {
            config['value'] = f.updateFieldValue;
          }
          break;
        case 'sendNotification':
          config['title'] = f.notificationTitle;
          config['message'] = f.notificationMessage;
          config['recipientType'] = f.recipientType;
          if (f.recipientType === 'specificUser') {
            config['specificUserId'] = f.specificUserId;
          }
          if (f.recipientType === 'team') {
            config['teamId'] = f.teamId;
          }
          break;
        case 'createActivity':
          config['subject'] = f.activitySubject;
          config['activityType'] = f.activityType;
          config['priority'] = f.activityPriority;
          config['dueDateOffset'] = f.dueDateOffset;
          config['assigneeType'] = f.assigneeType;
          if (f.assigneeType === 'specificUser') {
            config['assigneeUserId'] = f.assigneeUserId;
          }
          break;
        case 'sendEmail':
          config['emailTemplateId'] = f.emailTemplateId;
          config['emailRecipientField'] = f.emailRecipientField;
          break;
        case 'fireWebhook':
          config['url'] = f.webhookUrl;
          config['headers'] = f.webhookHeaders;
          config['payloadTemplate'] = f.webhookPayload;
          break;
        case 'enrollInSequence':
          config['sequenceId'] = f.sequenceId;
          break;
      }
    }

    if (this.nodeType() === 'wait') {
      config['duration'] = f.waitDuration;
      config['unit'] = f.waitUnit;
    }

    this.configChanged.emit(config);
  }
}
