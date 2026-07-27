import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { DashboardStats, JOURS, RepartitionItem, classePastille, lisible } from '../core/models';
import { IconeComponent } from '../shared/icone.component';

@Component({
  selector: 'mco-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, IconeComponent],
  template: `
    <header class="entre apparait">
      <div>
        <div class="eyebrow">Poste de conduite</div>
        <h1 class="titre-page">État du parc applicatif</h1>
        <p class="sous-titre">
          Vue consolidée du maintien en condition opérationnelle :
          santé des applications, dette de sécurité et capacité d'intervention.
        </p>
      </div>
      <div class="horodatage mono">{{ maintenant | date: 'EEEE d MMMM y — HH:mm' : '' : 'fr' }}</div>
    </header>

    @if (stats(); as s) {
      <section class="grille-cartes apparait" style="margin-top: 26px">
        <div class="kpi carte carte--survol">
          <div class="eyebrow">Applications suivies</div>
          <div class="kpi__valeur">{{ s.nb_applications }}</div>
          <div class="kpi__note">dont {{ s.nb_applications_vitales }} vitales</div>
        </div>
        <div class="kpi carte carte--survol" [class.kpi--alerte]="s.nb_vulnerabilites_critiques > 0">
          <div class="eyebrow">Vulnérabilités actives</div>
          <div class="kpi__valeur">{{ s.nb_vulnerabilites_ouvertes }}</div>
          <div class="kpi__note">{{ s.nb_vulnerabilites_critiques }} critiques à traiter</div>
        </div>
        <div class="kpi carte carte--survol" [class.kpi--alerte]="s.nb_vulnerabilites_hors_delai > 0">
          <div class="eyebrow">Hors délai</div>
          <div class="kpi__valeur">{{ s.nb_vulnerabilites_hors_delai }}</div>
          <div class="kpi__note">échéance de correction dépassée</div>
        </div>
        <div class="kpi carte carte--survol">
          <div class="eyebrow">Âge moyen des failles</div>
          <div class="kpi__valeur">{{ s.age_moyen_vulnerabilites }}<span class="unite">j</span></div>
          <div class="kpi__note">depuis la détection</div>
        </div>
        <div class="kpi carte carte--survol">
          <div class="eyebrow">Documentation à jour</div>
          <div class="kpi__valeur">{{ s.taux_documentation }}<span class="unite">%</span></div>
          <div class="kpi__note">DAT, DEX, PRA, manuels…</div>
        </div>
        <div class="kpi carte carte--survol">
          <div class="eyebrow">SBOM automatisé</div>
          <div class="kpi__valeur">{{ s.taux_sbom_automatise }}<span class="unite">%</span></div>
          <div class="kpi__note">{{ s.nb_evenements_semaine }} événement(s) cette semaine</div>
        </div>
      </section>

      <!-- Signature de l'interface : le ruban hebdomadaire de capacité d'intervention -->
      <section class="carte apparait" style="margin-top: 26px">
        <div class="entre">
          <div>
            <div class="eyebrow">Ruban hebdomadaire</div>
            <h2 style="font-size: 20px; margin-top: 6px">Capacité d'intervention par heure</h2>
            <p class="sous-titre" style="margin-top: 6px">
              Chaque case représente une heure de la semaine. Plus elle est dense, plus
              d'applications sont simultanément arrêtables sur ce créneau.
            </p>
          </div>
          <a class="btn" routerLink="/plages">
            <mco-icone nom="horloge" />
            Chercher un créneau
          </a>
        </div>

        <div class="ruban" style="margin-top: 20px">
          <div class="ruban__heures mono">
            <span></span>
            @for (h of heures; track h) {
              <span class="ruban__heure">{{ h % 3 === 0 ? h : '' }}</span>
            }
          </div>
          @for (ligne of grille(); track $index) {
            <div class="ruban__ligne">
              <span class="ruban__jour mono">{{ jours[$index].slice(0, 3) }}</span>
              @for (valeur of ligne; track $index) {
                <span
                  class="ruban__case"
                  [style.background]="teinte(valeur)"
                  [attr.title]="
                    jours[$index] + ' — ' + valeur + ' application(s) arrêtable(s)'
                  "
                ></span>
              }
            </div>
          }
          <div class="ruban__legende doux mono">
            <span>0</span>
            <span class="ruban__degrade"></span>
            <span>{{ nbApplications() }} applications</span>
          </div>
        </div>
      </section>

      <section class="colonnes apparait" style="margin-top: 26px">
        <div class="carte">
          <div class="eyebrow">Répartition</div>
          <h2 style="font-size: 18px; margin: 6px 0 18px">Statut opérationnel</h2>
          @for (item of s.repartition_statuts; track item.cle) {
            <div class="barre">
              <div class="barre__tete">
                <span [class]="classe(item.cle)">{{ format(item.cle) }}</span>
                <span class="mono doux">{{ item.valeur }}</span>
              </div>
              <div class="barre__rail">
                <div
                  class="barre__jauge"
                  [style.width.%]="pourcent(item, s.repartition_statuts)"
                ></div>
              </div>
            </div>
          }

          <h2 style="font-size: 18px; margin: 26px 0 18px">Criticité métier</h2>
          @for (item of s.repartition_criticites; track item.cle) {
            <div class="barre">
              <div class="barre__tete">
                <span [class]="classe(item.cle)">{{ format(item.cle) }}</span>
                <span class="mono doux">{{ item.valeur }}</span>
              </div>
              <div class="barre__rail">
                <div
                  class="barre__jauge"
                  [style.width.%]="pourcent(item, s.repartition_criticites)"
                ></div>
              </div>
            </div>
          }
        </div>

        <div class="carte">
          <div class="eyebrow">Sécurité</div>
          <h2 style="font-size: 18px; margin: 6px 0 18px">Gravité des failles actives</h2>
          @if (s.repartition_gravites.length) {
            @for (item of s.repartition_gravites; track item.cle) {
              <div class="barre">
                <div class="barre__tete">
                  <span [class]="classe(item.cle)">{{ format(item.cle) }}</span>
                  <span class="mono doux">{{ item.valeur }}</span>
                </div>
                <div class="barre__rail">
                  <div
                    class="barre__jauge barre__jauge--securite"
                    [style.width.%]="pourcent(item, s.repartition_gravites)"
                  ></div>
                </div>
              </div>
            }
          } @else {
            <p class="doux">Aucune vulnérabilité active. Parc sain.</p>
          }

          <h2 style="font-size: 18px; margin: 26px 0 14px">Applications les plus exposées</h2>
          <div class="pile" style="gap: 8px">
            @for (app of s.applications_a_risque; track app.id) {
              <a class="ligne-app" [routerLink]="['/applications', app.id]">
                <span class="mono">{{ app.code }}</span>
                <span class="doux">{{ app.nom }}</span>
                <mco-icone nom="retour" [taille]="15" class="fleche" />
              </a>
            }
          </div>
        </div>
      </section>
    } @else {
      <div class="vide" style="margin-top: 30px">Chargement des indicateurs…</div>
    }
  `,
  styles: [
    `
      .horodatage {
        font-size: 12px;
        color: var(--texte-doux);
        text-transform: capitalize;
        border: 1px solid var(--bordure);
        border-radius: 999px;
        padding: 7px 14px;
      }

      .kpi { padding: 20px; }
      .kpi__valeur {
        font-family: var(--display);
        font-size: 40px;
        font-weight: 600;
        line-height: 1.05;
        margin: 10px 0 4px;
        letter-spacing: -0.03em;
      }
      .unite { font-size: 18px; color: var(--texte-doux); margin-left: 3px; }
      .kpi__note { font-size: 12.5px; color: var(--texte-doux); }
      .kpi--alerte .kpi__valeur { color: var(--grenat); }

      .ruban { display: flex; flex-direction: column; gap: 4px; overflow-x: auto; }
      .ruban__heures, .ruban__ligne { display: grid; grid-template-columns: 44px repeat(24, 1fr); gap: 3px; }
      .ruban__heure { font-size: 9px; color: var(--texte-doux); text-align: center; }
      .ruban__jour {
        font-size: 10.5px; color: var(--texte-doux);
        text-transform: uppercase; letter-spacing: 0.08em; align-self: center;
      }
      .ruban__case {
        height: 26px;
        border-radius: 4px;
        border: 1px solid var(--bordure);
        transition: transform var(--transition), outline-color var(--transition);
        outline: 1px solid transparent;
      }
      .ruban__case:hover { transform: scale(1.22); outline-color: var(--signal); }
      .ruban__legende {
        display: flex; align-items: center; gap: 10px;
        font-size: 10.5px; margin-top: 10px;
      }
      .ruban__degrade {
        width: 130px; height: 8px; border-radius: 999px;
        background: linear-gradient(90deg, rgba(91, 134, 255, 0.06), var(--signal));
      }

      .colonnes { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      @media (max-width: 1000px) { .colonnes { grid-template-columns: 1fr; } }

      .barre { margin-bottom: 14px; }
      .barre__tete { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
      .barre__rail { height: 7px; border-radius: 999px; background: var(--surface-forte); overflow: hidden; }
      .barre__jauge {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, var(--signal), var(--violet));
        animation: pousse 620ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .barre__jauge--securite { background: linear-gradient(90deg, var(--ambre), var(--grenat)); }
      @keyframes pousse { from { width: 0 !important; } }

      .ligne-app {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 12px; border-radius: 10px;
        border: 1px solid var(--bordure);
        transition: border-color var(--transition), transform var(--transition);
      }
      .ligne-app:hover { border-color: var(--signal); transform: translateX(4px); }
      .ligne-app .fleche { margin-left: auto; transform: rotate(180deg); color: var(--texte-doux); }
    `,
  ],
})
export class DashboardComponent {
  private api = inject(ApiService);

  readonly stats = signal<DashboardStats | undefined>(undefined);
  readonly grille = signal<number[][]>([]);
  readonly nbApplications = signal(0);
  readonly maintenant = new Date();
  readonly jours = JOURS;
  readonly heures = Array.from({ length: 24 }, (_, i) => i);

  readonly maximum = computed(() => Math.max(1, this.nbApplications()));

  constructor() {
    this.api.dashboard().subscribe((s) => this.stats.set(s));
    this.api.couverture().subscribe((c) => {
      this.grille.set(c.grille);
      this.nbApplications.set(c.nb_applications);
    });
  }

  teinte(valeur: number): string {
    if (!valeur) return 'transparent';
    const ratio = Math.min(1, valeur / this.maximum());
    return `rgba(91, 134, 255, ${0.12 + ratio * 0.72})`;
  }

  pourcent(item: RepartitionItem, ensemble: RepartitionItem[]): number {
    const total = ensemble.reduce((somme, i) => somme + i.valeur, 0) || 1;
    return Math.round((item.valeur / total) * 100);
  }

  classe = classePastille;
  format = lisible;
}
