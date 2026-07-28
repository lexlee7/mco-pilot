"""Synchronisation légère du schéma de base de données.

Problème résolu ici : `Base.metadata.create_all()` sait créer les tables absentes,
mais il ne touche jamais à une table qui existe déjà. Quand on ajoute un champ à un
modèle (par exemple `dora` sur les applications), la base d'un environnement déjà
déployé conserve son ancienne structure, et l'application s'arrête au démarrage sur
une erreur « column ... does not exist ».

Cette fonction compare le modèle et la base réelle, puis ajoute les colonnes
manquantes. Elle ne supprime rien et ne modifie aucune colonne existante : c'est
volontairement une migration additive, sans risque pour les données en place.

Pour un usage plus exigeant (renommages, changements de type, retours arrière),
l'outil de référence est Alembic. Il est ici délibérément évité pour ne pas imposer
une étape de commande supplémentaire.
"""
from __future__ import annotations

import logging

from sqlalchemy import Boolean, Engine, inspect, text
from sqlalchemy.schema import Column

logger = logging.getLogger("mco.schema")


def _valeur_par_defaut(colonne: Column) -> str | None:
    """Traduit la valeur par défaut du modèle en littéral SQL.

    Indispensable pour les colonnes obligatoires : une base qui contient déjà des
    lignes refuse l'ajout d'une colonne NOT NULL sans valeur de repli.
    """
    defaut = colonne.default
    if defaut is None or getattr(defaut, "is_callable", False):
        if colonne.nullable:
            return None
        # Colonne obligatoire sans défaut déclaré : on en fabrique un neutre.
        if isinstance(colonne.type, Boolean):
            return "false"
        return "0" if colonne.type.python_type in (int, float) else "''"

    valeur = getattr(defaut, "arg", None)
    if callable(valeur):
        return None
    if isinstance(valeur, bool):
        return "true" if valeur else "false"
    if isinstance(valeur, (int, float)):
        return str(valeur)
    if valeur is None:
        return None
    return "'" + str(getattr(valeur, "value", valeur)).replace("'", "''") + "'"


def synchroniser_schema(engine: Engine, metadata) -> list[str]:
    """Ajoute à la base les colonnes présentes dans les modèles mais absentes des tables.

    Retourne la liste des modifications appliquées, pour journalisation.
    """
    inspecteur = inspect(engine)
    modifications: list[str] = []

    for table in metadata.sorted_tables:
        if not inspecteur.has_table(table.name):
            continue  # create_all vient de la créer avec toutes ses colonnes
        existantes = {c["name"] for c in inspecteur.get_columns(table.name)}

        for colonne in table.columns:
            if colonne.name in existantes:
                continue

            type_sql = colonne.type.compile(dialect=engine.dialect)
            morceaux = [f'ALTER TABLE "{table.name}" ADD COLUMN "{colonne.name}" {type_sql}']
            defaut = _valeur_par_defaut(colonne)
            if defaut is not None:
                morceaux.append(f"DEFAULT {defaut}")
            if not colonne.nullable:
                if defaut is None:
                    # Sans valeur de repli, imposer NOT NULL casserait les lignes
                    # existantes : on préfère une colonne permissive à un démarrage
                    # impossible.
                    logger.warning(
                        "Colonne %s.%s ajoutée sans contrainte NOT NULL "
                        "(aucune valeur par défaut exploitable).",
                        table.name,
                        colonne.name,
                    )
                else:
                    morceaux.append("NOT NULL")

            instruction = " ".join(morceaux)
            try:
                with engine.begin() as connexion:
                    connexion.execute(text(instruction))
                modifications.append(f"{table.name}.{colonne.name}")
                logger.info("Schéma mis à jour : %s", instruction)
            except Exception:  # noqa: BLE001
                logger.exception("Échec de la mise à jour du schéma : %s", instruction)

    if modifications:
        logger.info(
            "Synchronisation du schéma terminée : %s colonne(s) ajoutée(s) (%s).",
            len(modifications),
            ", ".join(modifications),
        )
    return modifications
