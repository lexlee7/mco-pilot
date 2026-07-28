"""Moteur intelligent de recherche de plage de maintenance.

Principe : la semaine est découpée en créneaux de 15 minutes (7 jours x 96 = 672).
Pour chaque application on construit un "masque de disponibilité" : True si
l'application est arrêtable sur ce créneau (d'après ses plages déclarées).

Chercher un créneau commun revient à superposer les masques. Quand aucune
superposition parfaite n'existe, on descend progressivement en tolérance :
un créneau à 1 conflit est proposé en indiquant précisément quelle application
pose problème et pourquoi. C'est le "moindre mal" du manager de production.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..models import Application

PAS_MINUTES = 15
CRENEAUX_PAR_JOUR = 24 * 60 // PAS_MINUTES  # 96
CRENEAUX_SEMAINE = 7 * CRENEAUX_PAR_JOUR  # 672

JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]


def _hhmm_to_index(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return (int(h) * 60 + int(m)) // PAS_MINUTES


def _index_to_hhmm(index: int) -> str:
    index = index % CRENEAUX_PAR_JOUR
    minutes = index * PAS_MINUTES
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _index_semaine_to_libelle(index: int) -> tuple[int, str]:
    jour = (index // CRENEAUX_PAR_JOUR) % 7
    return jour, _index_to_hhmm(index % CRENEAUX_PAR_JOUR)


@dataclass
class MasqueApplication:
    application: Application
    disponible: list[bool]
    a_des_plages: bool

    def libelle_plages(self) -> str:
        if not self.a_des_plages:
            return "aucune plage de maintenance déclarée"
        morceaux = [
            f"{JOURS[p.jour_semaine]} {p.heure_debut}-{p.heure_fin}"
            for p in self.application.plages
        ]
        return ", ".join(morceaux)


def construire_masque(app: Application) -> MasqueApplication:
    """Marque à True chaque créneau de 15 min couvert par une plage déclarée."""
    dispo = [False] * CRENEAUX_SEMAINE
    plages = list(app.plages)
    for plage in plages:
        debut = plage.jour_semaine * CRENEAUX_PAR_JOUR + _hhmm_to_index(plage.heure_debut)
        fin_idx = _hhmm_to_index(plage.heure_fin)
        debut_idx_jour = _hhmm_to_index(plage.heure_debut)
        # Plage qui franchit minuit (ex. 22:00 -> 02:00) : on ajoute 24h.
        duree = (fin_idx - debut_idx_jour) % CRENEAUX_PAR_JOUR
        if duree == 0:
            duree = CRENEAUX_PAR_JOUR
        for offset in range(duree):
            dispo[(debut + offset) % CRENEAUX_SEMAINE] = True
    return MasqueApplication(application=app, disponible=dispo, a_des_plages=bool(plages))


def _fenetre_autorisee(
    index_debut: int,
    nb_creneaux: int,
    jours_autorises: list[int] | None,
    borne_min: int | None,
    borne_max: int | None,
) -> bool:
    jour_debut = (index_debut // CRENEAUX_PAR_JOUR) % 7
    if jours_autorises and jour_debut not in jours_autorises:
        return False
    if borne_min is None and borne_max is None:
        return True
    for offset in range(nb_creneaux):
        minute_index = (index_debut + offset) % CRENEAUX_SEMAINE % CRENEAUX_PAR_JOUR
        if borne_min is not None and borne_max is not None:
            if borne_min <= borne_max:
                ok = borne_min <= minute_index < borne_max
            else:  # fenêtre nocturne, ex. 20:00 -> 06:00
                ok = minute_index >= borne_min or minute_index < borne_max
            if not ok:
                return False
        elif borne_min is not None and minute_index < borne_min:
            return False
        elif borne_max is not None and minute_index >= borne_max:
            return False
    return True


def rechercher_creneaux(
    apps: list[Application],
    duree_minutes: int = 120,
    tolerance_conflits: int = 0,
    jours_autorises: list[int] | None = None,
    heure_min: str | None = None,
    heure_max: str | None = None,
    max_resultats: int = 12,
) -> tuple[list[dict], str]:
    """Retourne les meilleurs créneaux communs, triés par nombre de conflits croissant."""
    if not apps:
        return [], "Sélectionnez au moins une application."

    masques = [construire_masque(a) for a in apps]
    nb_creneaux = max(1, -(-duree_minutes // PAS_MINUTES))  # arrondi supérieur
    if nb_creneaux > CRENEAUX_SEMAINE:
        return [], "La durée demandée dépasse une semaine complète."

    borne_min = _hhmm_to_index(heure_min) if heure_min else None
    borne_max = _hhmm_to_index(heure_max) if heure_max else None

    candidats: list[dict] = []
    for debut in range(CRENEAUX_SEMAINE):
        if not _fenetre_autorisee(debut, nb_creneaux, jours_autorises, borne_min, borne_max):
            continue
        conflits: list[MasqueApplication] = []
        for masque in masques:
            couvre = all(
                masque.disponible[(debut + o) % CRENEAUX_SEMAINE] for o in range(nb_creneaux)
            )
            if not couvre:
                conflits.append(masque)
        if len(conflits) > tolerance_conflits:
            continue
        candidats.append({"debut": debut, "conflits": conflits})

    if not candidats:
        return [], (
            "Aucun créneau ne respecte la tolérance demandée. "
            "Augmentez la tolérance de conflits, réduisez la durée ou élargissez la fenêtre horaire."
        )

    # Tri : d'abord le moins de conflits, puis le plus tôt dans la semaine.
    candidats.sort(key=lambda c: (len(c["conflits"]), c["debut"]))

    # On ne garde que des créneaux qui ne se chevauchent pas, pour éviter
    # d'afficher 40 fois la même fenêtre décalée de 15 minutes.
    retenus: list[dict] = []
    occupes: list[tuple[int, int]] = []
    for cand in candidats:
        debut = cand["debut"]
        fin = debut + nb_creneaux
        if any(debut < f and d < fin for d, f in occupes):
            continue
        occupes.append((debut, fin))
        retenus.append(cand)
        if len(retenus) >= max_resultats:
            break

    resultats = []
    for cand in retenus:
        debut = cand["debut"]
        jour, hdebut = _index_semaine_to_libelle(debut)
        _, hfin = _index_semaine_to_libelle(debut + nb_creneaux)
        conflits = cand["conflits"]
        codes_ok = [
            m.application.code for m in masques if m not in conflits
        ]
        detail_conflits = [
            {
                "application_id": m.application.id,
                "code": m.application.code,
                "nom": m.application.nom,
                "criticite": m.application.criticite,
                "raison": (
                    "Aucune plage de maintenance déclarée"
                    if not m.a_des_plages
                    else f"Hors plage habituelle ({m.libelle_plages()})"
                ),
            }
            for m in conflits
        ]
        if not conflits:
            resume = f"Créneau commun parfait sur {len(masques)} application(s)."
        elif len(conflits) == 1:
            resume = f"1 seul conflit détecté sur {conflits[0].application.code}."
        else:
            resume = (
                f"{len(conflits)} conflits détectés : "
                + ", ".join(m.application.code for m in conflits)
            )
        resultats.append(
            {
                "jour_semaine": jour,
                "jour_libelle": JOURS[jour],
                "heure_debut": hdebut,
                "heure_fin": hfin,
                "duree_minutes": nb_creneaux * PAS_MINUTES,
                "nb_conflits": len(conflits),
                "parfait": not conflits,
                "applications_couvertes": codes_ok,
                "conflits": detail_conflits,
                "resume": resume,
            }
        )

    parfaits = sum(1 for r in resultats if r["parfait"])
    if parfaits:
        message = f"{parfaits} créneau(x) commun(s) sans aucun conflit trouvé(s)."
    else:
        meilleur = resultats[0]["nb_conflits"]
        message = (
            f"Aucun créneau parfait. Meilleur compromis : {meilleur} conflit(s). "
            "Le détail par application est fourni pour arbitrer."
        )
    return resultats, message
