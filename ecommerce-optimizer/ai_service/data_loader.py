import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import numpy as np
import json # <-- Added to save the ledger

def main():
    file_path = 'merged_sales_data.csv'
    print("--- 1. Loading The Consolidated File ---")
    try:
        df = pd.read_csv(file_path, low_memory=False)
        print(f"Loaded {df.shape[0]} raw rows.")
    except FileNotFoundError:
        print("CRITICAL ERROR: 'merged_sales_data.csv' not found.")
        return

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

    print("\n--- 5. The Chronological Split ---")
    # Dynamically split based on the last 30 days of whatever data exists
    max_date = daily_sales['Order Date'].max()
    cutoff_date = max_date - pd.Timedelta(days=30)

    train_data = daily_sales[daily_sales['Order Date'] < cutoff_date].copy()
    test_data = daily_sales[daily_sales['Order Date'] >= cutoff_date].copy()

    print("\n--- 6. Waking up the AI (Training XGBoost) ---")
    item_columns = [col for col in daily_sales.columns if col.startswith('Item_')]
    features = ['Price Each', 'Sales_Lag_1Day', 'Sales_Lag_7Days', 'Month', 'DayOfWeek', 'Rolling_Mean_7D'] + item_columns
    target = 'Quantity Ordered'

    X_train = train_data[features]
    y_train = train_data[target]
    X_test = test_data[features]
    y_test = test_data[target]

    model = xgb.XGBRegressor(n_estimators=100, learning_rate=0.1, random_state=42)
    model.fit(X_train, y_train)

    print("\n--- 7. The Ultimate Test ---")
    predictions = model.predict(X_test)

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

    print("\n--- 8. Freezing the AI's Memory ---")
    model.save_model("xgboost_sales_model.json")

    # THE FIX: Physically save the exact feature strings to an external ledger
    with open("xgboost_features.json", "w") as f:
        json.dump(features, f)

    print("SUCCESS: AI brain saved locally as 'xgboost_sales_model.json'.")
    print("SUCCESS: Feature map saved locally as 'xgboost_features.json'.")

if __name__ == "__main__":
    main()