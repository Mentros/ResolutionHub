import { Component, Input, signal } from '@angular/core';
import { CrsdBtn, CrsdCard } from '@mentros/crsd-ui';
import { writeClipboard } from '../../core/util/clipboard';
import { isHttpUrl } from '../../core/util/documentation-location';
import { WikiEntry } from '../../core/models';
import { TagList } from '../../issues/tag-list/tag-list';

@Component({
  selector: 'app-wiki-entry-list',
  imports: [CrsdCard, CrsdBtn, TagList],
  templateUrl: './wiki-entry-list.html',
  styles: ':host { display: contents; }',
})
export class WikiEntryList {
  @Input({ required: true }) entries!: WikiEntry[];

  readonly copiedKey = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  copyPath(entryId: number, index: number, path: string): void {
    void this.copyPathAsync(entryId, index, path);
  }

  private async copyPathAsync(entryId: number, index: number, path: string): Promise<void> {
    try {
      await writeClipboard(path);
      this.error.set(null);
      const key = `${entryId}-${index}`;
      this.copiedKey.set(key);
      setTimeout(() => {
        if (this.copiedKey() === key) this.copiedKey.set(null);
      }, 2000);
    } catch {
      this.error.set('Der Pfad konnte nicht kopiert werden. Markiere ihn und kopiere ihn manuell.');
    }
  }

  isWebLocation(value: string): boolean {
    return isHttpUrl(value);
  }

  copied(entryId: number, index: number): boolean {
    return this.copiedKey() === `${entryId}-${index}`;
  }
}
