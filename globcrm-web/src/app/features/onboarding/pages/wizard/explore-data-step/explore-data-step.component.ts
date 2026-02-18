import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

interface SeedDataItem {
  icon: string;
  label: string;
  description: string;
  color: string;
}

@Component({
  selector: 'app-explore-data-step',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
  ],
  templateUrl: './explore-data-step.component.html',
  styleUrl: './explore-data-step.component.scss',
})
export class ExploreDataStepComponent {
  finish = output<void>();
  skipStep = output<void>();

  seedData: SeedDataItem[] = [
    {
      icon: 'contacts',
      label: '5 sample contacts',
      description: 'Pre-loaded contacts to explore contact management features.',
      color: 'var(--color-info)',
    },
    {
      icon: 'business',
      label: '2 sample companies',
      description: 'Example companies linked to contacts and deals.',
      color: 'var(--color-accent)',
    },
    {
      icon: 'handshake',
      label: '1 demo deal',
      description: 'A deal in your pipeline to explore the sales workflow.',
      color: 'var(--color-primary)',
    },
    {
      icon: 'view_kanban',
      label: 'Default sales pipeline',
      description: '5 stages: Lead, Qualified, Proposal, Negotiation, Closed.',
      color: 'var(--color-secondary)',
    },
  ];

  onFinish(): void {
    this.finish.emit();
  }

  onSkip(): void {
    this.skipStep.emit();
  }
}
