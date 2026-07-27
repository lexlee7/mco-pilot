export type Criticite = 'VITALE' | 'MAJEURE' | 'STANDARD' | 'MINEURE';
export type StatutApplication = 'RUN' | 'DEGRADE' | 'INCIDENT' | 'MAINTENANCE' | 'DECOMMISSIONNEE';
export type ModeSuivi = 'AUTOMATIQUE' | 'MANUEL' | 'NON';
export type Gravite = 'CRITIQUE' | 'ELEVEE' | 'MOYENNE' | 'FAIBLE';
export type StatutVulnerabilite =
  | 'OUVERTE' | 'EN_COURS' | 'CORRIGEE' | 'RISQUE_ACCEPTE' | 'FAUX_POSITIF';
export type EtatDocument = 'A_JOUR' | 'OBSOLETE' | 'EN_COURS' | 'MANQUANT' | 'NON_APPLICABLE';

export interface Partenaire {
  id: number;
  nom: string;
  type: string;
  contact_nom?: string | null;
  contact_email?: string | null;
  contact_telephone?: string | null;
  support_url?: string | null;
  escalade_n1?: string | null;
  escalade_n2?: string | null;
  reference_contrat?: string | null;
  horaires_support?: string | null;
  notes?: string | null;
}

export interface Plage {
  id: number;
  application_id: number;
  libelle?: string | null;
  jour_semaine: number;
  heure_debut: string;
  heure_fin: string;
  validee_par_metier: boolean;
}

export interface Flux {
  id: number;
  application_id: number;
  nom: string;
  sens: string;
  frequence: string;
  heure?: string | null;
  jour?: string | null;
  protocole?: string | null;
  partenaire_id?: number | null;
  partenaire?: Partenaire | null;
  bloquant: boolean;
  description?: string | null;
}

export interface DocumentApp {
  id: number;
  application_id: number;
  typologie: string;
  etat: EtatDocument;
  url?: string | null;
  version?: string | null;
  date_maj?: string | null;
  commentaire?: string | null;
}

export interface Dispositif {
  id: number;
  application_id: number;
  outil: string;
  type_scan?: string | null;
  frequence?: string | null;
  actif: boolean;
  dernier_scan?: string | null;
  url_rapport?: string | null;
}

export interface VulnerabiliteLiee {
  id: number;
  reference: string;
  titre: string;
  composant: string;
  gravite: Gravite;
  version_cible?: string | null;
  statut: StatutVulnerabilite;
  date_echeance?: string | null;
  age_jours: number;
}

export interface Application {
  id: number;
  code: string;
  nom: string;
  description?: string | null;
  criticite: Criticite;
  statut: StatutApplication;
  responsable_nom?: string | null;
  responsable_email?: string | null;
  responsable_telephone?: string | null;
  equipe?: string | null;
  environnement_url?: string | null;
  notes?: string | null;
  sbom_mode: ModeSuivi;
  sbom_commentaire?: string | null;
  sanity_check_mode: ModeSuivi;
  sanity_check_commentaire?: string | null;
  habilitations?: string | null;
  editeur_id?: number | null;
  editeur?: Partenaire | null;
  plages: Plage[];
  nb_vulnerabilites_ouvertes: number;
  cree_le: string;
  maj_le: string;
}

export interface ApplicationDetail extends Application {
  flux: Flux[];
  documents: DocumentApp[];
  dispositifs: Dispositif[];
  vulnerabilites: VulnerabiliteLiee[];
}

export interface ApplicationImpactee {
  application_id: number;
  code: string;
  nom: string;
  responsable_email?: string | null;
  statut: StatutVulnerabilite;
  version_installee?: string | null;
  date_correction_prevue?: string | null;
  commentaire?: string | null;
}

export interface Vulnerabilite {
  id: number;
  reference: string;
  titre: string;
  composant: string;
  versions_touchees?: string | null;
  version_cible?: string | null;
  gravite: Gravite;
  score_cvss?: number | null;
  statut: StatutVulnerabilite;
  date_detection: string;
  date_echeance?: string | null;
  source?: string | null;
  description?: string | null;
  plan_action?: string | null;
  age_jours: number;
  applications: ApplicationImpactee[];
}

export interface ConflitDetail {
  application_id: number;
  code: string;
  nom: string;
  criticite: Criticite;
  raison: string;
}

export interface Creneau {
  jour_semaine: number;
  jour_libelle: string;
  heure_debut: string;
  heure_fin: string;
  duree_minutes: number;
  nb_conflits: number;
  parfait: boolean;
  applications_couvertes: string[];
  conflits: ConflitDetail[];
  resume: string;
}

export interface ReponseCreneaux {
  nb_applications: number;
  duree_demandee: number;
  tolerance: number;
  creneaux: Creneau[];
  message: string;
}

export interface Evenement {
  id: number;
  titre: string;
  type: string;
  debut: string;
  fin: string;
  impact?: string | null;
  pilote?: string | null;
  description?: string | null;
  applications: { id: number; code: string; nom: string }[];
}

export interface OccurrencePlage {
  application_id: number;
  code: string;
  nom: string;
  criticite: Criticite;
  libelle: string;
  debut: string;
  fin: string;
}

export interface ListeDiffusion {
  id: number;
  nom: string;
  description?: string | null;
  destinataires: string;
  nb_destinataires: number;
}

export interface TemplateComm {
  id: number;
  nom: string;
  categorie: string;
  sujet: string;
  corps_html: string;
  variables?: string | null;
}

export interface HistoriqueComm {
  id: number;
  sujet: string;
  destinataires: string;
  envoye_le: string;
  statut_envoi: string;
  application_id?: number | null;
}

export interface RepartitionItem { cle: string; valeur: number; }

export interface DashboardStats {
  nb_applications: number;
  nb_applications_vitales: number;
  nb_vulnerabilites_ouvertes: number;
  nb_vulnerabilites_critiques: number;
  nb_vulnerabilites_hors_delai: number;
  age_moyen_vulnerabilites: number;
  taux_documentation: number;
  taux_sbom_automatise: number;
  nb_evenements_semaine: number;
  repartition_statuts: RepartitionItem[];
  repartition_criticites: RepartitionItem[];
  repartition_gravites: RepartitionItem[];
  couverture_plages: RepartitionItem[];
  applications_a_risque: { id: number; code: string; nom: string }[];
}

export interface Referentiels {
  criticites: string[];
  statuts_application: string[];
  modes_suivi: string[];
  types_partenaire: string[];
  sens_flux: string[];
  frequences_flux: string[];
  types_document: string[];
  etats_document: string[];
  gravites: string[];
  statuts_vulnerabilite: string[];
  types_evenement: string[];
  categories_template: string[];
}

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/** Convertit une valeur d'énumération en classe CSS de pastille. */
export function classePastille(valeur?: string | null): string {
  return 'pastille p-' + (valeur ?? 'neutre').toLowerCase();
}

/** Rend lisible une valeur technique : SANITY_CHECK -> Sanity check. */
export function lisible(valeur?: string | null): string {
  if (!valeur) return '—';
  const texte = valeur.replace(/_/g, ' ').toLowerCase();
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}
