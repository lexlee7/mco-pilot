"""Gestion transverse des flux du parc applicatif.

Le besoin auquel répond ce module : évaluer l'impact d'une opération ou d'un
incident. « Qui vais-je pénaliser si j'arrête cette application mercredi soir ? »,
« quels échanges passent chez ce partenaire entre 18h et 20h ? ». Ces questions
se posent sur l'ensemble du parc, pas application par application.
"""
from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Application, Flux, FrequenceFlux, SensFlux, TypeRecurrence
from ..schemas import FluxGlobalCreate, FluxRead, OccurrenceFlux
from ..serializers import flux_read
from ..services.recurrence import occurrences

router = APIRouter(prefix="/api/flux", tags=["Gestion des flux"])


def _en_minutes(heure: str | None) -> int | None:
    if not heure or ":" not in heure:
        return None
    h, m = heure.split(":")[:2]
    return int(h) * 60 + int(m)


@router.get("", response_model=list[FluxRead])
def lister(
    db: Session = Depends(get_db),
    recherche: str | None = Query(None, description="Nom du flux, protocole ou description"),
    application_id: int | None = None,
    partenaire_id: int | None = None,
    sens: SensFlux | None = None,
    frequence: FrequenceFlux | None = None,
    recurrence: TypeRecurrence | None = None,
    protocole: str | None = None,
    bloquant: bool | None = None,
    heure_min: str | None = Query(None, description="Borne basse, format HH:MM"),
    heure_max: str | None = Query(None, description="Borne haute, format HH:MM"),
    jour_semaine: int | None = Query(None, ge=0, le=6),
):
    requete = db.query(Flux)
    if recherche:
        motif = f"%{recherche.lower()}%"
        requete = requete.filter(
            or_(
                Flux.nom.ilike(motif),
                Flux.protocole.ilike(motif),
                Flux.description.ilike(motif),
                Flux.jour.ilike(motif),
            )
        )
    if application_id:
        requete = requete.filter(Flux.application_id == application_id)
    if partenaire_id:
        requete = requete.filter(Flux.partenaire_id == partenaire_id)
    if sens:
        requete = requete.filter(Flux.sens == sens)
    if frequence:
        requete = requete.filter(Flux.frequence == frequence)
    if recurrence:
        requete = requete.filter(Flux.recurrence == recurrence)
    if protocole:
        requete = requete.filter(Flux.protocole.ilike(f"%{protocole}%"))
    if bloquant is not None:
        requete = requete.filter(Flux.bloquant == bloquant)

    resultats = requete.all()

    # Le filtrage horaire et calendaire se fait en Python : il dépend de la
    # récurrence, que le SQL ne sait pas interpréter simplement.
    borne_basse, borne_haute = _en_minutes(heure_min), _en_minutes(heure_max)
    if borne_basse is not None or borne_haute is not None:
        gardes = []
        for flux in resultats:
            instant = _en_minutes(flux.heure)
            if instant is None:
                # Un flux continu ou horaire tombe forcément dans la fenêtre.
                if flux.recurrence in (TypeRecurrence.TEMPS_REEL, TypeRecurrence.HORAIRE):
                    gardes.append(flux)
                continue
            if borne_basse is not None and borne_haute is not None:
                dedans = (
                    borne_basse <= instant <= borne_haute
                    if borne_basse <= borne_haute
                    else instant >= borne_basse or instant <= borne_haute
                )
            elif borne_basse is not None:
                dedans = instant >= borne_basse
            else:
                dedans = instant <= (borne_haute or 0)
            if dedans:
                gardes.append(flux)
        resultats = gardes

    if jour_semaine is not None:
        horizon_debut = date.today()
        horizon_fin = horizon_debut + timedelta(days=62)
        resultats = [
            f
            for f in resultats
            if any(
                datetime.fromisoformat(o["horodatage"]).weekday() == jour_semaine
                for o in occurrences(f, horizon_debut, horizon_fin)
            )
        ]

    resultats.sort(key=lambda f: (f.heure or "99:99", f.nom))
    return [flux_read(f) for f in resultats]


@router.get("/synthese")
def synthese(db: Session = Depends(get_db)):
    """Compteurs utiles pour situer le parc d'échanges en un coup d'œil."""
    flux = db.query(Flux).all()
    return {
        "nb_flux": len(flux),
        "nb_bloquants": sum(1 for f in flux if f.bloquant),
        "nb_applications_concernees": len({f.application_id for f in flux}),
        "nb_partenaires_concernes": len({f.partenaire_id for f in flux if f.partenaire_id}),
        "par_sens": [
            {"cle": cle, "valeur": valeur}
            for cle, valeur in Counter(f.sens.value for f in flux).items()
        ],
        "par_recurrence": [
            {"cle": cle, "valeur": valeur}
            for cle, valeur in Counter(f.recurrence.value for f in flux).items()
        ],
    }


@router.get("/occurrences", response_model=list[OccurrenceFlux])
def projeter(
    db: Session = Depends(get_db),
    debut: date | None = None,
    nb_jours: int = Query(14, ge=1, le=180),
    application_id: int | None = None,
    partenaire_id: int | None = None,
    bloquant_uniquement: bool = False,
):
    """Occurrences datées des flux : la trame d'une analyse d'impact."""
    depart = debut or date.today()
    arrivee = depart + timedelta(days=nb_jours - 1)

    requete = db.query(Flux)
    if application_id:
        requete = requete.filter(Flux.application_id == application_id)
    if partenaire_id:
        requete = requete.filter(Flux.partenaire_id == partenaire_id)
    if bloquant_uniquement:
        requete = requete.filter(Flux.bloquant.is_(True))

    resultat: list[dict] = []
    for flux in requete.all():
        resultat.extend(occurrences(flux, depart, arrivee))
    resultat.sort(key=lambda o: o["horodatage"])
    return resultat


@router.post("", response_model=FluxRead, status_code=201)
def creer(payload: FluxGlobalCreate, db: Session = Depends(get_db)):
    if not db.get(Application, payload.application_id):
        raise HTTPException(status_code=404, detail="Application introuvable.")
    flux = Flux(**payload.model_dump())
    db.add(flux)
    db.commit()
    db.refresh(flux)
    return flux_read(flux)


@router.put("/{flux_id}", response_model=FluxRead)
def modifier(flux_id: int, payload: FluxGlobalCreate, db: Session = Depends(get_db)):
    flux = db.get(Flux, flux_id)
    if not flux:
        raise HTTPException(status_code=404, detail="Flux introuvable.")
    for cle, valeur in payload.model_dump().items():
        setattr(flux, cle, valeur)
    db.commit()
    db.refresh(flux)
    return flux_read(flux)


@router.delete("/{flux_id}", status_code=204)
def supprimer(flux_id: int, db: Session = Depends(get_db)):
    flux = db.get(Flux, flux_id)
    if not flux:
        raise HTTPException(status_code=404, detail="Flux introuvable.")
    db.delete(flux)
    db.commit()
