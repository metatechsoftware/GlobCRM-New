import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import {
  CdkDragDrop,
  CdkDrag,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { PipelineService } from '../../deals/pipeline.service';
import {
  PipelineDetailDto,
  CreatePipelineRequest,
  UpdatePipelineRequest,
  CreateStageRequest,
} from '../../deals/deal.models';

@Component({
  selector: 'app-pipeline-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatChipsModule,
    MatExpansionModule,
    CdkDrag,
    CdkDropList,
  ],
  template: `
    <div class="pipeline-edit-container">
      <div class="page-header">
        <button mat-icon-button routerLink="/settings/pipelines">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>{{ pageTitle }}</h1>
      </div>

      @if (isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Loading pipeline...</p>
        </div>
      } @else if (errorMessage() && mode() === 'edit' && !pipelineForm.dirty) {
        <div class="error-container">
          <mat-icon class="error-icon">error_outline</mat-icon>
          <p>{{ errorMessage() }}</p>
          <button mat-flat-button color="primary" routerLink="/settings/pipelines">
            Back to Pipelines
          </button>
        </div>
      } @else {
        <mat-card class="pipeline-form-card">
          <mat-card-content>
            <form [formGroup]="pipelineForm" class="pipeline-form">
              <h2 class="section-title">Pipeline Details</h2>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Pipeline Name</mat-label>
                <input
                  matInput
                  formControlName="name"
                  placeholder="Enter pipeline name"
                  maxlength="200"
                />
                @if (pipelineForm.get('name')?.hasError('required') && pipelineForm.get('name')?.touched) {
                  <mat-error>Pipeline name is required.</mat-error>
                }
                @if (pipelineForm.get('name')?.hasError('maxlength')) {
                  <mat-error>Pipeline name must be 200 characters or less.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Description</mat-label>
                <textarea
                  matInput
                  formControlName="description"
                  placeholder="Optional description"
                  rows="3"
                ></textarea>
              </mat-form-field>

              <mat-checkbox formControlName="isDefault">
                Set as default pipeline
              </mat-checkbox>
            </form>

            <!-- Stage Management Section -->
            <div class="stages-section">
              <div class="stages-header">
                <h2 class="section-title">Stages</h2>
                <button mat-stroked-button color="primary" (click)="addStage()">
                  <mat-icon>add</mat-icon>
                  Add Stage
                </button>
              </div>

              <!-- Stage Preview -->
              @if (stagesArray.length > 0) {
                <div class="stage-preview">
                  @for (stage of stagesArray.controls; track stage; let i = $index) {
                    <div class="stage-chip"
                      [style.background-color]="stage.get('color')?.value || '#9e9e9e'"
                      [style.color]="getContrastColor(stage.get('color')?.value || '#9e9e9e')"
                    >
                      {{ stage.get('name')?.value || 'Unnamed' }}
                      <span class="stage-probability">{{ stage.get('defaultProbability')?.value || 0 }}%</span>
                    </div>
                  }
                </div>
              }

              <!-- Draggable Stage List -->
              <div cdkDropList
                class="stage-list"
                (cdkDropListDropped)="onStageDrop($event)"
              >
                @for (stage of stagesArray.controls; track stage; let i = $index) {
                  <div class="stage-item" cdkDrag [formGroup]="getStageFormGroup(i)">
                    <div class="stage-drag-handle" cdkDragHandle>
                      <mat-icon>drag_indicator</mat-icon>
                    </div>

                    <div class="stage-content">
                      <div class="stage-row">
                        <mat-form-field appearance="outline" class="stage-name-field">
                          <mat-label>Stage Name</mat-label>
                          <input matInput formControlName="name" placeholder="e.g. Qualification" />
                          @if (getStageFormGroup(i).get('name')?.hasError('required') && getStageFormGroup(i).get('name')?.touched) {
                            <mat-error>Stage name is required.</mat-error>
                          }
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="stage-color-field">
                          <mat-label>Color</mat-label>
                          <input matInput formControlName="color" placeholder="#4caf50" maxlength="7" />
                          @if (getStageFormGroup(i).get('color')?.hasError('pattern')) {
                            <mat-error>Must be a hex color (e.g. #4caf50).</mat-error>
                          }
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="stage-probability-field">
                          <mat-label>Probability %</mat-label>
                          <input matInput type="number" formControlName="defaultProbability"
                            min="0" max="100" />
                        </mat-form-field>

                        <mat-checkbox formControlName="isWon" class="stage-checkbox">Won</mat-checkbox>
                        <mat-checkbox formControlName="isLost" class="stage-checkbox">Lost</mat-checkbox>

                        <button mat-icon-button color="warn" (click)="removeStage(i)"
                          matTooltip="Remove stage">
                          <mat-icon>close</mat-icon>
                        </button>
                      </div>

                      <!-- Required Fields (expandable) -->
                      <mat-expansion-panel class="required-fields-panel">
                        <mat-expansion-panel-header>
                          <mat-panel-title>
                            Required Fields
                            @if (getRequiredFieldCount(i) > 0) {
                              <span class="required-count">({{ getRequiredFieldCount(i) }})</span>
                            }
                          </mat-panel-title>
                        </mat-expansion-panel-header>
                        <div class="required-fields-grid" formGroupName="requiredFields">
                          <mat-checkbox formControlName="value">Deal Value</mat-checkbox>
                          <mat-checkbox formControlName="probability">Probability</mat-checkbox>
                          <mat-checkbox formControlName="expectedCloseDate">Expected Close Date</mat-checkbox>
                          <mat-checkbox formControlName="companyId">Company</mat-checkbox>
                          <mat-checkbox formControlName="ownerId">Owner</mat-checkbox>
                        </div>
                      </mat-expansion-panel>
                    </div>
                  </div>
                }
              </div>

              @if (stagesArray.length === 0) {
                <div class="no-stages">
                  <mat-icon>layers</mat-icon>
                  <p>No stages defined. Add stages to configure the deal pipeline flow.</p>
                </div>
              }
            </div>

            @if (errorMessage()) {
              <div class="form-error">
                <mat-icon>error_outline</mat-icon>
                <span>{{ errorMessage() }}</span>
              </div>
            }
          </mat-card-content>

          <mat-card-actions align="end">
            <button mat-button routerLink="/settings/pipelines">Cancel</button>
            <button
              mat-flat-button
              color="primary"
              (click)="onSave()"
              [disabled]="isSaving() || pipelineForm.invalid"
            >
              @if (isSaving()) {
                <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
              } @else {
                {{ mode() === 'create' ? 'Create Pipeline' : 'Save Changes' }}
              }
            </button>
          </mat-card-actions>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .pipeline-edit-container {
      padding: 24px;
      max-width: 1000px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;

      h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 500;
      }
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 0;

      p {
        margin-top: 16px;
        color: var(--color-text-secondary);
      }
    }

    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 0;

      .error-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--color-danger);
      }

      p {
        margin: 16px 0;
        color: var(--color-text-secondary);
      }
    }

    .pipeline-form-card {
      margin-bottom: 24px;
    }

    .pipeline-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 500;
      margin: 0 0 16px 0;
    }

    .full-width {
      width: 100%;
    }

    .stages-section {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid var(--color-border);
    }

    .stages-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .stage-preview {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
      padding: 12px;
      background: var(--color-primary-soft);
      border-radius: 8px;
    }

    .stage-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;

      .stage-probability {
        opacity: 0.8;
        font-size: 11px;
      }
    }

    .stage-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .stage-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 16px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      transition: box-shadow 200ms, border-color 200ms;

      &:hover {
        box-shadow: 0 2px 8px rgba(249, 115, 22, 0.1);
        border-color: var(--color-primary);
      }
    }

    .stage-drag-handle {
      cursor: grab;
      color: var(--color-text-muted);
      padding-top: 12px;

      &:active {
        cursor: grabbing;
      }
    }

    .stage-content {
      flex: 1;
      min-width: 0;
    }

    .stage-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }

    .stage-name-field {
      flex: 1;
      min-width: 180px;
    }

    .stage-color-field {
      width: 120px;
    }

    .stage-probability-field {
      width: 120px;
    }

    .stage-checkbox {
      padding-top: 12px;
    }

    .required-fields-panel {
      margin-top: 8px;

      ::ng-deep .mat-expansion-panel-body {
        padding: 8px 24px 16px;
      }
    }

    .required-fields-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
    }

    .required-count {
      margin-left: 8px;
      font-size: 12px;
      color: var(--color-text-secondary);
    }

    .no-stages {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px;
      color: var(--color-text-secondary);

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 8px;
        color: var(--color-primary);
        opacity: 0.6;
      }
    }

    .form-error {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding: 12px;
      background-color: var(--color-danger-soft);
      border-radius: var(--radius-sm);
      color: var(--color-danger-text);

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .button-spinner {
      display: inline-block;

      ::ng-deep circle {
        stroke: white;
      }
    }

    /* CDK Drag styles */
    .cdk-drag-preview {
      box-sizing: border-box;
      border-radius: 8px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    }

    .cdk-drag-placeholder {
      opacity: 0.3;
    }

    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
  `],
})
export class PipelineEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pipelineService = inject(PipelineService);
  private readonly snackBar = inject(MatSnackBar);

  mode = signal<'create' | 'edit'>('create');
  pipelineId = signal<string | null>(null);
  isLoading = signal(false);
  isSaving = signal(false);
  errorMessage = signal<string | null>(null);

  pipelineForm!: FormGroup;

  get stagesArray(): FormArray {
    return this.pipelineForm.get('stages') as FormArray;
  }

  ngOnInit(): void {
    this.pipelineForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(200)]],
      description: [''],
      isDefault: [false],
      stages: this.fb.array([]),
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.mode.set('edit');
      this.pipelineId.set(id);
      this.loadPipeline(id);
    }
  }

  private loadPipeline(id: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.pipelineService.getById(id).subscribe({
      next: (pipeline: PipelineDetailDto) => {
        this.pipelineForm.patchValue({
          name: pipeline.name,
          description: pipeline.description || '',
          isDefault: pipeline.isDefault,
        });

        // Clear and rebuild stages array
        this.stagesArray.clear();
        pipeline.stages
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .forEach((stage) => {
            this.stagesArray.push(
              this.createStageFormGroup({
                name: stage.name,
                color: stage.color,
                defaultProbability: Math.round(stage.defaultProbability * 100),
                isWon: stage.isWon,
                isLost: stage.isLost,
                requiredFields: stage.requiredFields || {},
              })
            );
          });

        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Failed to load pipeline.');
        this.isLoading.set(false);
      },
    });
  }

  private createStageFormGroup(data?: {
    name?: string;
    color?: string;
    defaultProbability?: number;
    isWon?: boolean;
    isLost?: boolean;
    requiredFields?: Record<string, any>;
  }): FormGroup {
    const fields = data?.requiredFields || {};
    return this.fb.group({
      name: [data?.name || '', [Validators.required]],
      color: [data?.color || '#4caf50', [Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
      defaultProbability: [data?.defaultProbability ?? 0],
      isWon: [data?.isWon || false],
      isLost: [data?.isLost || false],
      requiredFields: this.fb.group({
        value: [!!fields['value']],
        probability: [!!fields['probability']],
        expectedCloseDate: [!!fields['expectedCloseDate']],
        companyId: [!!fields['companyId']],
        ownerId: [!!fields['ownerId']],
      }),
    });
  }

  addStage(): void {
    this.stagesArray.push(this.createStageFormGroup());
  }

  removeStage(index: number): void {
    this.stagesArray.removeAt(index);
  }

  onStageDrop(event: CdkDragDrop<any>): void {
    const controls = this.stagesArray.controls;
    moveItemInArray(controls, event.previousIndex, event.currentIndex);
    // Update the FormArray by clearing and re-adding in new order
    const values = controls.map((c) => c.value);
    this.stagesArray.clear();
    values.forEach((val) => {
      this.stagesArray.push(
        this.createStageFormGroup({
          name: val.name,
          color: val.color,
          defaultProbability: val.defaultProbability,
          isWon: val.isWon,
          isLost: val.isLost,
          requiredFields: val.requiredFields,
        })
      );
    });
  }

  getStageFormGroup(index: number): FormGroup {
    return this.stagesArray.at(index) as FormGroup;
  }

  getRequiredFieldCount(index: number): number {
    const fields = this.getStageFormGroup(index).get('requiredFields')?.value;
    if (!fields) return 0;
    return Object.values(fields).filter((v) => v === true).length;
  }

  getContrastColor(hex: string): string {
    if (!hex || hex.length !== 7) return '#ffffff';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // Perceived brightness formula
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  }

  onSave(): void {
    if (this.pipelineForm.invalid) {
      this.pipelineForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const { name, description, isDefault } = this.pipelineForm.value;
    const stages: CreateStageRequest[] = this.stagesArray.controls.map(
      (control, index) => {
        const val = control.value;
        // Build requiredFields as a Record, filtering only true values
        const requiredFields: Record<string, boolean> = {};
        if (val.requiredFields) {
          Object.entries(val.requiredFields).forEach(([key, value]) => {
            if (value === true) {
              requiredFields[key] = true;
            }
          });
        }
        return {
          name: val.name,
          sortOrder: index,
          color: val.color,
          defaultProbability: (val.defaultProbability || 0) / 100, // Convert percentage to 0-1
          isWon: val.isWon || false,
          isLost: val.isLost || false,
          requiredFields,
        };
      }
    );

    if (this.mode() === 'create') {
      const request: CreatePipelineRequest = {
        name,
        description: description || null,
        isDefault,
        stages,
      };

      this.pipelineService.create(request).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.snackBar.open('Pipeline created successfully.', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/settings/pipelines']);
        },
        error: (err) => {
          this.isSaving.set(false);
          this.errorMessage.set(err.message || 'Failed to create pipeline.');
        },
      });
    } else {
      const id = this.pipelineId()!;
      const request: UpdatePipelineRequest = {
        name,
        description: description || null,
        isDefault,
        stages,
      };

      this.pipelineService.update(id, request).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.snackBar.open('Pipeline updated successfully.', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/settings/pipelines']);
        },
        error: (err) => {
          this.isSaving.set(false);
          this.errorMessage.set(err.message || 'Failed to update pipeline.');
        },
      });
    }
  }

  get pageTitle(): string {
    return this.mode() === 'create' ? 'Create Pipeline' : 'Edit Pipeline';
  }
}
