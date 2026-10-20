# Évaluation élargie du classement IA

Ce protocole expérimental complète la démonstration V2. Il conserve le modèle utilisé par l’application et ses anciens résultats. Aucun nouveau résultat n’est annoncé avant entraînement et annotation humaine.

## Corpus et séparation

Le corpus versionné contient 24 offres et 72 CV fictifs, soit 600 couples explicitement recensés.

| Jeu | Offres | CV | Couples | Origine des notes |
|---|---:|---:|---:|---|
| Entraînement | 10 | 30 | 300 | Règles du corpus V2 initial |
| Validation | 6 | 18 | 108 | Référence synthétique provisoire |
| Test | 8 | 24 | 192 | À annoter humainement |

Les anciennes offres de démonstration sont réaffectées à l’entraînement. Les nouvelles offres et les nouveaux CV de validation et de test n’en font pas partie. Les identifiants, les textes dupliqués et les couples traversant les jeux sont contrôlés. Ces contrôles détectent des doublons normalisés, pas toutes les paraphrases : une inspection humaine des contenus reste utile.

Les profils restent courts et fictifs. Augmenter leur nombre ne suffit pas à prouver une qualité en production.

## Première exécution

Depuis la racine du dépôt, chaque commande est indépendante :

1. Vérifier le protocole : `node --test backend/test/benchmark-protocol.test.js`
2. Préparer le paquet d’annotation : `npm run ai:benchmark:prepare --prefix backend`
3. Ouvrir `tools/review-benchmark.html` dans le navigateur et charger `backend/data/ai-benchmark-review.json`.
4. Saisir un identifiant d’évaluateur. Noter les couples par lots de 12, puis télécharger la progression. Recharger ce fichier pour reprendre.
5. Enregistrer la revue terminée dans `backend/data/ai-benchmark-review-completed.json`.
6. Entraîner et sélectionner sur validation : `npm run ai:benchmark:train --prefix backend`
7. Mesurer le test : `npm run ai:benchmark:test --prefix backend -- data/ai-benchmark-review-completed.json`

La préparation refuse d’écraser un fichier d’annotation existant. L’entraînement exige les dépendances du projet et télécharge l’encodeur si son cache est vide. Les annotations sont produites avant de regarder les scores IA.

## Grille humaine

- 0 : hors sujet, sans aptitude pertinente démontrée.
- 1 : correspondance faible, activité voisine et exigences principales non démontrées.
- 2 : correspondance partielle, compétences utiles et exigences à vérifier.
- 3 : correspondance forte, exigences principales étayées par le parcours.

Chaque note nécessite une justification fondée sur le contenu décrit. Une revue unique ne constitue pas un accord entre plusieurs évaluateurs ; un second avis RH permettrait d’étudier les désaccords.

## Sélection et test

La normalisation, les poids et la calibration sont appris uniquement sur le jeu d’entraînement. Trois régularisations prédéfinies sont comparées sur la validation. Le choix utilise NDCG@5, puis Recall@5, avec une règle de départage déterministe. La validation demeure synthétique et provisoire.

Le modèle expérimental est enregistré séparément dans `backend/data/ai-benchmark-model.json`. Le test exige une revue complète, une justification pour chaque couple, l’identité déclarée de l’évaluateur et l’empreinte du corpus exact. Il exige des profils pertinents et moins pertinents pour chaque offre. Une offre réellement dépourvue de candidat pertinent doit être étudiée séparément, pas réétiquetée pour passer le contrôle.

Les scores V1 et V2 sont mesurés sur les mêmes couples et annotations. Top-1, MRR, Recall@5, NDCG@5, les classements et les écarts par offre sont conservés dans `backend/data/ai-benchmark-runs/`. Les offres où V2 perd face à V1 ou ne place pas le meilleur niveau en tête sont listées pour analyse. Les résultats inférieurs sont conservés.

Les rapports portent les empreintes du corpus, du modèle et des annotations. Ils sont créés avec un nouveau nom à chaque exécution. Après consultation du test, une modification des modèles relève d’une nouvelle expérience ; il faut réserver de nouvelles données pour une confirmation indépendante.

## Rapport PFE

Présenter ce travail à sa date réelle. Documenter le corpus fictif, le protocole, les résultats réellement calculés et les limites. Ne pas réutiliser les anciens scores sur deux offres comme s’ils provenaient des huit nouvelles offres. Ne pas présenter les annotations générées ou les fixtures des tests logiciels comme une validation humaine.

Le corpus, le protocole et les outils peuvent être décrits comme préparés. L’entraînement, les annotations et les mesures restent à réaliser tant que les fichiers correspondants n’ont pas été effectivement produits et vérifiés.
