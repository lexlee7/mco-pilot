"""Relances automatiques sur les vulnérabilités.

Deux mécanismes :
1. Relance ciblée : chaque responsable applicatif reçoit la liste des failles
   ouvertes sur SES applications (échéance dépassée ou proche).
2. Récapitulatif hebdomadaire : vue consolidée du parc envoyée à une liste
   de diffusion nommée "Récapitulatif hebdomadaire MCO".
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..models import (
    Application,
    Gravite,
    ListeDiffusion,
    StatutVulnerabilite,
    Vulnerabilite,
    VulnerabiliteApplication,
)
from .mailer import envoyer_email

logger = logging.getLogger("mco.relances")

STATUTS_ACTIFS = (StatutVulnerabilite.OUVERTE, StatutVulnerabilite.EN_COURS)
ORDRE_GRAVITE = {
    Gravite.CRITIQUE: 0,
    Gravite.ELEVEE: 1,
    Gravite.MOYENNE: 2,
    Gravite.FAIBLE: 3,
}

STYLE_TABLE = (
    "border-collapse:collapse;width:100%;font-family:Segoe UI,Arial,sans-serif;font-size:13px"
)
STYLE_TH = "background:#16203a;color:#fff;text-align:left;padding:8px;border:1px solid #2a3654"
STYLE_TD = "padding:8px;border:1px solid #d7dced"

COULEUR_GRAVITE = {
    Gravite.CRITIQUE: "#c2273c",
    Gravite.ELEVEE: "#e07a1f",
    Gravite.MOYENNE: "#c9a227",
    Gravite.FAIBLE: "#5b7a8c",
}


def _lignes_vulnerabilites(db: Session) -> list[tuple[VulnerabiliteApplication, Vulnerabilite, Application]]:
    return (
        db.query(VulnerabiliteApplication, Vulnerabilite, Application)
        .join(Vulnerabilite, VulnerabiliteApplication.vulnerabilite_id == Vulnerabilite.id)
        .join(Application, VulnerabiliteApplication.application_id == Application.id)
        .filter(VulnerabiliteApplication.statut.in_(STATUTS_ACTIFS))
        .all()
    )


def _tableau_html(lignes: list[tuple[VulnerabiliteApplication, Vulnerabilite, Application]]) -> str:
    aujourdhui = date.today()
    lignes = sorted(lignes, key=lambda t: (ORDRE_GRAVITE.get(t[1].gravite, 9), t[1].date_detection))
    corps = []
    for lien, vuln, app in lignes:
        retard = ""
        if vuln.date_echeance:
            delta = (vuln.date_echeance - aujourdhui).days
            retard = (
                f"<strong style='color:#c2273c'>{abs(delta)} j de retard</strong>"
                if delta < 0
                else f"J-{delta}"
            )
        age = (aujourdhui - vuln.date_detection).days
        corps.append(
            f"<tr>"
            f"<td style='{STYLE_TD}'><strong>{app.code}</strong><br>{app.nom}</td>"
            f"<td style='{STYLE_TD}'>{vuln.reference}<br><span style='color:#5b6b8c'>{vuln.composant}</span></td>"
            f"<td style='{STYLE_TD};color:{COULEUR_GRAVITE.get(vuln.gravite, '#333')}'>"
            f"<strong>{vuln.gravite.value}</strong></td>"
            f"<td style='{STYLE_TD}'>{vuln.versions_touchees or '-'} &rarr; "
            f"<strong>{vuln.version_cible or 'à définir'}</strong></td>"
            f"<td style='{STYLE_TD}'>{age} j</td>"
            f"<td style='{STYLE_TD}'>{retard or '-'}</td>"
            f"</tr>"
        )
    entetes = (
        "<tr>"
        f"<th style='{STYLE_TH}'>Application</th>"
        f"<th style='{STYLE_TH}'>Vulnérabilité</th>"
        f"<th style='{STYLE_TH}'>Gravité</th>"
        f"<th style='{STYLE_TH}'>Version cible</th>"
        f"<th style='{STYLE_TH}'>Âge</th>"
        f"<th style='{STYLE_TH}'>Échéance</th>"
        "</tr>"
    )
    return f"<table style='{STYLE_TABLE}'>{entetes}{''.join(corps)}</table>"


def _enveloppe(titre: str, intro: str, contenu: str) -> str:
    return f"""<div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f6fb;padding:24px">
  <div style="max-width:860px;margin:auto;background:#fff;border-radius:14px;overflow:hidden;
              border:1px solid #dfe4f2">
    <div style="background:#101830;color:#fff;padding:20px 24px">
      <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#7d93c8">
        Pilotage MCO
      </div>
      <div style="font-size:21px;font-weight:600;margin-top:6px">{titre}</div>
    </div>
    <div style="padding:22px 24px;color:#26304a;line-height:1.6">
      <p>{intro}</p>
      {contenu}
      <p style="margin-top:22px;font-size:12px;color:#75809b">
        Message automatique émis par la plateforme de pilotage MCO.
      </p>
    </div>
  </div>
</div>"""


def relancer_responsables(db: Session, horizon_jours: int = 7) -> dict:
    """Envoie une relance à chaque responsable ayant des failles à échéance proche ou dépassée."""
    limite = date.today() + timedelta(days=horizon_jours)
    par_responsable: dict[str, list] = defaultdict(list)

    for lien, vuln, app in _lignes_vulnerabilites(db):
        if vuln.date_echeance and vuln.date_echeance > limite:
            continue
        if app.responsable_email:
            par_responsable[app.responsable_email].append((lien, vuln, app))

    envois = []
    for email, lignes in par_responsable.items():
        nb_critiques = sum(1 for _, v, _ in lignes if v.gravite == Gravite.CRITIQUE)
        sujet = f"[MCO] Relance vulnérabilités : {len(lignes)} action(s) attendue(s)"
        intro = (
            f"Bonjour,<br>Vous êtes responsable de {len(lignes)} vulnérabilité(s) active(s) "
            f"dont <strong>{nb_critiques}</strong> de gravité critique. "
            "Merci de mettre à jour l'avancement dans l'outil de pilotage MCO."
        )
        corps = _enveloppe("Relance vulnérabilités", intro, _tableau_html(lignes))
        statut, detail = envoyer_email([email], sujet, corps)
        envois.append({"destinataire": email, "nb": len(lignes), "statut": statut, "detail": detail})

    logger.info("Relance vulnérabilités : %s destinataire(s)", len(envois))
    return {"nb_destinataires": len(envois), "envois": envois}


def recapitulatif_hebdomadaire(db: Session, destinataires: list[str] | None = None) -> dict:
    """Récapitulatif consolidé du parc, envoyé à la liste de diffusion dédiée."""
    if destinataires is None:
        liste = (
            db.query(ListeDiffusion)
            .filter(ListeDiffusion.nom.ilike("%hebdomadaire%"))
            .first()
        )
        destinataires = liste.emails() if liste else []
    if not destinataires:
        return {"statut": "IGNORE", "detail": "Aucune liste de diffusion hebdomadaire configurée."}

    lignes = _lignes_vulnerabilites(db)
    aujourdhui = date.today()
    en_retard = [t for t in lignes if t[1].date_echeance and t[1].date_echeance < aujourdhui]
    critiques = [t for t in lignes if t[1].gravite == Gravite.CRITIQUE]
    nb_apps = db.query(Application).count()

    synthese = f"""
    <div style="display:block;margin:18px 0">
      <table style="{STYLE_TABLE}">
        <tr>
          <td style="{STYLE_TD};text-align:center"><div style="font-size:26px;font-weight:700">{nb_apps}</div>
            applications suivies</td>
          <td style="{STYLE_TD};text-align:center"><div style="font-size:26px;font-weight:700">{len(lignes)}</div>
            vulnérabilités actives</td>
          <td style="{STYLE_TD};text-align:center;color:#c2273c">
            <div style="font-size:26px;font-weight:700">{len(critiques)}</div> critiques</td>
          <td style="{STYLE_TD};text-align:center;color:#e07a1f">
            <div style="font-size:26px;font-weight:700">{len(en_retard)}</div> hors délai</td>
        </tr>
      </table>
    </div>"""

    contenu = synthese + (
        _tableau_html(lignes) if lignes else "<p>Aucune vulnérabilité active. Parc sain.</p>"
    )
    sujet = f"[MCO] Récapitulatif hebdomadaire du {aujourdhui.strftime('%d/%m/%Y')}"
    intro = "Voici l'état consolidé du parc applicatif pour la semaine écoulée."
    statut, detail = envoyer_email(
        destinataires, sujet, _enveloppe("Récapitulatif hebdomadaire MCO", intro, contenu)
    )
    logger.info("Récapitulatif hebdomadaire : %s", statut)
    return {
        "statut": statut,
        "detail": detail,
        "nb_destinataires": len(destinataires),
        "nb_vulnerabilites": len(lignes),
    }
