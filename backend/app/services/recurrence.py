"""Périodicité des flux.

Deux services rendus ici :

1. Traduire une récurrence en phrase lisible (« le 1er mardi du mois à 09:00 »),
   pour que la fiche reste compréhensible sans décoder les champs techniques.
2. Projeter les occurrences datées sur une période donnée. C'est ce qui permet de
   répondre à la question qui compte en exploitation : « si j'arrête cette
   application mercredi entre 22h et 2h, quels échanges vais-je manquer ? »
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from ..models import Flux, TypeRecurrence

JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
MOIS = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]
RANGS = {1: "1er", 2: "2e", 3: "3e", 4: "4e", 5: "dernier"}


def _jours_choisis(flux: Flux) -> list[int]:
    if not flux.jours_semaine:
        return []
    return sorted(
        int(j) for j in str(flux.jours_semaine).replace(",", ";").split(";") if j.strip().isdigit()
    )


def libelle_recurrence(flux: Flux) -> str:
    """Phrase décrivant le rythme du flux."""
    heure = f" à {flux.heure}" if flux.heure else ""
    jours = _jours_choisis(flux)

    match flux.recurrence:
        case TypeRecurrence.TEMPS_REEL:
            return "En continu (temps réel)"
        case TypeRecurrence.HORAIRE:
            return "Toutes les heures"
        case TypeRecurrence.QUOTIDIEN:
            return f"Tous les jours{heure}"
        case TypeRecurrence.HEBDOMADAIRE:
            if not jours:
                return f"Toutes les semaines{heure}"
            if jours == [0, 1, 2, 3, 4]:
                return f"Tous les jours ouvrés{heure}"
            if jours == [5, 6]:
                return f"Tous les week-ends{heure}"
            noms = [JOURS[j] + "s" for j in jours if 0 <= j <= 6]
            if len(noms) == 1:
                return f"Tous les {noms[0]}{heure}"
            return "Tous les " + ", ".join(noms[:-1]) + f" et {noms[-1]}{heure}"
        case TypeRecurrence.MENSUEL_DATE:
            if not flux.jour_du_mois:
                return f"Tous les mois{heure}"
            jour = "1er" if flux.jour_du_mois == 1 else str(flux.jour_du_mois)
            return f"Tous les {jour} du mois{heure}"
        case TypeRecurrence.MENSUEL_JOUR:
            rang = RANGS.get(flux.occurrence_mois or 1, "1er")
            jour = JOURS[flux.jour_semaine_mois or 0]
            return f"Le {rang} {jour} du mois{heure}"
        case TypeRecurrence.ANNUEL:
            mois = MOIS[(flux.mois_annee or 1) - 1]
            return f"Chaque {flux.jour_du_mois or 1} {mois}{heure}"
        case _:
            return "À la demande"


def _nieme_jour_du_mois(annee: int, mois: int, jour_semaine: int, rang: int) -> date | None:
    """Renvoie par exemple le 1er mardi, ou le dernier vendredi, d'un mois donné."""
    premier = date(annee, mois, 1)
    suivant = date(annee + (mois == 12), (mois % 12) + 1, 1)
    correspondants = []
    courant = premier
    while courant < suivant:
        if courant.weekday() == jour_semaine:
            correspondants.append(courant)
        courant += timedelta(days=1)
    if not correspondants:
        return None
    if rang >= 5:
        return correspondants[-1]
    return correspondants[rang - 1] if rang <= len(correspondants) else None


def occurrences(flux: Flux, debut: date, fin: date) -> list[dict]:
    """Occurrences datées du flux entre deux dates incluses."""
    if flux.recurrence == TypeRecurrence.A_LA_DEMANDE:
        return []

    heures = [flux.heure] if flux.heure else [None]
    resultats: list[dict] = []

    def ajouter(jour: date, heure: str | None, note: str | None = None) -> None:
        if not (debut <= jour <= fin):
            return
        if heure:
            h, m = (int(x) for x in heure.split(":"))
            horodatage = datetime.combine(jour, datetime.min.time()).replace(hour=h, minute=m)
        else:
            horodatage = datetime.combine(jour, datetime.min.time())
        resultats.append(
            {
                "flux_id": flux.id,
                "nom": flux.nom,
                "application_id": flux.application_id,
                "sens": flux.sens.value,
                "bloquant": flux.bloquant,
                "partenaire": flux.partenaire.nom if flux.partenaire else None,
                "date": jour.isoformat(),
                "horodatage": horodatage.isoformat(),
                "heure": heure,
                "note": note,
            }
        )

    if flux.recurrence in (TypeRecurrence.TEMPS_REEL, TypeRecurrence.HORAIRE):
        note = "En continu" if flux.recurrence == TypeRecurrence.TEMPS_REEL else "Toutes les heures"
        jour = debut
        while jour <= fin:
            ajouter(jour, None, note)
            jour += timedelta(days=1)
        return resultats

    if flux.recurrence == TypeRecurrence.QUOTIDIEN:
        jour = debut
        while jour <= fin:
            for heure in heures:
                ajouter(jour, heure)
            jour += timedelta(days=1)
        return resultats

    if flux.recurrence == TypeRecurrence.HEBDOMADAIRE:
        jours = _jours_choisis(flux)
        jour = debut
        while jour <= fin:
            if not jours or jour.weekday() in jours:
                for heure in heures:
                    ajouter(jour, heure)
            jour += timedelta(days=1)
        return resultats

    # Les rythmes mensuels et annuels se calculent mois par mois.
    annee, mois = debut.year, debut.month
    while date(annee, mois, 1) <= fin:
        if flux.recurrence == TypeRecurrence.MENSUEL_DATE:
            numero = flux.jour_du_mois or 1
            try:
                cible = date(annee, mois, numero)
            except ValueError:  # le 31 d'un mois qui n'en compte que 30
                suivant = date(annee + (mois == 12), (mois % 12) + 1, 1)
                cible = suivant - timedelta(days=1)
            for heure in heures:
                ajouter(cible, heure)
        elif flux.recurrence == TypeRecurrence.MENSUEL_JOUR:
            cible = _nieme_jour_du_mois(
                annee, mois, flux.jour_semaine_mois or 0, flux.occurrence_mois or 1
            )
            if cible:
                for heure in heures:
                    ajouter(cible, heure)
        elif flux.recurrence == TypeRecurrence.ANNUEL and mois == (flux.mois_annee or 1):
            try:
                cible = date(annee, mois, flux.jour_du_mois or 1)
                for heure in heures:
                    ajouter(cible, heure)
            except ValueError:
                pass
        annee, mois = annee + (mois == 12), (mois % 12) + 1

    resultats.sort(key=lambda o: o["horodatage"])
    return resultats
