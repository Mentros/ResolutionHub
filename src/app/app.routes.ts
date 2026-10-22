import { Routes } from '@angular/router';
import { IssueDetail } from './issues/issue-detail/issue-detail';
import { IssueForm } from './issues/issue-form/issue-form';
import { IssueList } from './issues/issue-list/issue-list';
import { TagsPage } from './tags/tags-page/tags-page';

export const routes: Routes = [
  { path: '', component: IssueList },
  { path: 'tags', component: TagsPage },
  { path: 'issues/new', component: IssueForm },
  { path: 'issues/:id/edit', component: IssueForm },
  { path: 'issues/:id', component: IssueDetail },
  { path: '**', redirectTo: '' },
];
