# LiftLab

**Find the audiences an ad actually persuades.**

Ad recommendation dashboard that compares 3 targeting strategies: an uplift model, two-model baseline, and random targeting with confidence intervals, so you can decide where your ad spend should go.

**Live site → https://devfrancisa.github.io/LiftLab/**

> All data is mock data from a seeded simulation of a randomized advertising experiment. Figures are offline estimates on a held-out split, not business results.

## Views

| | View | What it answers |
|---|---|---|
| 01 | **Overview** | Where should the next ad dollar go? Budget slider and an uplift curve with a draggable cutoff, the selected audience's conversion **with vs. without advertising**, and a plain-language recommendation. |
| 02 | **Audience Explorer** | Who does the ad move? Searchable, sortable, filterable segment table with paired probability bars; each row opens a drawer with the comparison, uncertainty, and an explanation. |
| 03 | **Experiments** | Does uplift targeting beat the alternatives? Uplift model vs. two-model baseline vs. random at the same budget, with bootstrap 95% CIs. Measured outcomes and model estimates are kept visually distinct. Includes a randomization balance check. |
| 04 | **Model Evaluation** | How good is the ranking? Measured uplift curves, AUUC per model, variation across five seeds, and expandable technical panels (architecture, protocol, ablations, leakage tests). |

## How the mock data stays consistent

`src/data/model.ts` simulates one held-out test split (100,000 users, randomized 80/20 into ad / no ad) with a hidden baseline conversion rate and true ad effect per user, and draws real Bernoulli outcomes. Five training seeds of a neural uplift model and a two-model baseline are simulated as noisy estimates of the true effect. Every number in the UI is computed from that one dataset:

- **Model estimates** (Overview, table probabilities) use only predicted scores.
- **Measured results** (Experiments, Model Evaluation) use only randomized outcomes: treated rate minus control rate inside each policy's selection, with a bootstrap over users.
- Uplift curves, AUUC, seed spread, segment confidence intervals, treatment balance (standardized mean differences), and a shuffled-treatment placebo test are all real computations on the simulated data.

Run `npm run check:data` to print the key figures.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173/LiftLab/
npm run build        # type-check + production build to dist/
npm run check:data   # sanity-check the simulation
```

Demo states: append `?demo=slow` (loading) or `?demo=error` (error + retry) to the URL.

Built with React, TypeScript, and Vite. Charts are hand-written SVG. Pushes to `main` deploy to GitHub Pages through `.github/workflows/deploy.yml`.
