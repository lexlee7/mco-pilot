"""Schémas Pydantic : contrat d'échange entre l'API et le front Angular."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from .models import (
    CategorieTemplate,
    StatutObsolescence,
    TypeDojo,
    Criticite,
    EtatDocument,
    FrequenceFlux,
    Gravite,
    ModeSuivi,
    SensFlux,
    StatutApplication,
    StatutVulnerabilite,
    TypeDocument,
    TypeEvenement,
    TypePartenaire,
)

ORM = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------- Partenaires
class PartenaireBase(BaseModel):
    nom: str
    type: TypePartenaire = TypePartenaire.EDITEUR
    contact_nom: str | None = None
    contact_email: str | None = None
    contact_telephone: str | None = None
    support_url: str | None = None
    escalade_n1: str | None = None
    escalade_n2: str | None = None
    reference_contrat: str | None = None
    horaires_support: str | None = None
    notes: str | None = None


class PartenaireCreate(PartenaireBase):
    pass


class PartenaireRead(PartenaireBase):
    model_config = ORM
    id: int


# --------------------------------------------------------------------- Plages
class PlageBase(BaseModel):
    libelle: str | None = None
    jour_semaine: int = Field(ge=0, le=6)
    heure_debut: str = Field(pattern=r"^\d{2}:\d{2}$")
    heure_fin: str = Field(pattern=r"^\d{2}:\d{2}$")
    validee_par_metier: bool = True


class PlageCreate(PlageBase):
    pass


class PlageRead(PlageBase):
    model_config = ORM
    id: int
    application_id: int


# --------------------------------------------------------------------- Flux
class FluxBase(BaseModel):
    nom: str
    sens: SensFlux = SensFlux.ENTRANT
    frequence: FrequenceFlux = FrequenceFlux.QUOTIDIEN
    heure: str | None = None
    jour: str | None = None
    protocole: str | None = None
    partenaire_id: int | None = None
    bloquant: bool = False
    description: str | None = None


class FluxCreate(FluxBase):
    pass


class FluxRead(FluxBase):
    model_config = ORM
    id: int
    application_id: int
    partenaire: PartenaireRead | None = None


# --------------------------------------------------------------------- Documents
class DocumentBase(BaseModel):
    typologie: TypeDocument
    etat: EtatDocument = EtatDocument.MANQUANT
    url: str | None = None
    version: str | None = None
    date_maj: date | None = None
    commentaire: str | None = None


class DocumentCreate(DocumentBase):
    pass


class DocumentRead(DocumentBase):
    model_config = ORM
    id: int
    application_id: int


# --------------------------------------------------------------------- Sécurité
class DispositifBase(BaseModel):
    outil: str
    type_scan: str | None = None
    frequence: str | None = None
    actif: bool = True
    dernier_scan: date | None = None
    url_rapport: str | None = None


class DispositifCreate(DispositifBase):
    pass


class DispositifRead(DispositifBase):
    model_config = ORM
    id: int
    application_id: int


# --------------------------------------------------------------------- Applications
class ApplicationBase(BaseModel):
    code: str
    nom: str
    description: str | None = None
    criticite: Criticite = Criticite.STANDARD
    statut: StatutApplication = StatutApplication.RUN
    responsable_nom: str | None = None
    responsable_email: str | None = None
    responsable_telephone: str | None = None
    equipe: str | None = None
    environnement_url: str | None = None
    notes: str | None = None
    sbom_mode: ModeSuivi = ModeSuivi.NON
    sbom_commentaire: str | None = None
    sanity_check_mode: ModeSuivi = ModeSuivi.NON
    sanity_check_commentaire: str | None = None
    habilitations: str | None = None
    editeur_id: int | None = None
    dora: bool = False
    expose_internet: bool = False


class ApplicationCreate(ApplicationBase):
    pass


class ApplicationUpdate(BaseModel):
    code: str | None = None
    nom: str | None = None
    description: str | None = None
    criticite: Criticite | None = None
    statut: StatutApplication | None = None
    responsable_nom: str | None = None
    responsable_email: str | None = None
    responsable_telephone: str | None = None
    equipe: str | None = None
    environnement_url: str | None = None
    notes: str | None = None
    sbom_mode: ModeSuivi | None = None
    sbom_commentaire: str | None = None
    sanity_check_mode: ModeSuivi | None = None
    sanity_check_commentaire: str | None = None
    habilitations: str | None = None
    editeur_id: int | None = None
    dora: bool | None = None
    expose_internet: bool | None = None


class ApplicationRead(ApplicationBase):
    model_config = ORM
    id: int
    cree_le: datetime
    maj_le: datetime
    editeur: PartenaireRead | None = None
    plages: list[PlageRead] = []
    nb_vulnerabilites_ouvertes: int = 0


class ApplicationDetail(ApplicationRead):
    flux: list[FluxRead] = []
    documents: list[DocumentRead] = []
    dispositifs: list[DispositifRead] = []
    vulnerabilites: list["VulnerabiliteLiee"] = []
    obsolescences: list["ObsolescenceRead"] = []
    dojos: list["DojoRead"] = []


# --------------------------------------------------------------------- Obsolescences
class ObsolescenceBase(BaseModel):
    composant: str
    version_obsolete: str
    version_cible: str | None = None
    date_limite: date | None = None
    date_traitement_prevue: date | None = None
    date_traitement_reelle: date | None = None
    statut: StatutObsolescence = StatutObsolescence.A_QUALIFIER
    criticite: Criticite = Criticite.STANDARD
    charge_estimee: str | None = None
    porteur: str | None = None
    commentaire: str | None = None


class ObsolescenceCreate(ObsolescenceBase):
    application_id: int


class ObsolescenceUpdate(BaseModel):
    composant: str | None = None
    version_obsolete: str | None = None
    version_cible: str | None = None
    date_limite: date | None = None
    date_traitement_prevue: date | None = None
    date_traitement_reelle: date | None = None
    statut: StatutObsolescence | None = None
    criticite: Criticite | None = None
    charge_estimee: str | None = None
    porteur: str | None = None
    commentaire: str | None = None
    application_id: int | None = None


class ObsolescenceRead(ObsolescenceBase):
    model_config = ORM
    id: int
    application_id: int
    code_application: str | None = None
    nom_application: str | None = None
    jours_restants: int | None = None
    en_retard: bool = False
    derive_planning: bool = False


class LigneComposant(BaseModel):
    """Regroupement du planning par composant technique."""

    composant: str
    nb_applications: int
    nb_en_retard: int
    echeance_la_plus_proche: date | None = None
    obsolescences: list[ObsolescenceRead] = []


class PlanningObsolescences(BaseModel):
    debut: date
    fin: date
    nb_obsolescences: int
    nb_en_retard: int
    nb_sans_echeance: int
    par_composant: list[LigneComposant] = []
    par_application: list["LigneApplicationObso"] = []


class LigneApplicationObso(BaseModel):
    application_id: int
    code: str
    nom: str
    criticite: Criticite
    nb_en_retard: int
    obsolescences: list[ObsolescenceRead] = []


# --------------------------------------------------------------------- DoJo
class DojoBase(BaseModel):
    titre: str
    type: TypeDojo = TypeDojo.EXPLOITATION
    url: str
    duree: str | None = None
    auteur: str | None = None
    date_maj: date | None = None
    description: str | None = None


class DojoCreate(DojoBase):
    pass


class DojoRead(DojoBase):
    model_config = ORM
    id: int
    application_id: int


# --------------------------------------------------------------------- Vulnérabilités
class LienApplication(BaseModel):
    application_id: int
    statut: StatutVulnerabilite = StatutVulnerabilite.OUVERTE
    version_installee: str | None = None
    date_correction_prevue: date | None = None
    commentaire: str | None = None


class VulnerabiliteBase(BaseModel):
    reference: str
    titre: str
    composant: str
    versions_touchees: str | None = None
    version_cible: str | None = None
    gravite: Gravite = Gravite.MOYENNE
    score_cvss: float | None = None
    statut: StatutVulnerabilite = StatutVulnerabilite.OUVERTE
    date_detection: date | None = None
    date_echeance: date | None = None
    source: str | None = None
    description: str | None = None
    plan_action: str | None = None


class VulnerabiliteCreate(VulnerabiliteBase):
    applications: list[LienApplication] = []


class VulnerabiliteUpdate(BaseModel):
    reference: str | None = None
    titre: str | None = None
    composant: str | None = None
    versions_touchees: str | None = None
    version_cible: str | None = None
    gravite: Gravite | None = None
    score_cvss: float | None = None
    statut: StatutVulnerabilite | None = None
    date_echeance: date | None = None
    source: str | None = None
    description: str | None = None
    plan_action: str | None = None
    applications: list[LienApplication] | None = None


class ApplicationImpactee(BaseModel):
    application_id: int
    code: str
    nom: str
    responsable_email: str | None = None
    statut: StatutVulnerabilite
    version_installee: str | None = None
    date_correction_prevue: date | None = None
    commentaire: str | None = None


class VulnerabiliteRead(VulnerabiliteBase):
    model_config = ORM
    id: int
    date_detection: date
    age_jours: int = 0
    applications: list[ApplicationImpactee] = []


class VulnerabiliteLiee(BaseModel):
    """Vue d'une vulnérabilité depuis la fiche application."""

    id: int
    reference: str
    titre: str
    composant: str
    gravite: Gravite
    version_cible: str | None = None
    statut: StatutVulnerabilite
    date_echeance: date | None = None
    age_jours: int = 0


# --------------------------------------------------------------------- Moteur de plages
class RechercheePlageRequest(BaseModel):
    application_ids: list[int] = []
    tout_le_parc: bool = False
    duree_minutes: int = 120
    tolerance_conflits: int = 0
    jours_autorises: list[int] | None = None  # 0=lundi
    heure_min: str | None = None  # borne basse "20:00"
    heure_max: str | None = None  # borne haute "06:00"


class ConflitDetail(BaseModel):
    application_id: int
    code: str
    nom: str
    criticite: Criticite
    raison: str


class CreneauPropose(BaseModel):
    jour_semaine: int
    jour_libelle: str
    heure_debut: str
    heure_fin: str
    duree_minutes: int
    nb_conflits: int
    parfait: bool
    applications_couvertes: list[str]
    conflits: list[ConflitDetail]
    resume: str


class RechercheePlageResponse(BaseModel):
    nb_applications: int
    duree_demandee: int
    tolerance: int
    creneaux: list[CreneauPropose]
    message: str


# --------------------------------------------------------------------- Événements
class EvenementBase(BaseModel):
    titre: str
    type: TypeEvenement = TypeEvenement.AUTRE
    debut: datetime
    fin: datetime
    impact: str | None = None
    pilote: str | None = None
    description: str | None = None


class EvenementCreate(EvenementBase):
    application_ids: list[int] = []


class EvenementRead(EvenementBase):
    model_config = ORM
    id: int
    applications: list["ApplicationMini"] = []


class ApplicationMini(BaseModel):
    model_config = ORM
    id: int
    code: str
    nom: str


# --------------------------------------------------------------------- Communication
class ListeDiffusionBase(BaseModel):
    nom: str
    description: str | None = None
    destinataires: str = ""


class ListeDiffusionCreate(ListeDiffusionBase):
    pass


class ListeDiffusionRead(ListeDiffusionBase):
    model_config = ORM
    id: int
    nb_destinataires: int = 0


class TemplateBase(BaseModel):
    nom: str
    categorie: CategorieTemplate = CategorieTemplate.INCIDENT_OUVERTURE
    sujet: str
    corps_html: str
    variables: str | None = None


class TemplateCreate(TemplateBase):
    pass


class TemplateRead(TemplateBase):
    model_config = ORM
    id: int


class EnvoiCommunicationRequest(BaseModel):
    template_id: int | None = None
    sujet: str
    corps_html: str
    liste_ids: list[int] = []
    destinataires_supplementaires: str = ""
    application_id: int | None = None
    test_uniquement: bool = False


class EnvoiCommunicationResponse(BaseModel):
    statut: str
    nb_destinataires: int
    destinataires: list[str]
    detail: str


class CommunicationRead(BaseModel):
    model_config = ORM
    id: int
    sujet: str
    destinataires: str
    envoye_le: datetime
    statut_envoi: str
    application_id: int | None = None


# --------------------------------------------------------------------- Dashboard
class RepartitionItem(BaseModel):
    cle: str
    valeur: int


class DashboardStats(BaseModel):
    nb_applications: int
    nb_applications_vitales: int
    nb_vulnerabilites_ouvertes: int
    nb_vulnerabilites_critiques: int
    nb_vulnerabilites_hors_delai: int
    age_moyen_vulnerabilites: float
    taux_documentation: float
    taux_sbom_automatise: float
    nb_evenements_semaine: int
    nb_obsolescences_actives: int = 0
    nb_obsolescences_en_retard: int = 0
    nb_obsolescences_90_jours: int = 0
    repartition_statuts: list[RepartitionItem]
    repartition_criticites: list[RepartitionItem]
    repartition_gravites: list[RepartitionItem]
    couverture_plages: list[RepartitionItem]
    applications_a_risque: list[ApplicationMini]


ApplicationDetail.model_rebuild()
EvenementRead.model_rebuild()
PlanningObsolescences.model_rebuild()
