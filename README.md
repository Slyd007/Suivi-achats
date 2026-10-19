# Suivi Achats — Carrefour Market Isigny-sur-Mer

Application web mobile-first pour le suivi quotidien des achats, du CA, des budgets et des préconisations par rayon.

## Ce que voit l'équipe

L'équipe saisit uniquement :
1. **Achat HT hors promo du jour**
2. **Achat promo HT du jour**
3. **CA TTC réalisé de J-1**

L'application enregistre automatiquement les achats et le CA sur leurs **vraies dates**, évitant le décalage J/J-1 de l'ancien tableau Excel.

## Ce que voit la Direction

- Synthèse de tous les rayons
- Budget CA mensuel par rayon
- Taux de marque cible par rayon
- Budget achat maxi calculé automatiquement
- Écart achat / budget en vert ou rouge
- Historique des données
- Journal de chaque création/correction
- Répartition du budget mensuel par poids des jours de semaine
- Clôture mensuelle avec stock initial/final et marge commerciale
- Préconisations automatiques après accumulation de données

## Architecture

- **GitHub Pages** : hébergement de l'interface statique
- **Supabase Auth** : comptes Direction / équipe
- **Supabase Postgres** : données partagées
- **RLS (Row Level Security)** : une équipe ne peut accéder qu'à son rayon ; la Direction voit le magasin
- **Audit DB** : les corrections sont historisées par trigger
- **Mode local** : si Supabase n'est pas configuré, l'app fonctionne en démonstration dans le navigateur

Le frontend n'utilise qu'une **clé Supabase publishable**. Ne jamais utiliser une clé `service_role` dans GitHub Pages.

## Mise en service Supabase

1. Créer un projet Supabase.
2. Ouvrir **SQL Editor** et exécuter `supabase/schema.sql`.
3. Dans **Authentication > Users**, créer le compte Direction.
4. Copier son UUID et exécuter `supabase/create-first-admin.sql` après remplacement de `YOUR_AUTH_USER_UUID`.
5. Créer ensuite les utilisateurs équipes si nécessaire et utiliser `supabase/create-team-user-template.sql`.
6. Récupérer dans Supabase :
   - Project URL
   - Publishable key

## Mise en service GitHub Pages

Dans le dépôt GitHub :

1. **Settings > Pages > Source** : choisir **GitHub Actions**.
2. **Settings > Secrets and variables > Actions > Variables** : créer :
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
3. Pousser sur `main`.
4. Le workflow `.github/workflows/pages.yml` lance les tests puis publie l'application.

GitHub recommande le déploiement Pages via GitHub Actions pour les sites statiques personnalisés.

## Paramètres à renseigner avant utilisation réelle

Pour chacun des 7 rayons :
- taux de marque cible (%)
- budget CA TTC de chaque mois
- TVA si différente de 5,5 %
- poids des jours de semaine si vous souhaitez une répartition réaliste du budget quotidien

Rayons préconfigurés : Fruits & Légumes, Poisson, Charcuterie, Fromage, Boucherie, Volaille, PVP.

## Calculs principaux

- `CA HT = CA TTC / (1 + TVA)`
- `Budget achat maxi HT = CA budget HT × (1 - taux de marque cible)`
- `Achats HT = achats hors promo + achats promo`
- `Écart achat = budget achat maxi - achats HT`
- `Coût marchandises consommées = stock initial + achats - stock final`
- `Marge commerciale = ventes HT - coût marchandises consommées`

La casse est affichée séparément lors de la clôture. Elle n'est pas redéduite automatiquement si le stock final provient d'un inventaire physique, afin d'éviter un double comptage.

## Tests

```bash
npm test
```

Les tests couvrent notamment : TVA, budget achat maxi, non-double-comptage promo, répartition mensuelle et marge avec variation de stock.

## Tester localement

Sans Supabase :

```bash
python -m http.server 8080
```

Puis ouvrir `http://localhost:8080`. Les données restent dans le navigateur tant que Supabase n'est pas branché.


## Référence marges placard

Le projet contient désormais les marges placard d'août 2026 (FRPB57) pour les 7 rayons suivis. Pour le budget d'achat, l'application utilise la **marge rayon après frais service** et conserve la marge brute/cumulée comme référence visuelle.

| Rayon | Marge brute placard | Cible après frais | Cumul après frais |
|---|---:|---:|---:|
| Fruits & Légumes | 34,85 % | 28,70 % | 28,60 % |
| Poisson | 33,36 % | 28,50 % | 27,28 % |
| Charcuterie | 44,88 % | 41,38 % | 40,86 % |
| Fromage | 34,38 % | 30,28 % | 29,93 % |
| Boucherie | 39,23 % | 35,60 % | 36,11 % |
| Volaille | 36,94 % | 34,99 % | 34,15 % |
| PVP / Point chaud | 60,16 % | 56,51 % | 55,40 % |

La marge peut être remplacée **mois par mois** dans Réglages Direction. Si aucun taux mensuel n'est renseigné, l'application reprend la dernière référence rayon initialisée.

## Fruits & Légumes — saisonnalité et projection 2026

Références intégrées :

- **CA annuel FL 2025 : 352 107,07 € TTC**
- Réalisé janvier-septembre 2026 : **298 349,48 € TTC**, soit **+5,19 %** vs janvier-septembre 2025
- Tendance avril-septembre 2026 : **+8,43 %** vs la même période 2025
- Projection Q4 : pondération 60 % de la tendance YTD et 40 % de la tendance récente, soit +6,49 %, arrondie à **+6,5 %**
- Budget de départ octobre 2026 : **26 208,43 €**
- Budget de départ novembre 2026 : **19 680,58 €**
- Budget de départ décembre 2026 : **27 050,84 €**
- Projection annuelle FL 2026 : **371 289,33 € TTC**

Le Bilan de Santé Client 2025 précise qu'un indice journalier supérieur à 115 correspond à une surpondération du CA et un indice inférieur à 85 à une sous-pondération. Le heatmap montre un profil récurrent avec vendredi/samedi plus forts et dimanche nettement plus faible. L'application initialise donc le FL avec les poids relatifs suivants (Dim -> Sam) :

`[0.65, 0.92, 0.97, 1.00, 1.02, 1.15, 1.22]`

Ce ne sont **pas** les indices Carrefour exacts : ce sont des coefficients de répartition de départ issus du code couleur. Ils sont normalisés à l'intérieur de chaque mois, donc ils ne changent jamais le budget mensuel. Ils pourront ensuite être recalibrés avec les données quotidiennes réellement enregistrées.

Pour une base Supabase déjà créée, exécuter `supabase/seed-fl-seasonality-2026.sql` afin d'ajouter les poids FL et les budgets Q4 sans recréer toute la base.

## Règles jours fériés du magasin

Règles d'exploitation intégrées au budget journalier :

- férié du **lundi au jeudi** : ouverture et poids de CA traités comme un dimanche ;
- férié du **vendredi ou samedi** : fermeture à 18 h ; coefficient initial = 90 % du poids normal du jour ;
- **1er mai, 25 décembre et 1er janvier** : fermeture totale, budget CA journalier = 0 ;
- lorsqu'un férié tombe du lundi au jeudi, le **jour précédent et le jour suivant** reçoivent provisoirement +10 % de poids pour modéliser le report de fréquentation.

Les +10 % et -10 % sont des coefficients de départ, pas des mesures historiques. Ils sont centralisés dans `STORE_HOLIDAY_RULES` et pourront être recalibrés avec les CA quotidiens. La normalisation mensuelle garantit que ces règles redistribuent le CA entre les jours sans modifier le budget total du mois.
