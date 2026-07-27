import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { NotificationService } from '../core/ui.service';
import { Application, Creneau, JOURS, ReponseCreneaux, classePastille, lisible } from '../core/models';
import { IconeComponent } from '../shared/icone.component';

@Component({
  selector: 'mco-maintenance',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconeComponent],
  template: `
    <header class="apparait">
      <div class="eyebrow">Moteur d'arbitrage</div>
      <h1 class="titre-page">Recherche de créneau commun</h1>
      <p class="sous-titre">
        Sélectionnez les applications à immobiliser ensemble. Le moteur superpose leurs plages
        déclarées et, si aucune fenêtre parfaite n'existe, propose le moindre mal en nommant
        précisément les applications en conflit.
      </p>
    </header>

    <div class="disposition" style="margin-top: 26px">
      <!-- ------------------------------------------------ Paramètres -->
      <aside class="carte apparait">
        <div class="eyebrow">Périmètre</div>
        <h2 class="titre-bloc">Applications concernées</h2>

        <label class="bascule">
          <input type="checkbox" [ngModel]="toutLeParc()" (ngModelChange)="toutLeParc.set($event)" />
          <span>Tout le parc ({{ applications().length }} applications)</span>
        </label>

        @if (!toutLeParc()) {
          <div class="recherche" style="margin: 14px 0 10px">
            <mco-icone nom="loupe" [taille]="15" />
            <input
              class="saisie"
              type="search"
              placeholder="Filtrer la liste…"
              [ngModel]="filtre()"
              (ngModelChange)="filtre.set($event)"
            />
          </div>
          <div class="liste-apps">
            @for (app of applicationsFiltrees(); track app.id) {
              <label class="ligne-choix" [class.ligne-choix--active]="estSelectionnee(app.id)">
                <input
                  type="checkbox"
                  [checked]="estSelectionnee(app.id)"
                  (change)="basculer(app.id)"
                />
                <span class="mono">{{ app.code }}</span>
                <span class="doux nom">{{ app.nom }}</span>
                @if (!app.plages.length) {
                  <span class="pastille p-alerte" title="Aucune plage déclarée">!</span>
                }
              </label>
            }
          </div>
          <div class="rangee" style="margin-top: 10px">
            <button class="btn btn--petit btn--fantome" type="button" (click)="toutSelectionner()">
              Tout cocher
            </button>
            <button class="btn btn--petit btn--fantome" type="button" (click)="selection.set([])">
              Tout décocher
            </button>
          </div>
        }

        <div class="eyebrow" style="margin-top: 24px">Contraintes</div>
        <h2 class="titre-bloc">Paramètres de l'intervention</h2>

        <div class="champ" style="margin-top: 14px">
          <label for="duree">Durée nécessaire : {{ dureeLisible() }}</label>
          <input
            id="duree"
            type="range"
            min="15"
            max="480"
            step="15"
            [ngModel]="duree()"
            (ngModelChange)="duree.set(+$event)"
          />
        </div>

        <div class="champ" style="margin-top: 14px">
          <label for="tolerance">
            Conflits tolérés : {{ tolerance() }}
            <span class="doux">({{ tolerance() === 0 ? 'créneau parfait exigé' : 'moindre mal accepté' }})</span>
          </label>
          <input
            id="tolerance"
            type="range"
            min="0"
            max="6"
            step="1"
            [ngModel]="tolerance()"
            (ngModelChange)="tolerance.set(+$event)"
          />
        </div>

        <div class="champ" style="margin-top: 14px">
          <label>Jours autorisés</label>
          <div class="jours">
            @for (j of jours; track j; let i = $index) {
              <button
                type="button"
                class="jour"
                [class.jour--actif]="joursChoisis().includes(i)"
                (click)="basculerJour(i)"
              >
                {{ j.slice(0, 3) }}
              </button>
            }
          </div>
        </div>

        <div class="grille-form" style="margin-top: 14px">
          <div class="champ">
            <label for="hmin">Pas avant</label>
            <input id="hmin" class="saisie mono" type="time" [ngModel]="heureMin()" (ngModelChange)="heureMin.set($event)" />
          </div>
          <div class="champ">
            <label for="hmax">Pas après</label>
            <input id="hmax" class="saisie mono" type="time" [ngModel]="heureMax()" (ngModelChange)="heureMax.set($event)" />
          </div>
        </div>

        <button
          class="btn btn--primaire"
          type="button"
          style="width: 100%; justify-content: center; margin-top: 20px"
          [disabled]="chargement()"
          (click)="rechercher()"
        >
          <mco-icone nom="eclair" />
          {{ chargement() ? 'Calcul en cours…' : 'Chercher les créneaux' }}
        </button>
      </aside>

      <!-- ------------------------------------------------ Résultats -->
      <section class="pile">
        @if (reponse(); as r) {
          <div class="carte apparait" [class.bandeau--parfait]="aDuParfait()">
            <div class="entre">
              <div>
                <div class="eyebrow">Résultat</div>
                <h2 class="titre-bloc">{{ r.message }}</h2>
                <p class="doux" style="font-size: 13px; margin-top: 6px">
                  {{ r.nb_applications }} application(s) analysée(s) ·
                  durée demandée {{ r.duree_demandee }} min ·
                  tolérance {{ r.tolerance }} conflit(s)
                </p>
              </div>
            </div>
          </div>

          @for (c of r.creneaux; track $index) {
            <article class="carte carte--survol creneau apparait" [class.creneau--parfait]="c.parfait">
              <div class="entre">
                <div class="rangee" style="gap: 16px">
                  <div class="horaire">
                    <div class="horaire__jour">{{ c.jour_libelle }}</div>
                    <div class="horaire__plage mono">{{ c.heure_debut }} → {{ c.heure_fin }}</div>
                  </div>
                  <div>
                    <div [class]="c.parfait ? 'pastille p-ok' : 'pastille p-alerte'">
                      {{ c.parfait ? 'Aucun conflit' : c.nb_conflits + ' conflit(s)' }}
                    </div>
                    <div class="doux" style="font-size: 13px; margin-top: 8px">{{ c.resume }}</div>
                  </div>
                </div>
                <div class="duree mono">{{ c.duree_minutes }} min</div>
              </div>

              @if (c.conflits.length) {
                <div class="conflits">
                  <div class="eyebrow">Nature des conflits</div>
                  @for (conflit of c.conflits; track conflit.application_id) {
                    <a class="conflit" [routerLink]="['/applications', conflit.application_id]">
                      <span class="mono">{{ conflit.code }}</span>
                      <span [class]="classe(conflit.criticite)">{{ format(conflit.criticite) }}</span>
                      <span class="doux raison">{{ conflit.raison }}</span>
                    </a>
                  }
                </div>
              }

              @if (c.applications_couvertes.length) {
                <div class="couvertes doux">
                  <span class="eyebrow">Sans impact</span>
                  @for (code of c.applications_couvertes; track code) {
                    <span class="pastille p-ok">{{ code }}</span>
                  }
                </div>
              }
            </article>
          } @empty {
            <div class="carte vide" style="border-style: dashed">
              Aucun créneau ne satisfait ces contraintes. Augmentez la tolérance de conflits,
              raccourcissez la durée ou élargissez la fenêtre horaire.
            </div>
          }
        } @else {
          <div class="carte vide" style="border-style: dashed">
            Choisissez un périmètre puis lancez la recherche pour afficher les créneaux communs.
          </div>
        }
      </section>
    </div>
  `,
  styles: [
    `
      .disposition { display: grid; grid-template-columns: 380px 1fr; gap: 20px; align-items: start; }
      @media (max-width: 1080px) { .disposition { grid-template-columns: 1fr; } }

      .titre-bloc { font-size: 18px; margin: 6px 0 12px; }

      .bascule { display: flex; align-items: center; gap: 10px; font-size: 14px; cursor: pointer; }
      .bascule input { width: 16px; height: 16px; accent-color: var(--signal); }

      .recherche { position: relative; display: flex; align-items: center; }
      .recherche mco-icone { position: absolute; left: 11px; color: var(--texte-doux); }
      .recherche .saisie { padding-left: 34px; }

      .liste-apps { max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
      .ligne-choix {
        display: flex; align-items: center; gap: 9px;
        padding: 7px 9px; border-radius: 8px; cursor: pointer; font-size: 13px;
        transition: background var(--transition);
      }
      .ligne-choix:hover { background: var(--surface-forte); }
      .ligne-choix--active { background: var(--signal-sourd); }
      .ligne-choix input { accent-color: var(--signal); }
      .ligne-choix .nom { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      input[type='range'] { width: 100%; accent-color: var(--signal); }

      .jours { display: flex; gap: 5px; flex-wrap: wrap; }
      .jour {
        padding: 7px 11px; border-radius: 8px; cursor: pointer; font-size: 12px;
        border: 1px solid var(--bordure-forte); background: transparent; color: var(--texte-doux);
        transition: all var(--transition);
      }
      .jour--actif { background: var(--signal-sourd); border-color: var(--signal); color: var(--texte); }

      .bandeau--parfait { border-color: rgba(53, 199, 154, 0.4); }

      .creneau { border-left: 3px solid var(--ambre); }
      .creneau--parfait { border-left-color: var(--menthe); }
      .horaire__jour { font-family: var(--display); font-size: 19px; font-weight: 600; }
      .horaire__plage { font-size: 14px; color: var(--texte-doux); margin-top: 3px; }
      .duree { font-size: 12px; color: var(--texte-doux); }

      .conflits { margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--bordure-forte); }
      .conflit {
        display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
        padding: 9px 11px; margin-top: 8px; border-radius: 9px;
        border: 1px solid var(--bordure); font-size: 13px;
        transition: border-color var(--transition), transform var(--transition);
      }
      .conflit:hover { border-color: var(--grenat); transform: translateX(3px); }
      .conflit .raison { flex: 1; min-width: 200px; font-size: 12.5px; }

      .couvertes { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-top: 14px; }
    `,
  ],
})
export class MaintenanceComponent {
  private api = inject(ApiService);
  private notif = inject(NotificationService);

  readonly applications = signal<Application[]>([]);
  readonly selection = signal<number[]>([]);
  readonly toutLeParc = signal(false);
  readonly filtre = signal('');
  readonly duree = signal(120);
  readonly tolerance = signal(0);
  readonly joursChoisis = signal<number[]>([]);
  readonly heureMin = signal('');
  readonly heureMax = signal('');
  readonly reponse = signal<ReponseCreneaux | undefined>(undefined);
  readonly chargement = signal(false);
  readonly jours = JOURS;

  readonly applicationsFiltrees = computed(() => {
    const terme = this.filtre().toLowerCase().trim();
    if (!terme) return this.applications();
    return this.applications().filter(
      (a) => a.code.toLowerCase().includes(terme) || a.nom.toLowerCase().includes(terme),
    );
  });

  readonly dureeLisible = computed(() => {
    const m = this.duree();
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? m % 60 + ' min' : ''}`.trim();
  });

  readonly aDuParfait = computed(() => (this.reponse()?.creneaux ?? []).some((c: Creneau) => c.parfait));

  constructor() {
    this.api.listerApplications().subscribe((apps) => this.applications.set(apps));
  }

  estSelectionnee(id: number): boolean {
    return this.selection().includes(id);
  }

  basculer(id: number): void {
    this.selection.update((liste) =>
      liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id],
    );
  }

  toutSelectionner(): void {
    this.selection.set(this.applicationsFiltrees().map((a) => a.id));
  }

  basculerJour(index: number): void {
    this.joursChoisis.update((liste) =>
      liste.includes(index) ? liste.filter((x) => x !== index) : [...liste, index],
    );
  }

  rechercher(): void {
    if (!this.toutLeParc() && !this.selection().length) {
      this.notif.erreur('Sélectionnez au moins une application.');
      return;
    }
    this.chargement.set(true);
    this.api
      .rechercherCreneaux({
        application_ids: this.selection(),
        tout_le_parc: this.toutLeParc(),
        duree_minutes: this.duree(),
        tolerance_conflits: this.tolerance(),
        jours_autorises: this.joursChoisis().length ? this.joursChoisis() : null,
        heure_min: this.heureMin() || null,
        heure_max: this.heureMax() || null,
      })
      .subscribe({
        next: (r) => {
          this.reponse.set(r);
          this.chargement.set(false);
        },
        error: () => {
          this.chargement.set(false);
          this.notif.erreur('La recherche a échoué.');
        },
      });
  }

  classe = classePastille;
  format = lisible;
}
