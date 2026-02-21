import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CardDto } from '../boards.models';

/**
 * Placeholder BoardCardComponent for board detail compilation.
 * Full implementation in Task 2.
 */
@Component({
  selector: 'app-board-card',
  standalone: true,
  template: `
    <div class="board-card-placeholder" (click)="cardClicked.emit(card().id)">
      <span class="card-title">{{ card().title }}</span>
    </div>
  `,
  styles: [`
    .board-card-placeholder {
      padding: 12px;
      background: var(--color-surface);
      border-radius: 10px;
      border: 1px solid var(--color-border-subtle);
      cursor: pointer;
    }
    .board-card-placeholder:hover {
      border-color: var(--color-border);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .card-title {
      font-weight: 500;
      font-size: 0.875rem;
      color: var(--color-text);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardCardComponent {
  readonly card = input.required<CardDto>();
  readonly boardId = input.required<string>();
  readonly cardClicked = output<string>();
  readonly cardArchived = output<string>();
}
