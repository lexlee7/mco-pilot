# Poste de conduite MCO

Application web de pilotage du **maintien en condition opérationnelle** d'un parc applicatif :
parc et fiches détaillées, moteur de recherche de créneau de maintenance, suivi des
vulnérabilités avec relances automatiques, calendrier MCO et communication de crise.

---

## 1. Ce que fait l'application

| Module | Ce que vous y faites |
|---|---|
| **Tableau de bord** | Voir en un écran l'état du parc, la dette de sécurité et la capacité d'intervention (le « ruban hebdomadaire »). |
| **Parc applicatif** | Créer/modifier les applications. Chaque fiche contient : responsable, notes, périmètre DORA, exposition Internet, plages de maintenance, cartographie des flux, habilitations de production, SBOM, sanity check, documentation (avec liens), dispositifs de sécurité, vulnérabilités, obsolescences et DoJo. |
| **Créneaux de maintenance** | Sélectionner plusieurs applications (ou tout le parc) et trouver la fenêtre commune. S'il n'existe aucun créneau parfait, l'outil propose le **moindre mal** en nommant les applications en conflit. |
| **Vulnérabilités** | Déclarer une faille (composant, version touchée, version cible), l'associer à plusieurs applications, suivre l'avancement application par application, déclencher les relances. |
| **Obsolescences** | Suivre les composants en fin de support : version obsolète, version cible, date limite imposée par l'éditeur et date de traitement planifiée. Planning visuel du parc, groupable par composant ou par application. |
| **Calendrier MCO** | Voir les plages projetées et inscrire les événements transverses (maintenance SSO, coupure réseau, fenêtre de tir infra, gel de production). |
| **Éditeurs & partenaires** | Annuaire centralisé des contacts et des chaînes d'escalade. |
| **Communication de crise** | Assistant en 3 étapes : modèle → destinataires → envoi. Éditeur de modèles HTML, listes de diffusion, historique. |

---

## 2. Architecture du projet

```
mco-pilot/
├── backend/                      ← l'API (le « moteur »)
│   ├── app/
│   │   ├── main.py               point d'entrée : branche tout et sert le front
│   │   ├── database.py           connexion à la base de données
│   │   ├── models.py             les tables (applications, vulnérabilités…)
│   │   ├── schemas.py            format des données échangées avec le front
│   │   ├── serializers.py        mise en forme des réponses
│   │   ├── seed.py               jeu de données de démonstration
│   │   ├── routers/              les URL de l'API, un fichier par domaine
│   │   │   ├── dashboard.py      /api/dashboard
│   │   │   ├── applications.py   /api/applications…
│   │   │   ├── partenaires.py    /api/partenaires…
│   │   │   ├── vulnerabilites.py /api/vulnerabilites…
│   │   │   ├── maintenance.py    /api/maintenance/recherche
│   │   │   ├── evenements.py     /api/evenements…
│   │   │   └── communication.py  /api/communication…
│   │   └── services/
│   │       ├── slot_engine.py    ← le moteur de recherche de créneau
│   │       ├── mailer.py         envoi d'e-mails (+ mode simulation)
│   │       ├── relances.py       relances et récapitulatif hebdomadaire
│   │       └── scheduler.py      déclenchement automatique des relances
│   └── requirements.txt          la liste des bibliothèques Python à installer
│
├── frontend/                     ← l'interface (ce que l'utilisateur voit)
│   ├── src/
│   │   ├── index.html            page d'accueil vide que Angular remplit
│   │   ├── styles.css            le système de design (couleurs, thèmes…)
│   │   └── app/
│   │       ├── app.component.ts  la coquille : menu de gauche, thème, alertes
│   │       ├── app.routes.ts     la liste des pages et de leurs adresses
│   │       ├── core/             modèles TypeScript + service d'appel à l'API
│   │       ├── shared/           icônes et fenêtre modale réutilisables
│   │       └── pages/            une page par module (8 fichiers)
│   ├── package.json              la liste des bibliothèques JavaScript
│   └── angular.json              configuration de compilation
│
├── Dockerfile                    recette de fabrication pour Render
├── render.yaml                   description de l'hébergement
└── .env.example                  modèle de configuration
```

**Choix techniques et pourquoi :**

- **FastAPI (Python)** côté serveur : le plus léger à démarrer, et il génère
  automatiquement une documentation interactive de l'API.
- **SQLite en local, PostgreSQL en ligne** : en local, la base est un simple fichier,
  vous n'avez donc **rien à installer**. Sur Render, l'application bascule toute seule
  sur PostgreSQL dès qu'elle détecte la variable `DATABASE_URL`.
- **Angular 18 en composants « standalone »** : pas de modules à déclarer, chaque page
  est un fichier autonome, chargé uniquement quand on la visite.
- **Une seule application déployée** : le front compilé est recopié dans le back, donc
  un seul service à héberger (et il reste dans l'offre gratuite de Render).

---

## 3. Vocabulaire utile

Si certains mots ci-dessous ne vous sont pas familiers, voici l'essentiel :

- **Terminal** : la fenêtre où l'on tape des commandes. Sous Windows, ouvrez
  « PowerShell » ; sous macOS, « Terminal » ; sous Linux, votre terminal habituel.
- **Dépôt (repository)** : le dossier de votre code, versionné avec Git.
- **Environnement virtuel (venv)** : un dossier isolé où l'on installe les bibliothèques
  Python d'un projet, pour ne pas polluer le reste de votre machine.
- **ORM** : la couche qui traduit les objets Python en lignes de base de données.
  Vous n'écrivez donc pas de SQL à la main.
- **CORS** : règle de sécurité des navigateurs. En développement, le front (port 4200)
  et l'API (port 8000) sont à deux adresses différentes : il faut donc autoriser
  explicitement le front. C'est déjà configuré.
- **SMTP** : le protocole d'envoi d'e-mails. Tant qu'il n'est pas configuré,
  l'application **simule** les envois (rien ne part, tout est tracé).
- **Port** : le « numéro de porte » d'un service sur votre machine. Ici : 8000 pour
  l'API, 4200 pour l'interface.

---

## 4. Installation en local — pas à pas *(facultatif)*

> **Vous ne voulez rien installer sur votre PC ?** Sautez directement à la
> [section 5](#5-déploiement-gratuit-sur-render--pas-à-pas). Le déploiement se fait
> entièrement depuis un navigateur : c'est le serveur de Render qui installe Python,
> Node et compile l'application. Vous obtenez une adresse web utilisable depuis
> n'importe quel poste, sans avoir rien posé sur le vôtre.
>
> Cette section 4 ne sert qu'à faire tourner l'application **sur votre machine**, ce qui
> est utile pour développer ou tester hors ligne — mais n'est pas nécessaire pour
> l'utiliser.

### Étape 4.1 — Installer les deux outils nécessaires

1. **Python 3.11 ou plus récent** : téléchargez-le sur <https://www.python.org/downloads/>.
   Sous Windows, **cochez impérativement la case « Add Python to PATH »** pendant
   l'installation.
2. **Node.js 20 ou plus récent** : téléchargez la version « LTS » sur <https://nodejs.org>.

Vérifiez que tout est en place en tapant ces deux commandes dans un terminal :

```bash
python --version
node --version
```

Vous devez voir s'afficher deux numéros de version. Si `python` n'est pas reconnu,
essayez `python3 --version`. (Dans toute la suite, si `python` ne fonctionne pas chez
vous, remplacez-le par `python3`, et `pip` par `pip3`.)

### Étape 4.2 — Démarrer l'API

Ouvrez un terminal, placez-vous dans le dossier du projet, puis :

```bash
cd backend

# Créer un environnement virtuel (un dossier isolé pour les bibliothèques)
python -m venv .venv

# L'activer :
#   sous macOS / Linux :
source .venv/bin/activate
#   sous Windows (PowerShell) :
.venv\Scripts\Activate.ps1

# Installer les bibliothèques du projet
pip install -r requirements.txt

# Démarrer le serveur
uvicorn app.main:app --reload --port 8000
```

Vous devez voir apparaître des lignes se terminant par
`Application startup complete.` — **laissez ce terminal ouvert**, c'est votre serveur.

Vérifiez en ouvrant <http://localhost:8000/api/sante> dans votre navigateur :
vous devez lire `{"statut":"ok","service":"pilotage-mco"}`.

> Documentation interactive de l'API : <http://localhost:8000/docs>.
> Vous pouvez y tester tous les appels sans écrire une ligne de code.

Au tout premier démarrage, un jeu de données de démonstration est injecté
(8 applications, 6 vulnérabilités, plages, flux, modèles de messages…).
Pour repartir d'une base vide, arrêtez le serveur, supprimez le fichier
`backend/mco.db`, puis redémarrez.

### Étape 4.3 — Démarrer l'interface

Ouvrez un **second** terminal (le premier continue de faire tourner l'API) :

```bash
cd frontend
npm install     # à faire une seule fois, cela prend quelques minutes
npm start
```

Quand la ligne `Local: http://localhost:4200/` s'affiche, ouvrez
<http://localhost:4200> dans votre navigateur. L'application est là.

### Étape 4.4 — Configurer l'envoi d'e-mails (facultatif)

Sans configuration, tout fonctionne : les envois sont simplement **simulés** et un
bandeau orange vous le rappelle dans le module Communication.

Pour envoyer réellement, arrêtez l'API (`Ctrl+C`), définissez les variables puis
relancez :

```bash
# macOS / Linux
export SMTP_HOST=smtp.exemple.fr
export SMTP_USER=pilotage-mco@exemple.fr
export SMTP_PASSWORD=votre_mot_de_passe

# Windows (PowerShell)
$env:SMTP_HOST="smtp.exemple.fr"
$env:SMTP_USER="pilotage-mco@exemple.fr"
$env:SMTP_PASSWORD="votre_mot_de_passe"
```

> Si votre messagerie utilise la double authentification (Gmail, Microsoft 365…),
> créez un **mot de passe d'application** dédié plutôt que d'utiliser votre mot de
> passe personnel.

---

## 5. Déploiement gratuit sur Render — pas à pas

### Étape 5.1 — Mettre le code sur GitHub **sans rien installer**

Render ne sait pas déployer un dossier posé sur votre disque : il va chercher le code
sur GitHub. Il faut donc y déposer le projet une fois. **Cela se fait entièrement depuis
votre navigateur, sans installer le moindre logiciel** — ni Git, ni Python, ni Node.
C'est le serveur de Render qui se chargera de tout compiler.

**a) Décompresser l'archive.** Windows et macOS savent le faire nativement :

- **Windows** : clic droit sur `mco-pilot.zip` → **Extraire tout…** → **Extraire**.
- **macOS** : double-clic sur l'archive.

Vous obtenez un dossier `mco-pilot` contenant `backend`, `frontend`, `Dockerfile`,
`README.md`, `render.yaml`. Ouvrez-le : vous allez avoir besoin de son contenu à
l'étape c.

> **Attention à un piège classique.** Selon l'outil de décompression, vous pouvez
> obtenir un dossier `mco-pilot` qui contient… un second dossier `mco-pilot`. Descendez
> jusqu'à celui qui contient directement `Dockerfile` : c'est **son contenu** qu'il faut
> envoyer, pas le dossier parent. Si `Dockerfile` ne se trouve pas à la racine du dépôt
> GitHub, Render ne saura pas construire l'application.

**b) Créer le dépôt sur GitHub.** Créez un compte sur <https://github.com> si vous n'en
avez pas. Cliquez ensuite sur le bouton **New** (ou rendez-vous sur
<https://github.com/new>) :

- **Repository name** : `mco-pilot`
- Laissez **Public**
- **Ne cochez aucune case d'initialisation** (pas de README, pas de .gitignore)
- Cliquez **Create repository**

GitHub affiche alors une page d'instructions. Repérez le lien
**« uploading an existing file »** au milieu de la page et cliquez dessus. (Vous pouvez
aussi aller directement à `https://github.com/VOTRE-COMPTE/mco-pilot/upload/main`.)

**c) Déposer les fichiers.** Ouvrez côte à côte votre explorateur de fichiers et la
fenêtre du navigateur, puis **sélectionnez tout le contenu** du dossier `mco-pilot`
(`Ctrl+A` sous Windows, `Cmd+A` sous macOS) et **faites-le glisser dans la zone de dépôt
de GitHub**. Les sous-dossiers `backend` et `frontend` sont envoyés avec leur arborescence.

Patientez que la liste des fichiers se remplisse (une cinquantaine, quelques dizaines de
secondes). Descendez en bas de page, écrivez un court message dans le champ de commit
— par exemple `Application de pilotage MCO` — puis cliquez **Commit changes**.

> **Un détail qui compte.** Le fichier `.gitignore` commence par un point : sur macOS
> comme sur Windows, ces fichiers sont masqués par défaut et ne seront donc pas
> sélectionnés par votre `Ctrl+A`. Ce n'est pas grave pour le déploiement — Render n'en
> a pas besoin. Si vous tenez à l'inclure : sous macOS, affichez les fichiers cachés avec
> `Cmd+Maj+.` ; sous Windows, onglet **Affichage** de l'explorateur → cochez
> **Éléments masqués**.

**d) Vérifier.** Rechargez la page d'accueil de votre dépôt. Vous devez voir, **à la
racine**, les entrées `backend`, `frontend`, `Dockerfile`, `README.md` et `render.yaml`.
Si `Dockerfile` est enfoui dans un sous-dossier, reprenez à l'étape a : c'est le piège
signalé plus haut.

C'est terminé, vous pouvez passer à l'étape suivante.

> **Et pour les mises à jour ?** Pour modifier un fichier plus tard, ouvrez-le sur
> GitHub, cliquez sur l'icône crayon, éditez, puis **Commit changes** : Render
> redéploiera automatiquement. Pour remplacer plusieurs fichiers d'un coup, utilisez de
> nouveau **Add file → Upload files**.

> **Si vous voulez un jour travailler sur le code sans rien installer non plus**, ouvrez
> votre dépôt sur GitHub et appuyez sur la touche **point** (`.`) : un éditeur de code
> complet s'ouvre dans le navigateur. Pour aussi *exécuter* l'application dans le
> navigateur, utilisez **Code → Codespaces → Create codespace**, qui vous donne une
> machine de développement en ligne (offre gratuite mensuelle limitée).

### Étape 5.2 — Créer le service sur Render

1. Créez un compte sur <https://render.com> (l'inscription avec GitHub est la plus simple).
2. Dans le tableau de bord, cliquez **New +** puis **Blueprint**.
3. Sélectionnez votre dépôt `mco-pilot`. Render lit le fichier `render.yaml` et vous
   propose de créer **un service web** et **une base PostgreSQL**.
4. Cliquez **Apply**. La première construction dure 5 à 10 minutes : Render compile le
   front Angular puis fabrique l'image Python. C'est normal.

À la fin, Render affiche une adresse du type
`https://pilotage-mco.onrender.com` : votre application est en ligne.

> **Variante sans Blueprint.** Si vous préférez cliquer plutôt que d'utiliser
> `render.yaml` : **New + → Web Service**, choisissez le dépôt, sélectionnez
> **Runtime : Docker**, laissez le Dockerfile détecté, plan **Free**. Créez ensuite
> séparément **New + → PostgreSQL** (plan Free), copiez son *Internal Database URL* et
> ajoutez-la dans le service web comme variable `DATABASE_URL`.

### Étape 5.3 — Renseigner les variables d'environnement

Dans Render, ouvrez votre service web → onglet **Environment**. Les variables
suivantes sont déjà posées par `render.yaml` ; complétez celles laissées vides si vous
voulez des e-mails réels :

| Variable | À quoi elle sert | Valeur |
|---|---|---|
| `DATABASE_URL` | Connexion PostgreSQL | remplie automatiquement |
| `SEED_ON_STARTUP` | Injecte le jeu de démonstration au premier lancement | `true` puis `false` une fois vos vraies données saisies |
| `SCHEDULER_ENABLED` | Active les relances automatiques | `true` |
| `SCHEDULER_TIMEZONE` | Fuseau des relances | `Europe/Paris` |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | Envoi réel des e-mails | vos identifiants, ou vide pour rester en simulation |

Après toute modification, cliquez **Save Changes** : Render redémarre le service.

### Étape 5.4 — Vérifier le déploiement

1. Ouvrez `https://VOTRE-SERVICE.onrender.com/api/sante` → vous devez lire `{"statut":"ok"…}`.
2. Ouvrez `https://VOTRE-SERVICE.onrender.com` → l'interface s'affiche.
3. Onglet **Logs** dans Render pour suivre le démarrage en cas de souci.

> **Bon à savoir sur l'offre gratuite.** Un service gratuit s'endort après 15 minutes
> sans visite : la première page consultée ensuite met 30 à 60 secondes à répondre,
> le temps du réveil. C'est normal. La base PostgreSQL gratuite a également une durée
> de vie limitée : pensez à exporter vos données si l'outil devient un usage durable.

---

## 6. Comprendre le moteur de recherche de créneau

C'est la pièce la plus spécifique de l'outil, elle mérite une explication.

1. La semaine est découpée en **créneaux de 15 minutes** (672 au total).
2. Pour chaque application, on construit un **masque de disponibilité** : chaque créneau
   est marqué « arrêtable » ou non, d'après les plages de maintenance déclarées dans sa
   fiche. Une plage qui franchit minuit (22h → 02h) est gérée correctement.
3. On superpose les masques des applications sélectionnées. Une fenêtre est retenue si
   le nombre d'applications non couvertes reste **inférieur ou égal à la tolérance**
   que vous avez fixée.
4. Les résultats sont triés par nombre de conflits croissant, puis chronologiquement,
   et les fenêtres qui se chevauchent sont fusionnées pour ne pas afficher vingt fois
   le même créneau décalé d'un quart d'heure.
5. Chaque conflit est **nommé et motivé** : « FIN-CORE — hors plage habituelle
   (Mercredi 22:00-02:00) » ou « BI-DWH — aucune plage de maintenance déclarée ».

Concrètement : mettez la tolérance à `0` pour n'accepter qu'un créneau parfait ;
montez-la à `1` ou `2` pour obtenir le moindre mal quand aucun consensus n'existe.

**Attention :** une application sans aucune plage déclarée est comptée en conflit
partout. Un point d'exclamation orange vous le signale dans la liste de sélection.

---

## 6 bis. Lire le planning des obsolescences

La frise oppose deux dates que l'on confond souvent :

- **La date limite** est subie : c'est la fin de support annoncée par l'éditeur.
- **La date de traitement prévue** est votre engagement : c'est ce que vous avez planifié.

Chaque barre représente le temps qu'il reste pour agir, d'aujourd'hui jusqu'à la fin de
support. Sa couleur donne l'urgence : rouge si le support est déjà terminé, ambre à moins
de trois mois, bleu à moins d'un an, vert au-delà. Le losange marque la date de traitement
planifiée.

**Le losange situé à droite de sa barre est le signal à surveiller** : il indique que vous
avez planifié le traitement *après* la fin de support. C'est une dérive, comptée séparément
dans les indicateurs. Elle peut être assumée — d'où le statut « Dérogation » — mais elle
doit être vue et décidée, pas subie.

Le regroupement **par composant** répond à une autre question que le regroupement par
application : « si je décide de sortir de Java 8, combien d'applications dois-je embarquer,
et laquelle me contraint le plus tôt ? »

## 7. Relances automatiques

| Tâche | Quand | Contenu |
|---|---|---|
| Relance ciblée | du lundi au vendredi à 08:00 | Chaque responsable reçoit le tableau des failles de **ses** applications dont l'échéance est dépassée ou proche (7 jours). |
| Récapitulatif hebdomadaire | lundi à 07:30 | Synthèse consolidée du parc, envoyée à la liste de diffusion dont le nom contient « hebdomadaire ». |

Vous pouvez déclencher les deux manuellement depuis la page **Vulnérabilités**
(boutons « Relancer les responsables » et « Envoyer le récapitulatif »), ce qui est
pratique pour vérifier le contenu avant de compter sur l'automatisme.

---

## 8. Problèmes fréquents

| Symptôme | Cause probable | Solution |
|---|---|---|
| L'interface s'affiche mais aucune donnée n'apparaît | l'API n'est pas démarrée | Vérifiez le terminal de l'étape 4.2 et ouvrez <http://localhost:8000/api/sante>. |
| `Address already in use` au démarrage | le port est déjà occupé | Changez de port : `uvicorn app.main:app --reload --port 8001`. |
| `ng: command not found` | dépendances non installées | Relancez `npm install` dans `frontend/`, et utilisez `npm start` plutôt que `ng serve`. |
| Erreur CORS dans la console du navigateur | front et API sur des adresses inattendues | Ajoutez votre adresse à la variable `CORS_ORIGINS`. |
| Les e-mails ne partent pas | SMTP non configuré | C'est le comportement normal en mode simulation : consultez l'historique dans le module Communication. |
| `column ... does not exist` au démarrage après une mise à jour | la base contient l'ancienne structure ; les nouvelles colonnes n'y ont pas encore été ajoutées | Corrigé automatiquement : l'application complète le schéma à chaque démarrage. Vérifiez l'état avec `https://VOTRE-SERVICE.onrender.com/api/diagnostic-base`. |
| La compilation échoue sur l'inlining des polices | pas d'accès à Google Fonts au moment du build | Déjà désactivé dans `angular.json` (`fonts.inline: false`). |
| Premier accès très lent en ligne | service gratuit endormi | Attendez 30 à 60 secondes. |
| Le fond s'affiche mais la page reste vide, ou le menu apparaît mais les boutons ne font rien | une ou plusieurs ressources du front sont introuvables sur le serveur | Ouvrez `https://VOTRE-SERVICE.onrender.com/api/diagnostic-front` : la réponse indique si le front compilé est complet et liste les ressources manquantes. |
| `Ressource statique introuvable` dans la console du navigateur | le front compilé est incomplet ou périmé dans l'image | Relancez un déploiement dans Render (**Manual Deploy → Clear build cache & deploy**), puis rechargez avec `Ctrl+Shift+R`. |

---

## 8 bis. Faire évoluer le modèle de données

L'application complète son schéma toute seule au démarrage : si un champ a été ajouté
aux modèles depuis le dernier déploiement, la colonne correspondante est créée dans la
base sans perte de données (`backend/app/schema_sync.py`). C'est ce qui permet de mettre
à jour l'application en ligne sans jamais toucher à la base.

Cette synchronisation est volontairement **additive** : elle ajoute des tables et des
colonnes, mais ne renomme rien, ne change aucun type et ne supprime jamais. Un renommage
de champ ou un changement de type demande une vraie migration — c'est le rôle d'Alembic,
délibérément écarté ici pour ne pas imposer une étape en ligne de commande.

L'adresse `/api/diagnostic-base` compare à tout moment la structure attendue et la
structure réelle.

## 9. Aller plus loin

Quelques évolutions naturelles, par ordre d'utilité pour un parc réel :

1. **Authentification** — l'application est aujourd'hui ouverte. Un SSO d'entreprise
   (OIDC) ou une simple authentification par jeton serait le premier chantier.
2. **Historisation des changements** — tracer qui a modifié quoi et quand sur les
   fiches, indispensable en audit.
3. **Alimentation automatique des vulnérabilités** — brancher l'API de votre scanner
   (Xray, Dependabot, Trivy) sur `POST /api/vulnerabilites` plutôt que de saisir à la main.
4. **Export du calendrier au format iCalendar** pour l'ouvrir dans Outlook.
