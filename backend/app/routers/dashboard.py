"""Indicateurs consolidés affichés sur le tableau de bord."""
from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Application,
    Criticite,
    Document,
    EtatDocument,
    Evenement,
    Gravite,
    ModeSuivi,
    Obsolescence,
    StatutObsolescence,
    StatutVulnerabilite,
    Vulnerabilite,
    VulnerabiliteApplication,
)
from ..schemas import ApplicationMini, DashboardStats, RepartitionItem

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

STATUTS_ACTIFS = (StatutVulnerabilite.OUVERTE, StatutVulnerabilite.EN_COURS)


@router.get("", response_model=DashboardStats)
def statistiques(db: Session = Depends(get_db)):
    apps = db.query(Application).all()
    liens = (
        db.query(VulnerabiliteApplication, Vulnerabilite)
        .join(Vulnerabilite, VulnerabiliteApplication.vulnerabilite_id == Vulnerabilite.id)
        .filter(VulnerabiliteApplication.statut.in_(STATUTS_ACTIFS))
        .all()
    )
    aujourdhui = date.today()

    ages = [(aujourdhui - v.date_detection).days for _, v in liens]
    hors_delai = [
        1 for _, v in liens if v.date_echeance and v.date_echeance < aujourdhui
    ]
    critiques = [1 for _, v in liens if v.gravite == Gravite.CRITIQUE]

    documents = db.query(Document).all()
    docs_pertinents = [d for d in documents if d.etat != EtatDocument.NON_APPLICABLE]
    docs_ok = [d for d in docs_pertinents if d.etat == EtatDocument.A_JOUR]
    taux_doc = round(100 * len(docs_ok) / len(docs_pertinents), 1) if docs_pertinents else 0.0

    sbom_auto = [a for a in apps if a.sbom_mode == ModeSuivi.AUTOMATIQUE]
    taux_sbom = round(100 * len(sbom_auto) / len(apps), 1) if apps else 0.0

    debut_semaine = datetime.now()
    fin_semaine = debut_semaine + timedelta(days=7)
    nb_evenements = (
        db.query(Evenement)
        .filter(Evenement.fin >= debut_semaine, Evenement.debut <= fin_semaine)
        .count()
    )

    obso_actives = (
        db.query(Obsolescence)
        .filter(
            Obsolescence.statut.in_(
                [
                    StatutObsolescence.A_QUALIFIER,
                    StatutObsolescence.A_PLANIFIER,
                    StatutObsolescence.PLANIFIEE,
                    StatutObsolescence.EN_COURS,
                ]
            )
        )
        .all()
    )
    obso_retard = [o for o in obso_actives if o.date_limite and o.date_limite < aujourdhui]
    horizon = aujourdhui + timedelta(days=90)
    obso_90 = [
        o for o in obso_actives if o.date_limite and aujourdhui <= o.date_limite <= horizon
    ]

    compte_par_app: Counter[int] = Counter(lien.application_id for lien, _ in liens)
    a_risque = sorted(
        apps,
        key=lambda a: (
            -compte_par_app.get(a.id, 0),
            0 if a.criticite == Criticite.VITALE else 1,
        ),
    )[:5]

    dora = Counter("Périmètre DORA" if a.dora else "Hors DORA" for a in apps)
    exposition = Counter(
        "Exposée Internet" if a.expose_internet else "Interne" for a in apps
    )
    statuts = Counter(a.statut.value for a in apps)
    criticites = Counter(a.criticite.value for a in apps)
    gravites = Counter(v.gravite.value for _, v in liens)

    sans_plage = sum(1 for a in apps if not a.plages)
    couverture = [
        RepartitionItem(cle="Plages déclarées", valeur=len(apps) - sans_plage),
        RepartitionItem(cle="Sans plage", valeur=sans_plage),
    ]

    return DashboardStats(
        nb_applications=len(apps),
        nb_applications_vitales=sum(1 for a in apps if a.criticite == Criticite.VITALE),
        nb_vulnerabilites_ouvertes=len(liens),
        nb_vulnerabilites_critiques=len(critiques),
        nb_vulnerabilites_hors_delai=len(hors_delai),
        age_moyen_vulnerabilites=round(sum(ages) / len(ages), 1) if ages else 0.0,
        taux_documentation=taux_doc,
        taux_sbom_automatise=taux_sbom,
        nb_evenements_semaine=nb_evenements,
        nb_obsolescences_actives=len(obso_actives),
        nb_obsolescences_en_retard=len(obso_retard),
        nb_obsolescences_90_jours=len(obso_90),
        repartition_statuts=[RepartitionItem(cle=k, valeur=v) for k, v in statuts.items()],
        repartition_criticites=[RepartitionItem(cle=k, valeur=v) for k, v in criticites.items()],
        repartition_gravites=[RepartitionItem(cle=k, valeur=v) for k, v in gravites.items()],
        repartition_dora=[RepartitionItem(cle=k, valeur=v) for k, v in dora.items()],
        repartition_exposition=[
            RepartitionItem(cle=k, valeur=v) for k, v in exposition.items()
        ],
        couverture_plages=couverture,
        applications_a_risque=[ApplicationMini.model_validate(a) for a in a_risque],
    )
