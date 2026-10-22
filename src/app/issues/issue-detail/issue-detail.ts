import { DatePipe } from '@angular/common';
import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { ISSUES_URL, IssueApi } from '../../core/issue-api';
import { Issue } from '../../core/models';
import {
  CrsdAlert,
  CrsdAlertDescription,
  CrsdBtn,
  CrsdEmpty,
  CrsdEmptyDescription,
  CrsdSpinner,
} from '@mentros/crsd-ui';
import { backLink, pageHead, pageLede, pageSection, pageTitle } from '../../core/crsd-ui';
import { CheckpointList } from '../checkpoint-list/checkpoint-list';
import { TagList } from '../tag-list/tag-list';

type DetailState =
  | { status: 'loading'; issue: null }
  | { status: 'ready'; issue: Issue }
  | { status: 'missing'; issue: null }
  | { status: 'error'; issue: null };

@Component({
  selector: 'app-issue-detail',
  imports: [
    RouterLink,
    DatePipe,
    TagList,
    CheckpointList,
    CrsdBtn,
    CrsdSpinner,
    CrsdEmpty,
    CrsdEmptyDescription,
    CrsdAlert,
    CrsdAlertDescription,
  ],
  templateUrl: './issue-detail.html',
})
export class IssueDetail {
  protected readonly pageSection = pageSection;
  protected readonly pageHead = pageHead;
  protected readonly pageTitle = pageTitle;
  protected readonly pageLede = pageLede;
  protected readonly backLink = backLink;
  private readonly api = inject(IssueApi);
  private readonly router = inject(Router);

  private readonly issueId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => Number(params.get('id'))),
      distinctUntilChanged(),
    ),
    { initialValue: Number.NaN },
  );

  private readonly issueResource = httpResource<Issue>(() => {
    const id = this.issueId();
    if (!Number.isInteger(id) || id <= 0) {
      return undefined;
    }
    return { url: `${ISSUES_URL}/${id}` };
  });

  readonly state = computed((): DetailState => {
    const id = this.issueId();
    if (!Number.isInteger(id) || id <= 0) {
      return { status: 'missing', issue: null };
    }

    const resource = this.issueResource;
    const status = resource.status();
    if (status === 'loading' || status === 'reloading') {
      return { status: 'loading', issue: null };
    }
    if (status === 'error') {
      const err = resource.error();
      return {
        status: err instanceof HttpErrorResponse && err.status === 404 ? 'missing' : 'error',
        issue: null,
      };
    }
    if (status === 'resolved' || status === 'local') {
      const issue = resource.value();
      return issue ? { status: 'ready', issue } : { status: 'error', issue: null };
    }
    return { status: 'loading', issue: null };
  });

  readonly deleting = signal(false);
  readonly error = signal<string | null>(null);

  remove(issue: Issue): void {
    if (this.deleting()) return;
    if (!confirm('Delete this issue? Its checkpoints will be removed too.')) return;
    this.deleting.set(true);
    this.error.set(null);
    this.api.deleteIssue(issue.id).subscribe({
      next: () => {
        void this.router.navigateByUrl('/');
      },
      error: () => {
        this.deleting.set(false);
        this.error.set('Could not delete the issue.');
      },
    });
  }
}
