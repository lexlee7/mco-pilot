import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

import { IconeComponent } from './icone.component';

@Component({
  selector: 'mco-modale',
  standalone: true,
  imports: [IconeComponent],
  template: `
    <div class="voile" (click)="fermer.emit()"></div>
    <div class="panneau" role="dialog" aria-modal="true" [attr.aria-label]="titre">
      <header class="entre">
        <div>
          <div class="eyebrow">{{ surtitre }}</div>
          <h2 style="font-size: 21px; margin-top: 6px">{{ titre }}</h2>
        </div>
        <button class="btn btn--fantome" type="button" (click)="fermer.emit()" aria-label="Fermer">
          <mco-icone nom="croix" />
        </button>
      </header>
      <div class="contenu">
        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      :host { position: fixed; inset: 0; z-index: 50; display: block; }
      .voile {
        position: absolute; inset: 0;
        background: rgba(4, 8, 20, 0.62);
        backdrop-filter: blur(3px);
        animation: fondu 200ms ease both;
      }
      .panneau {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: min(860px, calc(100vw - 32px));
        max-height: calc(100vh - 60px);
        overflow-y: auto;
        background: var(--ardoise);
        border: 1px solid var(--bordure-forte);
        border-radius: var(--r-l);
        box-shadow: var(--ombre);
        padding: 24px;
        animation: surgit 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .contenu { margin-top: 20px; }
      @keyframes fondu { from { opacity: 0; } }
      @keyframes surgit {
        from { opacity: 0; transform: translate(-50%, -46%) scale(0.97); }
      }
    `,
  ],
})
export class ModaleComponent {
  @Input() titre = '';
  @Input() surtitre = '';
  @Output() fermer = new EventEmitter<void>();

  @HostListener('window:keydown.escape')
  echap(): void {
    this.fermer.emit();
  }
}
