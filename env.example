import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { NotificationService } from '../core/ui.service';
import { Partenaire, Referentiels, classePastille, lisible } from '../core/models';
import { IconeComponent } from '../shared/icone.component';
import { ModaleComponent } from '../shared/modale.component';

@Component({
  selector: 'mco-partenaires',
  standalone: true,
  imports: [CommonModule, FormsModule, IconeComponent, ModaleComponent],
  template: `
    <header class="entre apparait">
      <div>
        <div class="eyebrow">Référentiel</div>
        <h1 class="titre-page">Éditeurs et partenaires</h1>
        <p class="sous-titre">
          Annuaire centralisé des contacts à joindre en cas d'incident : support éditeur,
          intégrateurs, infogérants et partenaires de flux, avec leur chaîne d'escalade.
        </p>
      </div>
      <button class="btn btn--primaire" type="button" (click)="ouvrirCreation()">
        <mco-icone nom="plus" /> Ajouter un contact
      </button>
    </header>

    <section class="carte apparait" style="margin-top: 24px; padding: 16px 18px">
      <div class="recherche">
        <mco-icone nom="loupe" [taille]="16" />
        <input
          class="saisie"
          type="search"
          placeholder="Rechercher un éditeur, un contact, une adresse e-mail…"
          [ngModel]="recherche()"
          (ngModelChange)="recherche.set($event)"
        />
      </div>
    </section>

    <div class="grille-fiches apparait" style="margin-top: 18px">
      @for (p of partenairesFiltres(); track p.id) {
        <article class="carte carte--survol fiche">
          <div class="entre">
            <div>
              <h2 class="fiche__nom">{{ p.nom }}</h2>
              <span class="pastille p-info" style="margin-top: 8px">{{ format(p.type) }}</span>
            </div>
            <div class="rangee" style="gap: 4px; flex-wrap: nowrap">
              <button class="btn btn--fantome btn--petit" type="button" (click)="ouvrirEdition(p)">
                <mco-icone nom="crayon" [taille]="15" />
              </button>
              <button class="btn btn--fantome btn--petit" type="button" (click)="supprimer(p)">
                <mco-icone nom="poubelle" [taille]="15" />
              </button>
            </div>
          </div>

          <dl class="liste-def">
            <dt>Contact principal</dt>
            <dd>
              {{ p.contact_nom || '—' }}
              @if (p.contact_email) {
                <div><a class="mono doux" [href]="'mailto:' + p.contact_email">{{ p.contact_email }}</a></div>
              }
              @if (p.contact_telephone) { <div class="mono doux">{{ p.contact_telephone }}</div> }
            </dd>
            <dt>Escalade niveau 1</dt>
            <dd class="doux">{{ p.escalade_n1 || 'Non définie' }}</dd>
            <dt>Escalade niveau 2</dt>
            <dd class="doux">{{ p.escalade_n2 || 'Non définie' }}</dd>
            <dt>Horaires de support</dt>
            <dd class="doux">{{ p.horaires_support || 'Non précisés' }}</dd>
            <dt>Contrat</dt>
            <dd class="doux mono">{{ p.reference_contrat || '—' }}</dd>
          </dl>

          @if (p.support_url) {
            <a class="btn btn--petit" [href]="p.support_url" target="_blank" rel="noopener" style="margin-top: 14px">
              Portail de support
            </a>
          }
        </article>
      } @empty {
        <div class="vide">Aucun partenaire ne correspond à cette recherche.</div>
      }
    </div>

    @if (formulaireOuvert()) {
      <mco-modale
        [titre]="brouillon.id ? 'Modifier ' + brouillon.nom : 'Nouveau partenaire'"
        surtitre="Référentiel fournisseurs"
        (fermer)="formulaireOuvert.set(false)"
      >
        <div class="grille-form">
          <div class="champ">
            <label for="pn">Raison sociale</label>
            <input id="pn" class="saisie" [(ngModel)]="brouillon.nom" />
          </div>
          <div class="champ">
            <label for="pt">Type</label>
            <select id="pt" class="saisie" [(ngModel)]="brouillon.type">
              @for (t of referentiels()?.types_partenaire ?? []; track t) {
                <option [value]="t">{{ format(t) }}</option>
              }
            </select>
          </div>
          <div class="champ">
            <label for="pcn">Nom du contact</label>
            <input id="pcn" class="saisie" [(ngModel)]="brouillon.contact_nom" />
          </div>
          <div class="champ">
            <label for="pce">Adresse e-mail</label>
            <input id="pce" class="saisie" type="email" [(ngModel)]="brouillon.contact_email" />
          </div>
          <div class="champ">
            <label for="pct">Téléphone</label>
            <input id="pct" class="saisie" [(ngModel)]="brouillon.contact_telephone" />
          </div>
          <div class="champ">
            <label for="pu">Portail de support</label>
            <input id="pu" class="saisie" [(ngModel)]="brouillon.support_url" placeholder="https://…" />
          </div>
          <div class="champ">
            <label for="pe1">Escalade niveau 1</label>
            <input id="pe1" class="saisie" [(ngModel)]="brouillon.escalade_n1" />
          </div>
          <div class="champ">
            <label for="pe2">Escalade niveau 2</label>
            <input id="pe2" class="saisie" [(ngModel)]="brouillon.escalade_n2" />
          </div>
          <div class="champ">
            <label for="pc">Référence du contrat</label>
            <input id="pc" class="saisie mono" [(ngModel)]="brouillon.reference_contrat" />
          </div>
          <div class="champ">
            <label for="ph">Horaires de support</label>
            <input id="ph" class="saisie" [(ngModel)]="brouillon.horaires_support" />
          </div>
        </div>

        <div class="champ" style="margin-top: 16px">
          <label for="pno">Notes</label>
          <textarea id="pno" class="saisie" [(ngModel)]="brouillon.notes"></textarea>
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
      .recherche { position: relative; display: flex; align-items: center; }
      .recherche mco-icone { position: absolute; left: 12px; color: var(--texte-doux); }
      .recherche .saisie { padding-left: 36px; }

      .grille-fiches {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;
      }
      .fiche__nom { font-size: 18px; }

      .liste-def { display: grid; gap: 12px; margin: 18px 0 0; }
      .liste-def dt {
        font-family: var(--mono); font-size: 10px; letter-spacing: 0.13em;
        text-transform: uppercase; color: var(--texte-doux);
      }
      .liste-def dd { margin: 4px 0 0; font-size: 13.5px; }
    `,
  ],
})
export class PartenairesComponent {
  private api = inject(ApiService);
  private notif = inject(NotificationService);

  readonly partenaires = signal<Partenaire[]>([]);
  readonly referentiels = signal<Referentiels | undefined>(undefined);
  readonly recherche = signal('');
  readonly formulaireOuvert = signal(false);

  brouillon: Partial<Partenaire> & { id?: number } = this.vierge();

  readonly partenairesFiltres = computed(() => {
    const terme = this.recherche().toLowerCase().trim();
    if (!terme) return this.partenaires();
    return this.partenaires().filter((p) =>
      [p.nom, p.contact_nom, p.contact_email, p.reference_contrat]
        .filter(Boolean)
        .some((valeur) => (valeur as string).toLowerCase().includes(terme)),
    );
  });

  constructor() {
    this.api.referentiels().subscribe((r) => this.referentiels.set(r));
    this.charger();
  }

  charger(): void {
    this.api.listerPartenaires().subscribe((p) => this.partenaires.set(p));
  }

  ouvrirCreation(): void {
    this.brouillon = this.vierge();
    this.formulaireOuvert.set(true);
  }

  ouvrirEdition(p: Partenaire): void {
    this.brouillon = { ...p };
    this.formulaireOuvert.set(true);
  }

  enregistrer(): void {
    if (!this.brouillon.nom) {
      this.notif.erreur('La raison sociale est obligatoire.');
      return;
    }
    const corps = { ...this.brouillon };
    delete corps.id;
    const requete = this.brouillon.id
      ? this.api.modifierPartenaire(this.brouillon.id, corps)
      : this.api.creerPartenaire(corps);
    requete.subscribe({
      next: () => {
        this.notif.succes('Partenaire enregistré.');
        this.formulaireOuvert.set(false);
        this.charger();
      },
      error: () => this.notif.erreur('Enregistrement impossible.'),
    });
  }

  supprimer(p: Partenaire): void {
    if (!confirm(`Supprimer ${p.nom} du référentiel ?`)) return;
    this.api.supprimerPartenaire(p.id).subscribe(() => {
      this.notif.succes('Partenaire supprimé.');
      this.charger();
    });
  }

  private vierge(): Partial<Partenaire> {
    return { nom: '', type: 'EDITEUR' };
  }

  classe = classePastille;
  format = lisible;
}
