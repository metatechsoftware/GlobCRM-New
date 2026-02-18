import { Routes } from '@angular/router';
import { NoteListComponent } from './note-list/note-list.component';
import { NoteFormComponent } from './note-form/note-form.component';
import { NoteDetailComponent } from './note-detail/note-detail.component';

export const NOTES_ROUTES: Routes = [
  { path: '', component: NoteListComponent },
  { path: 'new', component: NoteFormComponent },
  { path: ':id', component: NoteDetailComponent },
  { path: ':id/edit', component: NoteFormComponent },
];
