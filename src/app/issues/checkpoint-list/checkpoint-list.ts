import { Component, Input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CrsdAlert, CrsdAlertDescription, CrsdBtn, CrsdCard } from '@mentros/crsd-ui';
import { writeClipboard } from '../../core/clipboard';
import { Checkpoint } from '../../core/models';

@Component({
  selector: 'app-checkpoint-list',
  imports: [RouterLink, CrsdCard, CrsdBtn, CrsdAlert, CrsdAlertDescription],
  templateUrl: './checkpoint-list.html',
  styles: ':host { display: contents; }',
})
export class CheckpointList {
  @Input({ required: true }) checkpoints!: Checkpoint[];
  @Input({ required: true }) issueId!: number;

  readonly copiedId = signal<number | null>(null);
  readonly error = signal<string | null>(null);

  async copyPath(step: Checkpoint): Promise<void> {
    if (!step.sharePath) return;
    try {
      await writeClipboard(step.sharePath);
      this.error.set(null);
      this.copiedId.set(step.id);
      const copied = step.id;
      setTimeout(() => {
        if (this.copiedId() === copied) this.copiedId.set(null);
      }, 2000);
    } catch {
      this.error.set('Der Pfad konnte nicht kopiert werden. Markiere ihn und kopiere ihn manuell.');
    }
  }
}
