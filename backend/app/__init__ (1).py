"""Pilotage des vulnérabilités et des relances associées."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Application,
    Gravite,
    StatutVulnerabilite,
    Vulnerabilite,
    VulnerabiliteApplication,
)
from ..schemas import VulnerabiliteCreate, VulnerabiliteRead, VulnerabiliteUpdate
from ..serializers import vulnerabilite_read
from ..services.relances import recapitulatif_hebdomadaire, relancer_responsables

router = APIRouter(prefix="/api/vulnerabilites", tags=["Vulnérabilités"])


def _appliquer_liens(db: Session, vuln: Vulnerabilite, liens: list) -> None:
    vuln.liens.clear()
    db.flush()
    for lien in liens:
        if not db.get(Application, lien.application_id):
            raise HTTPException(
                status_code=400, detail=f"Application {lien.application_id} introuvable."
            )
        vuln.liens.append(
            VulnerabiliteApplication(
                application_id=lien.application_id,
                statut=lien.statut,
                version_installee=lien.version_installee,
                date_correction_prevue=lien.date_correction_prevue,
                commentaire=lien.commentaire,
            )
        )


@router.get("", response_model=list[VulnerabiliteRead])
def lister(
    db: Session = Depends(get_db),
    recherche: str | None = None,
    gravite: Gravite | None = None,
    statut: StatutVulnerabilite | None = None,
    application_id: int | None = Query(None),
    hors_delai: bool = False,
):
    requete = db.query(Vulnerabilite)
    if recherche:
        motif = f"%{recherche.lower()}%"
        requete = requete.filter(
            or_(
                Vulnerabilite.reference.ilike(motif),
                Vulnerabilite.titre.ilike(motif),
                Vulnerabilite.composant.ilike(motif),
            )
        )
    if gravite:
        requete = requete.filter(Vulnerabilite.gravite == gravite)
    if statut:
        requete = requete.filter(Vulnerabilite.statut == statut)
    if hors_delai:
        requete = requete.filter(
            Vulnerabilite.date_echeance.isnot(None),
            Vulnerabilite.date_echeance < date.today(),
            Vulnerabilite.statut.in_([StatutVulnerabilite.OUVERTE, StatutVulnerabilite.EN_COURS]),
        )
    if application_id:
        requete = requete.join(VulnerabiliteApplication).filter(
            VulnerabiliteApplication.application_id == application_id
        )
    resultats = requete.order_by(Vulnerabilite.date_detection.desc()).all()
    return [vulnerabilite_read(v) for v in resultats]


@router.post("", response_model=VulnerabiliteRead, status_code=201)
def creer(payload: VulnerabiliteCreate, db: Session = Depends(get_db)):
    donnees = payload.model_dump(exclude={"applications"})
    donnees["date_detection"] = donnees.get("date_detection") or date.today()
    vuln = Vulnerabilite(**donnees)
    db.add(vuln)
    db.flush()
    _appliquer_liens(db, vuln, payload.applications)
    db.commit()
    db.refresh(vuln)
    return vulnerabilite_read(vuln)


@router.get("/{vuln_id}", response_model=VulnerabiliteRead)
def obtenir(vuln_id: int, db: Session = Depends(get_db)):
    vuln = db.get(Vulnerabilite, vuln_id)
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnérabilité introuvable.")
    return vulnerabilite_read(vuln)


@router.put("/{vuln_id}", response_model=VulnerabiliteRead)
def modifier(vuln_id: int, payload: VulnerabiliteUpdate, db: Session = Depends(get_db)):
    vuln = db.get(Vulnerabilite, vuln_id)
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnérabilité introuvable.")
    donnees = payload.model_dump(exclude_unset=True, exclude={"applications"})
    for cle, valeur in donnees.items():
        setattr(vuln, cle, valeur)
    if payload.applications is not None:
        _appliquer_liens(db, vuln, payload.applications)
    db.commit()
    db.refresh(vuln)
    return vulnerabilite_read(vuln)


@router.delete("/{vuln_id}", status_code=204)
def supprimer(vuln_id: int, db: Session = Depends(get_db)):
    vuln = db.get(Vulnerabilite, vuln_id)
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnérabilité introuvable.")
    db.delete(vuln)
    db.commit()


@router.patch("/{vuln_id}/applications/{app_id}", response_model=VulnerabiliteRead)
def mettre_a_jour_avancement(
    vuln_id: int,
    app_id: int,
    statut: StatutVulnerabilite,
    db: Session = Depends(get_db),
    commentaire: str | None = None,
):
    """Met à jour l'avancement du correctif pour une application donnée."""
    lien = (
        db.query(VulnerabiliteApplication)
        .filter(
            VulnerabiliteApplication.vulnerabilite_id == vuln_id,
            VulnerabiliteApplication.application_id == app_id,
        )
        .first()
    )
    if not lien:
        raise HTTPException(status_code=404, detail="Association introuvable.")
    lien.statut = statut
    if commentaire is not None:
        lien.commentaire = commentaire
    db.commit()
    vuln = db.get(Vulnerabilite, vuln_id)
    # Le statut global suit l'état le moins avancé des applications concernées.
    statuts = {l.statut for l in vuln.liens}
    if statuts and statuts <= {StatutVulnerabilite.CORRIGEE, StatutVulnerabilite.FAUX_POSITIF}:
        vuln.statut = StatutVulnerabilite.CORRIGEE
    elif StatutVulnerabilite.OUVERTE in statuts:
        vuln.statut = StatutVulnerabilite.OUVERTE
    elif StatutVulnerabilite.EN_COURS in statuts:
        vuln.statut = StatutVulnerabilite.EN_COURS
    db.commit()
    db.refresh(vuln)
    return vulnerabilite_read(vuln)


@router.post("/relances/declencher", tags=["Relances"])
def declencher_relances(db: Session = Depends(get_db), horizon_jours: int = 7):
    """Relance immédiate des responsables applicatifs (utile pour tester)."""
    return relancer_responsables(db, horizon_jours=horizon_jours)


@router.post("/relances/recapitulatif", tags=["Relances"])
def declencher_recapitulatif(db: Session = Depends(get_db)):
    """Envoi immédiat du récapitulatif hebdomadaire."""
    return recapitulatif_hebdomadaire(db)
