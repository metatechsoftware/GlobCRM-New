import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { MyDayComponent } from './my-day.component';

export const MY_DAY_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('my-day')],
    children: [
      { path: '', component: MyDayComponent },
    ],
  },
];
