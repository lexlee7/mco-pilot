import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { NotificationService } from '../core/ui.service';
import {
  Application,
  Obsolescence,
  PlanningObsolescences,
  Referentiels,
  classePastille,
  lisible,
} from '../core/models';
import { IconeComponent } from '../shared/icone.component';
import { ModaleComponent } from '../shared/modale.component';

type Regroupement = 'composant' | 'application';

/** Une obsolescence positionnée sur la frise temporelle. */
interface Barre {
  obso: Obsolescence;
  gauche: number; // % depuis le début de la frise
  largeur: number; // % de la largeur totale
  positionPrevue: number | null; // % où se situe le traitement planifié
  ton: 'retard' | 'urgent' | 'proche' | 'confort';
  infobulle: string;
  /** Ce qui distingue cette obsolescence des autres du même groupe. */
  sousLibelle: string;
}

interface LignePlanning {
  cle: string;
  libelle: string;
  sousTitre: string;
  applicationId?: number;
  nbEnRetard: number;
  barres: Barre[];
}

const JOUR_MS = 86_400_000;

@Component({
  selector: 'mco-obsolescences',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconeComponent, ModaleComponent],
  template: `
    <header class="entre apparait">
      <div>
        <div class="eyebrow">Anticipation</div>
        <h1 class="titre-page">Obsolescences du parc</h1>
        <p class="sous-titre">
          Fins de support éditeur à traiter, composant par composant. La frise compare
          l'échéance imposée et la date de traitement que vous avez planifiée : tout
          losange situé après la fin de barre signale une dérive à arbitrer.
        </p>
      </div>
      <button class="btn btn--primaire" type="button" (click)="ouvrirCreation()">
        <mco-icone nom="plus" /> Déclarer une obsolescence
      </button>
    </header>

    @if (planning(); as p) {
      <section class="grille-cartes apparait" style="margin-top: 24px">
        <div class="carte kpi">
          <div class="eyebrow">Obsolescences actives</div>
          <div class="kpi__valeur">{{ p.nb_obsolescences }}</div>
          <div class="kpi__note">sur {{ p.par_application.length }} application(s)</div>
        </div>
        <div class="carte kpi" [class.kpi--alerte]="p.nb_en_retard > 0">
          <div class="eyebrow">Support déjà terminé</div>
          <div class="kpi__valeur">{{ p.nb_en_retard }}</div>
          <div class="kpi__note">échéance éditeur dépassée</div>
        </div>
        <div class="carte kpi" [class.kpi--alerte]="nbDerives() > 0">
          <div class="eyebrow">Dérives de planning</div>
          <div class="kpi__valeur">{{ nbDerives() }}</div>
          <div class="kpi__note">traitement prévu après l'échéance</div>
        </div>
        <div class="carte kpi">
          <div class="eyebrow">Sans échéance connue</div>
          <div class="kpi__valeur">{{ p.nb_sans_echeance }}</div>
          <div class="kpi__note">à qualifier auprès de l'éditeur</div>
        </div>
      </section>

      <section class="carte apparait" style="margin-top: 18px; padding: 14px 18px">
        <div class="entre">
          <div class="rangee">
            <span class="eyebrow">Regrouper par</span>
            <div class="segments">
              <button
                type="button"
                class="segment"
                [class.segment--actif]="regroupement() === 'composant'"
                (click)="regroupement.set('composant')"
              >
                Composant
              </button>
              <button
                type="button"
                class="segment"
                [class.segment--actif]="regroupement() === 'application'"
                (click)="regroupement.set('application')"
              >
                Application
              </button>
            </div>
          </div>
          <div class="rangee">
            <div class="recherche">
              <mco-icone nom="loupe" [taille]="15" />
              <input
                class="saisie"
                type="search"
                placeholder="Filtrer un composant, une application…"
                [ngModel]="filtre()"
                (ngModelChange)="filtre.set($event)"
              />
            </div>
            <select class="saisie filtre" [ngModel]="horizon()" (ngModelChange)="horizon.set(+$event)">
              <option [ngValue]="12">12 mois</option>
              <option [ngValue]="18">18 mois</option>
              <option [ngValue]="24">24 mois</option>
              <option [ngValue]="36">36 mois</option>
            </select>
          </div>
        </div>
      </section>

      <!-- ------------------------------------------------ La frise -->
      <section class="carte apparait" style="margin-top: 18px">
        <div class="entre" style="margin-bottom: 16px">
          <div>
            <div class="eyebrow">Planning</div>
            <h2 style="font-size: 19px; margin-top: 6px">Frise des échéances</h2>
          </div>
          <div class="legende doux">
            <span><i class="puce puce--retard"></i> support terminé</span>
            <span><i class="puce puce--urgent"></i> moins de 3 mois</span>
            <span><i class="puce puce--proche"></i> moins de 12 mois</span>
            <span><i class="puce puce--confort"></i> au-delà</span>
            <span><i class="losange"></i> traitement planifié</span>
          </div>
        </div>

        <div class="frise">
          <div class="frise__entete">
            <div class="frise__intitule"></div>
            <div class="frise__piste">
              @for (m of mois(); track m.cle) {
                <div class="frise__mois" [style.left.%]="m.position" [class.frise__mois--annee]="m.debutAnnee">
                  <span class="mono">{{ m.libelle }}</span>
                </div>
              }
              <div class="frise__aujourdhui" [style.left.%]="positionAujourdhui()">
                <span class="mono">aujourd'hui</span>
              </div>
            </div>
          </div>

          @for (ligne of lignes(); track ligne.cle) {
            <!-- En-tête de regroupement : le composant, ou l'application -->
            <div class="groupe">
              <div class="groupe__intitule">
                @if (ligne.applicationId) {
                  <a class="mono libelle" [routerLink]="['/applications', ligne.applicationId]">
                    {{ ligne.libelle }}
                  </a>
                } @else {
                  <span class="mono libelle">{{ ligne.libelle }}</span>
                }
                <span class="doux sous">{{ ligne.sousTitre }}</span>
              </div>
              <div class="groupe__trait"></div>
            </div>

            <!-- Une ligne dédiée par obsolescence : plus aucun chevauchement -->
            @for (barre of ligne.barres; track barre.obso.id) {
              <div class="frise__ligne">
                <div class="frise__intitule frise__intitule--enfant">
                  <span class="sous-libelle">{{ barre.sousLibelle }}</span>
                  <span class="doux sous mono">
                    {{ barre.obso.version_obsolete }} → {{ barre.obso.version_cible || '?' }}
                  </span>
                </div>
                <div class="frise__piste">
                  @for (m of mois(); track m.cle) {
                    <span class="frise__grille" [style.left.%]="m.position"></span>
                  }
                  <span class="frise__aujourdhui-trait" [style.left.%]="positionAujourdhui()"></span>

                  <button
                    type="button"
                    [class]="'barre barre--' + barre.ton"
                    [style.left.%]="barre.gauche"
                    [style.width.%]="barre.largeur"
                    [attr.title]="barre.infobulle"
                    (click)="ouvrirEdition(barre.obso)"
                  >
                    <span class="barre__texte mono">
                      {{ barre.obso.date_limite | date: 'MM/yy' }}
                    </span>
                  </button>
                  @if (barre.positionPrevue !== null) {
                    <span
                      class="losange losange--piste"
                      [class.losange--derive]="barre.obso.derive_planning"
                      [style.left.%]="barre.positionPrevue"
                      [attr.title]="
                        'Traitement planifié le ' + (barre.obso.date_traitement_prevue | date: 'dd/MM/yyyy')
                      "
                    ></span>
                  }
                </div>
              </div>
            }
          } @empty {
            <div class="vide" style="margin-top: 14px">
              Aucune obsolescence ne correspond à ce filtre.
            </div>
          }
        </div>

        @if (p.nb_sans_echeance > 0) {
          <p class="doux" style="font-size: 12.5px; margin-top: 16px">
            {{ p.nb_sans_echeance }} obsolescence(s) sans date de fin de support ne peuvent pas
            être positionnées sur la frise. Elles figurent dans le tableau ci-dessous.
          </p>
        }
      </section>

      <!-- ------------------------------------------------ Le détail -->
      <section class="carte apparait" style="margin-top: 18px">
        <div class="entre">
          <div>
            <div class="eyebrow">Détail</div>
            <h2 style="font-size: 19px; margin-top: 6px">Toutes les obsolescences</h2>
          </div>
          <label class="bascule">
            <input type="checkbox" [ngModel]="actives()" (ngModelChange)="actives.set($event); charger()" />
            <span>Masquer les obsolescences traitées</span>
          </label>
        </div>
        <div class="tableau-conteneur" style="margin-top: 14px">
          <table class="tableau">
            <thead>
              <tr>
                <th>Application</th><th>Composant</th><th>Version</th><th>Cible</th>
                <th>Fin de support</th><th>Traitement prévu</th><th>Statut</th>
                <th>Porteur</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (o of obsolescencesFiltrees(); track o.id) {
                <tr [class.ligne--retard]="o.en_retard">
                  <td>
                    <a class="mono" [routerLink]="['/applications', o.application_id]">
                      {{ o.code_application }}
                    </a>
                    <div class="doux" style="font-size: 12px">{{ o.nom_application }}</div>
                  </td>
                  <td>{{ o.composant }}</td>
                  <td class="mono">{{ o.version_obsolete }}</td>
                  <td class="mono">{{ o.version_cible || '—' }}</td>
                  <td class="mono">
                    {{ o.date_limite ? (o.date_limite | date: 'dd/MM/yyyy') : '—' }}
                    @if (o.jours_restants !== null && o.jours_restants !== undefined) {
                      <div [class]="o.en_retard ? 'pastille p-critique' : 'doux'" style="font-size: 11px; margin-top: 4px">
                        {{ o.en_retard ? (-o.jours_restants) + ' j de retard' : 'J-' + o.jours_restants }}
                      </div>
                    }
                  </td>
                  <td class="mono">
                    {{ o.date_traitement_prevue ? (o.date_traitement_prevue | date: 'dd/MM/yyyy') : '—' }}
                    @if (o.derive_planning) {
                      <div class="pastille p-alerte" style="font-size: 10px; margin-top: 4px">Dérive</div>
                    }
                  </td>
                  <td><span [class]="classe(o.statut)">{{ format(o.statut) }}</span></td>
                  <td class="doux">{{ o.porteur || '—' }}</td>
                  <td>
                    <div class="rangee" style="gap: 4px; flex-wrap: nowrap">
                      <button class="btn btn--fantome btn--petit" type="button" (click)="ouvrirEdition(o)">
                        <mco-icone nom="crayon" [taille]="15" />
                      </button>
                      <button class="btn btn--fantome btn--petit" type="button" (click)="supprimer(o)">
                        <mco-icone nom="poubelle" [taille]="15" />
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="9"><div class="vide" style="border: none">Aucune obsolescence.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    } @else {
      <div class="vide" style="margin-top: 30px">Chargement du planning…</div>
    }

    @if (formulaireOuvert()) {
      <mco-modale
        [titre]="brouillon.id ? 'Modifier l’obsolescence' : 'Déclarer une obsolescence'"
        surtitre="Composant en fin de support"
        (fermer)="formulaireOuvert.set(false)"
      >
        <div class="grille-form">
          <div class="champ">
            <label for="oa">Application concernée</label>
            <select id="oa" class="saisie" [(ngModel)]="brouillon.application_id">
              @for (a of applications(); track a.id) {
                <option [ngValue]="a.id">{{ a.code }} — {{ a.nom }}</option>
              }
            </select>
          </div>
          <div class="champ">
            <label for="oc">Composant</label>
            <input id="oc" class="saisie" list="liste-composants" [(ngModel)]="brouillon.composant"
                   placeholder="Java Runtime, Oracle Database…" />
            <datalist id="liste-composants">
              @for (c of composants(); track c) { <option [value]="c"></option> }
            </datalist>
          </div>
          <div class="champ">
            <label for="ov">Version obsolète</label>
            <input id="ov" class="saisie mono" [(ngModel)]="brouillon.version_obsolete" />
          </div>
          <div class="champ">
            <label for="ovc">Version cible</label>
            <input id="ovc" class="saisie mono" [(ngModel)]="brouillon.version_cible" />
          </div>
          <div class="champ">
            <label for="odl">Date limite de traitement (fin de support)</label>
            <input id="odl" class="saisie" type="date" [(ngModel)]="brouillon.date_limite" />
          </div>
          <div class="champ">
            <label for="odp">Date de traitement prévue</label>
            <input id="odp" class="saisie" type="date" [(ngModel)]="brouillon.date_traitement_prevue" />
          </div>
          <div class="champ">
            <label for="os">Statut</label>
            <select id="os" class="saisie" [(ngModel)]="brouillon.statut">
              @for (s of referentiels()?.statuts_obsolescence ?? []; track s) {
                <option [value]="s">{{ format(s) }}</option>
              }
            </select>
          </div>
          <div class="champ">
            <label for="ocr">Criticité</label>
            <select id="ocr" class="saisie" [(ngModel)]="brouillon.criticite">
              @for (c of referentiels()?.criticites ?? []; track c) {
                <option [value]="c">{{ format(c) }}</option>
              }
            </select>
          </div>
          <div class="champ">
            <label for="och">Charge estimée</label>
            <input id="och" class="saisie" [(ngModel)]="brouillon.charge_estimee" placeholder="8 j/h" />
          </div>
          <div class="champ">
            <label for="op">Porteur du sujet</label>
            <input id="op" class="saisie" [(ngModel)]="brouillon.porteur" />
          </div>
          <div class="champ">
            <label for="odr">Date de traitement réelle</label>
            <input id="odr" class="saisie" type="date" [(ngModel)]="brouillon.date_traitement_reelle" />
          </div>
        </div>
        <div class="champ" style="margin-top: 16px">
          <label for="ocm">Commentaire</label>
          <textarea id="ocm" class="saisie" [(ngModel)]="brouillon.commentaire"></textarea>
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
      .kpi__valeur {
        font-family: var(--display); font-size: 36px; font-weight: 600;
        margin: 8px 0 4px; letter-spacing: -0.03em;
      }
      .kpi--alerte .kpi__valeur { color: var(--grenat); }
      .kpi__note { font-size: 12.5px; color: var(--texte-doux); }

      .segments { display: flex; gap: 3px; padding: 3px; border-radius: 9px; background: var(--surface-forte); }
      .segment {
        padding: 6px 14px; border: none; background: none; cursor: pointer;
        border-radius: 7px; font-size: 13px; color: var(--texte-doux);
        transition: background var(--transition), color var(--transition);
      }
      .segment--actif { background: var(--signal-sourd); color: var(--texte); }

      .recherche { position: relative; display: flex; align-items: center; min-width: 250px; }
      .recherche mco-icone { position: absolute; left: 11px; color: var(--texte-doux); }
      .recherche .saisie { padding-left: 34px; }
      .filtre { max-width: 130px; }
      .bascule { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
      .bascule input { accent-color: var(--signal); }

      .legende { display: flex; gap: 14px; flex-wrap: wrap; font-size: 11.5px; align-items: center; }
      .legende span { display: inline-flex; align-items: center; gap: 5px; }
      .puce { width: 16px; height: 7px; border-radius: 3px; display: inline-block; }
      .puce--retard { background: var(--grenat); }
      .puce--urgent { background: var(--ambre); }
      .puce--proche { background: var(--signal); }
      .puce--confort { background: var(--menthe); }

      .frise { overflow-x: auto; padding-bottom: 6px; }
      .frise__entete, .frise__ligne {
        display: grid; grid-template-columns: 210px 1fr; align-items: center; min-width: 760px;
      }
      .frise__entete { height: 40px; margin-bottom: 6px; }
      .frise__ligne {
        min-height: 34px; border-top: 1px solid var(--bordure);
      }
      .frise__piste { min-height: 34px; }

      .groupe {
        display: grid; grid-template-columns: 210px 1fr;
        align-items: center; gap: 0; min-width: 760px;
        margin-top: 14px; padding-bottom: 3px;
      }
      .groupe__intitule { padding-right: 14px; overflow: hidden; }
      .groupe__intitule .libelle {
        display: block; font-size: 13.5px; font-weight: 600;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .groupe__intitule .sous { font-size: 11px; }
      .groupe__trait { height: 1px; background: var(--bordure-forte); }

      .frise__intitule--enfant { padding-left: 14px; border-left: 2px solid var(--bordure); }
      .sous-libelle {
        display: block; font-size: 12px; color: var(--texte);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .frise__intitule { padding-right: 14px; overflow: hidden; }
      .frise__intitule .libelle {
        display: block; font-size: 13px; font-weight: 500;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      a.libelle:hover { color: var(--signal); }
      .frise__intitule .sous { font-size: 11px; }

      .frise__piste { position: relative; height: 100%; min-height: 46px; }
      .frise__mois {
        position: absolute; top: 10px; transform: translateX(-50%);
        font-size: 9.5px; color: var(--texte-doux); white-space: nowrap;
      }
      .frise__mois--annee { color: var(--texte); font-weight: 500; }
      .frise__grille {
        position: absolute; top: 0; bottom: 0; width: 1px; background: var(--bordure);
      }
      .frise__aujourdhui {
        position: absolute; top: 22px; transform: translateX(-50%);
        font-size: 9px; color: var(--signal); white-space: nowrap;
      }
      .frise__aujourdhui-trait {
        position: absolute; top: 0; bottom: 0; width: 1px;
        background: var(--signal); opacity: 0.55;
      }

      .barre {
        position: absolute; top: 50%; transform: translateY(-50%);
        height: 18px; min-width: 10px;
        border: none; border-radius: 5px; cursor: pointer;
        display: flex; align-items: center; padding: 0 7px; overflow: hidden;
        color: #fff; transition: filter var(--transition), transform var(--transition);
      }
      .barre:hover { filter: brightness(1.15); transform: translateY(-50%) scaleY(1.18); }
      .barre--retard { background: linear-gradient(90deg, var(--grenat), #a3222a); }
      .barre--urgent { background: linear-gradient(90deg, var(--ambre), #d1791d); }
      .barre--proche { background: linear-gradient(90deg, var(--signal), var(--violet)); }
      .barre--confort { background: linear-gradient(90deg, var(--menthe), #22876a); }
      .barre__texte { font-size: 10px; white-space: nowrap; }

      .losange {
        width: 11px; height: 11px; display: inline-block;
        background: var(--texte); transform: rotate(45deg);
        border: 1.5px solid var(--nuit);
      }
      .losange--piste {
        position: absolute; top: 50%; margin-left: -5px;
        transform: translateY(-50%) rotate(45deg); z-index: 2;
      }
      .losange--derive { background: var(--grenat); box-shadow: 0 0 0 2px rgba(229, 72, 77, 0.3); }

      .ligne--retard td { background: rgba(229, 72, 77, 0.05); }
    `,
  ],
})
export class ObsolescencesComponent {
  private api = inject(ApiService);
  private notif = inject(NotificationService);

  readonly planning = signal<PlanningObsolescences | undefined>(undefined);
  readonly obsolescences = signal<Obsolescence[]>([]);
  readonly applications = signal<Application[]>([]);
  readonly composants = signal<string[]>([]);
  readonly referentiels = signal<Referentiels | undefined>(undefined);

  readonly regroupement = signal<Regroupement>('composant');
  readonly filtre = signal('');
  readonly horizon = signal(24);
  readonly actives = signal(true);
  readonly formulaireOuvert = signal(false);

  brouillon: Partial<Obsolescence> & { id?: number } = this.vierge();

  /** Bornes de la frise : du mois courant jusqu'à l'horizon choisi. */
  private readonly debutFrise = computed(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  private readonly finFrise = computed(() => {
    const d = this.debutFrise();
    return new Date(d.getFullYear(), d.getMonth() + this.horizon(), 1);
  });

  readonly mois = computed(() => {
    const debut = this.debutFrise();
    const total = this.finFrise().getTime() - debut.getTime();
    const pas = this.horizon() > 18 ? 3 : this.horizon() > 12 ? 2 : 1;
    const resultat: { cle: string; libelle: string; position: number; debutAnnee: boolean }[] = [];
    for (let i = 0; i <= this.horizon(); i += pas) {
      const date = new Date(debut.getFullYear(), debut.getMonth() + i, 1);
      resultat.push({
        cle: date.toISOString(),
        libelle:
          date.getMonth() === 0
            ? String(date.getFullYear())
            : date.toLocaleDateString('fr-FR', { month: 'short' }),
        position: ((date.getTime() - debut.getTime()) / total) * 100,
        debutAnnee: date.getMonth() === 0,
      });
    }
    return resultat;
  });

  readonly positionAujourdhui = computed(() => this.position(new Date()));

  readonly nbDerives = computed(
    () => this.obsolescences().filter((o) => o.derive_planning).length,
  );

  readonly obsolescencesFiltrees = computed(() => {
    const terme = this.filtre().toLowerCase().trim();
    if (!terme) return this.obsolescences();
    return this.obsolescences().filter((o) =>
      [o.composant, o.code_application, o.nom_application, o.porteur, o.version_obsolete]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(terme)),
    );
  });

  readonly lignes = computed<LignePlanning[]>(() => {
    const p = this.planning();
    if (!p) return [];
    const terme = this.filtre().toLowerCase().trim();

    const construire = (
      cle: string,
      libelle: string,
      sousTitre: string,
      items: Obsolescence[],
      nbEnRetard: number,
      applicationId?: number,
    ): LignePlanning => ({
      cle,
      libelle,
      sousTitre,
      applicationId,
      nbEnRetard,
      // Regroupé par composant, on distingue par application ; regroupé par
      // application, on distingue par composant. Chacune occupe sa propre ligne.
      barres: items
        .map((o) =>
          this.construireBarre(
            o,
            this.regroupement() === 'composant' ? (o.code_application ?? '') : o.composant,
          ),
        )
        .filter((b): b is Barre => b !== null),
    });

    let lignes: LignePlanning[];
    if (this.regroupement() === 'composant') {
      lignes = p.par_composant.map((c) =>
        construire(
          'c-' + c.composant,
          c.composant,
          `${c.nb_applications} application(s)` +
            (c.nb_en_retard ? ` · ${c.nb_en_retard} en retard` : ''),
          c.obsolescences,
          c.nb_en_retard,
        ),
      );
    } else {
      lignes = p.par_application.map((a) =>
        construire(
          'a-' + a.application_id,
          a.code,
          a.nom,
          a.obsolescences,
          a.nb_en_retard,
          a.application_id,
        ),
      );
    }

    if (terme) {
      lignes = lignes
        .map((l) => ({
          ...l,
          barres: l.barres.filter(
            (b) =>
              l.libelle.toLowerCase().includes(terme) ||
              l.sousTitre.toLowerCase().includes(terme) ||
              b.obso.composant.toLowerCase().includes(terme) ||
              (b.obso.code_application ?? '').toLowerCase().includes(terme),
          ),
        }))
        .filter((l) => l.barres.length > 0);
    }
    return lignes.filter((l) => l.barres.length > 0);
  });

  constructor() {
    this.api.referentiels().subscribe((r) => this.referentiels.set(r));
    this.api.listerApplications().subscribe((a) => this.applications.set(a));
    this.charger();
  }

  charger(): void {
    this.api.planningObsolescences().subscribe((p) => this.planning.set(p));
    this.api
      .listerObsolescences(this.actives() ? { actives_uniquement: 'true' } : {})
      .subscribe((o) => this.obsolescences.set(o));
    this.api.composantsObsoletes().subscribe((c) => this.composants.set(c));
  }

  /** Convertit une date en pourcentage de la largeur de la frise. */
  private position(date: Date): number {
    const debut = this.debutFrise().getTime();
    const total = this.finFrise().getTime() - debut;
    return Math.max(0, Math.min(100, ((date.getTime() - debut) / total) * 100));
  }

  /**
   * Une barre court d'aujourd'hui jusqu'à la fin de support : c'est le temps
   * qu'il reste pour agir. Si le support est déjà terminé, elle court à l'inverse
   * de l'échéance jusqu'à aujourd'hui, en rouge : c'est le retard accumulé.
   */
  private construireBarre(o: Obsolescence, sousLibelle: string): Barre | null {
    if (!o.date_limite) return null;
    const limite = new Date(o.date_limite);
    const maintenant = new Date();
    const debut = limite < maintenant ? limite : maintenant;
    const fin = limite < maintenant ? maintenant : limite;

    const gauche = this.position(debut);
    const largeur = Math.max(1.2, this.position(fin) - gauche);

    const restants = Math.round((limite.getTime() - maintenant.getTime()) / JOUR_MS);
    let ton: Barre['ton'] = 'confort';
    if (restants < 0) ton = 'retard';
    else if (restants <= 90) ton = 'urgent';
    else if (restants <= 365) ton = 'proche';

    const prevue = o.date_traitement_prevue ? new Date(o.date_traitement_prevue) : null;

    const infobulle =
      `${o.code_application} · ${o.composant} ${o.version_obsolete} → ${o.version_cible || '?'}\n` +
      `Fin de support : ${limite.toLocaleDateString('fr-FR')}` +
      (restants < 0 ? ` (${-restants} jours de retard)` : ` (dans ${restants} jours)`) +
      (prevue ? `\nTraitement prévu : ${prevue.toLocaleDateString('fr-FR')}` : '') +
      (o.derive_planning ? '\nDérive : le traitement est planifié après la fin de support.' : '');

    return {
      obso: o,
      gauche,
      largeur,
      positionPrevue: prevue ? this.position(prevue) : null,
      ton,
      infobulle,
      sousLibelle,
    };
  }

  ouvrirCreation(): void {
    this.brouillon = this.vierge();
    const premiere = this.applications()[0];
    if (premiere) this.brouillon.application_id = premiere.id;
    this.formulaireOuvert.set(true);
  }

  ouvrirEdition(o: Obsolescence): void {
    this.brouillon = { ...o };
    this.formulaireOuvert.set(true);
  }

  enregistrer(): void {
    if (!this.brouillon.composant || !this.brouillon.version_obsolete) {
      this.notif.erreur('Le composant et la version obsolète sont obligatoires.');
      return;
    }
    if (!this.brouillon.application_id) {
      this.notif.erreur('Sélectionnez l’application concernée.');
      return;
    }
    const corps: Partial<Obsolescence> = {
      application_id: this.brouillon.application_id,
      composant: this.brouillon.composant,
      version_obsolete: this.brouillon.version_obsolete,
      version_cible: this.brouillon.version_cible || null,
      date_limite: this.brouillon.date_limite || null,
      date_traitement_prevue: this.brouillon.date_traitement_prevue || null,
      date_traitement_reelle: this.brouillon.date_traitement_reelle || null,
      statut: this.brouillon.statut,
      criticite: this.brouillon.criticite,
      charge_estimee: this.brouillon.charge_estimee || null,
      porteur: this.brouillon.porteur || null,
      commentaire: this.brouillon.commentaire || null,
    };
    const requete = this.brouillon.id
      ? this.api.modifierObsolescence(this.brouillon.id, corps)
      : this.api.creerObsolescence(corps);
    requete.subscribe({
      next: () => {
        this.notif.succes('Obsolescence enregistrée.');
        this.formulaireOuvert.set(false);
        this.charger();
      },
      error: (e) => this.notif.erreur(e?.error?.detail ?? 'Enregistrement impossible.'),
    });
  }

  supprimer(o: Obsolescence): void {
    if (!confirm(`Supprimer l’obsolescence ${o.composant} ${o.version_obsolete} ?`)) return;
    this.api.supprimerObsolescence(o.id).subscribe(() => {
      this.notif.succes('Obsolescence supprimée.');
      this.charger();
    });
  }

  private vierge(): Partial<Obsolescence> {
    return {
      composant: '',
      version_obsolete: '',
      statut: 'A_QUALIFIER',
      criticite: 'STANDARD',
    };
  }

  classe = classePastille;
  format = lisible;
}
