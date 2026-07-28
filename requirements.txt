"""Envoi d'e-mails.

Si aucun serveur SMTP n'est configuré (variables d'environnement absentes),
l'application bascule automatiquement en MODE SIMULATION : le message est
journalisé dans les logs et enregistré en base, mais rien n'est expédié.
Cela permet de tester toute la chaîne sans configurer de messagerie.
"""
from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger("mco.mailer")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER or "mco-pilot@exemple.local")
SMTP_TLS = os.getenv("SMTP_TLS", "true").lower() == "true"


def mode_simulation() -> bool:
    return not (SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def envoyer_email(destinataires: list[str], sujet: str, corps_html: str) -> tuple[str, str]:
    """Retourne (statut, detail). Statut = ENVOYE | SIMULE | ECHEC."""
    destinataires = [d for d in destinataires if d]
    if not destinataires:
        return "ECHEC", "Aucun destinataire valide."

    if mode_simulation():
        logger.warning(
            "[SIMULATION] Email non expédié (SMTP non configuré) -> %s | Sujet : %s",
            ", ".join(destinataires),
            sujet,
        )
        return "SIMULE", (
            "SMTP non configuré : message enregistré en mode simulation. "
            "Renseignez SMTP_HOST / SMTP_USER / SMTP_PASSWORD pour un envoi réel."
        )

    message = EmailMessage()
    message["From"] = SMTP_FROM
    message["To"] = ", ".join(destinataires)
    message["Subject"] = sujet
    message.set_content("Ce message nécessite un client compatible HTML.")
    message.add_alternative(corps_html, subtype="html")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as serveur:
            if SMTP_TLS:
                serveur.starttls()
            serveur.login(SMTP_USER, SMTP_PASSWORD)
            serveur.send_message(message)
        return "ENVOYE", f"{len(destinataires)} destinataire(s) servis via {SMTP_HOST}."
    except Exception as exc:  # noqa: BLE001 - on remonte l'erreur telle quelle à l'IHM
        logger.exception("Échec d'envoi SMTP")
        return "ECHEC", f"Erreur SMTP : {exc}"
