import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CrsdIcon } from '@mentros/crsd-ui';
import { backLink } from '../ui/crsd-ui';

@Component({
  selector: 'app-back-link',
  imports: [RouterLink, CrsdIcon],
  template: `
    <a [routerLink]="link()" [class]="linkClass">
      <crsd-icon name="chevron-left" class="size-4 shrink-0 opacity-80" aria-hidden="true" />
      <span><ng-content /></span>
    </a>
  `,
  styles: ':host { display: contents; }',
})
export class BackLink {
  readonly link = input.required<string>();

  protected readonly linkClass = backLink;
}
