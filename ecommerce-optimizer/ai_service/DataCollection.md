# Data Collection for E-commerce Sales Forecasting

## Overview

Data collection is the first and most important stage of our AIML pipeline. In this project, the original downloaded dataset from Kaggle did not produce reliable results because it did not fully match our business schema and forecasting requirements. To solve that, we created a synthetic (mock) dataset from scratch and integrated it directly into our training pipeline.

---

## Why We Did Not Use the Kaggle Dataset Directly

The Kaggle data was useful for initial exploration, but not suitable for final training because of data mismatch:

- **Schema mismatch:** Column structure and naming were not consistently aligned with our expected fields (`Order ID`, `Product`, `Quantity Ordered`, `Price Each`, `Order Date`).
- **Catalog mismatch:** Product names and product mix did not match our actual e-commerce catalog used by the application.
- **Temporal mismatch:** Date patterns and timeline coverage were not ideal for our time-series forecasting setup.
- **Business-context mismatch:** Demand behavior in the public dataset did not consistently reflect our store-specific sales logic.

Because of this mismatch, model behavior became less reliable for our use case. So we generated a controlled dataset that reflects our domain.

---

## How We Created the Mock Dataset from Scratch

**File used:** `genarate_mock_data.py`  
**Main function:** `generate_ecommerce_data()`

### Techniques used in synthetic data generation

1. **Domain-aligned product catalog**
   - Built a fixed catalog with our real product names and realistic base prices.
   - Assigned a demand "weight" per product to control expected sales volume.

2. **Long chronological timeline**
   - Generated data for ~450 days (from an earlier start date up to yesterday).
   - This supports lag features and rolling windows needed for forecasting.

3. **Probabilistic demand simulation**
   - Used a Poisson distribution (`np.random.poisson`) for daily product demand.
   - This creates natural variability instead of constant sales.

4. **Weekend/weekday behavior modeling**
   - Applied a weekend multiplier (higher demand on weekends) to simulate real seasonality.

5. **Price-aware quantity behavior**
   - For lower-priced products, occasionally generated multi-quantity orders (2 to 4 units).
   - This introduces realistic basket-size variation.

6. **Randomized intraday order timestamps**
   - Added random hour/minute per order to avoid uniform timestamps.

7. **Final shuffling before saving**
   - Shuffled records before saving to `merged_sales_data.csv`.
   - This prevents accidental ordered artifacts in raw input files.

---

## How Data Collection Is Integrated in `data_loader.py`

**Stage:** `AIML PIPELINE STAGE 1: DATA COLLECTION`  
**Function:** `collect_data(file_path)`

### Techniques used in the data-loading stage

- **Controlled single-source loading:** Reads consolidated training data from `merged_sales_data.csv`.
- **Memory-safe parsing option:** Uses `pd.read_csv(..., low_memory=False)` for stable type inference in mixed columns.
- **Defensive file handling:** Catches `FileNotFoundError` and returns `None` for a safe pipeline stop.
- **Basic observability:** Prints row count so we can verify the loaded dataset size.
- **Clean handoff to next stage:** Returns a DataFrame directly to preprocessing in `main()`.

This design ensures the training pipeline starts with a known, validated source before transformations begin.

---

## Why Data Collection Is Crucial for AI Model Training

1. **Model quality depends on data quality**
   - Even the best algorithm cannot fix poor, mismatched, or noisy data.

2. **Feature engineering reliability starts here**
   - Lag features, rolling means, and seasonal features only work if timestamps and product data are consistent.

3. **Prevents misleading evaluation**
   - If source data does not reflect business reality, metrics like RMSE or R2 can look acceptable but fail in real deployment.

4. **Improves generalization and trust**
   - Domain-aligned data helps the model learn useful patterns and produce dependable forecasts.

5. **Supports reproducibility**
   - A controlled data-generation process allows repeatable training and consistent comparisons after tuning.

---

## Important Viva Points (What to Explain Clearly)

- **Why synthetic data was needed:** Public Kaggle data did not align with our schema, product catalog, and forecasting context.
- **How realism was introduced:** Poisson demand, weekend uplift, product-specific demand weights, and price-aware quantity logic.
- **How we ensured pipeline compatibility:** Generated fields exactly match what `data_loader.py` expects.
- **How data collection affects later stages:** Clean data directly improves preprocessing, feature engineering, tuning, and evaluation.
- **Risk awareness:** Synthetic data may not capture every real-world event (supply shocks, external promotions), so periodic retraining with production data is recommended.

---

## Suggested Future Improvements

- Add explicit schema validation checks at load time (required columns, data types, null-rate thresholds).
- Add data versioning (dataset timestamp + hash) for full experiment traceability.
- Blend synthetic data with anonymized real transaction data when available.
- Add automated drift checks to detect when live data behavior changes from training data.

---

## References in This Project

- Data generation script: `genarate_mock_data.py`
- Data loader and pipeline entry: `data_loader.py`
- Pipeline overview: `pipeline.md`
- Preprocessing notes: `dataPreprocessing.md`
- Feature engineering notes: `featureEngineering.md`

