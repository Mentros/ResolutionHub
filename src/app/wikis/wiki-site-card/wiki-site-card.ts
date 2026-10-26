import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SearchCardFooter } from '../../core/search-card-footer/search-card-footer';
import { WikiSiteSummary } from '../../core/models';
import { CrsdCard, CrsdCardDescription, CrsdCardTitle } from '@mentros/crsd-ui';

@Component({
  selector: 'app-wiki-site-card',
  imports: [RouterLink, SearchCardFooter, CrsdCard, CrsdCardTitle, CrsdCardDescription],
  templateUrl: './wiki-site-card.html',
  styles: ':host { display: contents; }',
})
export class WikiSiteCard {
  @Input({ required: true }) site!: WikiSiteSummary;

  entryLabel(count: number): string {
    return count === 1 ? '1 Seite' : `${count} Seiten`;
  }
}
