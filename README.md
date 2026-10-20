# Plateforme de recrutement assistée par IA

Application de recrutement avec deux espaces :

- le candidat consulte les offres, dépose un CV PDF et suit ses candidatures ;
- le responsable RH gère ses offres, consulte les candidatures, planifie les entretiens et prend la décision finale ;
- un pipeline asynchrone extrait le texte du CV et calcule un score comparatif pour une offre donnée.

Le score IA est une aide à la priorisation. Il ne constitue ni une décision automatique, ni une mesure de certitude sur un candidat.

## Architecture

```text
frontend (React + Vite)
        │ API REST, session HTTP-only
backend (Express)
        ├── PostgreSQL : données, sessions, files de jobs et audit
        ├── stockage privé : PDF des CV
        ├── worker IA : extraction et classement
        └── worker e-mail : notifications SMTP

DVC : dataset d'évaluation → entraînement → artefact du ranker + rapport
```

Le backend utilise une organisation routes → contrôleurs → services. Les workers s'exécutent actuellement dans le même processus que l'API, mais les jobs PostgreSQL sont réclamés avec verrouillage pour éviter leur double traitement.

## Prérequis

- Node.js 22 ;
- PostgreSQL ;
- Python 3.12 ou plus récent pour DVC ;
- un accès SMTP uniquement si les e-mails doivent être envoyés.

## Installation locale

```powershell
npm ci
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Créer ensuite la base indiquée par `DATABASE_URL`, puis appliquer les migrations :

```powershell
npm run db:init --prefix backend
npm run dev
```

L'API écoute par défaut sur `http://localhost:3000` et Vite sur `http://localhost:5173`.

Pour créer un compte RH :

```powershell
npm run user:create-hr --prefix backend -- --first-name "Amina" --last-name "Ben Salah" --email "rh@example.com" --password "MotDePasseLong"
```

Les comptes candidats sont créés depuis l'interface. Les données de démonstration sont facultatives :

```powershell
npm run demo:seed
```

## Configuration

Les valeurs de référence se trouvent dans `backend/.env.example` et `frontend/.env.example`.

En production :

- utiliser un `SESSION_SECRET` aléatoire d'au moins 32 caractères ;
- définir exactement `FRONTEND_URL` pour CORS et la protection d'origine ;
- activer `DATABASE_SSL` lorsque l'hébergeur PostgreSQL l'exige ;
- placer `CV_STORAGE_PATH` sur un volume privé, sauvegardé et chiffré ;
- ne jamais exposer le dossier des CV comme contenu statique ;
- configurer SMTP ou accepter que le worker e-mail reste désactivé.

## Base de données

```powershell
npm run db:migrate --prefix backend
npm run db:check --prefix backend
```

Chaque migration est transactionnelle et enregistrée dans `schema_migrations`. Ne pas modifier une ancienne migration déjà déployée : créer un nouveau fichier numéroté dans `database/migrations`.

## Pipeline IA et DVC

Installer DVC avec la version épinglée :

```powershell
py -m pip install -r requirements-dvc.txt
npm run data:reproduce
```

Le pipeline reproduit :

1. `backend/data/ai-evaluation-dataset.json` ;
2. `backend/src/ai/models/recruitment-ranker-v2.json` ;
3. `backend/data/ai-ranking-report.json`.

Le modèle est une sortie DVC : une installation ou un déploiement propre doit exécuter `dvc pull` ou `npm run data:reproduce` avant de démarrer l'API.

Commandes utiles :

```powershell
npm run ai:validate
npm run ai:train
npm run ai:evaluate --prefix backend
```

Le jeu actuel est petit et fictif. Les métriques servent à détecter une régression technique ; elles ne démontrent pas une performance, une absence de biais ou une conformité en situation réelle. Le tri par score n'est autorisé que pour les candidatures d'une même offre.

## Rétention des CV

La purge concerne :

- les candidatures rejetées depuis plus de `CV_RETENTION_DAYS` ;
- toutes les candidatures d'une offre close depuis plus de cette durée.

Commencer par une simulation :

```powershell
$env:CV_PURGE_DRY_RUN='true'
npm run data:purge-cvs
```

Après contrôle du nombre annoncé :

```powershell
$env:CV_PURGE_DRY_RUN='false'
npm run data:purge-cvs
```

La suppression retire l'enregistrement applicatif et le PDF. Le candidat peut également supprimer lui-même une candidature depuis son espace.

## Qualité

```powershell
npm test
npm run build
npm run ai:validate
npm run db:check --prefix backend
```

La CI reproduit le pipeline DVC deux fois dans le même environnement Linux et vérifie que `dvc.lock` reste identique entre ces deux exécutions. Elle évalue ensuite le ranker, exécute les tests et construit le frontend.

## Déploiement et supervision

Avant mise en production :

- exécuter les migrations puis `db:check` ;
- fournir l'artefact DVC du ranker ;
- conserver un seul processus worker par instance d'API ou séparer les workers dans un service dédié ;
- surveiller `/api/health`, les jobs `failed`, les files en attente et l'espace du volume CV ;
- centraliser les sorties standard du backend dans la solution de logs de l'hébergeur ;
- planifier la purge des CV et contrôler régulièrement son mode simulation.

La documentation détaillée du classement se trouve dans `docs/AI-MATCHING-V2.md`.
