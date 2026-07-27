"""Point d'entrée de l'API de pilotage MCO."""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import models  # noqa: F401 (import nécessaire pour créer les tables)
from .database import Base, SessionLocal, engine
from .routers import applications, communication, dashboard, evenements, maintenance, partenaires
from .routers import vulnerabilites
from .services.scheduler import arreter_scheduler, demarrer_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("mco")

DOSSIER_STATIQUE = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def cycle_de_vie(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if os.getenv("SEED_ON_STARTUP", "true").lower() == "true":
        from .seed import injecter_jeu_de_donnees

        db = SessionLocal()
        try:
            injecter_jeu_de_donnees(db)
        finally:
            db.close()
    demarrer_scheduler()
    logger.info("API MCO prête.")
    yield
    arreter_scheduler()


app = FastAPI(
    title="Pilotage MCO",
    description="API de maintien en condition opérationnelle d'un parc applicatif.",
    version="1.0.0",
    lifespan=cycle_de_vie,
)

origines = os.getenv("CORS_ORIGINS", "http://localhost:4200,http://127.0.0.1:4200").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origines if o.strip()] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(applications.router)
app.include_router(partenaires.router)
app.include_router(vulnerabilites.router)
app.include_router(maintenance.router)
app.include_router(evenements.router)
app.include_router(communication.router)


@app.get("/api/sante", tags=["Système"])
def sante():
    return {"statut": "ok", "service": "pilotage-mco"}


@app.get("/api/referentiels", tags=["Système"])
def referentiels():
    """Toutes les valeurs d'énumération, pour alimenter les listes déroulantes du front."""
    return {
        "criticites": [e.value for e in models.Criticite],
        "statuts_application": [e.value for e in models.StatutApplication],
        "modes_suivi": [e.value for e in models.ModeSuivi],
        "types_partenaire": [e.value for e in models.TypePartenaire],
        "sens_flux": [e.value for e in models.SensFlux],
        "frequences_flux": [e.value for e in models.FrequenceFlux],
        "types_document": [e.value for e in models.TypeDocument],
        "etats_document": [e.value for e in models.EtatDocument],
        "gravites": [e.value for e in models.Gravite],
        "statuts_vulnerabilite": [e.value for e in models.StatutVulnerabilite],
        "types_evenement": [e.value for e in models.TypeEvenement],
        "categories_template": [e.value for e in models.CategorieTemplate],
    }


# --------------------------------------------------------------------------
# Service du front Angular compilé (déploiement en une seule instance Render)
# --------------------------------------------------------------------------
if DOSSIER_STATIQUE.exists():
    app.mount(
        "/assets", StaticFiles(directory=DOSSIER_STATIQUE / "assets", check_dir=False), name="assets"
    )

    @app.get("/{chemin:path}", include_in_schema=False)
    def servir_front(chemin: str):
        cible = DOSSIER_STATIQUE / chemin
        if chemin and cible.is_file():
            return FileResponse(cible)
        return FileResponse(DOSSIER_STATIQUE / "index.html")
