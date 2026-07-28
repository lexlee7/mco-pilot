"""Communication de crise : listes de diffusion, modèles HTML et envoi assisté."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Application,
    Communication,
    ListeDiffusion,
    TemplateCommunication,
)
from ..schemas import (
    CommunicationRead,
    EnvoiCommunicationRequest,
    EnvoiCommunicationResponse,
    ListeDiffusionCreate,
    ListeDiffusionRead,
    TemplateCreate,
    TemplateRead,
)
from ..services.mailer import envoyer_email, mode_simulation

router = APIRouter(prefix="/api/communication", tags=["Communication de crise"])


def _liste_read(liste: ListeDiffusion) -> ListeDiffusionRead:
    data = ListeDiffusionRead.model_validate(liste)
    data.nb_destinataires = len(liste.emails())
    return data


# ------------------------------------------------------------- Listes de diffusion
@router.get("/listes", response_model=list[ListeDiffusionRead])
def lister_listes(db: Session = Depends(get_db)):
    return [_liste_read(l) for l in db.query(ListeDiffusion).order_by(ListeDiffusion.nom).all()]


@router.post("/listes", response_model=ListeDiffusionRead, status_code=201)
def creer_liste(payload: ListeDiffusionCreate, db: Session = Depends(get_db)):
    if db.query(ListeDiffusion).filter(ListeDiffusion.nom == payload.nom).first():
        raise HTTPException(status_code=409, detail="Une liste porte déjà ce nom.")
    liste = ListeDiffusion(**payload.model_dump())
    db.add(liste)
    db.commit()
    db.refresh(liste)
    return _liste_read(liste)


@router.put("/listes/{liste_id}", response_model=ListeDiffusionRead)
def modifier_liste(liste_id: int, payload: ListeDiffusionCreate, db: Session = Depends(get_db)):
    liste = db.get(ListeDiffusion, liste_id)
    if not liste:
        raise HTTPException(status_code=404, detail="Liste introuvable.")
    for cle, valeur in payload.model_dump().items():
        setattr(liste, cle, valeur)
    db.commit()
    db.refresh(liste)
    return _liste_read(liste)


@router.delete("/listes/{liste_id}", status_code=204)
def supprimer_liste(liste_id: int, db: Session = Depends(get_db)):
    liste = db.get(ListeDiffusion, liste_id)
    if not liste:
        raise HTTPException(status_code=404, detail="Liste introuvable.")
    db.delete(liste)
    db.commit()


# ------------------------------------------------------------- Modèles de message
@router.get("/templates", response_model=list[TemplateRead])
def lister_templates(db: Session = Depends(get_db)):
    return db.query(TemplateCommunication).order_by(TemplateCommunication.nom).all()


@router.post("/templates", response_model=TemplateRead, status_code=201)
def creer_template(payload: TemplateCreate, db: Session = Depends(get_db)):
    if db.query(TemplateCommunication).filter(TemplateCommunication.nom == payload.nom).first():
        raise HTTPException(status_code=409, detail="Un modèle porte déjà ce nom.")
    template = TemplateCommunication(**payload.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.put("/templates/{template_id}", response_model=TemplateRead)
def modifier_template(template_id: int, payload: TemplateCreate, db: Session = Depends(get_db)):
    template = db.get(TemplateCommunication, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Modèle introuvable.")
    for cle, valeur in payload.model_dump().items():
        setattr(template, cle, valeur)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/templates/{template_id}", status_code=204)
def supprimer_template(template_id: int, db: Session = Depends(get_db)):
    template = db.get(TemplateCommunication, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Modèle introuvable.")
    db.delete(template)
    db.commit()


# ------------------------------------------------------------- Envoi
@router.get("/etat-messagerie")
def etat_messagerie():
    return {
        "mode_simulation": mode_simulation(),
        "message": (
            "SMTP non configuré : les envois sont simulés et tracés dans l'historique."
            if mode_simulation()
            else "SMTP configuré : les messages partent réellement."
        ),
    }


@router.post("/envoyer", response_model=EnvoiCommunicationResponse)
def envoyer(payload: EnvoiCommunicationRequest, db: Session = Depends(get_db)):
    destinataires: list[str] = []
    for liste_id in payload.liste_ids:
        liste = db.get(ListeDiffusion, liste_id)
        if liste:
            destinataires.extend(liste.emails())
    supplementaires = (payload.destinataires_supplementaires or "").replace(",", ";").replace("\n", ";")
    destinataires.extend([e.strip() for e in supplementaires.split(";") if e.strip()])
    destinataires = sorted(set(destinataires))

    if not destinataires:
        raise HTTPException(status_code=400, detail="Aucun destinataire sélectionné.")

    corps = payload.corps_html
    if payload.application_id:
        app = db.get(Application, payload.application_id)
        if app:
            corps = (
                corps.replace("{{application}}", app.nom)
                .replace("{{code_application}}", app.code)
                .replace("{{responsable}}", app.responsable_nom or "")
            )
    corps = corps.replace("{{date}}", datetime.now().strftime("%d/%m/%Y")).replace(
        "{{heure}}", datetime.now().strftime("%H:%M")
    )

    if payload.test_uniquement:
        return EnvoiCommunicationResponse(
            statut="APERCU",
            nb_destinataires=len(destinataires),
            destinataires=destinataires,
            detail="Aperçu : aucun message n'a été expédié.",
        )

    statut, detail = envoyer_email(destinataires, payload.sujet, corps)
    db.add(
        Communication(
            sujet=payload.sujet,
            corps_html=corps,
            destinataires="; ".join(destinataires),
            application_id=payload.application_id,
            statut_envoi=statut,
            detail_envoi=detail,
        )
    )
    db.commit()
    return EnvoiCommunicationResponse(
        statut=statut,
        nb_destinataires=len(destinataires),
        destinataires=destinataires,
        detail=detail,
    )


@router.get("/historique", response_model=list[CommunicationRead])
def historique(db: Session = Depends(get_db), limite: int = 50):
    return (
        db.query(Communication)
        .order_by(Communication.envoye_le.desc())
        .limit(limite)
        .all()
    )
