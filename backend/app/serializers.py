"""Conversion des objets SQLAlchemy vers les schémas exposés par l'API."""
from __future__ import annotations

from datetime import date

from .models import Application, StatutVulnerabilite, Vulnerabilite
from .schemas import (
    ApplicationDetail,
    ApplicationImpactee,
    ApplicationRead,
    VulnerabiliteLiee,
    VulnerabiliteRead,
)

STATUTS_ACTIFS = (StatutVulnerabilite.OUVERTE, StatutVulnerabilite.EN_COURS)


def compter_vulns_ouvertes(app: Application) -> int:
    return sum(1 for lien in app.liens_vulnerabilites if lien.statut in STATUTS_ACTIFS)


def application_read(app: Application) -> ApplicationRead:
    data = ApplicationRead.model_validate(app)
    data.nb_vulnerabilites_ouvertes = compter_vulns_ouvertes(app)
    return data


def application_detail(app: Application) -> ApplicationDetail:
    data = ApplicationDetail.model_validate(app)
    data.nb_vulnerabilites_ouvertes = compter_vulns_ouvertes(app)
    data.vulnerabilites = [
        VulnerabiliteLiee(
            id=lien.vulnerabilite.id,
            reference=lien.vulnerabilite.reference,
            titre=lien.vulnerabilite.titre,
            composant=lien.vulnerabilite.composant,
            gravite=lien.vulnerabilite.gravite,
            version_cible=lien.vulnerabilite.version_cible,
            statut=lien.statut,
            date_echeance=lien.vulnerabilite.date_echeance,
            age_jours=(date.today() - lien.vulnerabilite.date_detection).days,
        )
        for lien in app.liens_vulnerabilites
    ]
    return data


def vulnerabilite_read(vuln: Vulnerabilite) -> VulnerabiliteRead:
    data = VulnerabiliteRead.model_validate(vuln)
    data.age_jours = (date.today() - vuln.date_detection).days
    data.applications = [
        ApplicationImpactee(
            application_id=lien.application.id,
            code=lien.application.code,
            nom=lien.application.nom,
            responsable_email=lien.application.responsable_email,
            statut=lien.statut,
            version_installee=lien.version_installee,
            date_correction_prevue=lien.date_correction_prevue,
            commentaire=lien.commentaire,
        )
        for lien in vuln.liens
    ]
    return data
