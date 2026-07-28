"""Suivi des obsolescences de composants.

Une obsolescence n'est pas une vulnérabilité : il n'y a pas de faille exploitable,
mais une fin de support éditeur à anticiper. Le pilotage se fait sur deux axes :
par application (que dois-je traiter sur ce périmètre ?) et par composant
(combien d'applications dois-je migrer si je décide de sortir de cette version ?).
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Application, Criticite, Obsolescence, StatutObsolescence
from ..schemas import (
    LigneApplicationObso,
    LigneComposant,
    ObsolescenceCreate,
    ObsolescenceRead,
    ObsolescenceUpdate,
    PlanningObsolescences,
)
from ..serializers import OBSO_ACTIVES, obsolescence_read

router = APIRouter(prefix="/api/obsolescences", tags=["Obsolescences"])

ORDRE_CRITICITE = {
    Criticite.VITALE: 0,
    Criticite.MAJEURE: 1,
    Criticite.STANDARD: 2,
    Criticite.MINEURE: 3,
}


@router.get("", response_model=list[ObsolescenceRead])
def lister(
    db: Session = Depends(get_db),
    recherche: str | None = Query(None, description="Composant, version ou porteur"),
    application_id: int | None = None,
    composant: str | None = None,
    statut: StatutObsolescence | None = None,
    criticite: Criticite | None = None,
    actives_uniquement: bool = False,
    en_retard: bool = False,
    echeance_avant: date | None = None,
):
    requete = db.query(Obsolescence)
    if recherche:
        motif = f"%{recherche.lower()}%"
        requete = requete.filter(
            or_(
                Obsolescence.composant.ilike(motif),
                Obsolescence.version_obsolete.ilike(motif),
                Obsolescence.version_cible.ilike(motif),
                Obsolescence.porteur.ilike(motif),
            )
        )
    if application_id:
        requete = requete.filter(Obsolescence.application_id == application_id)
    if composant:
        requete = requete.filter(Obsolescence.composant == composant)
    if statut:
        requete = requete.filter(Obsolescence.statut == statut)
    if criticite:
        requete = requete.filter(Obsolescence.criticite == criticite)
    if actives_uniquement or en_retard:
        requete = requete.filter(Obsolescence.statut.in_(OBSO_ACTIVES))
    if en_retard:
        requete = requete.filter(
            Obsolescence.date_limite.isnot(None), Obsolescence.date_limite < date.today()
        )
    if echeance_avant:
        requete = requete.filter(
            Obsolescence.date_limite.isnot(None), Obsolescence.date_limite <= echeance_avant
        )
    resultats = requete.order_by(
        Obsolescence.date_limite.is_(None), Obsolescence.date_limite
    ).all()
    return [obsolescence_read(o) for o in resultats]


@router.get("/composants", response_model=list[str])
def lister_composants(db: Session = Depends(get_db)):
    """Liste des composants distincts, pour alimenter les filtres et l'autocomplétion."""
    return sorted({c for (c,) in db.query(Obsolescence.composant).distinct().all()})


@router.get("/planning", response_model=PlanningObsolescences)
def planning(
    db: Session = Depends(get_db),
    horizon_mois: int = 18,
    actives_uniquement: bool = True,
):
    """Vue consolidée servant de trame au planning visuel du parc."""
    requete = db.query(Obsolescence)
    if actives_uniquement:
        requete = requete.filter(Obsolescence.statut.in_(OBSO_ACTIVES))
    obsolescences = requete.all()
    lues = [obsolescence_read(o) for o in obsolescences]

    aujourdhui = date.today()
    debut = min(
        [o.date_limite for o in obsolescences if o.date_limite] + [aujourdhui],
        default=aujourdhui,
    )
    fin = aujourdhui + timedelta(days=horizon_mois * 31)

    # ------------------------------------------------------ Regroupement par composant
    par_composant: dict[str, list] = defaultdict(list)
    for lue in lues:
        par_composant[lue.composant].append(lue)

    lignes_composant = []
    for nom, items in par_composant.items():
        echeances = [i.date_limite for i in items if i.date_limite]
        lignes_composant.append(
            LigneComposant(
                composant=nom,
                nb_applications=len({i.application_id for i in items}),
                nb_en_retard=sum(1 for i in items if i.en_retard),
                echeance_la_plus_proche=min(echeances) if echeances else None,
                obsolescences=sorted(items, key=lambda i: i.date_limite or date.max),
            )
        )
    lignes_composant.sort(
        key=lambda l: (l.echeance_la_plus_proche or date.max, -l.nb_applications)
    )

    # ------------------------------------------------------ Regroupement par application
    par_application: dict[int, list] = defaultdict(list)
    for lue in lues:
        par_application[lue.application_id].append(lue)

    lignes_application = []
    for app_id, items in par_application.items():
        app = db.get(Application, app_id)
        if not app:
            continue
        lignes_application.append(
            LigneApplicationObso(
                application_id=app.id,
                code=app.code,
                nom=app.nom,
                criticite=app.criticite,
                nb_en_retard=sum(1 for i in items if i.en_retard),
                obsolescences=sorted(items, key=lambda i: i.date_limite or date.max),
            )
        )
    lignes_application.sort(
        key=lambda l: (-l.nb_en_retard, ORDRE_CRITICITE.get(l.criticite, 9), l.code)
    )

    return PlanningObsolescences(
        debut=debut,
        fin=fin,
        nb_obsolescences=len(lues),
        nb_en_retard=sum(1 for i in lues if i.en_retard),
        nb_sans_echeance=sum(1 for i in lues if not i.date_limite),
        par_composant=lignes_composant,
        par_application=lignes_application,
    )


@router.post("", response_model=ObsolescenceRead, status_code=201)
def creer(payload: ObsolescenceCreate, db: Session = Depends(get_db)):
    if not db.get(Application, payload.application_id):
        raise HTTPException(status_code=404, detail="Application introuvable.")
    obso = Obsolescence(**payload.model_dump())
    db.add(obso)
    db.commit()
    db.refresh(obso)
    return obsolescence_read(obso)


@router.get("/{obso_id}", response_model=ObsolescenceRead)
def obtenir(obso_id: int, db: Session = Depends(get_db)):
    obso = db.get(Obsolescence, obso_id)
    if not obso:
        raise HTTPException(status_code=404, detail="Obsolescence introuvable.")
    return obsolescence_read(obso)


@router.put("/{obso_id}", response_model=ObsolescenceRead)
def modifier(obso_id: int, payload: ObsolescenceUpdate, db: Session = Depends(get_db)):
    obso = db.get(Obsolescence, obso_id)
    if not obso:
        raise HTTPException(status_code=404, detail="Obsolescence introuvable.")
    for cle, valeur in payload.model_dump(exclude_unset=True).items():
        setattr(obso, cle, valeur)
    db.commit()
    db.refresh(obso)
    return obsolescence_read(obso)


@router.delete("/{obso_id}", status_code=204)
def supprimer(obso_id: int, db: Session = Depends(get_db)):
    obso = db.get(Obsolescence, obso_id)
    if not obso:
        raise HTTPException(status_code=404, detail="Obsolescence introuvable.")
    db.delete(obso)
    db.commit()
