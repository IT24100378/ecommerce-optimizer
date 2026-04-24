# Feature Engineering for Sales Forecasting Model

## Overview
This document explains the feature engineering strategy used in our XGBoost sales forecasting model, including the rationale behind feature selection, their impact on model training, and the importance of thoughtful feature engineering in machine learning pipelines.

---

## 1. Features Used in Our Model

### A. **Lag Features (Historical Sales Patterns)**

#### 1.1 Sales_Lag_1Day
- **Definition:** Quantity ordered on the previous day for the same product
- **Why:** 
  - Captures short-term demand momentum and immediate buying patterns
  - Highly predictive because consumer behavior often shows continuity day-to-day
  - Helps the model identify short-term trends and spikes
- **How it affects training:**
  - Provides strong signal for next-day predictions
  - Reduces model's reliance on other features for immediate forecasts
  - Creates temporal dependencies that XGBoost can efficiently exploit

#### 1.2 Sales_Lag_7Days
- **Definition:** Quantity ordered 7 days ago for the same product
- **Why:**
  - Captures weekly seasonality (e.g., weekend vs. weekday patterns)
  - Accounts for repeat purchase cycles (weekly shopping habits)
  - More robust than 1-day lag for detecting recurring patterns
- **How it affects training:**
  - Helps distinguish between random noise and genuine weekly patterns
  - Provides a longer-term context for the model
  - Reduces overfitting to daily volatility
  - Particularly useful for products with weekly promotional cycles

---

### B. **Temporal Features (Calendar/Seasonality)**

#### 2.1 Month
- **Definition:** The month of the year (1-12) when the sale occurred
- **Why:**
  - Different months have different demand patterns (holiday seasons, back-to-school, etc.)
  - Captures seasonal trends across the year
  - Helps identify which products sell better at specific times
- **How it affects training:**
  - Allows the model to learn month-specific demand variations
  - Particularly effective for electronics (higher demand in holiday months)
  - Prevents the model from treating all months identically
  - Helps capture both positive peaks (holidays) and negative valleys (off-seasons)

#### 2.2 DayOfWeek
- **Definition:** Day of the week (0=Monday to 6=Sunday)
- **Why:**
  - Consumer shopping behavior differs significantly by day
  - Weekdays vs. weekends have distinct patterns
  - Some products have day-specific demand patterns (e.g., weekend leisure items)
- **How it affects training:**
  - Enables the model to capture 7-day cycles in demand
  - More granular than just using month information
  - Works complementarily with the 7-day lag feature
  - Useful for detecting patterns like "Friday is always peak" or "Monday has low sales"

---

### C. **Trend Features (Moving Averages)**

#### 3.1 Rolling_Mean_7D
- **Definition:** 7-day rolling average of quantity ordered (shifted by 1 day to avoid data leakage)
- **Why:**
  - Smooths out daily volatility to reveal underlying trends
  - Captures medium-term momentum without daily noise
  - Prevents the model from overreacting to outliers or temporary spikes
- **How it affects training:**
  - Provides a denoised signal for decision tree splits
  - Acts as a regularizing feature that prevents overfitting
  - Helps the model identify sustained uptrends or downtrends
  - Enables XGBoost to make more stable predictions

---

### D. **Product Features (Categorical/Item Features)**

#### 4.1 One-Hot Encoded Product Items (Item_*)
- **Definition:** Binary features for each product in the dataset (Item_iPhone17ProMax, Item_MacBookPro16Inch, etc.)
- **Products included:**
  - Electronics: iMac, MacBook Air, MacBook Pro, MacBook Neo
  - Phones: iPhone 17 Pro Max, Galaxy S26 Ultra, Galaxy S26+, Galaxy Z Fold7
  - Audio: Sony WF-1000XM6, Sony WH-1000XM6
  - TVs: BRAVIA models, Samsung Neo QLED
  - Cameras: Cinema Line FX6

- **Why:**
  - Different products have fundamentally different demand patterns
  - Some products have seasonal demand (e.g., new iPhone models at launch)
  - Price sensitivity varies by product
  - Allows the model to learn product-specific patterns
- **How it affects training:**
  - Enables XGBoost to create product-specific decision trees
  - Captures product-level demand variations that other features cannot explain
  - Prevents feature leakage (each product only has value 0 or 1)
  - Creates interpretable rules like "iPhones sell more in September" or "Cameras have different seasonal patterns"

---

### E. **Price Feature**

#### 5.1 Price Each
- **Definition:** Average price of the product on that day
- **Why:**
  - Price is a fundamental demand driver in economics
  - Different products have different price elasticity
  - Price changes directly impact purchase decisions
  - Helps distinguish between high-value and low-value products
- **How it affects training:**
  - Enables the model to learn price-demand relationships
  - Captures the effect of discounts and price increases
  - Works with product features to identify price-sensitive products
  - Prevents the model from assuming identical demand patterns for different price points

---

## 2. How Features Affect Model Training

### Feature Importance Hierarchy
1. **High Impact:** Lag features (1-day and 7-day) and rolling mean
   - These provide direct historical signals that are highly predictive
   - Tree-based models can use these effectively for immediate splits
   
2. **Medium Impact:** Day of week and month
   - Provide context but are cyclic (values repeat)
   - Help refine predictions but aren't complete determinants alone
   
3. **Contextual Impact:** Price and product features
   - Price adds economic reality to predictions
   - Product features allow personalized demand modeling

### Training Dynamics
- **Reduces Gradient Explosion:** Lag and rolling features are stationary, preventing extreme gradients
- **Enables Temporal Learnings:** XGBoost can create time-aware decision boundaries
- **Prevents Overfitting:** Multiple feature types force the model to generalize across different pattern types
- **Improves Convergence:** Features with clear signal reduce the search space for optimal tree structures

---

## 3. Why Feature Engineering is Important

### 3.1 Model Performance
- **Raw data is insufficient:** Without proper features, the model sees disconnected daily values
- **Features provide context:** Lag and seasonal features give the model temporal understanding
- **Better predictions:** Well-engineered features can improve RMSE by 20-50% compared to naive features

### 3.2 Preventing Data Leakage
- **Lag shifting:** We shift the rolling mean by 1 day to ensure we only use past data
- **Chronological split:** Our 30-day holdout maintains temporal integrity
- **Feature alignment:** Same features used in training and inference prevent schema mismatches

### 3.3 Domain Knowledge Integration
- **Business insight:** Lag and seasonal features encode real business understanding
  - Retailers know repeat patterns exist (lag features)
  - Retailers know seasons matter (month feature)
  - Retailers know weekday patterns differ (day of week)
- **Captures non-linear relationships:** Decision trees can multiply these features to find interactions

### 3.4 Interpretability
- **Business-friendly features:** Non-technical stakeholders understand "last week's sales" and "month"
- **Explainability:** Feature importance scores tell business teams what drives demand
- **Debuggability:** Clear feature definitions make it easy to diagnose prediction errors

### 3.5 Robustness
- **Multiple signals:** Using 6+ feature types means model isn't dependent on any single pattern
- **Handles outliers better:** Rolling averages smooth out spikes; calendar features provide stability
- **Generalizes to new data:** Features based on fundamental patterns rather than historical quirks

---

## 4. Feature Engineering Challenges & Solutions

### Challenge 1: Missing Values from Early Days
- **Problem:** First 7 days have no 7-day lag; first day has no 1-day lag
- **Solution:** We fill these with 0, treating them as "no historical reference"
- **Trade-off:** Slightly less accurate for first week but prevents data loss

### Challenge 2: Product Encoding Sparsity
- **Problem:** 26+ one-hot encoded features create high-dimensional space
- **Solution:** XGBoost handles sparsity efficiently; feature importance naturally filters meaningless features
- **Benefit:** Allows handling new products with minimal code change

### Challenge 3: Time Series Leakage
- **Problem:** Using future data during training invalidates forecasts
- **Solution:** 
  - TimeSeriesSplit for cross-validation (only validate on future data)
  - Lag shifting ensures only past data is used
  - Chronological holdout test set (last 30 days)

### Challenge 4: Stationarity
- **Problem:** Some features (raw sales) may be non-stationary, affecting model training
- **Solution:** 
  - Lag features capture differences (more stationary)
  - Rolling means detrend the signal
  - Calendar features decompose seasonality

---

## 5. Key Points for Your Viva

### When Asked "Why These Features?"
- **Original features:** Quantity, Price, and Date represent the raw business data
- **Engineered features:** Lags, rolling means, and seasonality translate domain knowledge into predictive signals
- **Categorical features:** One-hot encoding allows product-specific demand modeling

### When Asked "How Do You Prevent Data Leakage?"
- "We shift the rolling mean by 1 day, use only historical data"
- "We use TimeSeriesSplit for cross-validation to validate on future data only"
- "Our test set is the final 30 days, ensuring temporal separation"

### When Asked "What Makes Your Features Better?"
- "Our features are not arbitrary; each has clear business justification"
- "We use both high-frequency (daily) and medium-frequency (7-day) patterns"
- "Calendar features capture seasonality without assuming specific dates"

### When Asked "How Does Feature Engineering Improve XGBoost?"
- "XGBoost builds decision trees; better features → better splits"
- "Lag features give trees direct temporal patterns to exploit"
- "Multiple feature types force deeper, more generalizable trees"
- "Feature diversity reduces overfitting to any single pattern"

### When Asked "What Would Happen Without Feature Engineering?"
- "Model would only see raw daily quantities with no context"
- "Performance would drop significantly (likely 40%+ worse RMSE)"
- "Model couldn't distinguish between inherent patterns and random noise"

---

## 6. Feature Selection Process

### What We Considered But Didn't Include:
- **Exponential Moving Average:** Redundant with 7-day rolling mean and 7-day lag
- **Multiple rolling windows (3-day, 14-day):** Would increase dimensionality without clear benefit
- **Day of month (1-31):** Less meaningful than both month and day-of-week
- **Weather data:** Not available; would require external sources
- **Competitor pricing:** Not in scope; would require external data feeds

### Validation of Feature Selection:
- **Simplicity principle:** Each feature has direct interpretability
- **Data availability:** All features can be computed from order data alone
- **Computational efficiency:** Only 6 base features + product dummies (manageable for real-time inference)
- **XGBoost efficiency:** Tree-based models handle these feature types optimally

---

## 7. Advanced Considerations

### 7.1 Feature Interactions
XGBoost models feature interactions implicitly through:
- Product × Price (e.g., "iPhones are price-sensitive")
- Product × Day-of-week (e.g., "cameras sell better on weekends")
- Month × Product (e.g., "iPhones peak in September")

### 7.2 Temporal Dynamics
Our features capture multiple timescales:
- **Immediate (1-day lag):** Next day's demand likely similar to today
- **Weekly (7-day lag):** Weekly shopping cycles
- **Seasonal (Month):** Yearly patterns
- **Cyclic (Day-of-week):** Weekly cycles

### 7.3 Curse of Dimensionality
With 26 products, we have 32 features (6 base + 26 items). XGBoost handles this well because:
- Tree-based models don't suffer like distance-based models do
- Most product features are sparse (0 for most records)
- Feature importance naturally downweights irrelevant features

---

## 8. Deployment Validation

### Schema Alignment
- **Training:** Features saved to `xgboost_features.json`
- **Inference:** Model.py loads same feature list before prediction
- **Prevention:** Exact feature order ensures no dimensional mismatches

### Real-World Robustness
- **New products:** Can be added with new Item_* feature without retraining entire model
- **Price changes:** Handled by continuous Price Each feature
- **Promotion periods:** Captured by lag features (unusual values propagate)

---

## 9. Conclusion

Feature engineering transformed raw sales data into a 32-dimensional feature space that:
1. ✅ Captures temporal patterns (lags, rolling means)
2. ✅ Encodes seasonality (month, day-of-week)
3. ✅ Represents product diversity (one-hot encoding)
4. ✅ Includes economic factors (price)
5. ✅ Prevents data leakage (careful shifting and validation splits)
6. ✅ Remains interpretable (business-friendly feature names)
7. ✅ Scales efficiently (works for real-time inference)

This thoughtful feature engineering is the foundation of our model's predictive power, transforming raw data into actionable insights for inventory optimization.

---

## 10. References in Your Codebase

- **Data collection:** `data_loader.py` → `collect_data()`
- **Preprocessing:** `data_loader.py` → `preprocess_data()`
- **Feature engineering:** `data_loader.py` → `engineer_features()`, `build_feature_target_matrices()`
- **Training considerations:** `data_loader.py` → `train_model_with_safe_tuning()` with `TimeSeriesSplit`
- **Inference usage:** `main.py` → Loads `xgboost_features.json` for schema validation

