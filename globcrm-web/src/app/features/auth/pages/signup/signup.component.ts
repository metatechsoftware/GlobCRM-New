import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { CreateOrgComponent } from './create-org/create-org.component';
import { JoinOrgComponent } from './join-org/join-org.component';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatTabsModule,
    CreateOrgComponent,
    JoinOrgComponent,
    TranslocoPipe,
  ],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
})
export class SignupComponent {}
