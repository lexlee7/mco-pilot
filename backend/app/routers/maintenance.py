"""Moteur de recherche de créneaux de maintenance communs."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Application, StatutApplication
from ..schemas import RechercheePlageRequest, RechercheePlageResponse
from ..services.slot_engine import rechercher_creneaux

router = APIRouter(prefix="/api/maintenance", tags=["Plages de maintenance"])


@router.post("/recherche", response_model=RechercheePlageResponse)
def rechercher(payload: RechercheePlageRequest, db: Session = Depends(get_db)):
    requete = db.query(Application).filter(
        Application.statut != StatutApplication.DECOMMISSIONNEE
    )
    if not payload.tout_le_parc:
        requete = requete.filter(Application.id.in_(payload.application_ids or [-1]))
    apps = requete.order_by(Application.code).all()

    creneaux, message = rechercher_creneaux(
        apps,
        duree_minutes=payload.duree_minutes,
        tolerance_conflits=payload.tolerance_conflits,
        jours_autorises=payload.jours_autorises,
        heure_min=payload.heure_min,
        heure_max=payload.heure_max,
    )
    return RechercheePlageResponse(
        nb_applications=len(apps),
        duree_demandee=payload.duree_minutes,
        tolerance=payload.tolerance_conflits,
        creneaux=creneaux,
        message=message,
    )


@router.get("/couverture")
def couverture_hebdomadaire(db: Session = Depends(get_db)):
    """Heatmap : nombre d'applications arrêtables pour chaque heure de la semaine."""
    from ..services.slot_engine import CRENEAUX_PAR_JOUR, construire_masque

    apps = db.query(Application).filter(
        Application.statut != StatutApplication.DECOMMISSIONNEE
    ).all()
    masques = [construire_masque(a) for a in apps]
    grille = []
    for jour in range(7):
        ligne = []
        for heure in range(24):
            debut = jour * CRENEAUX_PAR_JOUR + heure * 4
            nb = sum(1 for m in masques if all(m.disponible[debut + o] for o in range(4)))
            ligne.append(nb)
        grille.append(ligne)
    return {"nb_applications": len(apps), "grille": grille}
