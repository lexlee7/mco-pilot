"""Planificateur de tâches (relances e-mail).

- Relance ciblée : chaque jour ouvré à 08:00.
- Récapitulatif hebdomadaire : chaque lundi à 07:30.

Désactivable avec la variable d'environnement SCHEDULER_ENABLED=false.
"""
from __future__ import annotations

import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from ..database import SessionLocal
from .relances import recapitulatif_hebdomadaire, relancer_responsables

logger = logging.getLogger("mco.scheduler")
_scheduler: BackgroundScheduler | None = None

FUSEAU = os.getenv("SCHEDULER_TIMEZONE", "Europe/Paris")


def _tache_relance() -> None:
    db = SessionLocal()
    try:
        relancer_responsables(db)
    except Exception:  # noqa: BLE001
        logger.exception("Échec de la relance quotidienne")
    finally:
        db.close()


def _tache_recap() -> None:
    db = SessionLocal()
    try:
        recapitulatif_hebdomadaire(db)
    except Exception:  # noqa: BLE001
        logger.exception("Échec du récapitulatif hebdomadaire")
    finally:
        db.close()


def demarrer_scheduler() -> None:
    global _scheduler
    if os.getenv("SCHEDULER_ENABLED", "true").lower() != "true":
        logger.info("Scheduler désactivé (SCHEDULER_ENABLED=false)")
        return
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone=FUSEAU)
    _scheduler.add_job(
        _tache_relance,
        CronTrigger(day_of_week="mon-fri", hour=8, minute=0),
        id="relance_vulnerabilites",
        replace_existing=True,
    )
    _scheduler.add_job(
        _tache_recap,
        CronTrigger(day_of_week="mon", hour=7, minute=30),
        id="recap_hebdomadaire",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Scheduler démarré (fuseau %s)", FUSEAU)


def arreter_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
