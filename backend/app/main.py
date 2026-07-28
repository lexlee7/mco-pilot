"""Point d'entrée de l'API de pilotage MCO."""
from __future__ import annotations

import logging
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import models  # noqa: F401 (import nécessaire pour créer les tables)
from .database import Base, SessionLocal, engine
from .routers import applications, communication, dashboard, evenements, maintenance
from .routers import obsolescences, partenaires, vulnerabilites
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
app.include_router(obsolescences.router)
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
        "statuts_obsolescence": [e.value for e in models.StatutObsolescence],
        "types_dojo": [e.value for e in models.TypeDojo],
        "categories_template": [e.value for e in models.CategorieTemplate],
    }


# --------------------------------------------------------------------------
# Service du front Angular compilé (déploiement en une seule instance Render)
# --------------------------------------------------------------------------

# Extensions considérées comme des fichiers, et non comme des routes de l'IHM.
# Distinction essentielle : si le navigateur réclame « /chunk-ABC.js » et que ce
# fichier n'existe pas, il faut répondre 404. Lui renvoyer index.html à la place
# masquerait la panne : le navigateur recevrait du HTML là où il attend du code,
# refuserait de l'exécuter, et l'IHM resterait muette sans erreur visible.
EXTENSIONS_FICHIERS = {
    ".js", ".mjs", ".css", ".map", ".ico", ".png", ".jpg", ".jpeg", ".gif",
    ".svg", ".webp", ".woff", ".woff2", ".ttf", ".eot", ".json", ".txt", ".webmanifest",
}


@app.get("/api/diagnostic-front", tags=["Système"])
def diagnostic_front():
    """Vérifie que le front compilé est complet et cohérent.

    À ouvrir dans un navigateur en cas de page blanche : indique si le dossier
    statique existe, combien de fichiers il contient, et si chaque ressource
    référencée par index.html est réellement présente sur le disque.
    """
    if not DOSSIER_STATIQUE.exists():
        return {
            "front_present": False,
            "dossier_attendu": str(DOSSIER_STATIQUE),
            "diagnostic": (
                "Le front compilé est absent de l'image. Vérifiez que l'étape de "
                "construction Angular du Dockerfile s'est bien déroulée."
            ),
        }

    fichiers = sorted(p.name for p in DOSSIER_STATIQUE.iterdir() if p.is_file())
    index = DOSSIER_STATIQUE / "index.html"
    references: list[dict] = []
    if index.exists():
        contenu = index.read_text(encoding="utf-8")
        for motif in re.findall(r'(?:src|href)="([^"]+\.(?:js|css))"', contenu):
            chemin = motif.lstrip("/")
            references.append({"fichier": chemin, "present": (DOSSIER_STATIQUE / chemin).is_file()})

    manquants = [r["fichier"] for r in references if not r["present"]]
    morceaux = [f for f in fichiers if f.startswith("chunk-")]
    return {
        "front_present": True,
        "index_present": index.exists(),
        "nb_fichiers": len(fichiers),
        "nb_morceaux_pages": len(morceaux),
        "ressources_index": references,
        "ressources_manquantes": manquants,
        "fichiers": fichiers,
        "diagnostic": (
            "Front complet et cohérent."
            if index.exists() and not manquants and morceaux
            else "Front incomplet : voir « ressources_manquantes » et « nb_morceaux_pages »."
        ),
    }


if DOSSIER_STATIQUE.exists():

    @app.get("/{chemin:path}", include_in_schema=False)
    def servir_front(chemin: str):
        cible = DOSSIER_STATIQUE / chemin
        if chemin and cible.is_file():
            return FileResponse(cible)
        if Path(chemin).suffix.lower() in EXTENSIONS_FICHIERS:
            raise HTTPException(
                status_code=404,
                detail=f"Ressource statique introuvable : {chemin}",
            )
        # Toute autre adresse est une route de l'interface : Angular en prend la main.
        return FileResponse(DOSSIER_STATIQUE / "index.html")
