import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { NotificationService } from '../core/ui.service';
import {
  Application,
  Evenement,
  OccurrencePlage,
  Referentiels,
  classePastille,
  lisible,
} from '../core/models';
import { IconeComponent } from '../shared/icone.component';
import { ModaleComponent } from '../shared/modale.component';

interface Jour {
  date: Date;
  dansLeMois: boolean;
  aujourdhui: boolean;
  plages: OccurrencePlage[];
  evenements: Evenement[];
}

@Component({
  selector: 'mco-calendrier',
  standalone: true,
  imports: [CommonModule, FormsModule, IconeComponent, ModaleComponent],
  template: `
    <header class="entre apparait">
      <div>
        <div class="eyebrow">Planification</div>
        <h1 class="titre-page">Calendrier MCO</h1>
        <p class="sous-titre">
          Plages de maintenance projetées sur les prochaines semaines et événements transverses :
          maintenance SSO, coupures réseau, fenêtres de tir infrastructure, gels de production.
        </p>
      </div>
      <button class="btn btn--primaire" type="button" (click)="formulaireOuvert.set(true)">
        <mco-icone nom="plus" /> Inscrire un événement
      </button>
    </header>

    <section class="carte apparait" style="margin-top: 24px; padding: 16px 18px">
      <div class="entre">
        <div class="rangee">
          <button class="btn btn--petit" type="button" (click)="decaler(-1)">
            <mco-icone nom="retour" [taille]="15" />
          </button>
          <strong class="mois">{{ premierJour() | date: 'MMMM y' }}</strong>
          <button class="btn btn--petit" type="button" (click)="decaler(1)">
            <mco-icone nom="retour" [taille]="15" style="transform: rotate(180deg)" />
          </button>
          <button class="btn btn--petit btn--fantome" type="button" (click)="decalage.set(0)">
            Aujourd'hui
          </button>
        </div>
        <div class="rangee">
          <select class="saisie filtre" [ngModel]="filtreApp()" (ngModelChange)="filtreApp.set($event)">
            <option value="">Toutes les applications</option>
            @for (a of applications(); track a.id) { <option [value]="a.id">{{ a.code }} — {{ a.nom }}</option> }
          </select>
          <label class="bascule">
            <input type="checkbox" [ngModel]="afficherPlages()" (ngModelChange)="afficherPlages.set($event)" />
            <span>Plages de maintenance</span>
          </label>
        </div>
      </div>
    </section>

    <section class="carte apparait" style="margin-top: 18px">
      <div class="grille-jours entetes">
        @for (j of joursCourts; track j) { <div class="entete mono">{{ j }}</div> }
      </div>
      <div class="grille-jours">
        @for (jour of jours(); track jour.date.getTime()) {
          <div
            class="case"
            [class.case--hors]="!jour.dansLeMois"
            [class.case--aujourdhui]="jour.aujourdhui"
          >
            <div class="case__numero mono">{{ jour.date.getDate() }}</div>
            @for (e of jour.evenements; track e.id) {
              <div class="jeton jeton--evenement" [attr.title]="e.titre + ' — ' + (e.impact || '')">
                {{ e.titre }}
              </div>
            }
            @if (afficherPlages()) {
              @for (p of jour.plages.slice(0, 3); track p.application_id + p.debut) {
                <div class="jeton jeton--plage mono" [attr.title]="p.nom + ' — ' + p.libelle">
                  {{ p.code }} {{ p.debut | date: 'HH:mm' }}
                </div>
              }
              @if (jour.plages.length > 3) {
                <div class="jeton jeton--plus doux">+{{ jour.plages.length - 3 }} plage(s)</div>
              }
            }
          </div>
        }
      </div>
    </section>

    <section class="carte apparait" style="margin-top: 18px">
      <div class="eyebrow">À venir</div>
      <h2 style="font-size: 18px; margin: 6px 0 14px">Événements transverses planifiés</h2>
      <div class="tableau-conteneur">
        <table class="tableau">
          <thead>
            <tr><th>Événement</th><th>Type</th><th>Début</th><th>Fin</th><th>Applications</th><th>Pilote</th><th></th></tr>
          </thead>
          <tbody>
            @for (e of evenements(); track e.id) {
              <tr>
                <td>
                  {{ e.titre }}
                  @if (e.impact) { <div class="doux" style="font-size: 12px">{{ e.impact }}</div> }
                </td>
                <td><span class="pastille p-info">{{ format(e.type) }}</span></td>
                <td class="mono">{{ e.debut | date: 'dd/MM HH:mm' }}</td>
                <td class="mono">{{ e.fin | date: 'dd/MM HH:mm' }}</td>
                <td>
                  <div class="rangee" style="gap: 4px">
                    @for (a of e.applications; track a.id) { <span class="pastille p-neutre">{{ a.code }}</span> }
                    @if (!e.applications.length) { <span class="doux">Tout le parc</span> }
                  </div>
                </td>
                <td class="doux">{{ e.pilote || '—' }}</td>
                <td>
                  <button class="btn btn--fantome btn--petit" type="button" (click)="supprimer(e)">
                    <mco-icone nom="poubelle" [taille]="15" />
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7"><div class="vide" style="border: none">Aucun événement planifié.</div></td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    @if (formulaireOuvert()) {
      <mco-modale titre="Inscrire un événement" surtitre="Calendrier MCO" (fermer)="formulaireOuvert.set(false)">
        <div class="grille-form">
          <div class="champ">
            <label for="et">Intitulé</label>
            <input id="et" class="saisie" [(ngModel)]="brouillon.titre" />
          </div>
          <div class="champ">
            <label for="ety">Type</label>
            <select id="ety" class="saisie" [(ngModel)]="brouillon.type">
              @for (t of referentiels()?.types_evenement ?? []; track t) { <option [value]="t">{{ format(t) }}</option> }
            </select>
          </div>
          <div class="champ">
            <label for="ed">Début</label>
            <input id="ed" class="saisie mono" type="datetime-local" [(ngModel)]="brouillon.debut" />
          </div>
          <div class="champ">
            <label for="ef">Fin</label>
            <input id="ef" class="saisie mono" type="datetime-local" [(ngModel)]="brouillon.fin" />
          </div>
          <div class="champ">
            <label for="ei">Impact attendu</label>
            <input id="ei" class="saisie" [(ngModel)]="brouillon.impact" />
          </div>
          <div class="champ">
            <label for="ep">Pilote</label>
            <input id="ep" class="saisie" [(ngModel)]="brouillon.pilote" />
          </div>
        </div>

        <div class="champ" style="margin-top: 16px">
          <label>Applications concernées</label>
          <div class="liste-apps">
            @for (a of applications(); track a.id) {
              <label class="ligne-choix" [class.ligne-choix--active]="appsChoisies().includes(a.id)">
                <input type="checkbox" [checked]="appsChoisies().includes(a.id)" (change)="basculerApp(a.id)" />
                <span class="mono">{{ a.code }}</span>
                <span class="doux">{{ a.nom }}</span>
              </label>
            }
          </div>
        </div>

        <div class="rangee" style="margin-top: 22px; justify-content: flex-end">
          <button class="btn btn--fantome" type="button" (click)="formulaireOuvert.set(false)">Annuler</button>
          <button class="btn btn--primaire" type="button" (click)="enregistrer()">
            <mco-icone nom="coche" /> Inscrire au calendrier
          </button>
        </div>
      </mco-modale>
    }
  `,
  styles: [
    `
      .mois { font-family: var(--display); font-size: 17px; text-transform: capitalize; min-width: 160px; text-align: center; }
      .filtre { max-width: 260px; }
      .bascule { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
      .bascule input { accent-color: var(--signal); }

      /* minmax(0, 1fr) et non 1fr : sans cela une colonne refuse de descendre
         sous la largeur de son contenu. Un titre d'événement long en « nowrap »
         élargit alors sa colonne, écrase les autres et désaligne les en-têtes. */
      .grille-jours {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 6px;
      }
      .entetes { margin-bottom: 8px; }
      .entete {
        font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
        color: var(--texte-doux); text-align: center; padding-bottom: 4px;
      }
      .case {
        min-height: 104px; padding: 8px; min-width: 0;
        border: 1px solid var(--bordure); border-radius: 10px;
        background: var(--surface);
        display: flex; flex-direction: column; gap: 4px;
        transition: border-color var(--transition);
      }
      .case:hover { border-color: var(--bordure-forte); }
      .case--hors { opacity: 0.38; }
      .case--aujourdhui { border-color: var(--signal); box-shadow: 0 0 0 1px var(--signal) inset; }
      .case__numero { font-size: 11.5px; color: var(--texte-doux); }

      .jeton {
        font-size: 10.5px; padding: 3px 6px; border-radius: 5px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        min-width: 0; max-width: 100%;
      }
      .jeton--evenement { background: rgba(155, 123, 255, 0.18); border-left: 2px solid var(--violet); }
      .jeton--plage { background: var(--signal-sourd); border-left: 2px solid var(--signal); }
      .jeton--plus { font-size: 10px; }

      .liste-apps { max-height: 210px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
      .ligne-choix { display: flex; align-items: center; gap: 9px; padding: 7px 9px; border-radius: 8px; cursor: pointer; font-size: 13px; }
      .ligne-choix:hover { background: var(--surface-forte); }
      .ligne-choix--active { background: var(--signal-sourd); }
      .ligne-choix input { accent-color: var(--signal); }

      @media (max-width: 760px) { .case { min-height: 74px; } .jeton { display: none; } }
    `,
  ],
})
export class CalendrierComponent {
  private api = inject(ApiService);
  private notif = inject(NotificationService);

  readonly evenements = signal<Evenement[]>([]);
  readonly occurrences = signal<OccurrencePlage[]>([]);
  readonly applications = signal<Application[]>([]);
  readonly referentiels = signal<Referentiels | undefined>(undefined);
  readonly decalage = signal(0);
  readonly filtreApp = signal('');
  readonly afficherPlages = signal(true);
  readonly formulaireOuvert = signal(false);
  readonly appsChoisies = signal<number[]>([]);

  readonly joursCourts = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  brouillon: Record<string, string> = { titre: '', type: 'MAINTENANCE_TRANSVERSE', debut: '', fin: '', impact: '', pilote: '' };

  readonly premierJour = computed(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + this.decalage(), 1);
  });

  readonly jours = computed<Jour[]>(() => {
    const premier = this.premierJour();
    const debutGrille = new Date(premier);
    const decalageLundi = (premier.getDay() + 6) % 7;
    debutGrille.setDate(premier.getDate() - decalageLundi);

    const filtre = this.filtreApp();
    const plages = filtre
      ? this.occurrences().filter((o) => String(o.application_id) === filtre)
      : this.occurrences();
    const evenements = filtre
      ? this.evenements().filter((e) => e.applications.some((a) => String(a.id) === filtre))
      : this.evenements();

    const aujourdhui = new Date().toDateString();
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(debutGrille);
      date.setDate(debutGrille.getDate() + i);
      const cle = date.toDateString();
      return {
        date,
        dansLeMois: date.getMonth() === premier.getMonth(),
        aujourdhui: cle === aujourdhui,
        plages: plages.filter((p) => new Date(p.debut).toDateString() === cle),
        evenements: evenements.filter((e) => {
          const debut = new Date(e.debut);
          const fin = new Date(e.fin);
          return date >= new Date(debut.toDateString()) && date <= new Date(fin.toDateString());
        }),
      };
    });
  });

  constructor() {
    this.api.referentiels().subscribe((r) => this.referentiels.set(r));
    this.api.listerApplications().subscribe((a) => this.applications.set(a));
    this.charger();
  }

  charger(): void {
    this.api.listerEvenements().subscribe((e) => this.evenements.set(e));
    this.api.projectionPlages(90).subscribe((o) => this.occurrences.set(o));
  }

  decaler(pas: number): void {
    this.decalage.update((d) => d + pas);
  }

  basculerApp(id: number): void {
    this.appsChoisies.update((liste) =>
      liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id],
    );
  }

  enregistrer(): void {
    if (!this.brouillon['titre'] || !this.brouillon['debut'] || !this.brouillon['fin']) {
      this.notif.erreur('Intitulé, début et fin sont obligatoires.');
      return;
    }
    this.api
      .creerEvenement({ ...this.brouillon, application_ids: this.appsChoisies() })
      .subscribe({
        next: () => {
          this.notif.succes('Événement inscrit au calendrier.');
          this.formulaireOuvert.set(false);
          this.brouillon = { titre: '', type: 'MAINTENANCE_TRANSVERSE', debut: '', fin: '', impact: '', pilote: '' };
          this.appsChoisies.set([]);
          this.charger();
        },
        error: (e) => this.notif.erreur(e?.error?.detail ?? 'Création impossible.'),
      });
  }

  supprimer(e: Evenement): void {
    if (!confirm(`Retirer « ${e.titre} » du calendrier ?`)) return;
    this.api.supprimerEvenement(e.id).subscribe(() => {
      this.notif.succes('Événement retiré.');
      this.charger();
    });
  }

  classe = classePastille;
  format = lisible;
}
