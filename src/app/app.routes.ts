import { Routes } from '@angular/router';
import { IssueDetail } from './issues/issue-detail/issue-detail';
import { IssueForm } from './issues/issue-form/issue-form';
import { IssueList } from './issues/issue-list/issue-list';
import { TagsPage } from './tags/tags-page/tags-page';
import { WikiSiteDetail } from './wikis/wiki-site-detail/wiki-site-detail';
import { WikiSiteForm } from './wikis/wiki-site-form/wiki-site-form';
import { WikiSiteList } from './wikis/wiki-site-list/wiki-site-list';

export const routes: Routes = [
  { path: '', component: IssueList },
  { path: 'wikis', component: WikiSiteList },
  { path: 'tags', component: TagsPage },
  { path: 'issues/new', component: IssueForm },
  { path: 'issues/:id/edit', component: IssueForm },
  { path: 'issues/:id', component: IssueDetail },
  { path: 'wikis/new', component: WikiSiteForm },
  { path: 'wikis/:id/edit', component: WikiSiteForm },
  { path: 'wikis/:id', component: WikiSiteDetail },
  { path: '**', redirectTo: '' },
];
