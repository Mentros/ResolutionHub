import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SearchCardFooter } from '../../core/search-card-footer/search-card-footer';
import { IssueSummary } from '../../core/models';
import { CrsdCard, CrsdCardDescription, CrsdCardTitle } from '@mentros/crsd-ui';

@Component({
  selector: 'app-issue-card',
  imports: [RouterLink, SearchCardFooter, CrsdCard, CrsdCardTitle, CrsdCardDescription],
  templateUrl: './issue-card.html',
  styles: ':host { display: contents; }',
})
export class IssueCard {
  @Input({ required: true }) issue!: IssueSummary;

  checkpointLabel(count: number): string {
    return count === 1 ? '1 Schritt' : `${count} Schritte`;
  }
}
