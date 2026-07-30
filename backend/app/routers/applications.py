"""Endpoints du parc applicatif."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.recurrence import libelle_recurrence
from ..models import (
    Application,
    Criticite,
    DispositifSecurite,
    Document,
    Dojo,
    Flux,
    PlageMaintenance,
    StatutApplication,
)
from ..schemas import (
    ApplicationCreate,
    DojoCreate,
    DojoRead,
    ApplicationDetail,
    ApplicationRead,
    ApplicationUpdate,
    DispositifCreate,
    DispositifRead,
    DocumentCreate,
    DocumentRead,
    FluxCreate,
    FluxRead,
    PlageCreate,
    PlageRead,
)
from ..serializers import application_detail, application_read, flux_read

router = APIRouter(prefix="/api/applications", tags=["Applications"])


def _get_app(db: Session, app_id: int) -> Application:
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application introuvable.")
    return app


@router.get("", response_model=list[ApplicationRead])
def lister_applications(
    db: Session = Depends(get_db),
    recherche: str | None = Query(None, description="Recherche globale code / nom / responsable"),
    statut: StatutApplication | None = None,
    criticite: Criticite | None = None,
    editeur_id: int | None = None,
):
    requete = db.query(Application)
    if recherche:
        motif = f"%{recherche.lower()}%"
        requete = requete.filter(
            or_(
                Application.code.ilike(motif),
                Application.nom.ilike(motif),
                Application.responsable_nom.ilike(motif),
                Application.equipe.ilike(motif),
                Application.description.ilike(motif),
            )
        )
    if statut:
        requete = requete.filter(Application.statut == statut)
    if criticite:
        requete = requete.filter(Application.criticite == criticite)
    if editeur_id:
        requete = requete.filter(Application.editeur_id == editeur_id)
    return [application_read(a) for a in requete.order_by(Application.code).all()]


@router.post("", response_model=ApplicationDetail, status_code=201)
def creer_application(payload: ApplicationCreate, db: Session = Depends(get_db)):
    if db.query(Application).filter(Application.code == payload.code).first():
        raise HTTPException(status_code=409, detail=f"Le code {payload.code} est déjà utilisé.")
    app = Application(**payload.model_dump())
    db.add(app)
    db.commit()
    db.refresh(app)
    return application_detail(app)


@router.get("/{app_id}", response_model=ApplicationDetail)
def obtenir_application(app_id: int, db: Session = Depends(get_db)):
    return application_detail(_get_app(db, app_id))


@router.put("/{app_id}", response_model=ApplicationDetail)
def modifier_application(app_id: int, payload: ApplicationUpdate, db: Session = Depends(get_db)):
    app = _get_app(db, app_id)
    donnees = payload.model_dump(exclude_unset=True)
    if "code" in donnees and donnees["code"] != app.code:
        if db.query(Application).filter(Application.code == donnees["code"]).first():
            raise HTTPException(status_code=409, detail="Ce code est déjà utilisé.")
    for cle, valeur in donnees.items():
        setattr(app, cle, valeur)
    db.commit()
    db.refresh(app)
    return application_detail(app)


@router.delete("/{app_id}", status_code=204)
def supprimer_application(app_id: int, db: Session = Depends(get_db)):
    db.delete(_get_app(db, app_id))
    db.commit()


# ------------------------------------------------------------------ Plages
@router.get("/{app_id}/plages", response_model=list[PlageRead])
def lister_plages(app_id: int, db: Session = Depends(get_db)):
    return _get_app(db, app_id).plages


@router.post("/{app_id}/plages", response_model=PlageRead, status_code=201)
def ajouter_plage(app_id: int, payload: PlageCreate, db: Session = Depends(get_db)):
    _get_app(db, app_id)
    plage = PlageMaintenance(application_id=app_id, **payload.model_dump())
    db.add(plage)
    db.commit()
    db.refresh(plage)
    return plage


@router.put("/{app_id}/plages/{plage_id}", response_model=PlageRead)
def modifier_plage(app_id: int, plage_id: int, payload: PlageCreate, db: Session = Depends(get_db)):
    plage = db.get(PlageMaintenance, plage_id)
    if not plage or plage.application_id != app_id:
        raise HTTPException(status_code=404, detail="Plage introuvable.")
    for cle, valeur in payload.model_dump().items():
        setattr(plage, cle, valeur)
    db.commit()
    db.refresh(plage)
    return plage


@router.delete("/{app_id}/plages/{plage_id}", status_code=204)
def supprimer_plage(app_id: int, plage_id: int, db: Session = Depends(get_db)):
    plage = db.get(PlageMaintenance, plage_id)
    if not plage or plage.application_id != app_id:
        raise HTTPException(status_code=404, detail="Plage introuvable.")
    db.delete(plage)
    db.commit()


# ------------------------------------------------------------------ Flux
@router.post("/{app_id}/flux", response_model=FluxRead, status_code=201)
def ajouter_flux(app_id: int, payload: FluxCreate, db: Session = Depends(get_db)):
    _get_app(db, app_id)
    flux = Flux(application_id=app_id, **payload.model_dump())
    db.add(flux)
    db.commit()
    db.refresh(flux)
    return flux_read(flux)


@router.put("/{app_id}/flux/{flux_id}", response_model=FluxRead)
def modifier_flux(app_id: int, flux_id: int, payload: FluxCreate, db: Session = Depends(get_db)):
    flux = db.get(Flux, flux_id)
    if not flux or flux.application_id != app_id:
        raise HTTPException(status_code=404, detail="Flux introuvable.")
    for cle, valeur in payload.model_dump().items():
        setattr(flux, cle, valeur)
    db.commit()
    db.refresh(flux)
    return flux_read(flux)


@router.delete("/{app_id}/flux/{flux_id}", status_code=204)
def supprimer_flux(app_id: int, flux_id: int, db: Session = Depends(get_db)):
    flux = db.get(Flux, flux_id)
    if not flux or flux.application_id != app_id:
        raise HTTPException(status_code=404, detail="Flux introuvable.")
    db.delete(flux)
    db.commit()


# ------------------------------------------------------------------ Documentation
@router.post("/{app_id}/documents", response_model=DocumentRead, status_code=201)
def ajouter_document(app_id: int, payload: DocumentCreate, db: Session = Depends(get_db)):
    _get_app(db, app_id)
    doc = Document(application_id=app_id, **payload.model_dump())
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.put("/{app_id}/documents/{doc_id}", response_model=DocumentRead)
def modifier_document(app_id: int, doc_id: int, payload: DocumentCreate, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc or doc.application_id != app_id:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    for cle, valeur in payload.model_dump().items():
        setattr(doc, cle, valeur)
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/{app_id}/documents/{doc_id}", status_code=204)
def supprimer_document(app_id: int, doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc or doc.application_id != app_id:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    db.delete(doc)
    db.commit()


# ------------------------------------------------------------------ Dispositifs de sécurité
@router.post("/{app_id}/dispositifs", response_model=DispositifRead, status_code=201)
def ajouter_dispositif(app_id: int, payload: DispositifCreate, db: Session = Depends(get_db)):
    _get_app(db, app_id)
    dispositif = DispositifSecurite(application_id=app_id, **payload.model_dump())
    db.add(dispositif)
    db.commit()
    db.refresh(dispositif)
    return dispositif


@router.put("/{app_id}/dispositifs/{dispositif_id}", response_model=DispositifRead)
def modifier_dispositif(
    app_id: int, dispositif_id: int, payload: DispositifCreate, db: Session = Depends(get_db)
):
    dispositif = db.get(DispositifSecurite, dispositif_id)
    if not dispositif or dispositif.application_id != app_id:
        raise HTTPException(status_code=404, detail="Dispositif introuvable.")
    for cle, valeur in payload.model_dump().items():
        setattr(dispositif, cle, valeur)
    db.commit()
    db.refresh(dispositif)
    return dispositif


@router.delete("/{app_id}/dispositifs/{dispositif_id}", status_code=204)
def supprimer_dispositif(app_id: int, dispositif_id: int, db: Session = Depends(get_db)):
    dispositif = db.get(DispositifSecurite, dispositif_id)
    if not dispositif or dispositif.application_id != app_id:
        raise HTTPException(status_code=404, detail="Dispositif introuvable.")
    db.delete(dispositif)
    db.commit()


# ------------------------------------------------------------------ DoJo (procédures filmées)
@router.get("/{app_id}/dojos", response_model=list[DojoRead])
def lister_dojos(app_id: int, db: Session = Depends(get_db)):
    return _get_app(db, app_id).dojos


@router.post("/{app_id}/dojos", response_model=DojoRead, status_code=201)
def ajouter_dojo(app_id: int, payload: DojoCreate, db: Session = Depends(get_db)):
    _get_app(db, app_id)
    dojo = Dojo(application_id=app_id, **payload.model_dump())
    db.add(dojo)
    db.commit()
    db.refresh(dojo)
    return dojo


@router.put("/{app_id}/dojos/{dojo_id}", response_model=DojoRead)
def modifier_dojo(app_id: int, dojo_id: int, payload: DojoCreate, db: Session = Depends(get_db)):
    dojo = db.get(Dojo, dojo_id)
    if not dojo or dojo.application_id != app_id:
        raise HTTPException(status_code=404, detail="DoJo introuvable.")
    for cle, valeur in payload.model_dump().items():
        setattr(dojo, cle, valeur)
    db.commit()
    db.refresh(dojo)
    return dojo


@router.delete("/{app_id}/dojos/{dojo_id}", status_code=204)
def supprimer_dojo(app_id: int, dojo_id: int, db: Session = Depends(get_db)):
    dojo = db.get(Dojo, dojo_id)
    if not dojo or dojo.application_id != app_id:
        raise HTTPException(status_code=404, detail="DoJo introuvable.")
    db.delete(dojo)
    db.commit()


@router.get("/{app_id}/cartographie", tags=["Applications"])
def cartographie_flux(app_id: int, db: Session = Depends(get_db)):
    """Données de la cartographie des échanges : l'application au centre,
    ses partenaires en entrée à gauche et en sortie à droite."""
    app = _get_app(db, app_id)
    entrants, sortants, bidirectionnels = [], [], []
    for flux in app.flux:
        noeud = {
            "id": flux.id,
            "nom": flux.nom,
            "sens": flux.sens.value,
            "frequence": flux.frequence.value,
            "recurrence": libelle_recurrence(flux),
            "heure": flux.heure,
            "jour": flux.jour,
            "protocole": flux.protocole,
            "bloquant": flux.bloquant,
            "partenaire": flux.partenaire.nom if flux.partenaire else "Interne",
            "partenaire_id": flux.partenaire_id,
        }
        if flux.sens.value == "ENTRANT":
            entrants.append(noeud)
        elif flux.sens.value == "SORTANT":
            sortants.append(noeud)
        else:
            bidirectionnels.append(noeud)
    return {
        "application": {"id": app.id, "code": app.code, "nom": app.nom,
                        "criticite": app.criticite.value, "statut": app.statut.value},
        "entrants": entrants,
        "sortants": sortants,
        "bidirectionnels": bidirectionnels,
        "nb_bloquants": sum(1 for f in app.flux if f.bloquant),
    }
