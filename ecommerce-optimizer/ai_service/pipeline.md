# AIML Pipeline Overview

This document explains the current sales-forecast training pipeline implemented in `data_loader.py`.

## 1) Data Collection

**Functions:** `collect_data(file_path)`

- Reads the source dataset from `merged_sales_data.csv`.
- Loads into a pandas DataFrame.
- Returns `None` if the file is missing (safe stop in `main()`).

**Input:** Raw consolidated CSV file.

**Output:** Raw DataFrame for downstream preprocessing.

## 2) Preprocessing

**Functions:** `preprocess_data(df)`

- Removes empty rows.
- Removes repeated header rows embedded in data (`Order ID` string rows).
- Drops rows missing required fields (`Order Date`, `Product`).
- Converts `Order Date` to datetime.
- Converts numeric fields (`Quantity Ordered`, `Price Each`) to numeric types.
- Builds base `Sales = Quantity Ordered * Price Each`.

**Input:** Raw DataFrame.

**Output:** Cleaned and typed DataFrame.

## 3) Feature Engineering

**Functions:** `engineer_features(df)`, `split_data_for_time_holdout(daily_sales)`, `build_feature_target_matrices(...)`

- Aggregates to daily product-level granularity.
- Builds lag features:
  - `Sales_Lag_1Day`
  - `Sales_Lag_7Days`
- Builds calendar features:
  - `Month`
  - `DayOfWeek`
- Builds trend feature:
  - `Rolling_Mean_7D`
- One-hot encodes products into `Item_*` columns.
- Performs chronological holdout split (last 30 days as test).
- Creates model matrices `X_train`, `y_train`, `X_test`, `y_test`.

**Input:** Preprocessed DataFrame.

**Output:** Feature matrices + target vectors + ordered feature list.

## 4) Model Training

**Functions:** `train_model_with_safe_tuning(X_train, y_train)`

- Baseline model: `xgb.XGBRegressor`.
- Safe fine-tuning path:
  - Uses `RandomizedSearchCV`.
  - Uses `TimeSeriesSplit` to avoid time leakage.
  - Optimizes `neg_root_mean_squared_error`.
- Safety guard:
  - If training data is too small, skips tuning and trains baseline.
  - If tuning fails, falls back to baseline training.

**Input:** Training feature matrix and target vector.

**Output:** Trained model + training mode (`tuned`, `baseline`, or `baseline-fallback`).

## 5) Model Evaluation and Tuning

**Functions:** `evaluate_model(y_test, predictions)`

Evaluation is done on the final chronological holdout test set.

Reported metrics:

- **ME (Mean Error):** `mean(y_pred - y_true)`
- **MAE:** `mean(abs(y_pred - y_true))`
- **RMSE:** `sqrt(mean((y_pred - y_true)^2))`
- **R2:** Explained variance score
- **MAPE:** `mean(abs((y_true - y_pred) / y_true)) * 100` on non-zero targets only

Why this mix:

- ME shows prediction bias direction (over/under).
- MAE gives average absolute error in units.
- RMSE penalizes large misses more heavily.
- R2 shows overall explanatory power.
- MAPE gives a percentage-style error view for business communication.

## 6) Deployment (Artifact Export)

**Functions:** `deploy_artifacts(model, features)`

Exports training artifacts used by inference service:

- `xgboost_sales_model.json` (trained model)
- `xgboost_features.json` (exact training feature order)

These are loaded by `main.py` at service startup to ensure prediction-time schema alignment.

## End-to-End Flow

`collect_data -> preprocess_data -> engineer_features -> split_data_for_time_holdout -> build_feature_target_matrices -> train_model_with_safe_tuning -> evaluate_model -> deploy_artifacts`

