import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { NotificationService, ThemeService } from './core/ui.service';
import { IconeComponent } from './shared/icone.component';

interface Entree {
  chemin: string;
  libelle: string;
  icone: string;
  indice: string;
}

@Component({
  selector: 'mco-racine',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconeComponent],
  template: `
    <div class="coque">
      <aside class="rail" [class.rail--ouvert]="railOuvert()">
        <div class="marque">
          <div class="marque__pastille"><mco-icone nom="eclair" [taille]="17" /></div>
          <div>
            <div class="marque__nom">Poste de conduite</div>
            <div class="marque__sous">MCO — parc applicatif</div>
          </div>
        </div>

        <nav>
          @for (entree of entrees; track entree.chemin) {
            <a
              class="lien"
              [routerLink]="entree.chemin"
              routerLinkActive="lien--actif"
              (click)="railOuvert.set(false)"
            >
              <mco-icone [nom]="entree.icone" />
              <span class="lien__libelle">{{ entree.libelle }}</span>
              <span class="lien__indice mono">{{ entree.indice }}</span>
            </a>
          }
        </nav>

        <div class="rail__pied">
          <button class="btn btn--fantome" type="button" (click)="theme.basculer()">
            <mco-icone [nom]="theme.theme() === 'sombre' ? 'soleil' : 'lune'" />
            {{ theme.theme() === 'sombre' ? 'Thème clair' : 'Thème sombre' }}
          </button>
        </div>
      </aside>

      <button class="bascule-rail btn" type="button" (click)="railOuvert.set(!railOuvert())">
        <mco-icone nom="grille" />
      </button>

      <main class="scene">
        <router-outlet />
      </main>

      <div class="toasts" role="status" aria-live="polite">
        @for (notif of notifications.notifications(); track notif.id) {
          <div class="toast" [class]="'toast--' + notif.ton" (click)="notifications.fermer(notif.id)">
            <mco-icone [nom]="notif.ton === 'erreur' ? 'croix' : 'coche'" [taille]="16" />
            <span>{{ notif.texte }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .coque { position: relative; z-index: 1; min-height: 100vh; }

      .rail {
        position: fixed;
        inset: 0 auto 0 0;
        width: var(--rail);
        display: flex;
        flex-direction: column;
        gap: 26px;
        padding: 22px 16px;
        background: var(--surface);
        backdrop-filter: blur(20px) saturate(150%);
        -webkit-backdrop-filter: blur(20px) saturate(150%);
        border-right: 1px solid var(--bordure);
        z-index: 30;
      }

      .marque { display: flex; align-items: center; gap: 11px; padding: 4px 8px; }
      .marque__pastille {
        width: 34px; height: 34px;
        display: grid; place-items: center;
        border-radius: 11px;
        background: linear-gradient(135deg, var(--signal), var(--violet));
        color: #fff;
        box-shadow: 0 6px 18px rgba(91, 134, 255, 0.35);
      }
      .marque__nom { font-family: var(--display); font-weight: 600; font-size: 14.5px; }
      .marque__sous {
        font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em;
        text-transform: uppercase; color: var(--texte-doux); margin-top: 2px;
      }

      nav { display: flex; flex-direction: column; gap: 3px; flex: 1; }

      .lien {
        position: relative;
        display: flex; align-items: center; gap: 11px;
        padding: 10px 12px;
        border-radius: 10px;
        color: var(--texte-doux);
        font-size: 14px;
        transition: color var(--transition), background var(--transition);
      }
      .lien:hover { color: var(--texte); background: var(--surface-forte); }
      .lien--actif { color: var(--texte); background: var(--signal-sourd); }
      .lien--actif::before {
        content: '';
        position: absolute; left: 0; top: 20%; bottom: 20%;
        width: 2px; border-radius: 2px; background: var(--signal);
      }
      .lien__libelle { flex: 1; }
      .lien__indice { font-size: 10px; opacity: 0.55; }

      .rail__pied { border-top: 1px solid var(--bordure); padding-top: 14px; }
      .rail__pied .btn { width: 100%; justify-content: flex-start; }

      .scene { margin-left: var(--rail); padding: 34px 38px 60px; max-width: 1500px; }

      .bascule-rail { display: none; position: fixed; top: 14px; left: 14px; z-index: 40; }

      .toasts {
        position: fixed; right: 22px; bottom: 22px; z-index: 60;
        display: flex; flex-direction: column; gap: 10px;
      }
      .toast {
        display: flex; align-items: center; gap: 10px;
        padding: 12px 16px; border-radius: var(--r-m);
        background: var(--ardoise); border: 1px solid var(--bordure-forte);
        box-shadow: var(--ombre); font-size: 14px; cursor: pointer;
        animation: glisse 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
        max-width: 380px;
      }
      .toast--succes { border-left: 3px solid var(--menthe); }
      .toast--erreur { border-left: 3px solid var(--grenat); }
      .toast--info { border-left: 3px solid var(--signal); }
      @keyframes glisse { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }

      @media (max-width: 980px) {
        .rail { transform: translateX(-100%); transition: transform var(--transition); }
        .rail--ouvert { transform: none; }
        .bascule-rail { display: inline-flex; }
        .scene { margin-left: 0; padding: 70px 18px 50px; }
      }
    `,
  ],
})
export class AppComponent {
  readonly theme = inject(ThemeService);
  readonly notifications = inject(NotificationService);
  readonly railOuvert = signal(false);

  readonly entrees: Entree[] = [
    { chemin: '/tableau-de-bord', libelle: 'Tableau de bord', icone: 'jauge', indice: '01' },
    { chemin: '/applications', libelle: 'Parc applicatif', icone: 'grille', indice: '02' },
    { chemin: '/plages', libelle: 'Créneaux de maintenance', icone: 'horloge', indice: '03' },
    { chemin: '/vulnerabilites', libelle: 'Vulnérabilités', icone: 'bouclier', indice: '04' },
    { chemin: '/obsolescences', libelle: 'Obsolescences', icone: 'sablier', indice: '05' },
    { chemin: '/calendrier', libelle: 'Calendrier MCO', icone: 'calendrier', indice: '06' },
    { chemin: '/partenaires', libelle: 'Éditeurs & partenaires', icone: 'contacts', indice: '07' },
    { chemin: '/communication', libelle: 'Communication de crise', icone: 'megaphone', indice: '08' },
  ];

  @HostListener('window:keydown.escape')
  fermerRail(): void {
    this.railOuvert.set(false);
  }
}
