import { CommonModule } from '@angular/common';
import { Component, Input, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { NotificationService } from '../core/ui.service';
import {
  ApplicationDetail,
  Dispositif,
  DocumentApp,
  Flux,
  JOURS,
  Partenaire,
  Plage,
  Referentiels,
  classePastille,
  lisible,
} from '../core/models';
import { IconeComponent } from '../shared/icone.component';

type Onglet = 'identite' | 'plages' | 'flux' | 'documentation' | 'securite' | 'vulnerabilites';

@Component({
  selector: 'mco-application-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconeComponent],
  template: `
    @if (app(); as a) {
      <a class="retour doux" routerLink="/applications">
        <mco-icone nom="retour" [taille]="16" /> Retour au parc
      </a>

      <header class="entre apparait" style="margin-top: 12px">
        <div>
          <div class="eyebrow">{{ a.code }}</div>
          <h1 class="titre-page">{{ a.nom }}</h1>
          <div class="rangee" style="margin-top: 10px">
            <span [class]="classe(a.criticite)">{{ format(a.criticite) }}</span>
            <span [class]="classe(a.statut)">{{ format(a.statut) }}</span>
            @if (a.equipe) { <span class="pastille p-neutre">{{ a.equipe }}</span> }
            @if (a.nb_vulnerabilites_ouvertes) {
              <span class="pastille p-critique">
                {{ a.nb_vulnerabilites_ouvertes }} faille(s) active(s)
              </span>
            }
          </div>
        </div>
        <div class="carte contact" style="padding: 16px 18px">
          <div class="eyebrow">Responsable applicatif</div>
          <div style="font-weight: 500; margin-top: 8px">{{ a.responsable_nom || 'Non désigné' }}</div>
          @if (a.responsable_email) {
            <a class="mono doux" [href]="'mailto:' + a.responsable_email">{{ a.responsable_email }}</a>
          }
          @if (a.responsable_telephone) {
            <div class="mono doux">{{ a.responsable_telephone }}</div>
          }
        </div>
      </header>

      <nav class="onglets apparait">
        @for (o of onglets; track o.cle) {
          <button
            class="onglet"
            type="button"
            [class.onglet--actif]="onglet() === o.cle"
            (click)="onglet.set(o.cle)"
          >
            {{ o.libelle }}
            @if (o.compteur !== undefined) {
              <span class="mono compteur">{{ compteur(a, o.cle) }}</span>
            }
          </button>
        }
      </nav>

      <!-- ------------------------------------------------------ Identité -->
      @if (onglet() === 'identite') {
        <div class="colonnes apparait">
          <div class="carte">
            <div class="eyebrow">Exploitation</div>
            <h2 class="titre-bloc">Suivi et contrôles</h2>
            <dl class="liste-def">
              <dt>SBOM — mise à disposition</dt>
              <dd>
                <span [class]="classe(a.sbom_mode)">{{ format(a.sbom_mode) }}</span>
                <div class="doux">{{ a.sbom_commentaire || 'Aucune précision.' }}</div>
              </dd>
              <dt>Sanity check</dt>
              <dd>
                <span [class]="classe(a.sanity_check_mode)">{{ format(a.sanity_check_mode) }}</span>
                <div class="doux">{{ a.sanity_check_commentaire || 'Aucune précision.' }}</div>
              </dd>
              <dt>URL de production</dt>
              <dd>
                @if (a.environnement_url) {
                  <a class="mono" [href]="a.environnement_url" target="_blank" rel="noopener">
                    {{ a.environnement_url }}
                  </a>
                } @else { <span class="doux">Non renseignée</span> }
              </dd>
              <dt>Dernière mise à jour</dt>
              <dd class="mono doux">{{ a.maj_le | date: 'dd/MM/yyyy HH:mm' }}</dd>
            </dl>
          </div>

          <div class="pile">
            <div class="carte">
              <div class="eyebrow">Accès production</div>
              <h2 class="titre-bloc">Habilitations et droits requis</h2>
              <p class="texte-long">{{ a.habilitations || 'Aucune habilitation documentée.' }}</p>
            </div>
            <div class="carte">
              <div class="eyebrow">Éditeur</div>
              <h2 class="titre-bloc">{{ a.editeur?.nom || 'Aucun éditeur associé' }}</h2>
              @if (a.editeur; as e) {
                <dl class="liste-def">
                  <dt>Contact</dt>
                  <dd>{{ e.contact_nom || '—' }} <span class="doux mono">{{ e.contact_email }}</span></dd>
                  <dt>Escalade niveau 1</dt>
                  <dd class="doux">{{ e.escalade_n1 || '—' }}</dd>
                  <dt>Escalade niveau 2</dt>
                  <dd class="doux">{{ e.escalade_n2 || '—' }}</dd>
                  <dt>Contrat</dt>
                  <dd class="doux mono">{{ e.reference_contrat || '—' }}</dd>
                </dl>
              }
            </div>
            <div class="carte">
              <div class="eyebrow">Consignes</div>
              <h2 class="titre-bloc">Notes d'exploitation</h2>
              <p class="texte-long">{{ a.notes || 'Aucune note.' }}</p>
            </div>
          </div>
        </div>
      }

      <!-- ------------------------------------------------------ Plages -->
      @if (onglet() === 'plages') {
        <div class="carte apparait">
          <div class="entre">
            <div>
              <div class="eyebrow">Fenêtres d'intervention</div>
              <h2 class="titre-bloc">Plages de maintenance habituelles</h2>
            </div>
          </div>

          <div class="tableau-conteneur" style="margin-top: 14px">
            <table class="tableau">
              <thead>
                <tr><th>Jour</th><th>Début</th><th>Fin</th><th>Libellé</th><th></th></tr>
              </thead>
              <tbody>
                @for (p of a.plages; track p.id) {
                  <tr>
                    <td>{{ jours[p.jour_semaine] }}</td>
                    <td class="mono">{{ p.heure_debut }}</td>
                    <td class="mono">{{ p.heure_fin }}</td>
                    <td class="doux">{{ p.libelle || '—' }}</td>
                    <td>
                      <button class="btn btn--fantome btn--petit" type="button" (click)="retirerPlage(p)">
                        <mco-icone nom="poubelle" [taille]="15" />
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5">
                    <div class="vide" style="border: none">
                      Aucune plage déclarée. Sans plage, cette application sera comptée en conflit
                      dans toutes les recherches de créneau commun.
                    </div>
                  </td></tr>
                }
              </tbody>
            </table>
          </div>

          <div class="ajout">
            <div class="champ">
              <label for="pj">Jour</label>
              <select id="pj" class="saisie" [(ngModel)]="nouvellePlage.jour_semaine">
                @for (j of jours; track j; let i = $index) { <option [ngValue]="i">{{ j }}</option> }
              </select>
            </div>
            <div class="champ">
              <label for="pd">Début</label>
              <input id="pd" class="saisie mono" type="time" [(ngModel)]="nouvellePlage.heure_debut" />
            </div>
            <div class="champ">
              <label for="pf">Fin</label>
              <input id="pf" class="saisie mono" type="time" [(ngModel)]="nouvellePlage.heure_fin" />
            </div>
            <div class="champ" style="flex: 1">
              <label for="pl">Libellé</label>
              <input id="pl" class="saisie" [(ngModel)]="nouvellePlage.libelle" placeholder="Fenêtre hebdomadaire" />
            </div>
            <button class="btn btn--primaire" type="button" (click)="ajouterPlage()">
              <mco-icone nom="plus" /> Ajouter la plage
            </button>
          </div>
        </div>
      }

      <!-- ------------------------------------------------------ Flux -->
      @if (onglet() === 'flux') {
        <div class="carte apparait">
          <div class="eyebrow">Échanges</div>
          <h2 class="titre-bloc">Flux entrants et sortants</h2>
          <div class="tableau-conteneur" style="margin-top: 14px">
            <table class="tableau">
              <thead>
                <tr>
                  <th>Flux</th><th>Sens</th><th>Fréquence</th><th>Heure</th><th>Jour</th>
                  <th>Protocole</th><th>Partenaire</th><th>Bloquant</th><th></th>
                </tr>
              </thead>
              <tbody>
                @for (f of a.flux; track f.id) {
                  <tr>
                    <td>{{ f.nom }}</td>
                    <td><span class="pastille p-info">{{ format(f.sens) }}</span></td>
                    <td class="doux">{{ format(f.frequence) }}</td>
                    <td class="mono">{{ f.heure || '—' }}</td>
                    <td class="doux">{{ f.jour || '—' }}</td>
                    <td class="mono doux">{{ f.protocole || '—' }}</td>
                    <td class="doux">{{ f.partenaire?.nom || '—' }}</td>
                    <td>
                      @if (f.bloquant) { <span class="pastille p-critique">Bloquant</span> }
                      @else { <span class="doux">Non</span> }
                    </td>
                    <td>
                      <button class="btn btn--fantome btn--petit" type="button" (click)="retirerFlux(f)">
                        <mco-icone nom="poubelle" [taille]="15" />
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="9">
                    <div class="vide" style="border: none">Aucun flux référencé.</div>
                  </td></tr>
                }
              </tbody>
            </table>
          </div>

          <div class="ajout">
            <div class="champ" style="flex: 1; min-width: 180px">
              <label for="fn">Nom du flux</label>
              <input id="fn" class="saisie" [(ngModel)]="nouveauFlux.nom" />
            </div>
            <div class="champ">
              <label for="fs">Sens</label>
              <select id="fs" class="saisie" [(ngModel)]="nouveauFlux.sens">
                @for (s of referentiels()?.sens_flux ?? []; track s) {
                  <option [value]="s">{{ format(s) }}</option>
                }
              </select>
            </div>
            <div class="champ">
              <label for="ff">Fréquence</label>
              <select id="ff" class="saisie" [(ngModel)]="nouveauFlux.frequence">
                @for (f of referentiels()?.frequences_flux ?? []; track f) {
                  <option [value]="f">{{ format(f) }}</option>
                }
              </select>
            </div>
            <div class="champ">
              <label for="fh">Heure</label>
              <input id="fh" class="saisie mono" type="time" [(ngModel)]="nouveauFlux.heure" />
            </div>
            <div class="champ">
              <label for="fj">Jour</label>
              <input id="fj" class="saisie" [(ngModel)]="nouveauFlux.jour" placeholder="Jours ouvrés" />
            </div>
            <div class="champ">
              <label for="fp">Partenaire</label>
              <select id="fp" class="saisie" [(ngModel)]="nouveauFlux.partenaire_id">
                <option [ngValue]="null">Aucun</option>
                @for (p of partenaires(); track p.id) { <option [ngValue]="p.id">{{ p.nom }}</option> }
              </select>
            </div>
            <button class="btn btn--primaire" type="button" (click)="ajouterFlux()">
              <mco-icone nom="plus" /> Ajouter
            </button>
          </div>
        </div>
      }

      <!-- ------------------------------------------------------ Documentation -->
      @if (onglet() === 'documentation') {
        <div class="carte apparait">
          <div class="entre">
            <div>
              <div class="eyebrow">Patrimoine documentaire</div>
              <h2 class="titre-bloc">État de la documentation</h2>
            </div>
            <div class="jauge-doc">
              <span class="mono">{{ tauxDoc(a) }}%</span>
              <span class="doux">à jour</span>
            </div>
          </div>

          <div class="grille-docs">
            @for (d of a.documents; track d.id) {
              <div class="doc">
                <div class="entre">
                  <span class="mono doc__type">{{ format(d.typologie) }}</span>
                  <button class="btn btn--fantome btn--petit" type="button" (click)="retirerDocument(d)">
                    <mco-icone nom="poubelle" [taille]="14" />
                  </button>
                </div>
                <select
                  class="saisie"
                  style="margin-top: 10px"
                  [ngModel]="d.etat"
                  (ngModelChange)="majDocument(d, $event)"
                >
                  @for (e of referentiels()?.etats_document ?? []; track e) {
                    <option [value]="e">{{ format(e) }}</option>
                  }
                </select>
                <div class="rangee doux" style="margin-top: 10px; font-size: 12px">
                  <span [class]="classe(d.etat)">{{ format(d.etat) }}</span>
                  @if (d.version) { <span class="mono">{{ d.version }}</span> }
                </div>
              </div>
            } @empty {
              <div class="vide">Aucune typologie documentaire suivie pour cette application.</div>
            }
          </div>

          <div class="ajout">
            <div class="champ" style="flex: 1">
              <label for="dt">Typologie à suivre</label>
              <select id="dt" class="saisie" [(ngModel)]="nouveauDocument.typologie">
                @for (t of referentiels()?.types_document ?? []; track t) {
                  <option [value]="t">{{ format(t) }}</option>
                }
              </select>
            </div>
            <div class="champ">
              <label for="de">État</label>
              <select id="de" class="saisie" [(ngModel)]="nouveauDocument.etat">
                @for (e of referentiels()?.etats_document ?? []; track e) {
                  <option [value]="e">{{ format(e) }}</option>
                }
              </select>
            </div>
            <div class="champ">
              <label for="dv">Version</label>
              <input id="dv" class="saisie mono" [(ngModel)]="nouveauDocument.version" />
            </div>
            <button class="btn btn--primaire" type="button" (click)="ajouterDocument()">
              <mco-icone nom="plus" /> Ajouter au suivi
            </button>
          </div>
        </div>
      }

      <!-- ------------------------------------------------------ Sécurité -->
      @if (onglet() === 'securite') {
        <div class="carte apparait">
          <div class="eyebrow">Dispositifs</div>
          <h2 class="titre-bloc">Outils de scan et de contrôle</h2>
          <div class="grille-docs" style="margin-top: 16px">
            @for (d of a.dispositifs; track d.id) {
              <div class="doc">
                <div class="entre">
                  <span style="font-weight: 500">{{ d.outil }}</span>
                  <button class="btn btn--fantome btn--petit" type="button" (click)="retirerDispositif(d)">
                    <mco-icone nom="poubelle" [taille]="14" />
                  </button>
                </div>
                <div class="doux" style="margin-top: 6px; font-size: 13px">{{ d.type_scan || '—' }}</div>
                <div class="rangee" style="margin-top: 10px">
                  <span [class]="d.actif ? 'pastille p-ok' : 'pastille p-neutre'">
                    {{ d.actif ? 'Actif' : 'Inactif' }}
                  </span>
                  <span class="mono doux" style="font-size: 11.5px">{{ d.frequence || '—' }}</span>
                </div>
                @if (d.dernier_scan) {
                  <div class="doux mono" style="margin-top: 8px; font-size: 11.5px">
                    Dernier scan : {{ d.dernier_scan | date: 'dd/MM/yyyy' }}
                  </div>
                }
              </div>
            } @empty {
              <div class="vide">Aucun dispositif de sécurité déclaré.</div>
            }
          </div>

          <div class="ajout">
            <div class="champ" style="flex: 1">
              <label for="so">Outil</label>
              <input id="so" class="saisie" [(ngModel)]="nouveauDispositif.outil" placeholder="SonarQube, JFrog Xray, Trivy…" />
            </div>
            <div class="champ" style="flex: 1">
              <label for="st">Type de scan</label>
              <input id="st" class="saisie" [(ngModel)]="nouveauDispositif.type_scan" placeholder="SAST, SCA, DAST…" />
            </div>
            <div class="champ">
              <label for="sf">Fréquence</label>
              <input id="sf" class="saisie" [(ngModel)]="nouveauDispositif.frequence" />
            </div>
            <button class="btn btn--primaire" type="button" (click)="ajouterDispositif()">
              <mco-icone nom="plus" /> Ajouter
            </button>
          </div>
        </div>
      }

      <!-- ------------------------------------------------------ Vulnérabilités -->
      @if (onglet() === 'vulnerabilites') {
        <div class="carte apparait">
          <div class="entre">
            <div>
              <div class="eyebrow">Sécurité applicative</div>
              <h2 class="titre-bloc">Vulnérabilités associées</h2>
            </div>
            <a class="btn" routerLink="/vulnerabilites">Ouvrir le pilotage global</a>
          </div>
          <div class="tableau-conteneur" style="margin-top: 14px">
            <table class="tableau">
              <thead>
                <tr>
                  <th>Référence</th><th>Composant</th><th>Gravité</th>
                  <th>Version cible</th><th>Statut</th><th>Âge</th><th>Échéance</th>
                </tr>
              </thead>
              <tbody>
                @for (v of a.vulnerabilites; track v.id) {
                  <tr>
                    <td class="mono">{{ v.reference }}<div class="doux" style="font-size: 12px">{{ v.titre }}</div></td>
                    <td class="doux">{{ v.composant }}</td>
                    <td><span [class]="classe(v.gravite)">{{ format(v.gravite) }}</span></td>
                    <td class="mono">{{ v.version_cible || '—' }}</td>
                    <td><span [class]="classe(v.statut)">{{ format(v.statut) }}</span></td>
                    <td class="mono">{{ v.age_jours }} j</td>
                    <td class="mono">{{ v.date_echeance ? (v.date_echeance | date: 'dd/MM/yy') : '—' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="7">
                    <div class="vide" style="border: none">Aucune vulnérabilité associée.</div>
                  </td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    } @else {
      <div class="vide">Chargement de la fiche…</div>
    }
  `,
  styles: [
    `
      .retour { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
      .retour:hover { color: var(--texte); }
      .contact { min-width: 240px; }
      .titre-bloc { font-size: 18px; margin: 6px 0 4px; }

      .onglets {
        display: flex; gap: 4px; margin: 26px 0 20px;
        border-bottom: 1px solid var(--bordure); overflow-x: auto;
      }
      .onglet {
        display: flex; align-items: center; gap: 7px;
        padding: 11px 15px; background: none; border: none; cursor: pointer;
        color: var(--texte-doux); font-size: 14px; white-space: nowrap;
        border-bottom: 2px solid transparent; margin-bottom: -1px;
        transition: color var(--transition), border-color var(--transition);
      }
      .onglet:hover { color: var(--texte); }
      .onglet--actif { color: var(--texte); border-bottom-color: var(--signal); }
      .compteur {
        font-size: 10.5px; padding: 1px 7px; border-radius: 999px;
        background: var(--surface-forte); color: var(--texte-doux);
      }

      .colonnes { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
      @media (max-width: 1000px) { .colonnes { grid-template-columns: 1fr; } }

      .liste-def { display: grid; grid-template-columns: 1fr; gap: 14px; margin: 16px 0 0; }
      .liste-def dt {
        font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.13em;
        text-transform: uppercase; color: var(--texte-doux);
      }
      .liste-def dd { margin: 5px 0 0; font-size: 14px; }
      .liste-def dd .doux { font-size: 12.5px; margin-top: 4px; }

      .texte-long { white-space: pre-line; line-height: 1.65; font-size: 14px; margin: 14px 0 0; }

      .ajout {
        display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;
        margin-top: 22px; padding-top: 20px; border-top: 1px dashed var(--bordure-forte);
      }

      .grille-docs {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 14px; margin-top: 16px;
      }
      .doc { padding: 14px; border: 1px solid var(--bordure); border-radius: var(--r-m); background: var(--surface); }
      .doc__type { font-size: 12.5px; font-weight: 500; }
      .jauge-doc { text-align: right; }
      .jauge-doc .mono { font-family: var(--display); font-size: 28px; font-weight: 600; display: block; }
      .jauge-doc .doux { font-size: 11px; }
    `,
  ],
})
export class ApplicationDetailComponent {
  private api = inject(ApiService);
  private notif = inject(NotificationService);

  @Input() set id(valeur: string) {
    this.appId = Number(valeur);
    this.charger();
  }

  private appId = 0;
  readonly app = signal<ApplicationDetail | undefined>(undefined);
  readonly partenaires = signal<Partenaire[]>([]);
  readonly referentiels = signal<Referentiels | undefined>(undefined);
  readonly onglet = signal<Onglet>('identite');
  readonly jours = JOURS;

  readonly onglets: { cle: Onglet; libelle: string; compteur?: boolean }[] = [
    { cle: 'identite', libelle: 'Identité' },
    { cle: 'plages', libelle: 'Plages de maintenance', compteur: true },
    { cle: 'flux', libelle: 'Flux', compteur: true },
    { cle: 'documentation', libelle: 'Documentation', compteur: true },
    { cle: 'securite', libelle: 'Dispositifs de sécurité', compteur: true },
    { cle: 'vulnerabilites', libelle: 'Vulnérabilités', compteur: true },
  ];

  nouvellePlage: Partial<Plage> = { jour_semaine: 2, heure_debut: '22:00', heure_fin: '00:00', libelle: '' };
  nouveauFlux: Partial<Flux> = { nom: '', sens: 'ENTRANT', frequence: 'QUOTIDIEN', partenaire_id: null };
  nouveauDocument: Partial<DocumentApp> = { typologie: 'DAT', etat: 'MANQUANT', version: '' };
  nouveauDispositif: Partial<Dispositif> = { outil: '', type_scan: '', frequence: '' };

  constructor() {
    this.api.referentiels().subscribe((r) => this.referentiels.set(r));
    this.api.listerPartenaires().subscribe((p) => this.partenaires.set(p));
  }

  charger(): void {
    this.api.application(this.appId).subscribe((a) => this.app.set(a));
  }

  compteur(a: ApplicationDetail, cle: Onglet): number {
    switch (cle) {
      case 'plages': return a.plages.length;
      case 'flux': return a.flux.length;
      case 'documentation': return a.documents.length;
      case 'securite': return a.dispositifs.length;
      case 'vulnerabilites': return a.vulnerabilites.length;
      default: return 0;
    }
  }

  tauxDoc(a: ApplicationDetail): number {
    const pertinents = a.documents.filter((d) => d.etat !== 'NON_APPLICABLE');
    if (!pertinents.length) return 0;
    return Math.round((pertinents.filter((d) => d.etat === 'A_JOUR').length / pertinents.length) * 100);
  }

  // ------------------------------------------------------------ Plages
  ajouterPlage(): void {
    this.api.ajouterPlage(this.appId, this.nouvellePlage).subscribe({
      next: () => { this.notif.succes('Plage ajoutée.'); this.charger(); },
      error: () => this.notif.erreur('Ajout impossible : vérifiez les heures saisies.'),
    });
  }
  retirerPlage(p: Plage): void {
    this.api.supprimerPlage(this.appId, p.id).subscribe(() => { this.notif.succes('Plage retirée.'); this.charger(); });
  }

  // ------------------------------------------------------------ Flux
  ajouterFlux(): void {
    if (!this.nouveauFlux.nom) { this.notif.erreur('Nommez le flux avant de l’ajouter.'); return; }
    this.api.ajouterFlux(this.appId, this.nouveauFlux).subscribe(() => {
      this.notif.succes('Flux ajouté.');
      this.nouveauFlux = { nom: '', sens: 'ENTRANT', frequence: 'QUOTIDIEN', partenaire_id: null };
      this.charger();
    });
  }
  retirerFlux(f: Flux): void {
    this.api.supprimerFlux(this.appId, f.id).subscribe(() => { this.notif.succes('Flux retiré.'); this.charger(); });
  }

  // ------------------------------------------------------------ Documentation
  ajouterDocument(): void {
    this.api.ajouterDocument(this.appId, this.nouveauDocument).subscribe(() => {
      this.notif.succes('Typologie ajoutée au suivi.');
      this.charger();
    });
  }
  majDocument(d: DocumentApp, etat: string): void {
    this.api.modifierDocument(this.appId, d.id, { ...d, etat: etat as DocumentApp['etat'] }).subscribe(() => {
      this.notif.succes('État documentaire mis à jour.');
      this.charger();
    });
  }
  retirerDocument(d: DocumentApp): void {
    this.api.supprimerDocument(this.appId, d.id).subscribe(() => { this.notif.succes('Typologie retirée.'); this.charger(); });
  }

  // ------------------------------------------------------------ Sécurité
  ajouterDispositif(): void {
    if (!this.nouveauDispositif.outil) { this.notif.erreur('Indiquez le nom de l’outil.'); return; }
    this.api.ajouterDispositif(this.appId, this.nouveauDispositif).subscribe(() => {
      this.notif.succes('Dispositif ajouté.');
      this.nouveauDispositif = { outil: '', type_scan: '', frequence: '' };
      this.charger();
    });
  }
  retirerDispositif(d: Dispositif): void {
    this.api.supprimerDispositif(this.appId, d.id).subscribe(() => { this.notif.succes('Dispositif retiré.'); this.charger(); });
  }

  classe = classePastille;
  format = lisible;
}
