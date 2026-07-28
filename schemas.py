"""Référentiel centralisé des éditeurs, intégrateurs et partenaires de flux."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Partenaire, TypePartenaire
from ..schemas import PartenaireCreate, PartenaireRead

router = APIRouter(prefix="/api/partenaires", tags=["Partenaires"])


@router.get("", response_model=list[PartenaireRead])
def lister(
    db: Session = Depends(get_db),
    recherche: str | None = None,
    type: TypePartenaire | None = None,
):
    requete = db.query(Partenaire)
    if recherche:
        motif = f"%{recherche.lower()}%"
        requete = requete.filter(
            or_(
                Partenaire.nom.ilike(motif),
                Partenaire.contact_nom.ilike(motif),
                Partenaire.contact_email.ilike(motif),
            )
        )
    if type:
        requete = requete.filter(Partenaire.type == type)
    return requete.order_by(Partenaire.nom).all()


@router.post("", response_model=PartenaireRead, status_code=201)
def creer(payload: PartenaireCreate, db: Session = Depends(get_db)):
    partenaire = Partenaire(**payload.model_dump())
    db.add(partenaire)
    db.commit()
    db.refresh(partenaire)
    return partenaire


@router.get("/{partenaire_id}", response_model=PartenaireRead)
def obtenir(partenaire_id: int, db: Session = Depends(get_db)):
    partenaire = db.get(Partenaire, partenaire_id)
    if not partenaire:
        raise HTTPException(status_code=404, detail="Partenaire introuvable.")
    return partenaire


@router.put("/{partenaire_id}", response_model=PartenaireRead)
def modifier(partenaire_id: int, payload: PartenaireCreate, db: Session = Depends(get_db)):
    partenaire = db.get(Partenaire, partenaire_id)
    if not partenaire:
        raise HTTPException(status_code=404, detail="Partenaire introuvable.")
    for cle, valeur in payload.model_dump().items():
        setattr(partenaire, cle, valeur)
    db.commit()
    db.refresh(partenaire)
    return partenaire


@router.delete("/{partenaire_id}", status_code=204)
def supprimer(partenaire_id: int, db: Session = Depends(get_db)):
    partenaire = db.get(Partenaire, partenaire_id)
    if not partenaire:
        raise HTTPException(status_code=404, detail="Partenaire introuvable.")
    db.delete(partenaire)
    db.commit()
