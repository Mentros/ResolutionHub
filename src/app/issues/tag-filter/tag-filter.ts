import { Component, Input, Signal, WritableSignal } from '@angular/core';
import { CrsdBtn } from '@mentros/crsd-ui';

@Component({
  selector: 'app-tag-filter',
  imports: [CrsdBtn],
  templateUrl: './tag-filter.html',
  styles: ':host { display: contents; }',
})
export class TagFilter {
  @Input({ required: true }) tags!: Signal<string[]>;
  @Input({ required: true }) selected!: WritableSignal<string[]>;

  isSelected(tag: string): boolean {
    return this.selected().some((name) => name.toLowerCase() === tag.toLowerCase());
  }

  toggle(tag: string): void {
    this.selected.update((current) => {
      const selected = current.some((name) => name.toLowerCase() === tag.toLowerCase());
      return selected
        ? current.filter((name) => name.toLowerCase() !== tag.toLowerCase())
        : [...current, tag];
    });
  }
}
