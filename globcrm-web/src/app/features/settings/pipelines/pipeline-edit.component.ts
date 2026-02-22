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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

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
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatTooltipModule,
    CdkDrag,
    CdkDropList,
    TranslocoPipe,
  ],
  template: `
    <div class="pe-page">
      <!-- Header -->
      <div class="pe-header">
        <a routerLink="/settings/pipelines" class="pe-back">
          <mat-icon>arrow_back</mat-icon>
          <span>{{ 'settings.pipelines.edit.breadcrumb' | transloco }}</span>
        </a>
        <div class="pe-title-row">
          <div class="pe-icon-wrap">
            <mat-icon>{{ mode() === 'create' ? 'add' : 'edit' }}</mat-icon>
          </div>
          <div>
            <h1 class="pe-title">{{ pageTitle }}</h1>
            <p class="pe-subtitle">{{ mode() === 'create' ? ('settings.pipelines.edit.createSubtitle' | transloco) : ('settings.pipelines.edit.editSubtitle' | transloco) }}</p>
          </div>
        </div>
      </div>

      @if (isLoading()) {
        <div class="pe-loading">
          <mat-spinner diameter="40"></mat-spinner>
          <p>{{ 'settings.pipelines.edit.loadingPipeline' | transloco }}</p>
        </div>
      } @else if (errorMessage() && mode() === 'edit' && !pipelineForm.dirty) {
        <div class="pe-error">
          <div class="pe-error__icon-wrap">
            <mat-icon>error_outline</mat-icon>
          </div>
          <h3>{{ 'settings.pipelines.edit.couldntLoad' | transloco }}</h3>
          <p>{{ errorMessage() }}</p>
          <button mat-flat-button color="primary" routerLink="/settings/pipelines">
            {{ 'settings.pipelines.edit.backToPipelines' | transloco }}
          </button>
        </div>
      } @else {
        <!-- Details Section -->
        <div class="pe-section" style="animation-delay: 0ms">
          <div class="pe-section__header">
            <mat-icon class="pe-section__icon">tune</mat-icon>
            <h2>{{ 'settings.pipelines.edit.pipelineDetails' | transloco }}</h2>
          </div>

          <form [formGroup]="pipelineForm" class="pe-form">
            <mat-form-field appearance="outline" class="pe-full-width">
              <mat-label>{{ 'settings.pipelines.edit.pipelineName' | transloco }}</mat-label>
              <input
                matInput
                formControlName="name"
                [placeholder]="'settings.pipelines.edit.pipelineNamePlaceholder' | transloco"
                maxlength="200"
              />
              @if (pipelineForm.get('name')?.hasError('required') && pipelineForm.get('name')?.touched) {
                <mat-error>{{ 'settings.pipelines.edit.pipelineNameRequired' | transloco }}</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="pe-full-width">
              <mat-label>{{ 'settings.pipelines.edit.description' | transloco }}</mat-label>
              <textarea
                matInput
                formControlName="description"
                [placeholder]="'settings.pipelines.edit.descriptionPlaceholder' | transloco"
                rows="3"
              ></textarea>
            </mat-form-field>

            <mat-checkbox formControlName="isDefault" color="primary">
              {{ 'settings.pipelines.edit.setAsDefault' | transloco }}
            </mat-checkbox>
          </form>
        </div>

        <!-- Stages Section -->
        <div class="pe-section" style="animation-delay: 80ms">
          <div class="pe-section__header">
            <mat-icon class="pe-section__icon">layers</mat-icon>
            <h2>{{ 'settings.pipelines.edit.stagesSection' | transloco }}</h2>
            <button mat-stroked-button color="primary" (click)="addStage()" class="pe-add-stage-btn">
              <mat-icon>add</mat-icon>
              {{ 'settings.pipelines.edit.addStage' | transloco }}
            </button>
          </div>

          <!-- Stage Flow Preview -->
          @if (stagesArray.length > 0) {
            <div class="pe-stage-flow">
              @for (stage of stagesArray.controls; track stage; let last = $last) {
                <div class="pe-flow-chip"
                  [style.background-color]="stage.get('color')?.value || '#9e9e9e'"
                  [style.color]="getContrastColor(stage.get('color')?.value || '#9e9e9e')"
                >
                  {{ stage.get('name')?.value || 'Unnamed' }}
                  <span class="pe-flow-prob">{{ stage.get('defaultProbability')?.value || 0 }}%</span>
                </div>
                @if (!last) {
                  <mat-icon class="pe-flow-arrow">chevron_right</mat-icon>
                }
              }
            </div>
          }

          <!-- Draggable Stage List -->
          <div cdkDropList class="pe-stage-list" (cdkDropListDropped)="onStageDrop($event)">
            @for (stage of stagesArray.controls; track stage; let i = $index) {
              <div class="pe-stage-item" cdkDrag [formGroup]="getStageFormGroup(i)" [style.animation-delay]="(i * 40) + 'ms'">
                <div class="pe-stage-drag" cdkDragHandle>
                  <mat-icon>drag_indicator</mat-icon>
                </div>

                <div class="pe-stage-color-bar"
                  [style.background]="stage.get('color')?.value || '#9e9e9e'"
                ></div>

                <div class="pe-stage-content">
                  <div class="pe-stage-row">
                    <mat-form-field appearance="outline" class="pe-stage-name">
                      <mat-label>{{ 'settings.pipelines.edit.stageName' | transloco }}</mat-label>
                      <input matInput formControlName="name" [placeholder]="'settings.pipelines.edit.stageNamePlaceholder' | transloco" />
                      @if (getStageFormGroup(i).get('name')?.hasError('required') && getStageFormGroup(i).get('name')?.touched) {
                        <mat-error>{{ 'settings.pipelines.edit.stageNameRequired' | transloco }}</mat-error>
                      }
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="pe-stage-color">
                      <mat-label>{{ 'settings.pipelines.edit.color' | transloco }}</mat-label>
                      <input matInput formControlName="color" placeholder="#4caf50" maxlength="7" />
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="pe-stage-prob">
                      <mat-label>{{ 'settings.pipelines.edit.probability' | transloco }}</mat-label>
                      <input matInput type="number" formControlName="defaultProbability" min="0" max="100" />
                    </mat-form-field>

                    <mat-checkbox formControlName="isWon" class="pe-stage-check">{{ 'settings.pipelines.edit.won' | transloco }}</mat-checkbox>
                    <mat-checkbox formControlName="isLost" class="pe-stage-check">{{ 'settings.pipelines.edit.lost' | transloco }}</mat-checkbox>

                    <button mat-icon-button (click)="removeStage(i)" [matTooltip]="'settings.pipelines.edit.removeStage' | transloco" class="pe-stage-remove">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>

                  <mat-expansion-panel class="pe-req-panel">
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        {{ 'settings.pipelines.edit.requiredFields' | transloco }}
                        @if (getRequiredFieldCount(i) > 0) {
                          <span class="pe-req-count">({{ getRequiredFieldCount(i) }})</span>
                        }
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <div class="pe-req-grid" formGroupName="requiredFields">
                      <mat-checkbox formControlName="value">{{ 'settings.pipelines.edit.dealValue' | transloco }}</mat-checkbox>
                      <mat-checkbox formControlName="probability">{{ 'settings.pipelines.edit.probabilityField' | transloco }}</mat-checkbox>
                      <mat-checkbox formControlName="expectedCloseDate">{{ 'settings.pipelines.edit.expectedCloseDate' | transloco }}</mat-checkbox>
                      <mat-checkbox formControlName="companyId">{{ 'settings.pipelines.edit.company' | transloco }}</mat-checkbox>
                      <mat-checkbox formControlName="ownerId">{{ 'settings.pipelines.edit.owner' | transloco }}</mat-checkbox>
                    </div>
                  </mat-expansion-panel>
                </div>
              </div>
            }
          </div>

          @if (stagesArray.length === 0) {
            <div class="pe-no-stages">
              <div class="pe-no-stages__visual">
                <mat-icon>layers</mat-icon>
              </div>
              <p>{{ 'settings.pipelines.edit.noStagesDefined' | transloco }}</p>
              <span class="pe-no-stages__hint">{{ 'settings.pipelines.edit.addStagesHint' | transloco }}</span>
            </div>
          }
        </div>

        @if (errorMessage()) {
          <div class="pe-form-error">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <div class="pe-actions">
          <button mat-button routerLink="/settings/pipelines">{{ 'settings.pipelines.edit.cancel' | transloco }}</button>
          <button
            mat-flat-button color="primary"
            (click)="onSave()"
            [disabled]="isSaving() || pipelineForm.invalid"
            class="pe-save-btn"
          >
            @if (isSaving()) {
              <mat-spinner diameter="18" class="pe-btn-spinner"></mat-spinner>
            } @else {
              <mat-icon>{{ mode() === 'create' ? 'add' : 'check' }}</mat-icon>
              {{ mode() === 'create' ? ('settings.pipelines.edit.createPipeline' | transloco) : ('settings.pipelines.edit.saveChanges' | transloco) }}
            }
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .pe-page { padding: var(--space-6) var(--space-8); max-width: 1000px; margin: 0 auto; }
    .pe-header { margin-bottom: var(--space-6); animation: peFadeSlideUp var(--duration-slower) var(--ease-out) both; }
    .pe-back { display: inline-flex; align-items: center; gap: var(--space-1); color: var(--color-text-secondary); font-size: var(--text-sm); font-weight: var(--font-medium); text-decoration: none; margin-bottom: var(--space-3); transition: color var(--duration-fast) var(--ease-default);
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover { color: var(--color-primary); }
    }
    .pe-title-row { display: flex; align-items: center; gap: var(--space-4); }
    .pe-icon-wrap { width: 48px; height: 48px; border-radius: var(--radius-lg); background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover)); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(20, 184, 166, 0.3); flex-shrink: 0;
      mat-icon { color: var(--color-accent-fg); font-size: 24px; width: 24px; height: 24px; }
    }
    .pe-title { margin: 0; font-size: var(--text-2xl); font-weight: var(--font-bold); letter-spacing: -0.3px; color: var(--color-text); }
    .pe-subtitle { margin: var(--space-1) 0 0; font-size: var(--text-sm); color: var(--color-text-secondary); }

    .pe-section { background: var(--color-surface); border: 1.5px solid var(--color-border); border-radius: 14px; padding: var(--space-6); margin-bottom: var(--space-5); animation: peSectionEntrance var(--duration-slower) var(--ease-out) both; }
    .pe-section__header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-5); padding-bottom: var(--space-4); border-bottom: 1px solid var(--color-border-subtle);
      h2 { margin: 0; font-size: var(--text-lg); font-weight: var(--font-semibold); letter-spacing: -0.2px; }
    }
    .pe-section__icon { font-size: 20px; width: 20px; height: 20px; color: var(--color-text-muted); }
    .pe-add-stage-btn { margin-left: auto; mat-icon { margin-right: var(--space-1); } }
    .pe-form { display: flex; flex-direction: column; gap: var(--space-2); }
    .pe-full-width { width: 100%; }

    .pe-stage-flow { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1-5); margin-bottom: var(--space-5); padding: var(--space-3) var(--space-4); background: var(--color-bg-secondary); border-radius: var(--radius-md); }
    .pe-flow-chip { display: inline-flex; align-items: center; gap: var(--space-1); padding: var(--space-0-5) var(--space-3); border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: var(--font-medium); }
    .pe-flow-prob { opacity: 0.75; font-size: 10px; }
    .pe-flow-arrow { font-size: 16px; width: 16px; height: 16px; color: var(--color-text-muted); }

    .pe-stage-list { display: flex; flex-direction: column; gap: var(--space-3); }
    .pe-stage-item { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-4); background: var(--color-surface); border: 1.5px solid var(--color-border); border-radius: var(--radius-lg); transition: box-shadow var(--duration-normal) var(--ease-default), border-color var(--duration-normal) var(--ease-default); animation: peStageEntrance var(--duration-slow) var(--ease-out) both;
      &:hover { box-shadow: var(--shadow-md); border-color: var(--color-border-strong); }
    }
    .pe-stage-drag { cursor: grab; color: var(--color-text-muted); padding-top: var(--space-3); &:active { cursor: grabbing; } &:hover { color: var(--color-text-secondary); } }
    .pe-stage-color-bar { width: 4px; border-radius: var(--radius-full); align-self: stretch; flex-shrink: 0; }
    .pe-stage-content { flex: 1; min-width: 0; }
    .pe-stage-row { display: flex; align-items: flex-start; gap: var(--space-3); flex-wrap: wrap; }
    .pe-stage-name { flex: 1; min-width: 180px; }
    .pe-stage-color { width: 120px; }
    .pe-stage-prob { width: 120px; }
    .pe-stage-check { padding-top: var(--space-3); }
    .pe-stage-remove { color: var(--color-text-muted); &:hover { color: var(--color-danger); } }
    .pe-req-panel { margin-top: var(--space-2); ::ng-deep .mat-expansion-panel-body { padding: var(--space-2) var(--space-6) var(--space-4); } }
    .pe-req-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--space-2); }
    .pe-req-count { margin-left: var(--space-2); font-size: var(--text-xs); color: var(--color-text-secondary); }

    .pe-no-stages { display: flex; flex-direction: column; align-items: center; padding: var(--space-8) var(--space-4); text-align: center;
      p { margin: var(--space-3) 0 var(--space-1); font-size: var(--text-base); font-weight: var(--font-medium); color: var(--color-text); }
    }
    .pe-no-stages__visual { width: 64px; height: 64px; border-radius: var(--radius-full); background: var(--color-accent-soft); display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 28px; width: 28px; height: 28px; color: var(--color-accent); }
    }
    .pe-no-stages__hint { font-size: var(--text-sm); color: var(--color-text-muted); }

    .pe-form-error { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-5); padding: var(--space-3) var(--space-4); background-color: var(--color-danger-soft); border-radius: var(--radius-md); color: var(--color-danger-text); font-size: var(--text-sm); border: 1px solid var(--color-danger);
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    }
    .pe-actions { display: flex; justify-content: flex-end; gap: var(--space-3); padding-top: var(--space-4); animation: peFadeSlideUp var(--duration-slower) var(--ease-out) both; animation-delay: 160ms; }
    .pe-save-btn { mat-icon { margin-right: var(--space-1); font-size: 18px; } }
    .pe-btn-spinner { display: inline-block; ::ng-deep circle { stroke: white; } }

    .pe-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-20) 0; gap: var(--space-4); p { margin: 0; color: var(--color-text-secondary); font-size: var(--text-sm); } }
    .pe-error { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-16) 0; text-align: center; h3 { margin: var(--space-4) 0 var(--space-2); font-size: var(--text-lg); } p { margin: 0 0 var(--space-5); color: var(--color-text-secondary); max-width: 360px; } }
    .pe-error__icon-wrap { width: 56px; height: 56px; border-radius: var(--radius-full); background: var(--color-danger-soft); display: flex; align-items: center; justify-content: center; mat-icon { font-size: 28px; width: 28px; height: 28px; color: var(--color-danger); } }

    @keyframes peFadeSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes peSectionEntrance { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes peStageEntrance { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
    @media (prefers-reduced-motion: reduce) { .pe-section, .pe-header, .pe-actions, .pe-stage-item { animation: none !important; opacity: 1; } }
    .cdk-drag-preview { box-sizing: border-box; border-radius: var(--radius-lg); box-shadow: var(--shadow-xl); }
    .cdk-drag-placeholder { opacity: 0.3; }
    .cdk-drag-animating { transition: transform 250ms var(--ease-default); }
    @media (max-width: 768px) { .pe-page { padding: var(--space-4); } .pe-title { font-size: var(--text-xl); } .pe-section { padding: var(--space-4); } .pe-stage-row { flex-direction: column; gap: var(--space-2); } .pe-stage-name, .pe-stage-color, .pe-stage-prob { width: 100%; min-width: unset; } }
  `],
})
export class PipelineEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pipelineService = inject(PipelineService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

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
          defaultProbability: (val.defaultProbability || 0) / 100,
          isWon: val.isWon || false,
          isLost: val.isLost || false,
          requiredFields,
        };
      }
    );

    if (this.mode() === 'create') {
      const request: CreatePipelineRequest = {
        name, description: description || null, isDefault, stages,
      };
      this.pipelineService.create(request).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.snackBar.open(this.transloco.translate('settings.pipelines.edit.createSuccess'), 'Close', { duration: 3000 });
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
        name, description: description || null, isDefault, stages,
      };
      this.pipelineService.update(id, request).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.snackBar.open(this.transloco.translate('settings.pipelines.edit.updateSuccess'), 'Close', { duration: 3000 });
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
    return this.mode() === 'create'
      ? this.transloco.translate('settings.pipelines.edit.createTitle')
      : this.transloco.translate('settings.pipelines.edit.editTitle');
  }
}
