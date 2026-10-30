import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { ISSUES_URL, IssueApi } from '../../core/api/issue-api';
import { Issue } from '../../core/models';
import {
  CrsdAlert,
  CrsdAlertDescription,
  CrsdBtn,
  CrsdConfirmDialog,
  CrsdEmpty,
  CrsdEmptyDescription,
  CrsdSpinner,
} from '@mentros/crsd-ui';
import { BackLink } from '../../core/back-link/back-link';
import { DetailRecordMeta } from '../../core/detail-record-meta/detail-record-meta';
import { pageHead, pageLede, pageSection, pageTitle } from '../../core/ui/crsd-ui';
import { CheckpointList } from '../checkpoint-list/checkpoint-list';

type DetailState =
  | { status: 'loading'; issue: null }
  | { status: 'ready'; issue: Issue }
  | { status: 'missing'; issue: null }
  | { status: 'error'; issue: null };

@Component({
  selector: 'app-issue-detail',
  imports: [
    RouterLink,
    BackLink,
    DetailRecordMeta,
    CheckpointList,
    CrsdBtn,
    CrsdConfirmDialog,
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

  checkpointLabel(count: number): string {
    return count === 1 ? '1 Schritt' : `${count} Schritte`;
  }

  remove(issue: Issue): void {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.error.set(null);
    this.api.deleteIssue(issue.id).subscribe({
      next: () => {
        void this.router.navigateByUrl('/');
      },
      error: () => {
        this.deleting.set(false);
        this.error.set('Das Ticket konnte nicht gelöscht werden.');
      },
    });
  }
}
