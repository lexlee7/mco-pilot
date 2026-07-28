"""Jeu de données de démonstration.

Injecté au premier démarrage uniquement (si la table des applications est vide).
Mettre SEED_ON_STARTUP=false pour démarrer sur une base vierge.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from .models import (
    Application,
    Dojo,
    Obsolescence,
    StatutObsolescence,
    TypeDojo,
    CategorieTemplate,
    Criticite,
    DispositifSecurite,
    Document,
    EtatDocument,
    Evenement,
    Flux,
    FrequenceFlux,
    Gravite,
    ListeDiffusion,
    ModeSuivi,
    Partenaire,
    PlageMaintenance,
    SensFlux,
    StatutApplication,
    StatutVulnerabilite,
    TemplateCommunication,
    TypeDocument,
    TypeEvenement,
    TypePartenaire,
    Vulnerabilite,
    VulnerabiliteApplication,
)

logger = logging.getLogger("mco.seed")

GABARIT_INCIDENT = """<div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f6fb;padding:24px">
  <div style="max-width:640px;margin:auto;background:#fff;border-radius:14px;border:1px solid #dfe4f2;overflow:hidden">
    <div style="background:#8c1d2b;color:#fff;padding:18px 22px">
      <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase">Incident en cours</div>
      <div style="font-size:20px;font-weight:600;margin-top:4px">{{application}}</div>
    </div>
    <div style="padding:22px;color:#26304a;line-height:1.6">
      <p>Bonjour,</p>
      <p>Un incident affecte actuellement l'application <strong>{{application}}</strong>
         ({{code_application}}) depuis {{heure}} le {{date}}.</p>
      <p><strong>Impact utilisateurs :</strong> à préciser.<br>
         <strong>Contournement :</strong> à préciser.<br>
         <strong>Prochaine communication :</strong> dans 1 heure.</p>
      <p>Nos équipes sont mobilisées. Merci de ne pas ouvrir de ticket complémentaire.</p>
      <p style="margin-top:20px">{{responsable}}<br>
        <span style="color:#75809b;font-size:12px">Responsable applicatif</span></p>
    </div>
  </div>
</div>"""

GABARIT_RETABLISSEMENT = GABARIT_INCIDENT.replace("#8c1d2b", "#1d6b4f").replace(
    "Incident en cours", "Service rétabli"
).replace(
    "<p>Un incident affecte actuellement l'application <strong>{{application}}</strong>\n         ({{code_application}}) depuis {{heure}} le {{date}}.</p>",
    "<p>Le service <strong>{{application}}</strong> ({{code_application}}) est rétabli depuis {{heure}} le {{date}}.</p>",
)

GABARIT_MAINTENANCE = """<div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f6fb;padding:24px">
  <div style="max-width:640px;margin:auto;background:#fff;border-radius:14px;border:1px solid #dfe4f2;overflow:hidden">
    <div style="background:#1c3f7a;color:#fff;padding:18px 22px">
      <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase">Maintenance planifiée</div>
      <div style="font-size:20px;font-weight:600;margin-top:4px">{{application}}</div>
    </div>
    <div style="padding:22px;color:#26304a;line-height:1.6">
      <p>Bonjour,</p>
      <p>Une intervention de maintenance est programmée sur <strong>{{application}}</strong>.</p>
      <p><strong>Date :</strong> à préciser<br>
         <strong>Créneau :</strong> à préciser<br>
         <strong>Indisponibilité attendue :</strong> à préciser</p>
      <p>Merci de sauvegarder vos travaux avant le début du créneau.</p>
      <p style="margin-top:20px">{{responsable}}</p>
    </div>
  </div>
</div>"""


def injecter_jeu_de_donnees(db: Session) -> None:
    if db.query(Application).count() > 0:
        return
    logger.info("Injection du jeu de données de démonstration…")

    # ------------------------------------------------------------ Partenaires
    partenaires = {
        "sapiens": Partenaire(
            nom="Sapiens Software",
            type=TypePartenaire.EDITEUR,
            contact_nom="Claire Fontaine",
            contact_email="support@sapiens-software.example",
            contact_telephone="+33 1 44 55 66 77",
            support_url="https://support.sapiens-software.example",
            escalade_n1="Hotline 8h-18h — +33 1 44 55 66 77",
            escalade_n2="Astreinte 24/7 — astreinte@sapiens-software.example",
            reference_contrat="CTR-2023-0148 (support Premium)",
            horaires_support="8h-18h du lundi au vendredi, astreinte hors plage",
        ),
        "novaflux": Partenaire(
            nom="NovaFlux Intégration",
            type=TypePartenaire.INTEGRATEUR,
            contact_nom="Marc Leduc",
            contact_email="marc.leduc@novaflux.example",
            contact_telephone="+33 2 98 11 22 33",
            escalade_n1="Chef de projet — Marc Leduc",
            escalade_n2="Directeur de service — Anne Rivet",
            reference_contrat="CTR-2024-0032 (TMA)",
            horaires_support="9h-19h ouvrés",
        ),
        "banque": Partenaire(
            nom="Banque Partenaire Nord",
            type=TypePartenaire.PARTENAIRE_FLUX,
            contact_nom="Cellule échanges",
            contact_email="echanges@bpn.example",
            escalade_n1="echanges@bpn.example",
            horaires_support="7h-20h ouvrés",
            notes="Flux SEPA quotidiens. Fenêtre de coupure interdite entre 6h et 20h.",
        ),
        "cloudops": Partenaire(
            nom="CloudOps Infogérance",
            type=TypePartenaire.INFOGERANT,
            contact_nom="NOC CloudOps",
            contact_email="noc@cloudops.example",
            contact_telephone="+33 800 000 111",
            escalade_n1="NOC 24/7",
            escalade_n2="Duty manager — duty@cloudops.example",
            reference_contrat="CTR-2022-0901",
            horaires_support="24/7",
        ),
    }
    db.add_all(partenaires.values())
    db.flush()

    # ------------------------------------------------------------ Applications
    def app_factory(**kwargs) -> Application:
        application = Application(**kwargs)
        db.add(application)
        return application

    finance = app_factory(
        code="FIN-CORE",
        nom="Cœur financier",
        description="Comptabilité générale et référentiel tiers du groupe.",
        criticite=Criticite.VITALE,
        statut=StatutApplication.RUN,
        responsable_nom="Sophie Vasseur",
        responsable_email="sophie.vasseur@exemple.fr",
        responsable_telephone="+33 6 12 34 56 78",
        equipe="Domaine Finance",
        environnement_url="https://fin-core.intra.exemple.fr",
        notes="Clôture mensuelle du 1er au 5 : aucune intervention tolérée.",
        sbom_mode=ModeSuivi.AUTOMATIQUE,
        sbom_commentaire="Généré par la CI à chaque build, publié dans Xray.",
        sanity_check_mode=ModeSuivi.AUTOMATIQUE,
        sanity_check_commentaire="Scénario Selenium post-déploiement (12 contrôles).",
        habilitations="Groupe AD PROD_FIN_OPS + compte applicatif svc-fincore + accès bastion Wallix.",
        dora=True,
        expose_internet=False,
        editeur_id=partenaires["sapiens"].id,
    )
    rh = app_factory(
        code="RH-PAIE",
        nom="Paie et gestion des temps",
        description="Traitement de la paie mensuelle et pointage.",
        criticite=Criticite.VITALE,
        statut=StatutApplication.RUN,
        responsable_nom="Karim Belhadj",
        responsable_email="karim.belhadj@exemple.fr",
        equipe="Domaine RH",
        notes="Gel absolu du 20 au 28 (préparation et lancement de la paie).",
        sbom_mode=ModeSuivi.MANUEL,
        sbom_commentaire="Fourni par l'éditeur à chaque montée de version.",
        sanity_check_mode=ModeSuivi.MANUEL,
        sanity_check_commentaire="Check-list de 8 points réalisée par le métier.",
        habilitations="Groupe AD PROD_RH_OPS, validation RSSI requise pour tout accès aux données.",
        dora=False,
        expose_internet=False,
        editeur_id=partenaires["sapiens"].id,
    )
    crm = app_factory(
        code="CRM-VTE",
        nom="CRM commercial",
        description="Suivi des opportunités et du portefeuille clients.",
        criticite=Criticite.MAJEURE,
        statut=StatutApplication.DEGRADE,
        responsable_nom="Élodie Marchand",
        responsable_email="elodie.marchand@exemple.fr",
        equipe="Domaine Commerce",
        notes="Lenteurs constatées sur le module reporting depuis la v9.2.",
        sbom_mode=ModeSuivi.AUTOMATIQUE,
        sanity_check_mode=ModeSuivi.AUTOMATIQUE,
        habilitations="Groupe AD PROD_CRM_SUPPORT.",
        dora=False,
        expose_internet=True,
        editeur_id=partenaires["novaflux"].id,
    )
    portail = app_factory(
        code="PTL-CLI",
        nom="Portail client",
        description="Espace client en ligne, exposé sur Internet.",
        criticite=Criticite.VITALE,
        statut=StatutApplication.RUN,
        responsable_nom="Thomas Girard",
        responsable_email="thomas.girard@exemple.fr",
        equipe="Domaine Digital",
        environnement_url="https://espace.exemple.fr",
        notes="Exposé Internet : toute vulnérabilité critique doit être traitée sous 48h.",
        sbom_mode=ModeSuivi.AUTOMATIQUE,
        sanity_check_mode=ModeSuivi.AUTOMATIQUE,
        habilitations="Groupe AD PROD_DIGITAL + double validation pour les modifications WAF.",
        dora=True,
        expose_internet=True,
        editeur_id=partenaires["novaflux"].id,
    )
    edi = app_factory(
        code="EDI-HUB",
        nom="Hub d'échanges EDI",
        description="Concentrateur des flux partenaires et bancaires.",
        criticite=Criticite.VITALE,
        statut=StatutApplication.RUN,
        responsable_nom="Nadia Perrin",
        responsable_email="nadia.perrin@exemple.fr",
        equipe="Domaine Intégration",
        notes="Aucun arrêt possible avant 22h : les flux bancaires tournent jusqu'à 21h30.",
        sbom_mode=ModeSuivi.MANUEL,
        sanity_check_mode=ModeSuivi.AUTOMATIQUE,
        habilitations="Groupe AD PROD_EDI_OPS + certificat client pour les rejeux.",
        dora=True,
        expose_internet=True,
        editeur_id=partenaires["cloudops"].id,
    )
    bi = app_factory(
        code="BI-DWH",
        nom="Entrepôt décisionnel",
        description="Datawarehouse et restitutions de pilotage.",
        criticite=Criticite.STANDARD,
        statut=StatutApplication.RUN,
        responsable_nom="Julien Ferrand",
        responsable_email="julien.ferrand@exemple.fr",
        equipe="Domaine Data",
        notes="Chaîne d'alimentation nocturne de 23h à 4h.",
        sbom_mode=ModeSuivi.NON,
        sanity_check_mode=ModeSuivi.MANUEL,
        habilitations="Groupe AD PROD_DATA_OPS.",
        dora=False,
        expose_internet=False,
    )
    ged = app_factory(
        code="GED-DOC",
        nom="Gestion documentaire",
        description="Archivage et diffusion des documents contractuels.",
        criticite=Criticite.MINEURE,
        statut=StatutApplication.RUN,
        responsable_nom="Alice Nguyen",
        responsable_email="alice.nguyen@exemple.fr",
        equipe="Services généraux",
        sbom_mode=ModeSuivi.NON,
        sanity_check_mode=ModeSuivi.NON,
        habilitations="Groupe AD PROD_GED.",
        dora=False,
        expose_internet=False,
    )
    sso = app_factory(
        code="SEC-SSO",
        nom="Authentification SSO",
        description="Fournisseur d'identité central du système d'information.",
        criticite=Criticite.VITALE,
        statut=StatutApplication.RUN,
        responsable_nom="Marc Aubry",
        responsable_email="marc.aubry@exemple.fr",
        equipe="Sécurité opérationnelle",
        notes="Toute maintenance SSO impacte l'ensemble du parc : communication obligatoire J-5.",
        sbom_mode=ModeSuivi.AUTOMATIQUE,
        sanity_check_mode=ModeSuivi.AUTOMATIQUE,
        habilitations="Groupe AD PROD_IAM_ADMIN + validation RSSI systématique.",
        dora=True,
        expose_internet=True,
        editeur_id=partenaires["cloudops"].id,
    )
    db.flush()

    # ------------------------------------------------------------ Plages hebdomadaires
    plages = [
        (finance, 2, "22:00", "02:00", "Fenêtre hebdomadaire mercredi soir"),
        (finance, 5, "20:00", "23:59", "Renfort samedi"),
        (rh, 2, "21:00", "01:00", "Mercredi nuit"),
        (rh, 6, "08:00", "18:00", "Dimanche journée"),
        (crm, 2, "22:00", "03:00", "Mercredi nuit"),
        (crm, 3, "22:00", "03:00", "Jeudi nuit"),
        (portail, 2, "23:00", "02:00", "Nuit du mercredi"),
        (portail, 6, "06:00", "10:00", "Dimanche matin"),
        (edi, 2, "22:30", "01:30", "Après clôture bancaire"),
        (bi, 1, "18:00", "23:00", "Mardi soir hors alimentation"),
        (bi, 2, "18:00", "23:00", "Mercredi soir"),
        (bi, 5, "08:00", "20:00", "Samedi journée"),
        (ged, 2, "20:00", "23:59", "Mercredi soir"),
        (ged, 5, "08:00", "23:59", "Samedi"),
        (ged, 6, "08:00", "23:59", "Dimanche"),
        (sso, 2, "23:00", "02:00", "Mercredi nuit uniquement"),
    ]
    for application, jour, debut, fin, libelle in plages:
        db.add(
            PlageMaintenance(
                application_id=application.id,
                jour_semaine=jour,
                heure_debut=debut,
                heure_fin=fin,
                libelle=libelle,
            )
        )

    # ------------------------------------------------------------ Flux
    flux = [
        (edi, "Virements SEPA sortants", SensFlux.SORTANT, FrequenceFlux.QUOTIDIEN, "18:30",
         "Jours ouvrés", "SFTP", partenaires["banque"], True,
         "Rejet bloquant si non transmis avant 19h."),
        (edi, "Relevés bancaires entrants", SensFlux.ENTRANT, FrequenceFlux.QUOTIDIEN, "06:15",
         "Jours ouvrés", "SFTP", partenaires["banque"], True, None),
        (finance, "Écritures comptables du CRM", SensFlux.ENTRANT, FrequenceFlux.QUOTIDIEN,
         "22:00", "Tous les jours", "API REST", None, False, None),
        (bi, "Alimentation datawarehouse", SensFlux.ENTRANT, FrequenceFlux.QUOTIDIEN, "23:00",
         "Tous les jours", "ETL", None, False, "Durée moyenne 4h."),
        (portail, "Publication catalogue", SensFlux.SORTANT, FrequenceFlux.HORAIRE, None,
         "Tous les jours", "API REST", None, False, None),
        (rh, "Déclaration sociale nominative", SensFlux.SORTANT, FrequenceFlux.MENSUEL, "10:00",
         "Le 5 du mois", "SFTP", partenaires["banque"], True, "Échéance légale stricte."),
    ]
    for application, nom, sens, freq, heure, jour, proto, partenaire, bloquant, desc in flux:
        db.add(
            Flux(
                application_id=application.id,
                nom=nom,
                sens=sens,
                frequence=freq,
                heure=heure,
                jour=jour,
                protocole=proto,
                partenaire_id=partenaire.id if partenaire else None,
                bloquant=bloquant,
                description=desc,
            )
        )

    # ------------------------------------------------------------ Documentation
    matrice_doc = {
        finance: [
            (TypeDocument.DAT, EtatDocument.A_JOUR, "v4.1"),
            (TypeDocument.DEX, EtatDocument.A_JOUR, "v3.8"),
            (TypeDocument.MANUEL_UTILISATEUR, EtatDocument.OBSOLETE, "v2.0"),
            (TypeDocument.PRA_PCA, EtatDocument.A_JOUR, "v2.2"),
            (TypeDocument.MATRICE_FLUX, EtatDocument.A_JOUR, "v1.5"),
        ],
        rh: [
            (TypeDocument.DAT, EtatDocument.A_JOUR, "v2.4"),
            (TypeDocument.DEX, EtatDocument.EN_COURS, None),
            (TypeDocument.MANUEL_UTILISATEUR, EtatDocument.A_JOUR, "v5.1"),
            (TypeDocument.PRA_PCA, EtatDocument.MANQUANT, None),
        ],
        crm: [
            (TypeDocument.DAT, EtatDocument.OBSOLETE, "v1.2"),
            (TypeDocument.DEX, EtatDocument.MANQUANT, None),
            (TypeDocument.PROCEDURE_EXPLOITATION, EtatDocument.A_JOUR, "v2.0"),
        ],
        portail: [
            (TypeDocument.DAT, EtatDocument.A_JOUR, "v6.0"),
            (TypeDocument.DEX, EtatDocument.A_JOUR, "v6.0"),
            (TypeDocument.ANALYSE_RISQUE, EtatDocument.A_JOUR, "v3.0"),
            (TypeDocument.PRA_PCA, EtatDocument.EN_COURS, None),
        ],
        edi: [
            (TypeDocument.MATRICE_FLUX, EtatDocument.A_JOUR, "v9.3"),
            (TypeDocument.DEX, EtatDocument.A_JOUR, "v4.0"),
            (TypeDocument.PLAN_REPRISE_DONNEES, EtatDocument.OBSOLETE, "v1.0"),
        ],
        bi: [
            (TypeDocument.DAT, EtatDocument.EN_COURS, None),
            (TypeDocument.PROCEDURE_EXPLOITATION, EtatDocument.A_JOUR, "v1.1"),
        ],
        ged: [(TypeDocument.MANUEL_UTILISATEUR, EtatDocument.A_JOUR, "v1.0")],
        sso: [
            (TypeDocument.DAT, EtatDocument.A_JOUR, "v3.3"),
            (TypeDocument.DEX, EtatDocument.A_JOUR, "v3.3"),
            (TypeDocument.ANALYSE_RISQUE, EtatDocument.A_JOUR, "v2.1"),
            (TypeDocument.PRA_PCA, EtatDocument.A_JOUR, "v2.0"),
        ],
    }
    for application, docs in matrice_doc.items():
        for typologie, etat, version in docs:
            db.add(
                Document(
                    application_id=application.id,
                    typologie=typologie,
                    etat=etat,
                    version=version,
                    url=(
                        f"https://documentation.intra.exemple.fr/{application.code.lower()}/"
                        f"{typologie.value.lower()}"
                        if version
                        else None
                    ),
                    date_maj=date.today() - timedelta(days=45) if version else None,
                )
            )

    # ------------------------------------------------------------ Dispositifs de sécurité
    dispositifs = [
        (finance, "SonarQube", "SAST + qualité", "À chaque build"),
        (finance, "JFrog Xray", "SCA / dépendances", "Quotidien"),
        (portail, "SonarQube", "SAST", "À chaque build"),
        (portail, "JFrog Xray", "SCA / dépendances", "Quotidien"),
        (portail, "OWASP ZAP", "DAST", "Hebdomadaire"),
        (portail, "Gitleaks", "Détection de secrets", "À chaque commit"),
        (crm, "SonarQube", "SAST", "Hebdomadaire"),
        (edi, "JFrog Xray", "SCA / dépendances", "Quotidien"),
        (sso, "Trivy", "Scan d'images conteneurs", "Quotidien"),
        (sso, "SonarQube", "SAST", "À chaque build"),
        (bi, "Trivy", "Scan d'images conteneurs", "Hebdomadaire"),
    ]
    for application, outil, type_scan, freq in dispositifs:
        db.add(
            DispositifSecurite(
                application_id=application.id,
                outil=outil,
                type_scan=type_scan,
                frequence=freq,
                actif=True,
                dernier_scan=date.today() - timedelta(days=2),
            )
        )

    # ------------------------------------------------------------ Vulnérabilités
    def creer_vuln(reference, titre, composant, versions, cible, gravite, cvss, detection,
                   echeance, source, liens) -> None:
        vuln = Vulnerabilite(
            reference=reference,
            titre=titre,
            composant=composant,
            versions_touchees=versions,
            version_cible=cible,
            gravite=gravite,
            score_cvss=cvss,
            date_detection=detection,
            date_echeance=echeance,
            source=source,
            statut=StatutVulnerabilite.OUVERTE,
        )
        db.add(vuln)
        db.flush()
        for application, statut, version_installee in liens:
            db.add(
                VulnerabiliteApplication(
                    vulnerabilite_id=vuln.id,
                    application_id=application.id,
                    statut=statut,
                    version_installee=version_installee,
                )
            )

    aujourdhui = date.today()
    creer_vuln(
        "CVE-2024-21733", "Fuite d'informations via requêtes malformées", "Apache Tomcat",
        "8.5.7 – 8.5.98 / 9.0.0 – 9.0.85", "9.0.86", Gravite.ELEVEE, 7.5,
        aujourdhui - timedelta(days=52), aujourdhui - timedelta(days=8), "JFrog Xray",
        [(finance, StatutVulnerabilite.EN_COURS, "9.0.71"),
         (crm, StatutVulnerabilite.OUVERTE, "8.5.90"),
         (bi, StatutVulnerabilite.OUVERTE, "9.0.80")],
    )
    creer_vuln(
        "CVE-2023-44487", "Épuisement de ressources HTTP/2 (Rapid Reset)", "Nginx / proxy frontal",
        "< 1.25.3", "1.25.3", Gravite.CRITIQUE, 9.1,
        aujourdhui - timedelta(days=90), aujourdhui - timedelta(days=45), "Veille CERT-FR",
        [(portail, StatutVulnerabilite.EN_COURS, "1.24.0"),
         (sso, StatutVulnerabilite.OUVERTE, "1.22.1")],
    )
    creer_vuln(
        "CVE-2025-10188", "Élévation de privilèges via désérialisation", "Bibliothèque Jackson",
        "2.13.0 – 2.16.1", "2.17.2", Gravite.CRITIQUE, 9.8,
        aujourdhui - timedelta(days=12), aujourdhui + timedelta(days=3), "SonarQube",
        [(finance, StatutVulnerabilite.OUVERTE, "2.15.3"),
         (portail, StatutVulnerabilite.OUVERTE, "2.16.1"),
         (edi, StatutVulnerabilite.EN_COURS, "2.14.0")],
    )
    creer_vuln(
        "CVE-2024-6387", "Exécution de code à distance sur le service SSH", "OpenSSH",
        "8.5p1 – 9.7p1", "9.8p1", Gravite.CRITIQUE, 8.1,
        aujourdhui - timedelta(days=30), aujourdhui - timedelta(days=2), "Trivy",
        [(sso, StatutVulnerabilite.EN_COURS, "9.6p1"), (edi, StatutVulnerabilite.CORRIGEE, "9.8p1")],
    )
    creer_vuln(
        "CVE-2024-38875", "Déni de service sur le traitement des URL", "Framework web interne",
        "4.2.0 – 4.2.14", "4.2.15", Gravite.MOYENNE, 5.9,
        aujourdhui - timedelta(days=20), aujourdhui + timedelta(days=25), "Dependabot",
        [(crm, StatutVulnerabilite.OUVERTE, "4.2.10"), (ged, StatutVulnerabilite.OUVERTE, "4.2.8")],
    )
    creer_vuln(
        "CVE-2023-4863", "Débordement de tampon lors du décodage d'images", "libwebp",
        "< 1.3.2", "1.3.2", Gravite.FAIBLE, 4.3,
        aujourdhui - timedelta(days=140), aujourdhui + timedelta(days=60), "Trivy",
        [(ged, StatutVulnerabilite.RISQUE_ACCEPTE, "1.2.4")],
    )

    # ------------------------------------------------------------ Obsolescences
    obsolescences = [
        (finance, "Oracle Database", "12.2", "19c", -40, 60, StatutObsolescence.EN_COURS,
         Criticite.VITALE, "15 j/h", "Sophie Vasseur"),
        (finance, "Java Runtime", "8u382", "17.0.11", 120, 95, StatutObsolescence.PLANIFIEE,
         Criticite.MAJEURE, "8 j/h", "Sophie Vasseur"),
        (rh, "Windows Server", "2012 R2", "2022", -180, 45, StatutObsolescence.EN_COURS,
         Criticite.VITALE, "20 j/h", "Karim Belhadj"),
        (crm, "Java Runtime", "8u382", "17.0.11", 120, 210, StatutObsolescence.A_PLANIFIER,
         Criticite.MAJEURE, "10 j/h", "Élodie Marchand"),
        (crm, "Apache Tomcat", "8.5", "10.1", 60, None, StatutObsolescence.A_QUALIFIER,
         Criticite.STANDARD, None, None),
        (portail, "Angular", "14", "18", 30, 25, StatutObsolescence.PLANIFIEE,
         Criticite.MAJEURE, "12 j/h", "Thomas Girard"),
        (portail, "Node.js", "16", "20 LTS", -20, 10, StatutObsolescence.EN_COURS,
         Criticite.VITALE, "5 j/h", "Thomas Girard"),
        (edi, "Java Runtime", "8u382", "17.0.11", 120, 150, StatutObsolescence.A_PLANIFIER,
         Criticite.VITALE, "18 j/h", "Nadia Perrin"),
        (edi, "Oracle Database", "12.2", "19c", -40, 120, StatutObsolescence.A_PLANIFIER,
         Criticite.VITALE, "12 j/h", "Nadia Perrin"),
        (bi, "PostgreSQL", "11", "16", 200, None, StatutObsolescence.A_QUALIFIER,
         Criticite.STANDARD, None, "Julien Ferrand"),
        (bi, "Python", "3.8", "3.12", 90, 80, StatutObsolescence.PLANIFIEE,
         Criticite.STANDARD, "6 j/h", "Julien Ferrand"),
        (ged, "Apache Tomcat", "8.5", "10.1", 60, 300, StatutObsolescence.A_PLANIFIER,
         Criticite.MINEURE, "4 j/h", "Alice Nguyen"),
        (sso, "Windows Server", "2012 R2", "2022", -180, 30, StatutObsolescence.EN_COURS,
         Criticite.VITALE, "14 j/h", "Marc Aubry"),
        (sso, "OpenSSL", "1.1.1", "3.0", 15, 12, StatutObsolescence.PLANIFIEE,
         Criticite.VITALE, "3 j/h", "Marc Aubry"),
    ]
    for application, composant, version, cible, ecart_limite, ecart_prevu, statut, crit, charge, porteur in obsolescences:
        db.add(
            Obsolescence(
                application_id=application.id,
                composant=composant,
                version_obsolete=version,
                version_cible=cible,
                date_limite=date.today() + timedelta(days=ecart_limite),
                date_traitement_prevue=(
                    date.today() + timedelta(days=ecart_prevu) if ecart_prevu is not None else None
                ),
                statut=statut,
                criticite=crit,
                charge_estimee=charge,
                porteur=porteur,
            )
        )

    # ------------------------------------------------------------ DoJo (procédures filmées)
    dojos = [
        (finance, "Redémarrer le service applicatif", TypeDojo.REDEMARRAGE, "6 min", "Sophie Vasseur"),
        (finance, "Contrôler la clôture comptable", TypeDojo.EXPLOITATION, "11 min", "Sophie Vasseur"),
        (edi, "Rejouer un flux bancaire en échec", TypeDojo.INCIDENT, "9 min", "Nadia Perrin"),
        (edi, "Vérifier la chaîne d'échanges du matin", TypeDojo.SUPERVISION, "7 min", "Nadia Perrin"),
        (portail, "Basculer sur la page de maintenance", TypeDojo.EXPLOITATION, "4 min", "Thomas Girard"),
        (portail, "Déployer un correctif en production", TypeDojo.DEPLOIEMENT, "14 min", "Thomas Girard"),
        (sso, "Relancer le fournisseur d'identité", TypeDojo.REDEMARRAGE, "5 min", "Marc Aubry"),
        (bi, "Relancer une alimentation en échec", TypeDojo.INCIDENT, "8 min", "Julien Ferrand"),
        (rh, "Restaurer une sauvegarde de la veille", TypeDojo.SAUVEGARDE_RESTAURATION, "16 min", "Karim Belhadj"),
    ]
    for application, titre, type_dojo, duree, auteur in dojos:
        db.add(
            Dojo(
                application_id=application.id,
                titre=titre,
                type=type_dojo,
                url=(
                    "https://videos.intra.exemple.fr/dojo/"
                    f"{application.code.lower()}-{type_dojo.value.lower()}"
                ),
                duree=duree,
                auteur=auteur,
                date_maj=date.today() - timedelta(days=30),
                description="Procédure filmée pas à pas, hébergée sur le portail vidéo interne.",
            )
        )

    # ------------------------------------------------------------ Calendrier
    lundi_prochain = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(
        days=(7 - datetime.now().weekday())
    )
    evenements = [
        Evenement(
            titre="Maintenance SSO — montée de version majeure",
            type=TypeEvenement.MAINTENANCE_TRANSVERSE,
            debut=lundi_prochain + timedelta(days=2, hours=23),
            fin=lundi_prochain + timedelta(days=3, hours=2),
            impact="Authentification indisponible sur l'ensemble du parc",
            pilote="Marc Aubry",
            description="Communication obligatoire à J-5 auprès de tous les responsables.",
        ),
        Evenement(
            titre="Coupure réseau datacenter Nord",
            type=TypeEvenement.COUPURE_RESEAU,
            debut=lundi_prochain + timedelta(days=5, hours=6),
            fin=lundi_prochain + timedelta(days=5, hours=9),
            impact="Bascule sur le lien de secours, latence accrue",
            pilote="NOC CloudOps",
        ),
        Evenement(
            titre="Fenêtre de tir infrastructure — patch OS",
            type=TypeEvenement.FENETRE_TIR_INFRA,
            debut=lundi_prochain + timedelta(days=9, hours=22),
            fin=lundi_prochain + timedelta(days=10, hours=4),
            impact="Redémarrage des serveurs applicatifs par vagues",
            pilote="CloudOps Infogérance",
        ),
        Evenement(
            titre="Gel de production — clôture comptable",
            type=TypeEvenement.GEL_PRODUCTION,
            debut=lundi_prochain + timedelta(days=12),
            fin=lundi_prochain + timedelta(days=17),
            impact="Aucune mise en production autorisée",
            pilote="Sophie Vasseur",
        ),
    ]
    evenements[0].applications = [sso, finance, crm, portail, rh]
    evenements[1].applications = [edi, bi]
    evenements[2].applications = [finance, crm, bi, ged]
    evenements[3].applications = [finance]
    db.add_all(evenements)

    # ------------------------------------------------------------ Communication
    db.add_all(
        [
            ListeDiffusion(
                nom="Utilisateurs métier — Finance",
                description="Correspondants finance et contrôle de gestion.",
                destinataires="finance-corres@exemple.fr; controle-gestion@exemple.fr",
            ),
            ListeDiffusion(
                nom="Clients externes — Portail",
                description="Contacts clients abonnés aux notifications de service.",
                destinataires="clients-portail@exemple.fr",
            ),
            ListeDiffusion(
                nom="Cellule de crise",
                description="Direction, RSSI, production, communication.",
                destinataires="crise@exemple.fr; rssi@exemple.fr; production@exemple.fr",
            ),
            ListeDiffusion(
                nom="Récapitulatif hebdomadaire MCO",
                description="Destinataires du récapitulatif automatique du lundi matin.",
                destinataires="pilotage-mco@exemple.fr; rssi@exemple.fr",
            ),
        ]
    )
    db.add_all(
        [
            TemplateCommunication(
                nom="Incident — ouverture",
                categorie=CategorieTemplate.INCIDENT_OUVERTURE,
                sujet="[INCIDENT] {{application}} — service perturbé",
                corps_html=GABARIT_INCIDENT,
                variables="{{application}}, {{code_application}}, {{responsable}}, {{date}}, {{heure}}",
            ),
            TemplateCommunication(
                nom="Incident — rétablissement",
                categorie=CategorieTemplate.RETABLISSEMENT,
                sujet="[RÉTABLI] {{application}} — retour à la normale",
                corps_html=GABARIT_RETABLISSEMENT,
                variables="{{application}}, {{code_application}}, {{responsable}}, {{date}}, {{heure}}",
            ),
            TemplateCommunication(
                nom="Maintenance planifiée",
                categorie=CategorieTemplate.MAINTENANCE_PLANIFIEE,
                sujet="[MAINTENANCE] {{application}} — intervention programmée",
                corps_html=GABARIT_MAINTENANCE,
                variables="{{application}}, {{code_application}}, {{responsable}}",
            ),
        ]
    )

    db.commit()
    logger.info("Jeu de données injecté.")
