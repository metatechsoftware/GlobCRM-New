import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  TemplateRef,
  contentChildren,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';

/**
 * Configuration for a single tab in the related entity tabs component.
 */
export interface EntityTab {
  label: string;
  icon: string;
  enabled: boolean;
}

/**
 * Standard tab configurations for each entity type.
 * Enabled tabs have content available now; disabled tabs show "coming soon".
 */
export const COMPANY_TABS: EntityTab[] = [
  { label: 'Details', icon: 'info', enabled: true },
  { label: 'Contacts', icon: 'people', enabled: true },
  { label: 'Deals', icon: 'handshake', enabled: true },
  { label: 'Activities', icon: 'task_alt', enabled: true },
  { label: 'Quotes', icon: 'request_quote', enabled: false },
  { label: 'Notes', icon: 'note', enabled: false },
];

export const CONTACT_TABS: EntityTab[] = [
  { label: 'Details', icon: 'info', enabled: true },
  { label: 'Company', icon: 'business', enabled: true },
  { label: 'Deals', icon: 'handshake', enabled: true },
  { label: 'Activities', icon: 'task_alt', enabled: true },
  { label: 'Quotes', icon: 'request_quote', enabled: false },
  { label: 'Emails', icon: 'email', enabled: false },
  { label: 'Notes', icon: 'note', enabled: false },
];

export const PRODUCT_TABS: EntityTab[] = [
  { label: 'Details', icon: 'info', enabled: true },
  { label: 'Quotes', icon: 'request_quote', enabled: false },
];

export const DEAL_TABS: EntityTab[] = [
  { label: 'Details', icon: 'info', enabled: true },
  { label: 'Contacts', icon: 'people', enabled: true },
  { label: 'Products', icon: 'inventory_2', enabled: true },
  { label: 'Activities', icon: 'task_alt', enabled: true },
  { label: 'Timeline', icon: 'timeline', enabled: true },
];

/**
 * Directive to mark template content for a specific tab index.
 * Used with ng-template to project content into the corresponding tab.
 *
 * Usage:
 *   <app-related-entity-tabs [tabs]="tabs">
 *     <ng-template appTabContent>Details content here</ng-template>
 *     <ng-template appTabContent>Contacts content here</ng-template>
 *   </app-related-entity-tabs>
 */
// Note: Tab content is projected via contentChildren querying TemplateRef

/**
 * Reusable tabbed navigation component for entity detail pages.
 *
 * Renders a mat-tab-group with standardized tab configuration per entity type.
 * Active tabs display their label and projected content. Disabled tabs show
 * the label with "(coming soon)" and are not clickable.
 *
 * Each entity detail page provides the tab content via ng-template elements
 * as direct children, which are projected into the corresponding tab body.
 *
 * Usage:
 *   <app-related-entity-tabs [tabs]="companyTabs" (tabChanged)="onTabChanged($event)">
 *     <ng-template>Details content...</ng-template>
 *     <ng-template>Contacts list content...</ng-template>
 *   </app-related-entity-tabs>
 */
@Component({
  selector: 'app-related-entity-tabs',
  standalone: true,
  imports: [NgTemplateOutlet, MatTabsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .tab-label {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .tab-label mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .coming-soon {
      font-size: 11px;
      font-weight: normal;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.5));
      margin-left: 2px;
    }

    .tab-body {
      padding: 16px 0;
    }

    .disabled-tab-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 48px 24px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.5));
      text-align: center;
    }

    .disabled-tab-content mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      opacity: 0.4;
    }
  `,
  template: `
    <mat-tab-group
      [selectedIndex]="activeTabIndex()"
      (selectedIndexChange)="onTabChange($event)"
      animationDuration="200ms">
      @for (tab of tabs(); track tab.label; let i = $index) {
        <mat-tab [disabled]="!tab.enabled">
          <ng-template mat-tab-label>
            <span class="tab-label">
              <mat-icon>{{ tab.icon }}</mat-icon>
              {{ tab.label }}
              @if (!tab.enabled) {
                <span class="coming-soon">(coming soon)</span>
              }
            </span>
          </ng-template>

          <div class="tab-body">
            @if (tab.enabled && tabTemplates()[i]) {
              <ng-container
                [ngTemplateOutlet]="tabTemplates()[i]">
              </ng-container>
            } @else if (!tab.enabled) {
              <div class="disabled-tab-content">
                <mat-icon>{{ tab.icon }}</mat-icon>
                <span>{{ tab.label }} will be available in a future update.</span>
              </div>
            }
          </div>
        </mat-tab>
      }
    </mat-tab-group>
  `,
})
export class RelatedEntityTabsComponent {
  /** Tab configuration array defining label, icon, and enabled state. */
  tabs = input.required<EntityTab[]>();

  /** The initially active tab index. Defaults to 0 (Details). */
  activeTabIndex = input<number>(0);

  /** Emits the new tab index when the user switches tabs. */
  tabChanged = output<number>();

  /**
   * Content templates projected by the parent component.
   * Each ng-template child corresponds to a tab by index.
   */
  tabTemplates = contentChildren(TemplateRef);

  /**
   * Handle tab selection change.
   */
  onTabChange(index: number): void {
    this.tabChanged.emit(index);
  }
}
