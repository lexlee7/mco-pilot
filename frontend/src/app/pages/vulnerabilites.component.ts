import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { NotificationService } from '../core/ui.service';
import { Application, Referentiels, Vulnerabilite, classePastille, lisible } from '../core/models';
import { IconeComponent } from '../shared/icone.component';
import { ModaleComponent } from '../shared/modale.component';

@Component({
  selector: 'mco-vulnerabilites',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconeComponent, ModaleComponent],
  template: `
    <header class="entre apparait">
      <div>
        <div class="eyebrow">Sécurité applicative</div>
        <h1 class="titre-page">Pilotage des vulnérabilités</h1>
        <p class="sous-titre">
          Chaque faille est suivie par composant et par version cible, avec un avancement propre à
          chaque application impactée.
        </p>
      </div>
      <div class="rangee">
        <button class="btn" type="button" (click)="relancer()">
          <mco-icone nom="envoi" /> Relancer les responsables
        </button>
        <button class="btn" type="button" (click)="recapituler()">
          <mco-icone nom="envoi" /> Envoyer le récapitulatif
        </button>
        <button class="btn btn--primaire" type="button" (click)="ouvrirCreation()">
          <mco-icone nom="plus" /> Déclarer une faille
        </button>
      </div>
    </header>

    <section class="grille-cartes apparait" style="margin-top: 24px">
      <div class="carte kpi"><div class="eyebrow">Failles suivies</div><div class="kpi__valeur">{{ vulnerabilites().length }}</div></div>
      <div class="carte kpi"><div class="eyebrow">Critiques</div><div class="kpi__valeur alerte">{{ nbCritiques() }}</div></div>
      <div class="carte kpi"><div class="eyebrow">Hors délai</div><div class="kpi__valeur alerte">{{ nbHorsDelai() }}</div></div>
      <div class="carte kpi"><div class="eyebrow">Âge moyen</div><div class="kpi__valeur">{{ ageMoyen() }}<span class="unite">j</span></div></div>
    </section>

    <section class="carte apparait" style="margin-top: 18px; padding: 16px 18px">
      <div class="rangee">
        <div class="recherche">
          <mco-icone nom="loupe" [taille]="16" />
          <input
            class="saisie"
            type="search"
            placeholder="Référence CVE, composant, intitulé…"
            [ngModel]="recherche()"
            (ngModelChange)="recherche.set($event); charger()"
          />
        </div>
        <select class="saisie filtre" [ngModel]="gravite()" (ngModelChange)="gravite.set($event); charger()">
          <option value="">Toutes gravités</option>
          @for (g of referentiels()?.gravites ?? []; track g) { <option [value]="g">{{ format(g) }}</option> }
        </select>
        <select class="saisie filtre" [ngModel]="statut()" (ngModelChange)="statut.set($event); charger()">
          <option value="">Tous statuts</option>
          @for (s of referentiels()?.statuts_vulnerabilite ?? []; track s) { <option [value]="s">{{ format(s) }}</option> }
        </select>
        <label class="bascule">
          <input type="checkbox" [ngModel]="horsDelai()" (ngModelChange)="horsDelai.set($event); charger()" />
          <span>Hors délai uniquement</span>
        </label>
      </div>
    </section>

    <div class="pile apparait" style="margin-top: 18px">
      @for (v of vulnerabilites(); track v.id) {
        <article class="carte carte--survol vuln" [attr.data-gravite]="v.gravite">
          <div class="entre">
            <div>
              <div class="rangee">
                <span class="mono reference">{{ v.reference }}</span>
                <span [class]="classe(v.gravite)">{{ format(v.gravite) }}</span>
                <span [class]="classe(v.statut)">{{ format(v.statut) }}</span>
                @if (estHorsDelai(v)) { <span class="pastille p-critique">Échéance dépassée</span> }
              </div>
              <h2 class="vuln__titre">{{ v.titre }}</h2>
              <div class="doux" style="font-size: 13px; margin-top: 6px">
                Composant <strong>{{ v.composant }}</strong>
                · versions touchées {{ v.versions_touchees || 'non précisées' }}
                · cible corrective <span class="mono">{{ v.version_cible || 'à définir' }}</span>
              </div>
            </div>
            <div style="text-align: right">
              <div class="mono doux" style="font-size: 12px">détectée il y a {{ v.age_jours }} j</div>
              @if (v.date_echeance) {
                <div class="mono doux" style="font-size: 12px">
                  échéance {{ v.date_echeance | date: 'dd/MM/yyyy' }}
                </div>
              }
              @if (v.score_cvss) { <div class="cvss mono">CVSS {{ v.score_cvss }}</div> }
              <div class="rangee" style="justify-content: flex-end; margin-top: 8px">
                <button class="btn btn--fantome btn--petit" type="button" (click)="ouvrirEdition(v)">
                  <mco-icone nom="crayon" [taille]="15" />
                </button>
                <button class="btn btn--fantome btn--petit" type="button" (click)="supprimer(v)">
                  <mco-icone nom="poubelle" [taille]="15" />
                </button>
              </div>
            </div>
          </div>

          <div class="impacts">
            <div class="eyebrow">Applications impactées — avancement du correctif</div>
            <div class="grille-impacts">
              @for (impact of v.applications; track impact.application_id) {
                <div class="impact">
                  <a class="mono" [routerLink]="['/applications', impact.application_id]">{{ impact.code }}</a>
                  <div class="doux" style="font-size: 12px">
                    version installée {{ impact.version_installee || '—' }}
                  </div>
                  <select
                    class="saisie"
                    style="margin-top: 8px"
                    [ngModel]="impact.statut"
                    (ngModelChange)="majAvancement(v, impact.application_id, $event)"
                  >
                    @for (s of referentiels()?.statuts_vulnerabilite ?? []; track s) {
                      <option [value]="s">{{ format(s) }}</option>
                    }
                  </select>
                </div>
              } @empty {
                <div class="doux">Aucune application associée.</div>
              }
            </div>
          </div>
        </article>
      } @empty {
        <div class="vide">Aucune vulnérabilité ne correspond à ces critères.</div>
      }
    </div>

    @if (formulaireOuvert()) {
      <mco-modale
        [titre]="brouillon.id ? 'Modifier ' + brouillon.reference : 'Déclarer une vulnérabilité'"
        surtitre="Sécurité applicative"
        (fermer)="formulaireOuvert.set(false)"
      >
        <div class="grille-form">
          <div class="champ">
            <label for="ref">Référence</label>
            <input id="ref" class="saisie mono" [(ngModel)]="brouillon.reference" placeholder="CVE-2025-0000" />
          </div>
          <div class="champ">
            <label for="tit">Intitulé</label>
            <input id="tit" class="saisie" [(ngModel)]="brouillon.titre" />
          </div>
          <div class="champ">
            <label for="comp">Composant impacté</label>
            <input id="comp" class="saisie" [(ngModel)]="brouillon.composant" />
          </div>
          <div class="champ">
            <label for="vt">Versions touchées</label>
            <input id="vt" class="saisie mono" [(ngModel)]="brouillon.versions_touchees" placeholder="2.13.0 – 2.16.1" />
          </div>
          <div class="champ">
            <label for="vc">Version cible corrective</label>
            <input id="vc" class="saisie mono" [(ngModel)]="brouillon.version_cible" />
          </div>
          <div class="champ">
            <label for="grav">Gravité</label>
            <select id="grav" class="saisie" [(ngModel)]="brouillon.gravite">
              @for (g of referentiels()?.gravites ?? []; track g) { <option [value]="g">{{ format(g) }}</option> }
            </select>
          </div>
          <div class="champ">
            <label for="cvss">Score CVSS</label>
            <input id="cvss" class="saisie mono" type="number" step="0.1" [(ngModel)]="brouillon.score_cvss" />
          </div>
          <div class="champ">
            <label for="ech">Échéance de correction</label>
            <input id="ech" class="saisie" type="date" [(ngModel)]="brouillon.date_echeance" />
          </div>
          <div class="champ">
            <label for="src">Source de détection</label>
            <input id="src" class="saisie" [(ngModel)]="brouillon.source" placeholder="SonarQube, Xray, CERT-FR…" />
          </div>
        </div>

        <div class="champ" style="margin-top: 16px">
          <label>Applications impactées</label>
          <div class="liste-apps">
            @for (app of applications(); track app.id) {
              <label class="ligne-choix" [class.ligne-choix--active]="appsChoisies().includes(app.id)">
                <input
                  type="checkbox"
                  [checked]="appsChoisies().includes(app.id)"
                  (change)="basculerApp(app.id)"
                />
                <span class="mono">{{ app.code }}</span>
                <span class="doux">{{ app.nom }}</span>
              </label>
            }
          </div>
        </div>

        <div class="champ" style="margin-top: 16px">
          <label for="plan">Plan d'action</label>
          <textarea id="plan" class="saisie" [(ngModel)]="brouillon.plan_action"></textarea>
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
        font-family: var(--display); font-size: 36px; font-weight: 600; margin-top: 8px;
        letter-spacing: -0.03em;
      }
      .kpi__valeur.alerte { color: var(--grenat); }
      .unite { font-size: 16px; color: var(--texte-doux); margin-left: 3px; }

      .recherche { position: relative; flex: 1; min-width: 240px; display: flex; align-items: center; }
      .recherche mco-icone { position: absolute; left: 12px; color: var(--texte-doux); }
      .recherche .saisie { padding-left: 36px; }
      .filtre { max-width: 190px; }
      .bascule { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
      .bascule input { accent-color: var(--signal); }

      .vuln { border-left: 3px solid var(--texte-doux); }
      .vuln[data-gravite='CRITIQUE'] { border-left-color: var(--grenat); }
      .vuln[data-gravite='ELEVEE'] { border-left-color: #e07a1f; }
      .vuln[data-gravite='MOYENNE'] { border-left-color: var(--ambre); }
      .vuln[data-gravite='FAIBLE'] { border-left-color: var(--menthe); }
      .reference { font-size: 14px; font-weight: 500; }
      .vuln__titre { font-size: 17px; margin-top: 10px; }
      .cvss {
        display: inline-block; margin-top: 6px; font-size: 11px;
        padding: 2px 8px; border-radius: 999px; border: 1px solid var(--bordure-forte);
      }

      .impacts { margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--bordure-forte); }
      .grille-impacts {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 12px; margin-top: 12px;
      }
      .impact { padding: 12px; border: 1px solid var(--bordure); border-radius: var(--r-m); }

      .liste-apps { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
      .ligne-choix {
        display: flex; align-items: center; gap: 9px; padding: 7px 9px;
        border-radius: 8px; cursor: pointer; font-size: 13px;
      }
      .ligne-choix:hover { background: var(--surface-forte); }
      .ligne-choix--active { background: var(--signal-sourd); }
      .ligne-choix input { accent-color: var(--signal); }
    `,
  ],
})
export class VulnerabilitesComponent {
  private api = inject(ApiService);
  private notif = inject(NotificationService);

  readonly vulnerabilites = signal<Vulnerabilite[]>([]);
  readonly applications = signal<Application[]>([]);
  readonly referentiels = signal<Referentiels | undefined>(undefined);
  readonly recherche = signal('');
  readonly gravite = signal('');
  readonly statut = signal('');
  readonly horsDelai = signal(false);
  readonly formulaireOuvert = signal(false);
  readonly appsChoisies = signal<number[]>([]);

  brouillon: Partial<Vulnerabilite> & { id?: number } = this.vierge();

  readonly nbCritiques = computed(
    () => this.vulnerabilites().filter((v) => v.gravite === 'CRITIQUE').length,
  );
  readonly nbHorsDelai = computed(
    () => this.vulnerabilites().filter((v) => this.estHorsDelai(v)).length,
  );
  readonly ageMoyen = computed(() => {
    const liste = this.vulnerabilites();
    if (!liste.length) return 0;
    return Math.round(liste.reduce((s, v) => s + v.age_jours, 0) / liste.length);
  });

  constructor() {
    this.api.referentiels().subscribe((r) => this.referentiels.set(r));
    this.api.listerApplications().subscribe((a) => this.applications.set(a));
    this.charger();
  }

  charger(): void {
    this.api
      .listerVulnerabilites({
        recherche: this.recherche() || undefined,
        gravite: this.gravite() || undefined,
        statut: this.statut() || undefined,
        hors_delai: this.horsDelai() ? 'true' : undefined,
      })
      .subscribe((v) => this.vulnerabilites.set(v));
  }

  estHorsDelai(v: Vulnerabilite): boolean {
    if (!v.date_echeance) return false;
    if (v.statut !== 'OUVERTE' && v.statut !== 'EN_COURS') return false;
    return new Date(v.date_echeance) < new Date();
  }

  ouvrirCreation(): void {
    this.brouillon = this.vierge();
    this.appsChoisies.set([]);
    this.formulaireOuvert.set(true);
  }

  ouvrirEdition(v: Vulnerabilite): void {
    this.brouillon = { ...v };
    this.appsChoisies.set(v.applications.map((a) => a.application_id));
    this.formulaireOuvert.set(true);
  }

  basculerApp(id: number): void {
    this.appsChoisies.update((liste) =>
      liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id],
    );
  }

  enregistrer(): void {
    if (!this.brouillon.reference || !this.brouillon.titre || !this.brouillon.composant) {
      this.notif.erreur('Référence, intitulé et composant sont obligatoires.');
      return;
    }
    const corps: Record<string, unknown> = {
      reference: this.brouillon.reference,
      titre: this.brouillon.titre,
      composant: this.brouillon.composant,
      versions_touchees: this.brouillon.versions_touchees,
      version_cible: this.brouillon.version_cible,
      gravite: this.brouillon.gravite,
      score_cvss: this.brouillon.score_cvss,
      date_echeance: this.brouillon.date_echeance || null,
      source: this.brouillon.source,
      plan_action: this.brouillon.plan_action,
      applications: this.appsChoisies().map((id) => ({ application_id: id, statut: 'OUVERTE' })),
    };
    const requete = this.brouillon.id
      ? this.api.modifierVulnerabilite(this.brouillon.id, corps)
      : this.api.creerVulnerabilite(corps);
    requete.subscribe({
      next: () => {
        this.notif.succes('Vulnérabilité enregistrée.');
        this.formulaireOuvert.set(false);
        this.charger();
      },
      error: (e) => this.notif.erreur(e?.error?.detail ?? 'Enregistrement impossible.'),
    });
  }

  majAvancement(v: Vulnerabilite, appId: number, statut: string): void {
    this.api.majAvancement(v.id, appId, statut).subscribe({
      next: () => {
        this.notif.succes('Avancement mis à jour.');
        this.charger();
      },
      error: () => this.notif.erreur('Mise à jour impossible.'),
    });
  }

  supprimer(v: Vulnerabilite): void {
    if (!confirm(`Supprimer ${v.reference} ?`)) return;
    this.api.supprimerVulnerabilite(v.id).subscribe(() => {
      this.notif.succes('Vulnérabilité supprimée.');
      this.charger();
    });
  }

  relancer(): void {
    this.api.declencherRelances().subscribe((r) =>
      this.notif.succes(`Relance envoyée à ${r.nb_destinataires} responsable(s).`),
    );
  }

  recapituler(): void {
    this.api.declencherRecapitulatif().subscribe((r) => this.notif.info(r.detail));
  }

  private vierge(): Partial<Vulnerabilite> {
    return { reference: '', titre: '', composant: '', gravite: 'MOYENNE' };
  }

  classe = classePastille;
  format = lisible;
}
