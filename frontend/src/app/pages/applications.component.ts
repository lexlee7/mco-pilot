import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { ApiService } from '../core/api.service';
import { NotificationService } from '../core/ui.service';
import { Application, Partenaire, Referentiels, classePastille, lisible } from '../core/models';
import { IconeComponent } from '../shared/icone.component';
import { ModaleComponent } from '../shared/modale.component';

@Component({
  selector: 'mco-applications',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconeComponent, ModaleComponent],
  template: `
    <header class="entre apparait">
      <div>
        <div class="eyebrow">Référentiel</div>
        <h1 class="titre-page">Parc applicatif</h1>
        <p class="sous-titre">
          {{ applications().length }} application(s) affichée(s). Cliquez sur une ligne pour ouvrir
          la fiche complète : plages, flux, documentation, habilitations et sécurité.
        </p>
      </div>
      <button class="btn btn--primaire" type="button" (click)="ouvrirCreation()">
        <mco-icone nom="plus" />
        Ajouter une application
      </button>
    </header>

    <section class="carte apparait" style="margin-top: 24px; padding: 16px 18px">
      <div class="rangee">
        <div class="recherche">
          <mco-icone nom="loupe" [taille]="16" />
          <input
            class="saisie"
            type="search"
            placeholder="Rechercher un code, un nom, un responsable, une équipe…"
            [ngModel]="recherche()"
            (ngModelChange)="surRecherche($event)"
          />
        </div>
        <select class="saisie filtre" [ngModel]="statut()" (ngModelChange)="filtrer('statut', $event)">
          <option value="">Tous les statuts</option>
          @for (s of referentiels()?.statuts_application ?? []; track s) {
            <option [value]="s">{{ format(s) }}</option>
          }
        </select>
        <select
          class="saisie filtre"
          [ngModel]="criticite()"
          (ngModelChange)="filtrer('criticite', $event)"
        >
          <option value="">Toutes les criticités</option>
          @for (c of referentiels()?.criticites ?? []; track c) {
            <option [value]="c">{{ format(c) }}</option>
          }
        </select>
        @if (recherche() || statut() || criticite()) {
          <button class="btn btn--fantome btn--petit" type="button" (click)="reinitialiser()">
            Réinitialiser
          </button>
        }
      </div>
    </section>

    <section class="carte apparait" style="margin-top: 18px; padding: 4px 0 0">
      <div class="tableau-conteneur">
        <table class="tableau">
          <thead>
            <tr>
              <th>Code</th>
              <th>Application</th>
              <th>Criticité</th>
              <th>Statut</th>
              <th>Responsable</th>
              <th>Éditeur</th>
              <th>Plages</th>
              <th>Failles</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (app of applications(); track app.id) {
              <tr>
                <td class="mono">{{ app.code }}</td>
                <td>
                  <a class="lien-nom" [routerLink]="['/applications', app.id]">{{ app.nom }}</a>
                  @if (app.equipe) {
                    <div class="doux" style="font-size: 12px">{{ app.equipe }}</div>
                  }
                </td>
                <td><span [class]="classe(app.criticite)">{{ format(app.criticite) }}</span></td>
                <td><span [class]="classe(app.statut)">{{ format(app.statut) }}</span></td>
                <td>
                  {{ app.responsable_nom || '—' }}
                  @if (app.responsable_email) {
                    <div class="doux mono" style="font-size: 11.5px">{{ app.responsable_email }}</div>
                  }
                </td>
                <td class="doux">{{ app.editeur?.nom || '—' }}</td>
                <td class="mono doux">{{ app.plages.length }}</td>
                <td>
                  @if (app.nb_vulnerabilites_ouvertes > 0) {
                    <span class="pastille p-critique">{{ app.nb_vulnerabilites_ouvertes }}</span>
                  } @else {
                    <span class="doux mono">0</span>
                  }
                </td>
                <td>
                  <div class="rangee" style="gap: 4px; flex-wrap: nowrap">
                    <button
                      class="btn btn--fantome btn--petit"
                      type="button"
                      (click)="ouvrirEdition(app)"
                      title="Modifier"
                    >
                      <mco-icone nom="crayon" [taille]="15" />
                    </button>
                    <button
                      class="btn btn--fantome btn--petit"
                      type="button"
                      (click)="supprimer(app)"
                      title="Supprimer"
                    >
                      <mco-icone nom="poubelle" [taille]="15" />
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="9">
                  <div class="vide" style="border: none">
                    Aucune application ne correspond à ces critères. Modifiez la recherche ou
                    ajoutez une application.
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    @if (formulaireOuvert()) {
      <mco-modale
        [titre]="brouillon.id ? 'Modifier ' + brouillon.nom : 'Nouvelle application'"
        surtitre="Fiche d'identité"
        (fermer)="formulaireOuvert.set(false)"
      >
        <div class="grille-form">
          <div class="champ">
            <label for="code">Code court</label>
            <input id="code" class="saisie mono" [(ngModel)]="brouillon.code" placeholder="FIN-CORE" />
          </div>
          <div class="champ">
            <label for="nom">Nom de l'application</label>
            <input id="nom" class="saisie" [(ngModel)]="brouillon.nom" />
          </div>
          <div class="champ">
            <label for="criticite">Criticité métier</label>
            <select id="criticite" class="saisie" [(ngModel)]="brouillon.criticite">
              @for (c of referentiels()?.criticites ?? []; track c) {
                <option [value]="c">{{ format(c) }}</option>
              }
            </select>
          </div>
          <div class="champ">
            <label for="statut">Statut opérationnel</label>
            <select id="statut" class="saisie" [(ngModel)]="brouillon.statut">
              @for (s of referentiels()?.statuts_application ?? []; track s) {
                <option [value]="s">{{ format(s) }}</option>
              }
            </select>
          </div>
          <div class="champ">
            <label for="resp">Responsable applicatif</label>
            <input id="resp" class="saisie" [(ngModel)]="brouillon.responsable_nom" />
          </div>
          <div class="champ">
            <label for="mail">Adresse e-mail du responsable</label>
            <input id="mail" class="saisie" type="email" [(ngModel)]="brouillon.responsable_email" />
          </div>
          <div class="champ">
            <label for="tel">Téléphone</label>
            <input id="tel" class="saisie" [(ngModel)]="brouillon.responsable_telephone" />
          </div>
          <div class="champ">
            <label for="equipe">Équipe / domaine</label>
            <input id="equipe" class="saisie" [(ngModel)]="brouillon.equipe" />
          </div>
          <div class="champ">
            <label for="editeur">Éditeur ou prestataire</label>
            <select id="editeur" class="saisie" [(ngModel)]="brouillon.editeur_id">
              <option [ngValue]="null">Aucun</option>
              @for (p of partenaires(); track p.id) {
                <option [ngValue]="p.id">{{ p.nom }}</option>
              }
            </select>
          </div>
          <div class="champ">
            <label for="url">URL de production</label>
            <input id="url" class="saisie" [(ngModel)]="brouillon.environnement_url" />
          </div>
          <div class="champ">
            <label for="sbom">SBOM — mise à disposition</label>
            <select id="sbom" class="saisie" [(ngModel)]="brouillon.sbom_mode">
              @for (m of referentiels()?.modes_suivi ?? []; track m) {
                <option [value]="m">{{ format(m) }}</option>
              }
            </select>
          </div>
          <div class="champ">
            <label for="sanity">Sanity check — type de vérification</label>
            <select id="sanity" class="saisie" [(ngModel)]="brouillon.sanity_check_mode">
              @for (m of referentiels()?.modes_suivi ?? []; track m) {
                <option [value]="m">{{ format(m) }}</option>
              }
            </select>
          </div>
        </div>

        <div class="grille-form" style="margin-top: 16px">
          <div class="champ">
            <label for="sbomc">Précision SBOM</label>
            <input id="sbomc" class="saisie" [(ngModel)]="brouillon.sbom_commentaire" />
          </div>
          <div class="champ">
            <label for="sanityc">Précision sanity check</label>
            <input id="sanityc" class="saisie" [(ngModel)]="brouillon.sanity_check_commentaire" />
          </div>
        </div>

        <div class="champ" style="margin-top: 16px">
          <label for="hab">Habilitations et droits requis pour intervenir en production</label>
          <textarea
            id="hab"
            class="saisie"
            [(ngModel)]="brouillon.habilitations"
            placeholder="Groupes AD, comptes de service, bastion, validations préalables…"
          ></textarea>
        </div>
        <div class="champ" style="margin-top: 16px">
          <label for="notes">Notes et consignes d'exploitation</label>
          <textarea id="notes" class="saisie" [(ngModel)]="brouillon.notes"></textarea>
        </div>

        <div class="rangee" style="margin-top: 22px; justify-content: flex-end">
          <button class="btn btn--fantome" type="button" (click)="formulaireOuvert.set(false)">
            Annuler
          </button>
          <button class="btn btn--primaire" type="button" (click)="enregistrer()">
            <mco-icone nom="coche" />
            {{ brouillon.id ? 'Enregistrer les modifications' : 'Créer l’application' }}
          </button>
        </div>
      </mco-modale>
    }
  `,
  styles: [
    `
      .recherche { position: relative; flex: 1; min-width: 260px; display: flex; align-items: center; }
      .recherche mco-icone { position: absolute; left: 12px; color: var(--texte-doux); }
      .recherche .saisie { padding-left: 36px; }
      .filtre { max-width: 210px; }
      .lien-nom { font-weight: 500; border-bottom: 1px solid transparent; transition: border-color var(--transition); }
      .lien-nom:hover { border-color: var(--signal); }
    `,
  ],
})
export class ApplicationsComponent {
  private api = inject(ApiService);
  private notif = inject(NotificationService);

  readonly applications = signal<Application[]>([]);
  readonly partenaires = signal<Partenaire[]>([]);
  readonly referentiels = signal<Referentiels | undefined>(undefined);
  readonly recherche = signal('');
  readonly statut = signal('');
  readonly criticite = signal('');
  readonly formulaireOuvert = signal(false);

  brouillon: Partial<Application> & { id?: number } = this.vierge();

  private frappe = new Subject<string>();

  constructor() {
    this.api.referentiels().subscribe((r) => this.referentiels.set(r));
    this.api.listerPartenaires().subscribe((p) => this.partenaires.set(p));
    this.frappe
      .pipe(
        debounceTime(280),
        distinctUntilChanged(),
        switchMap((terme) =>
          this.api.listerApplications({
            recherche: terme,
            statut: this.statut() || undefined,
            criticite: this.criticite() || undefined,
          }),
        ),
      )
      .subscribe((apps) => this.applications.set(apps));
    this.charger();
  }

  charger(): void {
    this.api
      .listerApplications({
        recherche: this.recherche() || undefined,
        statut: this.statut() || undefined,
        criticite: this.criticite() || undefined,
      })
      .subscribe((apps) => this.applications.set(apps));
  }

  surRecherche(terme: string): void {
    this.recherche.set(terme);
    this.frappe.next(terme);
  }

  filtrer(champ: 'statut' | 'criticite', valeur: string): void {
    if (champ === 'statut') this.statut.set(valeur);
    else this.criticite.set(valeur);
    this.charger();
  }

  reinitialiser(): void {
    this.recherche.set('');
    this.statut.set('');
    this.criticite.set('');
    this.charger();
  }

  ouvrirCreation(): void {
    this.brouillon = this.vierge();
    this.formulaireOuvert.set(true);
  }

  ouvrirEdition(app: Application): void {
    this.brouillon = { ...app };
    this.formulaireOuvert.set(true);
  }

  enregistrer(): void {
    if (!this.brouillon.code || !this.brouillon.nom) {
      this.notif.erreur('Le code et le nom sont obligatoires.');
      return;
    }
    const corps = { ...this.brouillon };
    delete corps.id;
    const requete = this.brouillon.id
      ? this.api.modifierApplication(this.brouillon.id, corps)
      : this.api.creerApplication(corps);
    requete.subscribe({
      next: () => {
        this.notif.succes(this.brouillon.id ? 'Application mise à jour.' : 'Application créée.');
        this.formulaireOuvert.set(false);
        this.charger();
      },
      error: (e) => this.notif.erreur(e?.error?.detail ?? 'Enregistrement impossible.'),
    });
  }

  supprimer(app: Application): void {
    if (!confirm(`Supprimer définitivement ${app.code} — ${app.nom} ?`)) return;
    this.api.supprimerApplication(app.id).subscribe({
      next: () => {
        this.notif.succes(`${app.code} supprimée.`);
        this.charger();
      },
      error: () => this.notif.erreur('Suppression impossible.'),
    });
  }

  private vierge(): Partial<Application> {
    return {
      code: '',
      nom: '',
      criticite: 'STANDARD',
      statut: 'RUN',
      sbom_mode: 'NON',
      sanity_check_mode: 'NON',
      editeur_id: null,
    };
  }

  classe = classePastille;
  format = lisible;
}
