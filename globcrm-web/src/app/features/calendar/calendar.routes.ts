import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { CalendarComponent } from './calendar.component';

export const CALENDAR_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('calendar')],
    children: [
      { path: '', component: CalendarComponent },
    ],
  },
];
