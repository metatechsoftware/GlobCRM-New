import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-my-day',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="my-day-placeholder">
      <h1>My Day</h1>
      <p>Coming Soon</p>
    </div>
  `,
  styles: [`
    .my-day-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60vh;
      color: var(--mat-sys-on-surface-variant, #666);
    }

    h1 {
      font-size: 2rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }

    p {
      font-size: 1.125rem;
      opacity: 0.7;
    }
  `],
})
export class MyDayComponent {}
