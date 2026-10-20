# Matching IA V2 — modèle de ranking appris

## Objectif

La V1 utilisait un encodeur MiniLM prêt à l'emploi puis combinait la similarité sémantique et le taux de compétences avec des poids fixes de 65 % et 35 %. La V2 conserve MiniLM comme extracteur de représentation, mais la décision finale est produite par un modèle de learning-to-rank entraîné dans le projet.

Le pipeline exécuté en production est le suivant :

```text
CV + offre
  → nettoyage des données sensibles
  → embeddings MiniLM
  → extraction de cinq caractéristiques explicables
  → normalisation apprise
  → ranker pairwise appris
  → calibration du score
  → score de compatibilité, facteurs et preuves textuelles
```

## Dataset

Le dataset V2 contient :

- 10 offres ;
- 30 CV fictifs ;
- 300 jugements offre–CV ;
- quatre niveaux de pertinence, de 0 à 3.

Le découpage est effectué par offre pour empêcher qu'une même offre soit présente dans l'entraînement et dans le test :

- 7 offres d'entraînement, soit 210 paires ;
- 1 offre de validation, soit 30 paires ;
- 2 offres de test, soit 60 paires.

Les données reproductibles sont générées par `backend/src/scripts/export-evaluation-dataset.js`. Les jugements se trouvent dans `backend/src/evaluation/reference-cases.js` et sont exportés dans `backend/data/ai-evaluation-dataset.json`.

## Taxonomie de compétences

Les compétences ne sont plus déclarées dans le code de l'extracteur. Elles sont définies dans `backend/src/ai/skill-taxonomy.json` avec :

- un identifiant canonique ;
- des synonymes ;
- une catégorie ;
- des compétences associées.

L'extracteur retourne aussi la phrase du CV ayant servi de preuve.

## Caractéristiques apprises

Le ranker reçoit cinq caractéristiques comprises entre 0 et 1 :

1. similarité sémantique MiniLM ;
2. couverture des compétences demandées ;
3. couverture des compétences associées ;
4. alignement entre l'intitulé du poste et le CV ;
5. précision des compétences du candidat par rapport à l'offre.

Le service `ai-ranking-features.service.js` constitue l'unique définition de ces caractéristiques pour l'entraînement et l'inférence. Cela évite un décalage entre le modèle entraîné et le backend.

## Algorithme d'entraînement

Le modèle est un ranker logistique pairwise. Pour deux candidats associés à la même offre, il apprend à produire :

```text
score(candidat pertinent) > score(candidat moins pertinent)
```

La loss utilisée est :

```text
L = log(1 + exp(-(score_positif - score_négatif)))
```

Les cinq candidats incorrects les mieux classés par la baseline de chaque offre sont utilisés comme hard negatives. Leur poids est doublé pendant l'entraînement. La V2 actuelle apprend sur 588 paires de préférence, dont 35 paires contenant un hard negative.

Les cinq caractéristiques étant définies comme des signaux favorables, l'optimisation projette leurs poids à zéro lorsqu'une mise à jour voudrait les rendre négatifs. Une meilleure similarité ou une meilleure couverture ne peut donc pas pénaliser mécaniquement un candidat.

Après l'apprentissage du ranking, une calibration logistique transforme le score brut en score de compatibilité. Les moyennes, écarts-types, poids et paramètres de calibration sont stockés dans l'artefact `backend/src/ai/models/recruitment-ranker-v2.json`.

## Résultats actuels

Résultats sur les deux offres de test, absentes de l'entraînement :

| Modèle | Top-1 | MRR | Recall@5 | NDCG@5 |
|---|---:|---:|---:|---:|
| Formule hybride V1 | 100 % | 1,000 | 0,750 | 0,8726 |
| Ranker appris V2 | 100 % | 1,000 | 1,000 | 0,9344 |

Le gain de NDCG@5 est de 0,0618 point et la couverture des profils pertinents dans le Top 5 passe de 75 % à 100 %.

Le rapport complet, incluant chaque classement et l'étude d'ablation, est généré dans `backend/data/ai-ranking-report.json`.

## Entraîner et évaluer

Depuis la racine du projet :

```bash
npm run data:reproduce
npm run ai:train
npm run ai:evaluate --prefix backend
```

`ai:train` recalcule les embeddings, extrait les caractéristiques, entraîne le ranker, calibre le score et remplace l'artefact V2.

## Intégration applicative

`recruitment-matcher.service.js` combine l'encodeur existant et le ranker appris. Pour chaque candidature, le backend conserve :

- la version du modèle ;
- le score final ;
- le score sémantique ;
- la couverture des compétences ;
- les principaux facteurs ;
- les extraits justificatifs du CV.

L'interface RH affiche ces informations et conserve explicitement la décision finale à l'utilisateur humain.

La probabilité calibrée sert au score de compatibilité. Elle n'est pas présentée comme une « confiance du modèle » : le projet ne dispose pas encore d'une estimation d'incertitude validée. Les facteurs affichés précisent si leur contribution favorise ou pénalise le score.

## Limites à présenter honnêtement

Le dataset actuel est fictif et petit. Les résultats prouvent le fonctionnement du pipeline d'apprentissage, mais ne démontrent pas encore une performance réelle en production. L'étape suivante consiste à annoter des paires offre–CV plus nombreuses, puis à refaire le découpage par offre. Le ranker et les scripts sont déjà conçus pour accepter ces nouvelles données sans modifier l'architecture applicative.

Le transformer MiniLM n'est pas réentraîné dans cette version : il sert d'encodeur. La contribution entraînée dans le projet est le modèle de ranking, sa normalisation, son hard-negative mining et sa calibration. Un fine-tuning contrastif de l'encodeur pourra être ajouté lorsque suffisamment de données humaines seront disponibles.

Enfin, le ranker apprend des préférences entre candidats d'une même offre. Ses scores ne doivent pas servir à construire un classement global mélangeant plusieurs offres.
