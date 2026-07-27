"""Modèle de données du pilotage MCO."""
from __future__ import annotations

import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------
# Énumérations métier
# --------------------------------------------------------------------------
class Criticite(str, enum.Enum):
    VITALE = "VITALE"
    MAJEURE = "MAJEURE"
    STANDARD = "STANDARD"
    MINEURE = "MINEURE"


class StatutApplication(str, enum.Enum):
    RUN = "RUN"
    DEGRADE = "DEGRADE"
    INCIDENT = "INCIDENT"
    MAINTENANCE = "MAINTENANCE"
    DECOMMISSIONNEE = "DECOMMISSIONNEE"


class ModeSuivi(str, enum.Enum):
    AUTOMATIQUE = "AUTOMATIQUE"
    MANUEL = "MANUEL"
    NON = "NON"


class TypePartenaire(str, enum.Enum):
    EDITEUR = "EDITEUR"
    INTEGRATEUR = "INTEGRATEUR"
    INFOGERANT = "INFOGERANT"
    PARTENAIRE_FLUX = "PARTENAIRE_FLUX"


class SensFlux(str, enum.Enum):
    ENTRANT = "ENTRANT"
    SORTANT = "SORTANT"
    BIDIRECTIONNEL = "BIDIRECTIONNEL"


class FrequenceFlux(str, enum.Enum):
    TEMPS_REEL = "TEMPS_REEL"
    HORAIRE = "HORAIRE"
    QUOTIDIEN = "QUOTIDIEN"
    HEBDOMADAIRE = "HEBDOMADAIRE"
    MENSUEL = "MENSUEL"
    A_LA_DEMANDE = "A_LA_DEMANDE"


class TypeDocument(str, enum.Enum):
    DAT = "DAT"
    DEX = "DEX"
    MANUEL_UTILISATEUR = "MANUEL_UTILISATEUR"
    PROCEDURE_EXPLOITATION = "PROCEDURE_EXPLOITATION"
    MATRICE_FLUX = "MATRICE_FLUX"
    PRA_PCA = "PRA_PCA"
    PLAN_REPRISE_DONNEES = "PLAN_REPRISE_DONNEES"
    ANALYSE_RISQUE = "ANALYSE_RISQUE"


class EtatDocument(str, enum.Enum):
    A_JOUR = "A_JOUR"
    OBSOLETE = "OBSOLETE"
    EN_COURS = "EN_COURS"
    MANQUANT = "MANQUANT"
    NON_APPLICABLE = "NON_APPLICABLE"


class Gravite(str, enum.Enum):
    CRITIQUE = "CRITIQUE"
    ELEVEE = "ELEVEE"
    MOYENNE = "MOYENNE"
    FAIBLE = "FAIBLE"


class StatutVulnerabilite(str, enum.Enum):
    OUVERTE = "OUVERTE"
    EN_COURS = "EN_COURS"
    CORRIGEE = "CORRIGEE"
    RISQUE_ACCEPTE = "RISQUE_ACCEPTE"
    FAUX_POSITIF = "FAUX_POSITIF"


class TypeEvenement(str, enum.Enum):
    MAINTENANCE_TRANSVERSE = "MAINTENANCE_TRANSVERSE"
    COUPURE_RESEAU = "COUPURE_RESEAU"
    FENETRE_TIR_INFRA = "FENETRE_TIR_INFRA"
    GEL_PRODUCTION = "GEL_PRODUCTION"
    MISE_EN_PRODUCTION = "MISE_EN_PRODUCTION"
    AUTRE = "AUTRE"


class CategorieTemplate(str, enum.Enum):
    INCIDENT_OUVERTURE = "INCIDENT_OUVERTURE"
    INCIDENT_SUIVI = "INCIDENT_SUIVI"
    RETABLISSEMENT = "RETABLISSEMENT"
    MAINTENANCE_PLANIFIEE = "MAINTENANCE_PLANIFIEE"
    INFORMATION = "INFORMATION"


# --------------------------------------------------------------------------
# Tables d'association
# --------------------------------------------------------------------------
evenement_application = Table(
    "evenement_application",
    Base.metadata,
    Column("evenement_id", ForeignKey("evenements.id", ondelete="CASCADE"), primary_key=True),
    Column("application_id", ForeignKey("applications.id", ondelete="CASCADE"), primary_key=True),
)


class VulnerabiliteApplication(Base):
    """Lien vulnérabilité <-> application, porteur de l'avancement du correctif."""

    __tablename__ = "vulnerabilite_application"
    __table_args__ = (UniqueConstraint("vulnerabilite_id", "application_id", name="uq_vuln_app"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    vulnerabilite_id: Mapped[int] = mapped_column(
        ForeignKey("vulnerabilites.id", ondelete="CASCADE"), index=True
    )
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    statut: Mapped[StatutVulnerabilite] = mapped_column(
        Enum(StatutVulnerabilite), default=StatutVulnerabilite.OUVERTE
    )
    version_installee: Mapped[str | None] = mapped_column(String(60))
    date_correction_prevue: Mapped[date | None] = mapped_column(Date)
    commentaire: Mapped[str | None] = mapped_column(Text)

    vulnerabilite = relationship("Vulnerabilite", back_populates="liens")
    application = relationship("Application", back_populates="liens_vulnerabilites")


# --------------------------------------------------------------------------
# Référentiel éditeurs / partenaires
# --------------------------------------------------------------------------
class Partenaire(Base):
    __tablename__ = "partenaires"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[TypePartenaire] = mapped_column(Enum(TypePartenaire), default=TypePartenaire.EDITEUR)
    contact_nom: Mapped[str | None] = mapped_column(String(120))
    contact_email: Mapped[str | None] = mapped_column(String(160))
    contact_telephone: Mapped[str | None] = mapped_column(String(40))
    support_url: Mapped[str | None] = mapped_column(String(255))
    escalade_n1: Mapped[str | None] = mapped_column(String(255))
    escalade_n2: Mapped[str | None] = mapped_column(String(255))
    reference_contrat: Mapped[str | None] = mapped_column(String(120))
    horaires_support: Mapped[str | None] = mapped_column(String(120))
    notes: Mapped[str | None] = mapped_column(Text)

    applications = relationship("Application", back_populates="editeur")
    flux = relationship("Flux", back_populates="partenaire")


# --------------------------------------------------------------------------
# Application
# --------------------------------------------------------------------------
class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    nom: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    criticite: Mapped[Criticite] = mapped_column(Enum(Criticite), default=Criticite.STANDARD)
    statut: Mapped[StatutApplication] = mapped_column(
        Enum(StatutApplication), default=StatutApplication.RUN
    )
    responsable_nom: Mapped[str | None] = mapped_column(String(120))
    responsable_email: Mapped[str | None] = mapped_column(String(160))
    responsable_telephone: Mapped[str | None] = mapped_column(String(40))
    equipe: Mapped[str | None] = mapped_column(String(120))
    environnement_url: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

    sbom_mode: Mapped[ModeSuivi] = mapped_column(Enum(ModeSuivi), default=ModeSuivi.NON)
    sbom_commentaire: Mapped[str | None] = mapped_column(String(255))
    sanity_check_mode: Mapped[ModeSuivi] = mapped_column(Enum(ModeSuivi), default=ModeSuivi.NON)
    sanity_check_commentaire: Mapped[str | None] = mapped_column(String(255))

    habilitations: Mapped[str | None] = mapped_column(Text)
    editeur_id: Mapped[int | None] = mapped_column(ForeignKey("partenaires.id", ondelete="SET NULL"))

    cree_le: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    maj_le: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc)

    editeur = relationship("Partenaire", back_populates="applications")
    plages = relationship(
        "PlageMaintenance", back_populates="application", cascade="all, delete-orphan"
    )
    flux = relationship("Flux", back_populates="application", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="application", cascade="all, delete-orphan")
    dispositifs = relationship(
        "DispositifSecurite", back_populates="application", cascade="all, delete-orphan"
    )
    liens_vulnerabilites = relationship(
        "VulnerabiliteApplication", back_populates="application", cascade="all, delete-orphan"
    )
    evenements = relationship(
        "Evenement", secondary=evenement_application, back_populates="applications"
    )


class PlageMaintenance(Base):
    """Plage hebdomadaire récurrente pendant laquelle l'application est arrêtable."""

    __tablename__ = "plages_maintenance"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    libelle: Mapped[str | None] = mapped_column(String(120))
    jour_semaine: Mapped[int] = mapped_column(Integer)  # 0 = lundi ... 6 = dimanche
    heure_debut: Mapped[str] = mapped_column(String(5))  # "22:00"
    heure_fin: Mapped[str] = mapped_column(String(5))  # "02:00" (passage minuit géré)
    validee_par_metier: Mapped[bool] = mapped_column(Boolean, default=True)

    application = relationship("Application", back_populates="plages")


class Flux(Base):
    __tablename__ = "flux"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    nom: Mapped[str] = mapped_column(String(120))
    sens: Mapped[SensFlux] = mapped_column(Enum(SensFlux), default=SensFlux.ENTRANT)
    frequence: Mapped[FrequenceFlux] = mapped_column(
        Enum(FrequenceFlux), default=FrequenceFlux.QUOTIDIEN
    )
    heure: Mapped[str | None] = mapped_column(String(5))
    jour: Mapped[str | None] = mapped_column(String(40))
    protocole: Mapped[str | None] = mapped_column(String(40))
    partenaire_id: Mapped[int | None] = mapped_column(
        ForeignKey("partenaires.id", ondelete="SET NULL")
    )
    bloquant: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[str | None] = mapped_column(Text)

    application = relationship("Application", back_populates="flux")
    partenaire = relationship("Partenaire", back_populates="flux")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    typologie: Mapped[TypeDocument] = mapped_column(Enum(TypeDocument))
    etat: Mapped[EtatDocument] = mapped_column(Enum(EtatDocument), default=EtatDocument.MANQUANT)
    url: Mapped[str | None] = mapped_column(String(255))
    version: Mapped[str | None] = mapped_column(String(30))
    date_maj: Mapped[date | None] = mapped_column(Date)
    commentaire: Mapped[str | None] = mapped_column(Text)

    application = relationship("Application", back_populates="documents")


class DispositifSecurite(Base):
    __tablename__ = "dispositifs_securite"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    outil: Mapped[str] = mapped_column(String(80))  # SonarQube, JFrog Xray, Dependabot...
    type_scan: Mapped[str | None] = mapped_column(String(80))  # SAST, SCA, DAST, secrets...
    frequence: Mapped[str | None] = mapped_column(String(60))
    actif: Mapped[bool] = mapped_column(Boolean, default=True)
    dernier_scan: Mapped[date | None] = mapped_column(Date)
    url_rapport: Mapped[str | None] = mapped_column(String(255))

    application = relationship("Application", back_populates="dispositifs")


# --------------------------------------------------------------------------
# Vulnérabilités
# --------------------------------------------------------------------------
class Vulnerabilite(Base):
    __tablename__ = "vulnerabilites"

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(60), index=True)  # CVE-2024-XXXX
    titre: Mapped[str] = mapped_column(String(200))
    composant: Mapped[str] = mapped_column(String(120))
    versions_touchees: Mapped[str | None] = mapped_column(String(120))
    version_cible: Mapped[str | None] = mapped_column(String(60))
    gravite: Mapped[Gravite] = mapped_column(Enum(Gravite), default=Gravite.MOYENNE)
    score_cvss: Mapped[float | None] = mapped_column()
    statut: Mapped[StatutVulnerabilite] = mapped_column(
        Enum(StatutVulnerabilite), default=StatutVulnerabilite.OUVERTE
    )
    date_detection: Mapped[date] = mapped_column(Date, default=date.today)
    date_echeance: Mapped[date | None] = mapped_column(Date)
    source: Mapped[str | None] = mapped_column(String(80))
    description: Mapped[str | None] = mapped_column(Text)
    plan_action: Mapped[str | None] = mapped_column(Text)

    liens = relationship(
        "VulnerabiliteApplication", back_populates="vulnerabilite", cascade="all, delete-orphan"
    )


# --------------------------------------------------------------------------
# Calendrier MCO
# --------------------------------------------------------------------------
class Evenement(Base):
    __tablename__ = "evenements"

    id: Mapped[int] = mapped_column(primary_key=True)
    titre: Mapped[str] = mapped_column(String(160))
    type: Mapped[TypeEvenement] = mapped_column(Enum(TypeEvenement), default=TypeEvenement.AUTRE)
    debut: Mapped[datetime] = mapped_column(DateTime)
    fin: Mapped[datetime] = mapped_column(DateTime)
    impact: Mapped[str | None] = mapped_column(String(255))
    pilote: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)

    applications = relationship(
        "Application", secondary=evenement_application, back_populates="evenements"
    )


# --------------------------------------------------------------------------
# Communication de crise
# --------------------------------------------------------------------------
class ListeDiffusion(Base):
    __tablename__ = "listes_diffusion"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(120), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    destinataires: Mapped[str] = mapped_column(Text, default="")  # emails séparés par ; ou saut de ligne

    def emails(self) -> list[str]:
        raw = (self.destinataires or "").replace(",", ";").replace("\n", ";")
        return [e.strip() for e in raw.split(";") if e.strip()]


class TemplateCommunication(Base):
    __tablename__ = "templates_communication"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(120), unique=True)
    categorie: Mapped[CategorieTemplate] = mapped_column(
        Enum(CategorieTemplate), default=CategorieTemplate.INCIDENT_OUVERTURE
    )
    sujet: Mapped[str] = mapped_column(String(200))
    corps_html: Mapped[str] = mapped_column(Text)
    variables: Mapped[str | None] = mapped_column(String(255))


class Communication(Base):
    """Historique des messages envoyés."""

    __tablename__ = "communications"

    id: Mapped[int] = mapped_column(primary_key=True)
    sujet: Mapped[str] = mapped_column(String(200))
    corps_html: Mapped[str] = mapped_column(Text)
    destinataires: Mapped[str] = mapped_column(Text)
    application_id: Mapped[int | None] = mapped_column(
        ForeignKey("applications.id", ondelete="SET NULL")
    )
    envoye_le: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    statut_envoi: Mapped[str] = mapped_column(String(40), default="ENVOYE")
    detail_envoi: Mapped[str | None] = mapped_column(Text)
