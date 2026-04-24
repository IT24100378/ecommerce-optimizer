import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit
import numpy as np
import json # <-- Added to save the ledger
from typing import Optional, cast


# =========================================================
# AIML PIPELINE STAGE 1: DATA COLLECTION
# =========================================================
def collect_data(file_path: str) -> Optional[pd.DataFrame]:
    print("--- 1. Loading The Consolidated File ---")
    try:
        df = cast(pd.DataFrame, pd.read_csv(file_path, low_memory=False))
        print(f"Loaded {df.shape[0]} raw rows.")
        return df
    except FileNotFoundError:
        print("CRITICAL ERROR: 'merged_sales_data.csv' not found.")
        return None


# =========================================================
# AIML PIPELINE STAGE 2: PREPROCESSING
# =========================================================
def preprocess_data(df):
    print("\n--- 2. Purging Bad Data ---")
    df = df.dropna(how='all')
    df = df[df['Order ID'] != 'Order ID']
    df = df.dropna(subset=['Order Date', 'Product'])

    print("\n--- 3. Time-Series Transformation ---")
    df['Order Date'] = pd.to_datetime(df['Order Date'], format='%m/%d/%y %H:%M', errors='coerce')
    df = df.dropna(subset=['Order Date'])

    df['Quantity Ordered'] = pd.to_numeric(df['Quantity Ordered'])
    df['Price Each'] = pd.to_numeric(df['Price Each'])
    df['Sales'] = df['Quantity Ordered'] * df['Price Each']
    return df


# =========================================================
# AIML PIPELINE STAGE 3: FEATURE ENGINEERING
# =========================================================
def engineer_features(df):
    print("\n--- 4. Building the AI Feature Matrix ---")
    daily_sales = df.groupby([pd.Grouper(key='Order Date', freq='D'), 'Product']).agg({
        'Quantity Ordered': 'sum',
        'Sales': 'sum',
        'Price Each': 'mean'
    }).reset_index()

    daily_sales = daily_sales.sort_values(by=['Product', 'Order Date'])
    daily_sales['Sales_Lag_1Day'] = daily_sales.groupby('Product')['Quantity Ordered'].shift(1)
    daily_sales['Sales_Lag_7Days'] = daily_sales.groupby('Product')['Quantity Ordered'].shift(7)

    daily_sales['Month'] = daily_sales['Order Date'].dt.month
    daily_sales['DayOfWeek'] = daily_sales['Order Date'].dt.dayofweek
    daily_sales['Rolling_Mean_7D'] = daily_sales.groupby('Product')['Quantity Ordered'].transform(
        lambda x: x.shift(1).rolling(window=7, min_periods=1).mean()
    )
    daily_sales = daily_sales.fillna(0)

    # ONE-HOT ENCODING
    product_dummies = pd.get_dummies(daily_sales['Product'], prefix='Item').astype(int)
    daily_sales = pd.concat([daily_sales, product_dummies], axis=1)
    return daily_sales


def split_data_for_time_holdout(daily_sales):
    print("\n--- 5. The Chronological Split ---")
    # Dynamically split based on the last 30 days of whatever data exists
    max_date = daily_sales['Order Date'].max()
    cutoff_date = max_date - pd.Timedelta(days=30)

    train_data = daily_sales[daily_sales['Order Date'] < cutoff_date].copy()
    test_data = daily_sales[daily_sales['Order Date'] >= cutoff_date].copy()

    # Keep training and test sets chronologically ordered for time-aware tuning and evaluation.
    train_data = train_data.sort_values(by='Order Date').reset_index(drop=True)
    test_data = test_data.sort_values(by='Order Date').reset_index(drop=True)
    return train_data, test_data


def build_feature_target_matrices(daily_sales, train_data, test_data):
    item_columns = [col for col in daily_sales.columns if col.startswith('Item_')]
    features = ['Price Each', 'Sales_Lag_1Day', 'Sales_Lag_7Days', 'Month', 'DayOfWeek', 'Rolling_Mean_7D'] + item_columns
    target = 'Quantity Ordered'

    X_train = train_data[features]
    y_train = train_data[target]
    X_test = test_data[features]
    y_test = test_data[target]
    return X_train, y_train, X_test, y_test, features


# =========================================================
# AIML PIPELINE STAGE 4: MODEL TRAINING
# =========================================================
def train_model_with_safe_tuning(X_train, y_train):
    """Train XGBoost with time-aware tuning when enough training history exists."""
    baseline_model = xgb.XGBRegressor(
        n_estimators=300,
        learning_rate=0.05,
        objective="reg:squarederror",
        random_state=42
    )

    # Safety guard: tune only when we have enough sequential examples to validate across folds.
    if len(X_train) < 200:
        print("Tuning skipped: training set too small for stable time-series CV. Using baseline model.")
        baseline_model.fit(X_train, y_train)
        return baseline_model, "baseline"

    param_dist = {
        "n_estimators": [200, 300, 500, 700],
        "learning_rate": [0.01, 0.03, 0.05, 0.1],
        "max_depth": [3, 4, 5, 6, 8],
        "min_child_weight": [1, 3, 5, 7],
        "subsample": [0.7, 0.85, 1.0],
        "colsample_bytree": [0.7, 0.85, 1.0],
        "gamma": [0.0, 0.1, 0.3],
        "reg_alpha": [0.0, 0.01, 0.1],
        "reg_lambda": [1.0, 2.0, 5.0]
    }

    # TimeSeriesSplit preserves order so every validation fold is strictly in the future of its train fold.
    tscv = TimeSeriesSplit(n_splits=4)

    try:
        search = RandomizedSearchCV(
            estimator=xgb.XGBRegressor(objective="reg:squarederror", random_state=42),
            param_distributions=param_dist,
            n_iter=24,
            scoring="neg_root_mean_squared_error",
            cv=tscv,
            n_jobs=-1,
            random_state=42,
            verbose=1
        )
        search.fit(X_train, y_train)
        print(f"Tuning completed. Best CV RMSE: {-search.best_score_:.4f}")
        print(f"Best params: {search.best_params_}")
        return search.best_estimator_, "tuned"
    except Exception as tune_error:
        # Safe fallback: if tuning fails for any reason, keep pipeline working with baseline training.
        print(f"Tuning failed ({tune_error}). Falling back to baseline model.")
        baseline_model.fit(X_train, y_train)
        return baseline_model, "baseline-fallback"


# =========================================================
# AIML PIPELINE STAGE 5: MODEL EVALUATION AND TUNING
# =========================================================
def evaluate_model(y_test, predictions):
    y_true = y_test.to_numpy()
    y_pred = predictions

    me = np.mean(y_pred - y_true)
    mae = mean_absolute_error(y_test, predictions)
    rmse = np.sqrt(mean_squared_error(y_test, predictions))
    r2 = r2_score(y_test, predictions)

    # MAPE is undefined when true values are zero, so we evaluate only non-zero targets.
    nonzero_mask = y_true != 0
    if np.any(nonzero_mask):
        mape = np.mean(np.abs((y_true[nonzero_mask] - y_pred[nonzero_mask]) / y_true[nonzero_mask])) * 100
    else:
        mape = float("nan")

    print(f"Mean Error (ME): {me:.2f} units")
    print(f"Mean Absolute Error (MAE): {mae:.2f} units")
    print(f"Root Mean Squared Error (RMSE): {rmse:.2f} units")
    print(f"R-squared (R2): {r2:.4f}")
    print(f"Mean Absolute Percentage Error (MAPE): {mape:.2f}%")


# =========================================================
# AIML PIPELINE STAGE 6: DEPLOYMENT (MODEL ARTIFACT EXPORT)
# =========================================================
def deploy_artifacts(model, features):
    print("\n--- 8. Freezing the AI's Memory ---")
    model.save_model("xgboost_sales_model.json")

    # Persist exact feature order to keep inference input schema aligned with training.
    with open("xgboost_features.json", "w") as f:
        json.dump(features, f)

    print("SUCCESS: AI brain saved locally as 'xgboost_sales_model.json'.")
    print("SUCCESS: Feature map saved locally as 'xgboost_features.json'.")


def main():
    file_path = 'merged_sales_data.csv'
    # ===========================
    # DATA COLLECTION
    # ===========================
    df = collect_data(file_path)
    if df is None:
        return

    # ===========================
    # PREPROCESSING
    # ===========================
    df = preprocess_data(df)

    # ===========================
    # FEATURE ENGINEERING
    # ===========================
    daily_sales = engineer_features(df)
    train_data, test_data = split_data_for_time_holdout(daily_sales)
    X_train, y_train, X_test, y_test, features = build_feature_target_matrices(daily_sales, train_data, test_data)

    # ===========================
    # MODEL TRAINING
    # ===========================
    print("\n--- 6. Waking up the AI (Training XGBoost) ---")
    model, training_mode = train_model_with_safe_tuning(X_train, y_train)
    print(f"Training mode used: {training_mode}")

    # ===========================
    # MODEL EVALUATION AND TUNING
    # ===========================
    print("\n--- 7. The Ultimate Test ---")
    predictions = model.predict(X_test)
    evaluate_model(y_test, predictions)

    # ===========================
    # DEPLOYMENT
    # ===========================
    deploy_artifacts(model, features)

if __name__ == "__main__":
    main()