import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CrsdBtn } from '@mentros/crsd-ui';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, CrsdBtn],
  templateUrl: './app.html',
})
export class App {}
