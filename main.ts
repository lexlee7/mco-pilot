import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { ApiService } from '../core/api.service';
import { NotificationService } from '../core/ui.service';
import {
  Application,
  HistoriqueComm,
  ListeDiffusion,
  Referentiels,
  TemplateComm,
  classePastille,
  lisible,
} from '../core/models';
import { IconeComponent } from '../shared/icone.component';
import { ModaleComponent } from '../shared/modale.component';

type Vue = 'assistant' | 'modeles' | 'listes' | 'historique';

@Component({
  selector: 'mco-communication',
  standalone: true,
  imports: [CommonModule, FormsModule, IconeComponent, ModaleComponent],
  template: `
    <header class="apparait">
      <div class="eyebrow">Cellule de crise</div>
      <h1 class="titre-page">Communication d'incident</h1>
      <p class="sous-titre">
        Trois gestes pour prévenir : choisir un modèle, cocher les destinataires, relire et envoyer.
        Conçu pour être utilisable sous pression, sans rien avoir à rédiger dans l'urgence.
      </p>
    </header>

    @if (etatMessagerie(); as etat) {
      @if (etat.mode_simulation) {
        <div class="carte bandeau apparait" style="margin-top: 18px">
          <mco-icone nom="eclair" />
          <span>{{ etat.message }}</span>
        </div>
      }
    }

    <nav class="onglets apparait">
      @for (v of vues; track v.cle) {
        <button class="onglet" type="button" [class.onglet--actif]="vue() === v.cle" (click)="vue.set(v.cle)">
          {{ v.libelle }}
        </button>
      }
    </nav>

    <!-- ------------------------------------------------ Assistant -->
    @if (vue() === 'assistant') {
      <div class="disposition apparait">
        <div class="pile">
          <section class="carte">
            <div class="eyebrow">Étape 1</div>
            <h2 class="titre-bloc">Choisir un modèle de message</h2>
            <div class="grille-modeles">
              @for (t of templates(); track t.id) {
                <button
                  type="button"
                  class="modele"
                  [class.modele--actif]="templateChoisi()?.id === t.id"
                  (click)="choisirTemplate(t)"
                >
                  <span class="pastille p-info">{{ format(t.categorie) }}</span>
                  <strong>{{ t.nom }}</strong>
                  <span class="doux">{{ t.sujet }}</span>
                </button>
              } @empty {
                <div class="doux">Aucun modèle enregistré. Créez-en un dans l'onglet « Modèles ».</div>
              }
            </div>
          </section>

          <section class="carte">
            <div class="eyebrow">Étape 2</div>
            <h2 class="titre-bloc">Sélectionner les destinataires</h2>
            <div class="grille-listes">
              @for (l of listes(); track l.id) {
                <label class="liste-choix" [class.liste-choix--active]="listesChoisies().includes(l.id)">
                  <input
                    type="checkbox"
                    [checked]="listesChoisies().includes(l.id)"
                    (change)="basculerListe(l.id)"
                  />
                  <div>
                    <strong>{{ l.nom }}</strong>
                    <div class="doux" style="font-size: 12px">
                      {{ l.nb_destinataires }} destinataire(s)
                    </div>
                  </div>
                </label>
              }
            </div>
            <div class="grille-form" style="margin-top: 16px">
              <div class="champ">
                <label for="sup">Destinataires supplémentaires</label>
                <input
                  id="sup"
                  class="saisie mono"
                  [ngModel]="supplementaires()"
                  (ngModelChange)="supplementaires.set($event)"
                  placeholder="prenom.nom@exemple.fr ; autre@exemple.fr"
                />
              </div>
              <div class="champ">
                <label for="app">Application concernée</label>
                <select id="app" class="saisie" [ngModel]="applicationId()" (ngModelChange)="applicationId.set($event)">
                  <option value="">Aucune / transverse</option>
                  @for (a of applications(); track a.id) {
                    <option [value]="a.id">{{ a.code }} — {{ a.nom }}</option>
                  }
                </select>
              </div>
            </div>
          </section>

          <section class="carte">
            <div class="eyebrow">Étape 3</div>
            <h2 class="titre-bloc">Relire et envoyer</h2>
            <div class="champ" style="margin-top: 12px">
              <label for="suj">Objet du message</label>
              <input id="suj" class="saisie" [ngModel]="sujet()" (ngModelChange)="sujet.set($event)" />
            </div>
            <div class="champ" style="margin-top: 14px">
              <label for="corps">Contenu HTML (les variables sont remplacées à l'envoi)</label>
              <textarea
                id="corps"
                class="saisie mono"
                style="min-height: 200px; font-size: 12px"
                [ngModel]="corps()"
                (ngModelChange)="corps.set($event)"
              ></textarea>
            </div>
            <div class="rangee" style="margin-top: 18px; justify-content: flex-end">
              <button class="btn" type="button" (click)="envoyer(true)">Vérifier les destinataires</button>
              <button class="btn btn--primaire" type="button" (click)="envoyer(false)">
                <mco-icone nom="envoi" /> Envoyer maintenant
              </button>
            </div>
          </section>
        </div>

        <aside class="carte apercu">
          <div class="eyebrow">Aperçu</div>
          <h2 class="titre-bloc">{{ sujet() || 'Objet du message' }}</h2>
          <div class="apercu__cadre" [innerHTML]="apercu()"></div>
        </aside>
      </div>
    }

    <!-- ------------------------------------------------ Modèles -->
    @if (vue() === 'modeles') {
      <div class="carte apparait">
        <div class="entre">
          <div>
            <div class="eyebrow">Bibliothèque</div>
            <h2 class="titre-bloc">Modèles de communication</h2>
          </div>
          <button class="btn btn--primaire" type="button" (click)="ouvrirTemplate()">
            <mco-icone nom="plus" /> Nouveau modèle
          </button>
        </div>
        <div class="tableau-conteneur" style="margin-top: 14px">
          <table class="tableau">
            <thead><tr><th>Modèle</th><th>Catégorie</th><th>Objet</th><th>Variables</th><th></th></tr></thead>
            <tbody>
              @for (t of templates(); track t.id) {
                <tr>
                  <td>{{ t.nom }}</td>
                  <td><span class="pastille p-info">{{ format(t.categorie) }}</span></td>
                  <td class="doux">{{ t.sujet }}</td>
                  <td class="mono doux" style="font-size: 11.5px">{{ t.variables || '—' }}</td>
                  <td>
                    <div class="rangee" style="gap: 4px; flex-wrap: nowrap">
                      <button class="btn btn--fantome btn--petit" type="button" (click)="ouvrirTemplate(t)">
                        <mco-icone nom="crayon" [taille]="15" />
                      </button>
                      <button class="btn btn--fantome btn--petit" type="button" (click)="supprimerTemplate(t)">
                        <mco-icone nom="poubelle" [taille]="15" />
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5"><div class="vide" style="border: none">Aucun modèle enregistré.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- ------------------------------------------------ Listes -->
    @if (vue() === 'listes') {
      <div class="carte apparait">
        <div class="entre">
          <div>
            <div class="eyebrow">Annuaire</div>
            <h2 class="titre-bloc">Listes de diffusion</h2>
          </div>
          <button class="btn btn--primaire" type="button" (click)="ouvrirListe()">
            <mco-icone nom="plus" /> Nouvelle liste
          </button>
        </div>
        <div class="grille-listes" style="margin-top: 16px">
          @for (l of listes(); track l.id) {
            <div class="carte" style="padding: 16px">
              <div class="entre">
                <strong>{{ l.nom }}</strong>
                <div class="rangee" style="gap: 4px; flex-wrap: nowrap">
                  <button class="btn btn--fantome btn--petit" type="button" (click)="ouvrirListe(l)">
                    <mco-icone nom="crayon" [taille]="15" />
                  </button>
                  <button class="btn btn--fantome btn--petit" type="button" (click)="supprimerListe(l)">
                    <mco-icone nom="poubelle" [taille]="15" />
                  </button>
                </div>
              </div>
              <div class="doux" style="font-size: 13px; margin-top: 6px">{{ l.description || '—' }}</div>
              <div class="mono doux" style="font-size: 11.5px; margin-top: 10px; word-break: break-all">
                {{ l.destinataires }}
              </div>
              <span class="pastille p-neutre" style="margin-top: 12px">
                {{ l.nb_destinataires }} destinataire(s)
              </span>
            </div>
          }
        </div>
      </div>
    }

    <!-- ------------------------------------------------ Historique -->
    @if (vue() === 'historique') {
      <div class="carte apparait">
        <div class="eyebrow">Traçabilité</div>
        <h2 class="titre-bloc">Messages envoyés</h2>
        <div class="tableau-conteneur" style="margin-top: 14px">
          <table class="tableau">
            <thead><tr><th>Date</th><th>Objet</th><th>Destinataires</th><th>Statut</th></tr></thead>
            <tbody>
              @for (h of historique(); track h.id) {
                <tr>
                  <td class="mono">{{ h.envoye_le | date: 'dd/MM/yyyy HH:mm' }}</td>
                  <td>{{ h.sujet }}</td>
                  <td class="doux mono" style="font-size: 11.5px">{{ h.destinataires }}</td>
                  <td><span [class]="classe(h.statut_envoi)">{{ format(h.statut_envoi) }}</span></td>
                </tr>
              } @empty {
                <tr><td colspan="4"><div class="vide" style="border: none">Aucun envoi enregistré.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    @if (modaleTemplate()) {
      <mco-modale
        [titre]="brouillonTemplate.id ? 'Modifier le modèle' : 'Nouveau modèle'"
        surtitre="Bibliothèque"
        (fermer)="modaleTemplate.set(false)"
      >
        <div class="grille-form">
          <div class="champ">
            <label for="tn">Nom du modèle</label>
            <input id="tn" class="saisie" [(ngModel)]="brouillonTemplate.nom" />
          </div>
          <div class="champ">
            <label for="tc">Catégorie</label>
            <select id="tc" class="saisie" [(ngModel)]="brouillonTemplate.categorie">
              @for (c of referentiels()?.categories_template ?? []; track c) {
                <option [value]="c">{{ format(c) }}</option>
              }
            </select>
          </div>
        </div>
        <div class="champ" style="margin-top: 14px">
          <label for="ts">Objet</label>
          <input id="ts" class="saisie" [(ngModel)]="brouillonTemplate.sujet" />
        </div>
        <div class="champ" style="margin-top: 14px">
          <label for="tb">Corps HTML</label>
          <textarea
            id="tb"
            class="saisie mono"
            style="min-height: 240px; font-size: 12px"
            [(ngModel)]="brouillonTemplate.corps_html"
          ></textarea>
        </div>
        <p class="doux" style="font-size: 12px; margin-top: 10px">
          Variables disponibles :
          <span class="mono">
            {{ '{{application}}' }} {{ '{{code_application}}' }} {{ '{{responsable}}' }}
            {{ '{{date}}' }} {{ '{{heure}}' }}
          </span>
        </p>
        <div class="rangee" style="margin-top: 20px; justify-content: flex-end">
          <button class="btn btn--fantome" type="button" (click)="modaleTemplate.set(false)">Annuler</button>
          <button class="btn btn--primaire" type="button" (click)="enregistrerTemplate()">
            <mco-icone nom="coche" /> Enregistrer
          </button>
        </div>
      </mco-modale>
    }

    @if (modaleListe()) {
      <mco-modale
        [titre]="brouillonListe.id ? 'Modifier la liste' : 'Nouvelle liste de diffusion'"
        surtitre="Annuaire"
        (fermer)="modaleListe.set(false)"
      >
        <div class="champ">
          <label for="ln">Nom de la liste</label>
          <input id="ln" class="saisie" [(ngModel)]="brouillonListe.nom" />
        </div>
        <div class="champ" style="margin-top: 14px">
          <label for="ld">Description</label>
          <input id="ld" class="saisie" [(ngModel)]="brouillonListe.description" />
        </div>
        <div class="champ" style="margin-top: 14px">
          <label for="lde">Destinataires (séparés par un point-virgule ou un retour à la ligne)</label>
          <textarea id="lde" class="saisie mono" style="font-size: 12.5px" [(ngModel)]="brouillonListe.destinataires"></textarea>
        </div>
        <div class="rangee" style="margin-top: 20px; justify-content: flex-end">
          <button class="btn btn--fantome" type="button" (click)="modaleListe.set(false)">Annuler</button>
          <button class="btn btn--primaire" type="button" (click)="enregistrerListe()">
            <mco-icone nom="coche" /> Enregistrer
          </button>
        </div>
      </mco-modale>
    }
  `,
  styles: [
    `
      .bandeau {
        display: flex; align-items: center; gap: 12px;
        padding: 14px 18px; font-size: 13.5px;
        border-left: 3px solid var(--ambre);
      }

      .onglets {
        display: flex; gap: 4px; margin: 24px 0 20px;
        border-bottom: 1px solid var(--bordure); overflow-x: auto;
      }
      .onglet {
        padding: 11px 15px; background: none; border: none; cursor: pointer;
        color: var(--texte-doux); font-size: 14px; white-space: nowrap;
        border-bottom: 2px solid transparent; margin-bottom: -1px;
        transition: color var(--transition), border-color var(--transition);
      }
      .onglet:hover { color: var(--texte); }
      .onglet--actif { color: var(--texte); border-bottom-color: var(--signal); }

      .disposition { display: grid; grid-template-columns: 1fr 400px; gap: 20px; align-items: start; }
      @media (max-width: 1080px) { .disposition { grid-template-columns: 1fr; } }

      .titre-bloc { font-size: 18px; margin: 6px 0 4px; }

      .grille-modeles {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
        gap: 12px; margin-top: 16px;
      }
      .modele {
        display: flex; flex-direction: column; gap: 8px; align-items: flex-start;
        padding: 14px; border-radius: var(--r-m); cursor: pointer; text-align: left;
        border: 1px solid var(--bordure); background: var(--surface); color: inherit;
        transition: border-color var(--transition), transform var(--transition);
      }
      .modele:hover { border-color: var(--bordure-forte); transform: translateY(-2px); }
      .modele--actif { border-color: var(--signal); background: var(--signal-sourd); }
      .modele .doux { font-size: 12px; }

      .grille-listes {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px;
      }
      .liste-choix {
        display: flex; align-items: center; gap: 11px; padding: 13px;
        border: 1px solid var(--bordure); border-radius: var(--r-m); cursor: pointer;
        transition: border-color var(--transition);
      }
      .liste-choix:hover { border-color: var(--bordure-forte); }
      .liste-choix--active { border-color: var(--signal); background: var(--signal-sourd); }
      .liste-choix input { accent-color: var(--signal); width: 16px; height: 16px; }

      .apercu { position: sticky; top: 24px; }
      .apercu__cadre {
        margin-top: 14px; border-radius: var(--r-m); overflow: auto;
        max-height: 620px; background: #fff; color: #26304a;
        border: 1px solid var(--bordure-forte);
      }
    `,
  ],
})
export class CommunicationComponent {
  private api = inject(ApiService);
  private notif = inject(NotificationService);
  private sanitizer = inject(DomSanitizer);

  readonly vue = signal<Vue>('assistant');
  readonly vues: { cle: Vue; libelle: string }[] = [
    { cle: 'assistant', libelle: 'Assistant d’envoi' },
    { cle: 'modeles', libelle: 'Modèles' },
    { cle: 'listes', libelle: 'Listes de diffusion' },
    { cle: 'historique', libelle: 'Historique' },
  ];

  readonly templates = signal<TemplateComm[]>([]);
  readonly listes = signal<ListeDiffusion[]>([]);
  readonly applications = signal<Application[]>([]);
  readonly historique = signal<HistoriqueComm[]>([]);
  readonly referentiels = signal<Referentiels | undefined>(undefined);
  readonly etatMessagerie = signal<{ mode_simulation: boolean; message: string } | undefined>(undefined);

  readonly templateChoisi = signal<TemplateComm | undefined>(undefined);
  readonly listesChoisies = signal<number[]>([]);
  readonly supplementaires = signal('');
  readonly applicationId = signal('');
  readonly sujet = signal('');
  readonly corps = signal('');

  readonly modaleTemplate = signal(false);
  readonly modaleListe = signal(false);
  brouillonTemplate: Partial<TemplateComm> & { id?: number } = { nom: '', categorie: 'INCIDENT_OUVERTURE', sujet: '', corps_html: '' };
  brouillonListe: Partial<ListeDiffusion> & { id?: number } = { nom: '', description: '', destinataires: '' };

  readonly apercu = computed<SafeHtml>(() => {
    const app = this.applications().find((a) => String(a.id) === this.applicationId());
    const maintenant = new Date();
    const rendu = this.corps()
      .replace(/{{application}}/g, app?.nom ?? '[application]')
      .replace(/{{code_application}}/g, app?.code ?? '[code]')
      .replace(/{{responsable}}/g, app?.responsable_nom ?? '[responsable]')
      .replace(/{{date}}/g, maintenant.toLocaleDateString('fr-FR'))
      .replace(/{{heure}}/g, maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    return this.sanitizer.bypassSecurityTrustHtml(rendu || '<p style="padding:20px">Sélectionnez un modèle.</p>');
  });

  constructor() {
    this.api.referentiels().subscribe((r) => this.referentiels.set(r));
    this.api.listerApplications().subscribe((a) => this.applications.set(a));
    this.api.etatMessagerie().subscribe((e) => this.etatMessagerie.set(e));
    this.charger();
  }

  charger(): void {
    this.api.listerTemplates().subscribe((t) => this.templates.set(t));
    this.api.listerListes().subscribe((l) => this.listes.set(l));
    this.api.historiqueCommunications().subscribe((h) => this.historique.set(h));
  }

  choisirTemplate(t: TemplateComm): void {
    this.templateChoisi.set(t);
    this.sujet.set(t.sujet);
    this.corps.set(t.corps_html);
  }

  basculerListe(id: number): void {
    this.listesChoisies.update((liste) =>
      liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id],
    );
  }

  envoyer(apercuSeulement: boolean): void {
    if (!this.sujet() || !this.corps()) {
      this.notif.erreur('Choisissez un modèle ou rédigez un message avant d’envoyer.');
      return;
    }
    if (!this.listesChoisies().length && !this.supplementaires().trim()) {
      this.notif.erreur('Sélectionnez au moins une liste de diffusion.');
      return;
    }
    if (!apercuSeulement && !confirm('Confirmer l’envoi du message aux destinataires sélectionnés ?')) {
      return;
    }
    this.api
      .envoyerCommunication({
        template_id: this.templateChoisi()?.id ?? null,
        sujet: this.sujet(),
        corps_html: this.corps(),
        liste_ids: this.listesChoisies(),
        destinataires_supplementaires: this.supplementaires(),
        application_id: this.applicationId() ? Number(this.applicationId()) : null,
        test_uniquement: apercuSeulement,
      })
      .subscribe({
        next: (r) => {
          if (apercuSeulement) {
            this.notif.info(`${r.nb_destinataires} destinataire(s) : ${r.destinataires.join(', ')}`);
          } else {
            this.notif.succes(`${r.statut} — ${r.nb_destinataires} destinataire(s). ${r.detail}`);
            this.charger();
          }
        },
        error: (e) => this.notif.erreur(e?.error?.detail ?? 'Envoi impossible.'),
      });
  }

  // ------------------------------------------------------------ Modèles
  ouvrirTemplate(t?: TemplateComm): void {
    this.brouillonTemplate = t
      ? { ...t }
      : { nom: '', categorie: 'INCIDENT_OUVERTURE', sujet: '', corps_html: '' };
    this.modaleTemplate.set(true);
  }

  enregistrerTemplate(): void {
    if (!this.brouillonTemplate.nom || !this.brouillonTemplate.sujet) {
      this.notif.erreur('Nom et objet sont obligatoires.');
      return;
    }
    const corps = { ...this.brouillonTemplate };
    delete corps.id;
    const requete = this.brouillonTemplate.id
      ? this.api.modifierTemplate(this.brouillonTemplate.id, corps)
      : this.api.creerTemplate(corps);
    requete.subscribe({
      next: () => {
        this.notif.succes('Modèle enregistré.');
        this.modaleTemplate.set(false);
        this.charger();
      },
      error: (e) => this.notif.erreur(e?.error?.detail ?? 'Enregistrement impossible.'),
    });
  }

  supprimerTemplate(t: TemplateComm): void {
    if (!confirm(`Supprimer le modèle « ${t.nom} » ?`)) return;
    this.api.supprimerTemplate(t.id).subscribe(() => {
      this.notif.succes('Modèle supprimé.');
      this.charger();
    });
  }

  // ------------------------------------------------------------ Listes
  ouvrirListe(l?: ListeDiffusion): void {
    this.brouillonListe = l ? { ...l } : { nom: '', description: '', destinataires: '' };
    this.modaleListe.set(true);
  }

  enregistrerListe(): void {
    if (!this.brouillonListe.nom) {
      this.notif.erreur('Nommez la liste.');
      return;
    }
    const corps = { ...this.brouillonListe };
    delete corps.id;
    const requete = this.brouillonListe.id
      ? this.api.modifierListe(this.brouillonListe.id, corps)
      : this.api.creerListe(corps);
    requete.subscribe({
      next: () => {
        this.notif.succes('Liste enregistrée.');
        this.modaleListe.set(false);
        this.charger();
      },
      error: (e) => this.notif.erreur(e?.error?.detail ?? 'Enregistrement impossible.'),
    });
  }

  supprimerListe(l: ListeDiffusion): void {
    if (!confirm(`Supprimer la liste « ${l.nom} » ?`)) return;
    this.api.supprimerListe(l.id).subscribe(() => {
      this.notif.succes('Liste supprimée.');
      this.charger();
    });
  }

  classe = classePastille;
  format = lisible;
}
