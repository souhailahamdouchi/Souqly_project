# Contributing à SOUQLY

Merci de contribuer à SOUQLY !

## Comment contribuer

1. `fork` le dépôt puis créez votre branche :
   ```bash
   git checkout -b feature/ma-fonctionnalite
   ```
2. Développez en gardant le style existant (Pint côté backend, ESLint côté
   frontend).
3. Vérifiez avant de soumettre :
   ```bash
   cd backend && php artisan test
   cd frontend && npm run lint && npm run build
   ```
4. Créez une **Pull Request** vers `main` avec une description claire.

## Conventions

- **Backend** : PSR-12 via Laravel Pint, contrôleurs API sous
  `app/Http/Controllers/Api`, énumérations d'états dans `app/Enums`.
- **Frontend** : TypeScript strict, composants dans `src/components`,
  accès API exclusivement via `src/api` (jamais de `fetch` éparpillé), UI en
  français.
- Une PR = une fonctionnalité ; message de commit en français, concis et à
  l'impératif.

## Répartition de l'équipe

| Domaine                  | Responsable        |
| -------------------------|--------------------|
| Frontend                 | Hamdouchi Souhaila |
| Backend                  | Ouroui Youssef     |
| Chef de projet           | Souiti Hamza       |
| Leader/Tests/Deploiement | Lasly Younes       |
| Conception               | Kourrou Abdelwahab |
