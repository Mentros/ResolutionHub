import { DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CrsdCard,
  CrsdCardDescription,
  CrsdCardFooter,
  CrsdCardTitle,
} from '@mentros/crsd-ui';
import { IssueSummary } from '../../core/models';
import { TagList } from '../tag-list/tag-list';

@Component({
  selector: 'app-issue-card',
  imports: [RouterLink, DatePipe, TagList, CrsdCard, CrsdCardTitle, CrsdCardDescription, CrsdCardFooter],
  templateUrl: './issue-card.html',
  styles: ':host { display: contents; }',
})
export class IssueCard {
  @Input({ required: true }) issue!: IssueSummary;

  checkpointLabel(count: number): string {
    return count === 1 ? '1 checkpoint' : `${count} checkpoints`;
  }
}
