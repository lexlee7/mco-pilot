import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { NotificationService } from '../core/ui.service';
import {
  Application,
  Flux,
  JOURS,
  OccurrenceFlux,
  Partenaire,
  Referentiels,
  SyntheseFlux,
  classePastille,
  lisible,
} from '../core/models';
import { IconeComponent } from '../shared/icone.component';
import { ModaleComponent } from '../shared/modale.component';

type Vue = 'catalogue' | 'impact';

@Component({
  selector: 'mco-flux',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconeComponent, ModaleComponent],
  template: `
    <header class="entre apparait">
      <div>
        <div class="eyebrow">Échanges</div>
        <h1 class="titre-page">Gestion des flux</h1>
        <p class="sous-titre">
          Tous les échanges du parc, quelle que soit l'application. Filtrez par partenaire,
          par créneau horaire ou par jour pour mesurer ce qu'une opération ou un incident
          va réellement toucher.
        </p>
      </div>
      <button class="btn btn--primaire" type="button" (click)="ouvrirCreation()">
        <mco-icone nom="plus" /> Déclarer un flux
      </button>
    </header>

    @if (synthese(); as s) {
      <section class="grille-cartes apparait" style="margin-top: 24px">
        <div class="carte kpi">
          <div class="eyebrow">Flux référencés</div>
          <div class="kpi__valeur">{{ s.nb_flux }}</div>
          <div class="kpi__note">sur {{ s.nb_applications_concernees }} application(s)</div>
        </div>
        <div class="carte kpi" [class.kpi--alerte]="s.nb_bloquants > 0">
          <div class="eyebrow">Flux bloquants</div>
          <div class="kpi__valeur">{{ s.nb_bloquants }}</div>
          <div class="kpi__note">impact métier immédiat en cas d'arrêt</div>
        </div>
        <div class="carte kpi">
          <div class="eyebrow">Partenaires impliqués</div>
          <div class="kpi__valeur">{{ s.nb_partenaires_concernes }}</div>
          <div class="kpi__note">correspondants externes à prévenir</div>
        </div>
        <div class="carte kpi">
          <div class="eyebrow">Flux affichés</div>
          <div class="kpi__valeur">{{ flux().length }}</div>
          <div class="kpi__note">après application des filtres</div>
        </div>
      </section>
    }

    <nav class="onglets apparait">
      @for (v of vues; track v.cle) {
        <button class="onglet" type="button" [class.onglet--actif]="vue() === v.cle" (click)="basculer(v.cle)">
          {{ v.libelle }}
        </button>
      }
    </nav>

    <!-- ------------------------------------------------ Filtres -->
    <section class="carte apparait" style="padding: 16px 18px">
      <div class="rangee">
        <div class="recherche">
          <mco-icone nom="loupe" [taille]="16" />
          <input
            class="saisie"
            type="search"
            placeholder="Nom du flux, protocole, description…"
            [ngModel]="recherche()"
            (ngModelChange)="recherche.set($event); charger()"
          />
        </div>
        <select class="saisie filtre" [ngModel]="applicationId()" (ngModelChange)="applicationId.set($event); charger()">
          <option value="">Toutes les applications</option>
          @for (a of applications(); track a.id) { <option [value]="a.id">{{ a.code }}</option> }
        </select>
        <select class="saisie filtre" [ngModel]="partenaireId()" (ngModelChange)="partenaireId.set($event); charger()">
          <option value="">Tous les partenaires</option>
          @for (p of partenaires(); track p.id) { <option [value]="p.id">{{ p.nom }}</option> }
        </select>
        <select class="saisie filtre" [ngModel]="sens()" (ngModelChange)="sens.set($event); charger()">
          <option value="">Tous les sens</option>
          @for (s of referentiels()?.sens_flux ?? []; track s) { <option [value]="s">{{ format(s) }}</option> }
        </select>
        <select class="saisie filtre" [ngModel]="recurrence()" (ngModelChange)="recurrence.set($event); charger()">
          <option value="">Toutes les récurrences</option>
          @for (r of referentiels()?.types_recurrence ?? []; track r) { <option [value]="r">{{ format(r) }}</option> }
        </select>
      </div>

      <div class="rangee" style="margin-top: 12px">
        <div class="champ" style="max-width: 150px">
          <label for="hmin">Créneau — de</label>
          <input id="hmin" class="saisie mono" type="time" [ngModel]="heureMin()" (ngModelChange)="heureMin.set($event); charger()" />
        </div>
        <div class="champ" style="max-width: 150px">
          <label for="hmax">à</label>
          <input id="hmax" class="saisie mono" type="time" [ngModel]="heureMax()" (ngModelChange)="heureMax.set($event); charger()" />
        </div>
        <div class="champ" style="max-width: 190px">
          <label for="jsem">Jour de la semaine</label>
          <select id="jsem" class="saisie" [ngModel]="jourSemaine()" (ngModelChange)="jourSemaine.set($event); charger()">
            <option value="">Tous les jours</option>
            @for (j of jours; track j; let i = $index) { <option [value]="i">{{ j }}</option> }
          </select>
        </div>
        <label class="bascule" style="margin-top: 18px">
          <input type="checkbox" [ngModel]="bloquant()" (ngModelChange)="bloquant.set($event); charger()" />
          <span>Flux bloquants uniquement</span>
        </label>
        @if (filtresActifs()) {
          <button class="btn btn--fantome btn--petit" type="button" style="margin-top: 18px" (click)="reinitialiser()">
            Réinitialiser
          </button>
        }
      </div>
    </section>

    <!-- ------------------------------------------------ Catalogue -->
    @if (vue() === 'catalogue') {
      <section class="carte apparait" style="margin-top: 18px; padding: 4px 0 0">
        <div class="tableau-conteneur">
          <table class="tableau">
            <thead>
              <tr>
                <th>Application</th><th>Flux</th><th>Sens</th><th>Périodicité</th>
                <th>Heure</th><th>Protocole</th><th>Partenaire</th><th>Bloquant</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (f of flux(); track f.id) {
                <tr>
                  <td>
                    <a class="mono" [routerLink]="['/applications', f.application_id]">
                      {{ f.code_application }}
                    </a>
                  </td>
                  <td>
                    {{ f.nom }}
                    @if (f.description) {
                      <div class="doux" style="font-size: 12px">{{ f.description }}</div>
                    }
                  </td>
                  <td><span class="pastille p-info">{{ format(f.sens) }}</span></td>
                  <td class="doux">{{ f.libelle_recurrence }}</td>
                  <td class="mono">{{ f.heure || '—' }}</td>
                  <td class="mono doux">{{ f.protocole || '—' }}</td>
                  <td class="doux">{{ f.partenaire?.nom || 'Interne' }}</td>
                  <td>
                    @if (f.bloquant) { <span class="pastille p-critique">Bloquant</span> }
                    @else { <span class="doux">Non</span> }
                  </td>
                  <td>
                    <div class="rangee" style="gap: 4px; flex-wrap: nowrap">
                      <button class="btn btn--fantome btn--petit" type="button" (click)="ouvrirEdition(f)">
                        <mco-icone nom="crayon" [taille]="15" />
                      </button>
                      <button class="btn btn--fantome btn--petit" type="button" (click)="supprimer(f)">
                        <mco-icone nom="poubelle" [taille]="15" />
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="9">
                  <div class="vide" style="border: none">Aucun flux ne correspond à ces critères.</div>
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }

    <!-- ------------------------------------------------ Analyse d'impact -->
    @if (vue() === 'impact') {
      <section class="carte apparait" style="margin-top: 18px">
        <div class="entre">
          <div>
            <div class="eyebrow">Analyse d'impact</div>
            <h2 class="titre-bloc">Échanges attendus jour par jour</h2>
            <p class="doux" style="font-size: 13px; margin-top: 4px">
              Projection des occurrences réelles sur la période, récurrences dépliées.
              Utile pour choisir une fenêtre d'intervention ou mesurer ce qu'un incident a manqué.
            </p>
          </div>
          <div class="champ" style="max-width: 150px">
            <label for="horizon">Horizon</label>
            <select id="horizon" class="saisie" [ngModel]="horizon()" (ngModelChange)="horizon.set(+$event); chargerOccurrences()">
              <option [ngValue]="7">7 jours</option>
              <option [ngValue]="14">14 jours</option>
              <option [ngValue]="31">31 jours</option>
            </select>
          </div>
        </div>

        <div class="pile" style="margin-top: 18px; gap: 14px">
          @for (jour of occurrencesParJour(); track jour.cle) {
            <div class="jour-impact">
              <div class="jour-impact__tete">
                <strong>{{ jour.libelle }}</strong>
                <span class="doux mono">{{ jour.items.length }} échange(s)</span>
              </div>
              <div class="jour-impact__liste">
                @for (o of jour.items; track o.flux_id + o.horodatage) {
                  <div class="occurrence" [class.occurrence--bloquante]="o.bloquant">
                    <span class="mono heure">{{ o.heure || o.note || '—' }}</span>
                    <a class="mono" [routerLink]="['/applications', o.application_id]">
                      {{ codeDe(o.application_id) }}
                    </a>
                    <span class="nom">{{ o.nom }}</span>
                    <span class="doux">{{ o.partenaire || 'Interne' }}</span>
                    <span [class]="o.sens === 'ENTRANT' ? 'pastille p-info' : 'pastille p-neutre'">
                      {{ format(o.sens) }}
                    </span>
                  </div>
                }
              </div>
            </div>
          } @empty {
            <div class="vide">Aucune occurrence sur la période sélectionnée.</div>
          }
        </div>
      </section>
    }

    @if (formulaireOuvert()) {
      <mco-modale
        [titre]="brouillon.id ? 'Modifier le flux' : 'Nouveau flux'"
        surtitre="Échange applicatif"
        (fermer)="formulaireOuvert.set(false)"
      >
        <div class="grille-form">
          <div class="champ">
            <label for="fa">Application</label>
            <select id="fa" class="saisie" [(ngModel)]="brouillon.application_id">
              @for (a of applications(); track a.id) {
                <option [ngValue]="a.id">{{ a.code }} — {{ a.nom }}</option>
              }
            </select>
          </div>
          <div class="champ">
            <label for="fn">Nom du flux</label>
            <input id="fn" class="saisie" [(ngModel)]="brouillon.nom" />
          </div>
          <div class="champ">
            <label for="fs">Sens</label>
            <select id="fs" class="saisie" [(ngModel)]="brouillon.sens">
              @for (s of referentiels()?.sens_flux ?? []; track s) { <option [value]="s">{{ format(s) }}</option> }
            </select>
          </div>
          <div class="champ">
            <label for="fp">Partenaire</label>
            <select id="fp" class="saisie" [(ngModel)]="brouillon.partenaire_id">
              <option [ngValue]="null">Interne</option>
              @for (p of partenaires(); track p.id) { <option [ngValue]="p.id">{{ p.nom }}</option> }
            </select>
          </div>
          <div class="champ">
            <label for="fpr">Protocole</label>
            <input id="fpr" class="saisie" [(ngModel)]="brouillon.protocole" placeholder="SFTP, API REST…" />
          </div>
          <div class="champ">
            <label for="fh">Heure de déclenchement</label>
            <input id="fh" class="saisie mono" type="time" [(ngModel)]="brouillon.heure" />
          </div>
        </div>

        <!-- Périodicité, sur le modèle d'une réunion récurrente -->
        <div class="bloc-recurrence">
          <div class="eyebrow">Périodicité</div>
          <div class="champ" style="margin-top: 12px">
            <label for="fr">Rythme</label>
            <select id="fr" class="saisie" [(ngModel)]="brouillon.recurrence">
              @for (r of referentiels()?.types_recurrence ?? []; track r) {
                <option [value]="r">{{ libelleRecurrence(r) }}</option>
              }
            </select>
          </div>

          @if (brouillon.recurrence === 'HEBDOMADAIRE') {
            <div class="champ" style="margin-top: 14px">
              <label>Jours concernés</label>
              <div class="jours">
                @for (j of jours; track j; let i = $index) {
                  <button
                    type="button"
                    class="jour"
                    [class.jour--actif]="joursCoches().includes(i)"
                    (click)="basculerJour(i)"
                  >
                    {{ j.slice(0, 3) }}
                  </button>
                }
              </div>
            </div>
          }

          @if (brouillon.recurrence === 'MENSUEL_DATE' || brouillon.recurrence === 'ANNUEL') {
            <div class="grille-form" style="margin-top: 14px">
              <div class="champ">
                <label for="fjm">Jour du mois</label>
                <input id="fjm" class="saisie" type="number" min="1" max="31" [(ngModel)]="brouillon.jour_du_mois" />
              </div>
              @if (brouillon.recurrence === 'ANNUEL') {
                <div class="champ">
                  <label for="fma">Mois</label>
                  <select id="fma" class="saisie" [(ngModel)]="brouillon.mois_annee">
                    @for (m of mois; track m; let i = $index) { <option [ngValue]="i + 1">{{ m }}</option> }
                  </select>
                </div>
              }
            </div>
          }

          @if (brouillon.recurrence === 'MENSUEL_JOUR') {
            <div class="grille-form" style="margin-top: 14px">
              <div class="champ">
                <label for="foc">Occurrence</label>
                <select id="foc" class="saisie" [(ngModel)]="brouillon.occurrence_mois">
                  <option [ngValue]="1">Le 1er</option>
                  <option [ngValue]="2">Le 2e</option>
                  <option [ngValue]="3">Le 3e</option>
                  <option [ngValue]="4">Le 4e</option>
                  <option [ngValue]="5">Le dernier</option>
                </select>
              </div>
              <div class="champ">
                <label for="fjsm">Jour</label>
                <select id="fjsm" class="saisie" [(ngModel)]="brouillon.jour_semaine_mois">
                  @for (j of jours; track j; let i = $index) { <option [ngValue]="i">{{ j }}</option> }
                </select>
              </div>
            </div>
          }

          <p class="apercu-recurrence mono">{{ apercuRecurrence() }}</p>
        </div>

        <div class="rangee" style="margin-top: 16px">
          <label class="bascule">
            <input type="checkbox" [(ngModel)]="brouillon.bloquant" />
            <span>Flux bloquant — son interruption a un impact métier immédiat</span>
          </label>
        </div>

        <div class="champ" style="margin-top: 16px">
          <label for="fd">Description</label>
          <textarea id="fd" class="saisie" [(ngModel)]="brouillon.description"></textarea>
        </div>

        <div class="rangee" style="margin-top: 22px; justify-content: flex-end">
          <button class="btn btn--fantome" type="button" (click)="formulaireOuvert.set(false)">Annuler</button>
          <button class="btn btn--primaire" type="button" (click)="enregistrer()">
            <mco-icone nom="coche" /> Enregistrer
          </button>
        </div>
      </mco-modale>
    }
  `,
  styles: [
    `
      .kpi__valeur { font-family: var(--display); font-size: 34px; font-weight: 600; margin: 8px 0 4px; }
      .kpi--alerte .kpi__valeur { color: var(--grenat); }
      .kpi__note { font-size: 12.5px; color: var(--texte-doux); }

      .onglets {
        display: flex; gap: 4px; margin: 22px 0 18px;
        border-bottom: 1px solid var(--bordure);
      }
      .onglet {
        padding: 11px 15px; background: none; border: none; cursor: pointer;
        color: var(--texte-doux); font-size: 14px; border-bottom: 2px solid transparent;
        margin-bottom: -1px; transition: color var(--transition), border-color var(--transition);
      }
      .onglet:hover { color: var(--texte); }
      .onglet--actif { color: var(--texte); border-bottom-color: var(--signal); }

      .recherche { position: relative; flex: 1; min-width: 220px; display: flex; align-items: center; }
      .recherche mco-icone { position: absolute; left: 12px; color: var(--texte-doux); }
      .recherche .saisie { padding-left: 36px; }
      .filtre { max-width: 185px; }
      .bascule { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
      .bascule input { accent-color: var(--signal); }
      .titre-bloc { font-size: 18px; margin: 6px 0 4px; }

      .bloc-recurrence {
        margin-top: 18px; padding: 16px;
        border: 1px dashed var(--bordure-forte); border-radius: var(--r-m);
      }
      .jours { display: flex; gap: 5px; flex-wrap: wrap; }
      .jour {
        padding: 7px 11px; border-radius: 8px; cursor: pointer; font-size: 12px;
        border: 1px solid var(--bordure-forte); background: transparent;
        color: var(--texte-doux); transition: all var(--transition);
      }
      .jour--actif { background: var(--signal-sourd); border-color: var(--signal); color: var(--texte); }
      .apercu-recurrence {
        margin: 14px 0 0; font-size: 12px; color: var(--signal);
        padding: 9px 12px; border-radius: 8px; background: var(--signal-sourd);
      }

      .jour-impact { border: 1px solid var(--bordure); border-radius: var(--r-m); overflow: hidden; }
      .jour-impact__tete {
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 14px; background: var(--surface-forte); font-size: 13.5px;
        text-transform: capitalize;
      }
      .jour-impact__liste { padding: 6px 0; }
      .occurrence {
        display: grid;
        grid-template-columns: 86px 90px minmax(0, 1fr) 150px 110px;
        gap: 12px; align-items: center;
        padding: 8px 14px; font-size: 13px;
        border-left: 2px solid transparent;
      }
      .occurrence:hover { background: var(--surface-forte); }
      .occurrence--bloquante { border-left-color: var(--grenat); }
      .occurrence .heure { font-size: 11.5px; color: var(--texte-doux); }
      .occurrence .nom { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      @media (max-width: 900px) {
        .occurrence { grid-template-columns: 1fr; gap: 3px; }
      }
    `,
  ],
})
export class FluxComponent {
  private api = inject(ApiService);
  private notif = inject(NotificationService);

  readonly vue = signal<Vue>('catalogue');
  readonly vues: { cle: Vue; libelle: string }[] = [
    { cle: 'catalogue', libelle: 'Catalogue des flux' },
    { cle: 'impact', libelle: 'Analyse d’impact' },
  ];

  readonly flux = signal<Flux[]>([]);
  readonly occurrences = signal<OccurrenceFlux[]>([]);
  readonly synthese = signal<SyntheseFlux | undefined>(undefined);
  readonly applications = signal<Application[]>([]);
  readonly partenaires = signal<Partenaire[]>([]);
  readonly referentiels = signal<Referentiels | undefined>(undefined);

  readonly recherche = signal('');
  readonly applicationId = signal('');
  readonly partenaireId = signal('');
  readonly sens = signal('');
  readonly recurrence = signal('');
  readonly heureMin = signal('');
  readonly heureMax = signal('');
  readonly jourSemaine = signal('');
  readonly bloquant = signal(false);
  readonly horizon = signal(14);
  readonly formulaireOuvert = signal(false);
  readonly joursCoches = signal<number[]>([]);

  readonly jours = JOURS;
  readonly mois = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];

  brouillon: Partial<Flux> & { id?: number } = this.vierge();

  readonly filtresActifs = computed(
    () =>
      !!(
        this.recherche() || this.applicationId() || this.partenaireId() || this.sens() ||
        this.recurrence() || this.heureMin() || this.heureMax() || this.jourSemaine() ||
        this.bloquant()
      ),
  );

  readonly occurrencesParJour = computed(() => {
    const groupes = new Map<string, OccurrenceFlux[]>();
    for (const o of this.occurrences()) {
      const liste = groupes.get(o.date) ?? [];
      liste.push(o);
      groupes.set(o.date, liste);
    }
    return [...groupes.entries()].map(([cle, items]) => ({
      cle,
      libelle: new Date(cle).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long',
      }),
      items,
    }));
  });

  readonly apercuRecurrence = computed(() => {
    const b = this.brouillon;
    const heure = b.heure ? ` à ${b.heure}` : '';
    switch (b.recurrence) {
      case 'TEMPS_REEL': return 'En continu (temps réel)';
      case 'HORAIRE': return 'Toutes les heures';
      case 'QUOTIDIEN': return `Tous les jours${heure}`;
      case 'HEBDOMADAIRE': {
        const choisis = this.joursCoches();
        if (!choisis.length) return `Toutes les semaines${heure}`;
        if (choisis.length === 5 && choisis.every((j) => j < 5)) {
          return `Tous les jours ouvrés${heure}`;
        }
        return 'Tous les ' + choisis.map((j) => JOURS[j].toLowerCase() + 's').join(', ') + heure;
      }
      case 'MENSUEL_DATE': return `Tous les ${b.jour_du_mois ?? 1} du mois${heure}`;
      case 'MENSUEL_JOUR': {
        const rangs = ['1er', '2e', '3e', '4e', 'dernier'];
        const rang = rangs[(b.occurrence_mois ?? 1) - 1];
        return `Le ${rang} ${JOURS[b.jour_semaine_mois ?? 0].toLowerCase()} du mois${heure}`;
      }
      case 'ANNUEL':
        return `Chaque ${b.jour_du_mois ?? 1} ${this.mois[(b.mois_annee ?? 1) - 1].toLowerCase()}${heure}`;
      default: return 'Déclenché à la demande';
    }
  });

  constructor() {
    this.api.referentiels().subscribe((r) => this.referentiels.set(r));
    this.api.listerApplications().subscribe((a) => this.applications.set(a));
    this.api.listerPartenaires().subscribe((p) => this.partenaires.set(p));
    this.api.syntheseFlux().subscribe((s) => this.synthese.set(s));
    this.charger();
  }

  basculer(vue: Vue): void {
    this.vue.set(vue);
    if (vue === 'impact') this.chargerOccurrences();
  }

  charger(): void {
    this.api
      .listerFlux({
        recherche: this.recherche() || undefined,
        application_id: this.applicationId() || undefined,
        partenaire_id: this.partenaireId() || undefined,
        sens: this.sens() || undefined,
        recurrence: this.recurrence() || undefined,
        heure_min: this.heureMin() || undefined,
        heure_max: this.heureMax() || undefined,
        jour_semaine: this.jourSemaine() || undefined,
        bloquant: this.bloquant() ? 'true' : undefined,
      })
      .subscribe((f) => this.flux.set(f));
    if (this.vue() === 'impact') this.chargerOccurrences();
  }

  chargerOccurrences(): void {
    this.api
      .occurrencesFlux({
        nb_jours: String(this.horizon()),
        application_id: this.applicationId() || undefined,
        partenaire_id: this.partenaireId() || undefined,
        bloquant_uniquement: this.bloquant() ? 'true' : undefined,
      })
      .subscribe((o) => this.occurrences.set(o));
  }

  reinitialiser(): void {
    this.recherche.set('');
    this.applicationId.set('');
    this.partenaireId.set('');
    this.sens.set('');
    this.recurrence.set('');
    this.heureMin.set('');
    this.heureMax.set('');
    this.jourSemaine.set('');
    this.bloquant.set(false);
    this.charger();
  }

  codeDe(id: number): string {
    return this.applications().find((a) => a.id === id)?.code ?? '';
  }

  libelleRecurrence(valeur: string): string {
    const libelles: Record<string, string> = {
      TEMPS_REEL: 'En continu (temps réel)',
      HORAIRE: 'Toutes les heures',
      QUOTIDIEN: 'Tous les jours',
      HEBDOMADAIRE: 'Certains jours de la semaine',
      MENSUEL_DATE: 'Tous les mois, à date fixe',
      MENSUEL_JOUR: 'Tous les mois, à jour relatif',
      ANNUEL: 'Une fois par an',
      A_LA_DEMANDE: 'À la demande',
    };
    return libelles[valeur] ?? this.format(valeur);
  }

  basculerJour(index: number): void {
    this.joursCoches.update((liste) =>
      liste.includes(index) ? liste.filter((x) => x !== index) : [...liste, index].sort(),
    );
  }

  ouvrirCreation(): void {
    this.brouillon = this.vierge();
    const premiere = this.applications()[0];
    if (premiere) this.brouillon.application_id = premiere.id;
    this.joursCoches.set([]);
    this.formulaireOuvert.set(true);
  }

  ouvrirEdition(f: Flux): void {
    this.brouillon = { ...f };
    this.joursCoches.set(
      (f.jours_semaine ?? '')
        .split(';')
        .filter((j) => j.trim() !== '')
        .map(Number),
    );
    this.formulaireOuvert.set(true);
  }

  enregistrer(): void {
    if (!this.brouillon.nom || !this.brouillon.application_id) {
      this.notif.erreur('L’application et le nom du flux sont obligatoires.');
      return;
    }
    const corps: Partial<Flux> = {
      ...this.brouillon,
      jours_semaine: this.joursCoches().join(';') || null,
      // La fréquence historique est conservée cohérente avec la récurrence choisie.
      frequence: this.brouillon.recurrence === 'MENSUEL_JOUR' ? 'MENSUEL' : this.brouillon.frequence,
    };
    delete corps.id;
    delete corps.partenaire;
    delete corps.libelle_recurrence;
    delete corps.code_application;
    delete corps.nom_application;

    const requete = this.brouillon.id
      ? this.api.modifierFluxGlobal(this.brouillon.id, corps)
      : this.api.creerFluxGlobal(corps);
    requete.subscribe({
      next: () => {
        this.notif.succes('Flux enregistré.');
        this.formulaireOuvert.set(false);
        this.charger();
        this.api.syntheseFlux().subscribe((s) => this.synthese.set(s));
      },
      error: (e) => this.notif.erreur(e?.error?.detail ?? 'Enregistrement impossible.'),
    });
  }

  supprimer(f: Flux): void {
    if (!confirm(`Supprimer le flux « ${f.nom} » ?`)) return;
    this.api.supprimerFluxGlobal(f.id).subscribe(() => {
      this.notif.succes('Flux supprimé.');
      this.charger();
    });
  }

  private vierge(): Partial<Flux> {
    return {
      nom: '',
      sens: 'ENTRANT',
      frequence: 'QUOTIDIEN',
      recurrence: 'QUOTIDIEN',
      bloquant: false,
      partenaire_id: null,
    };
  }

  classe = classePastille;
  format = lisible;
}
