"""Conversion des objets SQLAlchemy vers les schémas exposés par l'API."""
from __future__ import annotations

from datetime import date

from .models import (
    Application,
    Flux,
    Obsolescence,
    StatutObsolescence,
    StatutVulnerabilite,
    Vulnerabilite,
)
from .schemas import (
    ApplicationDetail,
    ApplicationImpactee,
    ApplicationRead,
    FluxRead,
    ObsolescenceRead,
    VulnerabiliteLiee,
    VulnerabiliteRead,
)

STATUTS_ACTIFS = (StatutVulnerabilite.OUVERTE, StatutVulnerabilite.EN_COURS)
OBSO_ACTIVES = (
    StatutObsolescence.A_QUALIFIER,
    StatutObsolescence.A_PLANIFIER,
    StatutObsolescence.PLANIFIEE,
    StatutObsolescence.EN_COURS,
)


def flux_read(flux: Flux) -> FluxRead:
    """Ajoute le libellé de récurrence et le rattachement applicatif."""
    from .services.recurrence import libelle_recurrence

    data = FluxRead.model_validate(flux)
    data.libelle_recurrence = libelle_recurrence(flux)
    if flux.application is not None:
        data.code_application = flux.application.code
        data.nom_application = flux.application.nom
    return data


def obsolescence_read(obso: Obsolescence) -> ObsolescenceRead:
    """Ajoute les indicateurs calculés : reste à courir, retard, dérive de planning."""
    data = ObsolescenceRead.model_validate(obso)
    if obso.application is not None:
        data.code_application = obso.application.code
        data.nom_application = obso.application.nom
    active = obso.statut in OBSO_ACTIVES
    if obso.date_limite:
        data.jours_restants = (obso.date_limite - date.today()).days
        data.en_retard = active and obso.date_limite < date.today()
        # Dérive : le traitement est planifié après la fin de support éditeur.
        data.derive_planning = bool(
            active
            and obso.date_traitement_prevue
            and obso.date_traitement_prevue > obso.date_limite
        )
    return data


def compter_vulns_ouvertes(app: Application) -> int:
    return sum(1 for lien in app.liens_vulnerabilites if lien.statut in STATUTS_ACTIFS)


def application_read(app: Application) -> ApplicationRead:
    data = ApplicationRead.model_validate(app)
    data.nb_vulnerabilites_ouvertes = compter_vulns_ouvertes(app)
    return data


def application_detail(app: Application) -> ApplicationDetail:
    data = ApplicationDetail.model_validate(app)
    data.nb_vulnerabilites_ouvertes = compter_vulns_ouvertes(app)
    data.flux = [flux_read(f) for f in app.flux]
    data.obsolescences = [obsolescence_read(o) for o in app.obsolescences]
    data.dojos = list(app.dojos)
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
