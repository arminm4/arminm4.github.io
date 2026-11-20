---
id: ai-p1
title: Project: Customer Intelligence (classical ML)
week: Weeks 5–6
kind: project
summary: A team-style ML project: churn prediction, customer segmentation and a demand forecast, with honest evaluation and a business write-up.
builds_on: ai-w4, ai-w3, ai-w2, ai-w1
leads_to: ai-w7
---

The mid-bootcamp project covers the full **classical ML workflow**, from a business question to a defended recommendation. Use Jupyter or Google Colab. The in-app playground works for small experiments.

# Project: Customer Intelligence for an online retailer

**Data options** (choose one):
- **Telco Customer Churn** (IBM sample, on Kaggle): churn label + services + charges.
- **Online Retail II** (UCI Machine Learning Repository): real e-commerce transactions for RFM segmentation and forecasting.
- The app's **shop database** (export it from the SQL playground), extended with your own simulated churn labels.

### Part A: Churn prediction (supervised)

1. Frame it: what counts as "churn", what the prediction horizon is, and what the costs of a false negative and a false positive are.
2. EDA: target balance, distributions, leakage hunt (any column recorded *after* the churn?).
3. Pipeline: `ColumnTransformer` (scaling numeric features, one-hot encoding categoricals) + model, all inside cross-validation.
4. Compare a dummy baseline, logistic regression, a random forest and gradient boosting, with stratified CV on ROC-AUC and PR-AUC.
5. Tune the best model. Choose the **decision threshold from a cost matrix** (e.g. a retention offer costs 5 and a lost customer costs 50).
6. Explain the model: permutation importance, plus partial-dependence plots for the top features.
7. Report the test-set results once, with a confusion matrix at your chosen threshold.

### Part B: Segmentation (unsupervised)

1. Build **RFM** features (Recency, Frequency, Monetary) or usage features. Log-transform the skewed ones and standardize.
2. Run K-Means (choose k with elbow + silhouette) and try DBSCAN or hierarchical clustering for comparison.
3. **Profile** every segment and name it ("Loyal big spenders", "At-risk one-timers"). Propose one action per segment.

### Part C: Forecast

1. Aggregate daily or weekly revenue (or units for the top category).
2. Baselines: naive and seasonal naive. Then a gradient-boosting model with lag/rolling/calendar features (and ARIMA in Colab if you like).
3. Time-series CV. Report MAE and MASE, and plot the forecast against the actuals with an interval.

### Deliverables

- A clean notebook (or repo) that runs top to bottom, with fixed random seeds.
- A 1-page **business memo**: the problem, the approach, results in business terms (expected saved revenue), risks and limitations, and next steps.
- A 5-minute presentation (slides) as if to a non-technical manager.

## Milestones

- [ ] Choose a dataset; write the problem framing and success metrics for A, B and C
- [ ] EDA notebook, including a leakage review and a data dictionary
- [ ] Part A: baseline vs 3 models in one CV setup; tuned best model
- [ ] Part A: cost-based threshold, explanation plots, single test-set evaluation
- [ ] Part B: RFM features, clustering, segment profiles and actions
- [ ] Part C: baselines vs ML forecast with time-series CV and intervals
- [ ] Business memo (1 page) and slides
- [ ] Peer review: someone else re-runs your notebook from scratch successfully

## Rubric

| Criterion | Weight |
|---|---|
| Problem framing and metrics aligned with the business | 15% |
| Methodology: no leakage, proper CV, baselines, single test use | 30% |
| Modeling quality and tuning | 15% |
| Interpretation: importances, segment profiles, error analysis | 15% |
| Communication: memo, slides, reproducible code | 25% |

## Stretch goals

- Calibrate the churn probabilities (`CalibratedClassifierCV`) and check reliability plots.
- Uplift-modeling discussion: who is *persuadable*, not just who is at risk?
- Recommend products per segment using item–item CF from week 4.
- Serve the churn model behind a FastAPI endpoint (a preview of Full-Stack week 3).

# Sources

- [scikit-learn: ColumnTransformer and Pipelines for heterogeneous data](https://scikit-learn.org/stable/modules/compose.html)
- [scikit-learn: Permutation importance](https://scikit-learn.org/stable/modules/permutation_importance.html) and [Partial dependence](https://scikit-learn.org/stable/modules/partial_dependence.html)
- [UCI Machine Learning Repository: Online Retail II](https://archive.ics.uci.edu/dataset/502/online+retail+ii)
- [Kaggle: Telco Customer Churn dataset](https://www.kaggle.com/datasets/blastchar/telco-customer-churn)
- *Data Science for Business* by Provost & Fawcett (framing, expected-value thinking)
