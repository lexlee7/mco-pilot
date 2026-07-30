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
    CommunicationDetail,
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


def _substituer(corps: str, sujet: str, applications: list[Application]) -> tuple[str, str]:
    """Remplace les variables dans le corps ET dans l'objet.

    L'objet était auparavant expédié tel quel : les destinataires recevaient un
    message dont le titre affichait encore la variable brute.

    Avec plusieurs applications, les noms sont énumérés ; les variables au
    singulier reprennent alors la liste complète, afin qu'aucun destinataire ne
    croie qu'un seul périmètre est concerné.
    """
    noms = ", ".join(a.nom for a in applications)
    codes = ", ".join(a.code for a in applications)
    responsables = ", ".join(
        sorted({a.responsable_nom for a in applications if a.responsable_nom})
    )
    maintenant = datetime.now()
    valeurs = {
        "{{application}}": noms or "[application]",
        "{{applications}}": noms or "[applications]",
        "{{code_application}}": codes or "[code]",
        "{{responsable}}": responsables,
        "{{date}}": maintenant.strftime("%d/%m/%Y"),
        "{{heure}}": maintenant.strftime("%H:%M"),
    }
    for cle, valeur in valeurs.items():
        corps = corps.replace(cle, valeur)
        sujet = sujet.replace(cle, valeur)
    return corps, sujet


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

    applications = (
        db.query(Application).filter(Application.id.in_(payload.application_ids)).all()
        if payload.application_ids
        else []
    )
    corps, sujet = _substituer(payload.corps_html, payload.sujet, applications)

    if payload.test_uniquement:
        return EnvoiCommunicationResponse(
            statut="APERCU",
            nb_destinataires=len(destinataires),
            destinataires=destinataires,
            detail=(
                "Aperçu : aucun message n'a été expédié. "
                f"Objet tel qu'il partira : « {sujet} »"
            ),
        )

    statut, detail = envoyer_email(destinataires, sujet, corps)
    db.add(
        Communication(
            sujet=sujet,
            corps_html=corps,
            destinataires="; ".join(destinataires),
            application_id=applications[0].id if applications else None,
            applications_codes=", ".join(a.code for a in applications) or None,
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


@router.get("/historique/{communication_id}", response_model=CommunicationDetail)
def consulter(communication_id: int, db: Session = Depends(get_db)):
    """Message archivé tel qu'il a été expédié, corps HTML compris."""
    message = db.get(Communication, communication_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message introuvable.")
    return message


@router.get("/historique", response_model=list[CommunicationRead])
def historique(db: Session = Depends(get_db), limite: int = 50):
    return (
        db.query(Communication)
        .order_by(Communication.envoye_le.desc())
        .limit(limite)
        .all()
    )
