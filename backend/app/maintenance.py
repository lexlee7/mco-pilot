"""Calendrier MCO : événements transverses et projection des plages hebdomadaires."""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Application, Evenement, StatutApplication, TypeEvenement
from ..schemas import EvenementCreate, EvenementRead

router = APIRouter(prefix="/api/evenements", tags=["Calendrier MCO"])


@router.get("", response_model=list[EvenementRead])
def lister(
    db: Session = Depends(get_db),
    debut: datetime | None = None,
    fin: datetime | None = None,
    type: TypeEvenement | None = None,
    application_id: int | None = None,
):
    requete = db.query(Evenement)
    if debut:
        requete = requete.filter(Evenement.fin >= debut)
    if fin:
        requete = requete.filter(Evenement.debut <= fin)
    if type:
        requete = requete.filter(Evenement.type == type)
    evenements = requete.order_by(Evenement.debut).all()
    if application_id:
        evenements = [e for e in evenements if any(a.id == application_id for a in e.applications)]
    return evenements


@router.post("", response_model=EvenementRead, status_code=201)
def creer(payload: EvenementCreate, db: Session = Depends(get_db)):
    if payload.fin <= payload.debut:
        raise HTTPException(status_code=400, detail="La fin doit être postérieure au début.")
    evenement = Evenement(**payload.model_dump(exclude={"application_ids"}))
    if payload.application_ids:
        evenement.applications = (
            db.query(Application).filter(Application.id.in_(payload.application_ids)).all()
        )
    db.add(evenement)
    db.commit()
    db.refresh(evenement)
    return evenement


@router.put("/{evenement_id}", response_model=EvenementRead)
def modifier(evenement_id: int, payload: EvenementCreate, db: Session = Depends(get_db)):
    evenement = db.get(Evenement, evenement_id)
    if not evenement:
        raise HTTPException(status_code=404, detail="Événement introuvable.")
    for cle, valeur in payload.model_dump(exclude={"application_ids"}).items():
        setattr(evenement, cle, valeur)
    evenement.applications = (
        db.query(Application).filter(Application.id.in_(payload.application_ids)).all()
        if payload.application_ids
        else []
    )
    db.commit()
    db.refresh(evenement)
    return evenement


@router.delete("/{evenement_id}", status_code=204)
def supprimer(evenement_id: int, db: Session = Depends(get_db)):
    evenement = db.get(Evenement, evenement_id)
    if not evenement:
        raise HTTPException(status_code=404, detail="Événement introuvable.")
    db.delete(evenement)
    db.commit()


@router.get("/plages/projection")
def projeter_plages(
    db: Session = Depends(get_db),
    debut: datetime | None = None,
    nb_jours: int = 28,
    application_id: int | None = None,
):
    """Transforme les plages hebdomadaires récurrentes en occurrences datées,
    afin de les afficher dans le calendrier au même titre que les événements."""
    origine = (debut or datetime.now()).replace(hour=0, minute=0, second=0, microsecond=0)
    requete = db.query(Application).filter(
        Application.statut != StatutApplication.DECOMMISSIONNEE
    )
    if application_id:
        requete = requete.filter(Application.id == application_id)

    occurrences = []
    for app in requete.all():
        for plage in app.plages:
            for offset in range(nb_jours):
                jour = origine + timedelta(days=offset)
                if jour.weekday() != plage.jour_semaine:
                    continue
                h_debut, m_debut = (int(x) for x in plage.heure_debut.split(":"))
                h_fin, m_fin = (int(x) for x in plage.heure_fin.split(":"))
                depart = jour.replace(hour=h_debut, minute=m_debut)
                arrivee = jour.replace(hour=h_fin, minute=m_fin)
                if arrivee <= depart:  # franchit minuit
                    arrivee += timedelta(days=1)
                occurrences.append(
                    {
                        "application_id": app.id,
                        "code": app.code,
                        "nom": app.nom,
                        "criticite": app.criticite,
                        "libelle": plage.libelle or "Plage de maintenance",
                        "debut": depart.isoformat(),
                        "fin": arrivee.isoformat(),
                    }
                )
    occurrences.sort(key=lambda o: o["debut"])
    return occurrences
