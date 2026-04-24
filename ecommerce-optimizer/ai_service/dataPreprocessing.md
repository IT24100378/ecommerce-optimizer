# Data Preprocessing in E-commerce Sales Forecasting Model

## Why Data Preprocessing is Essential in Model Training

Data preprocessing is a critical step in machine learning pipelines because raw data often contains inconsistencies, missing values, and formats that are not suitable for model training. Without proper preprocessing:

- **Data Quality Issues**: Raw datasets may include duplicate entries, null values, incorrect data types, or irrelevant information that can mislead the model.
- **Model Performance Degradation**: Unprocessed data can lead to poor model accuracy, overfitting, or complete failure during training.
- **Computational Inefficiency**: Inconsistent data formats can cause errors or require excessive computational resources.
- **Bias Introduction**: Missing or improperly handled data can introduce bias in predictions.

In our e-commerce sales forecasting project, preprocessing ensures that the time-series sales data is clean, consistent, and properly formatted for XGBoost model training.

## How Data Preprocessing Affects Model Training

Data preprocessing directly impacts model training in several ways:

### 1. **Improved Model Accuracy**
- Removes noise and irrelevant data, allowing the model to focus on meaningful patterns
- Ensures consistent data types and formats, preventing runtime errors
- Handles missing values appropriately, maintaining data integrity

### 2. **Enhanced Training Stability**
- Prevents numerical instability from invalid data types
- Reduces training time by working with clean, optimized datasets
- Enables proper feature engineering and scaling

### 3. **Better Generalization**
- Time-series aware preprocessing (chronological splits) prevents data leakage
- Proper handling of categorical variables through encoding improves feature representation
- Feature scaling and normalization ensure balanced learning across different feature ranges

### 4. **Robust Model Deployment**
- Consistent preprocessing ensures training and inference use the same data format
- Feature ordering preservation prevents deployment mismatches
- Error handling in preprocessing makes the pipeline more reliable

## Techniques Used in Our Data Preprocessing Pipeline

Our preprocessing pipeline follows a systematic approach with the following key techniques:

### 1. **Data Cleaning and Validation**
- **Complete Row Removal**: `dropna(how='all')` removes entirely empty rows
- **Header Row Filtering**: Removes duplicate header rows where 'Order ID' equals 'Order ID'
- **Critical Field Validation**: `dropna(subset=['Order Date', 'Product'])` ensures essential fields are present

### 2. **Data Type Conversion and Standardization**
- **DateTime Parsing**: Converts 'Order Date' to pandas datetime with specific format `'%m/%d/%y %H:%M'`
- **Numeric Conversion**: Transforms 'Quantity Ordered' and 'Price Each' to numeric types
- **Derived Feature Creation**: Calculates 'Sales' as `Quantity Ordered * Price Each`

### 3. **Time-Series Feature Engineering**
- **Temporal Aggregation**: Groups data by daily intervals and product categories
- **Lag Features**: Creates `Sales_Lag_1Day` and `Sales_Lag_7Days` for temporal dependencies
- **Calendar Features**: Extracts `Month` and `DayOfWeek` for seasonal patterns
- **Rolling Statistics**: Computes 7-day rolling mean (`Rolling_Mean_7D`) for trend analysis

### 4. **Categorical Variable Encoding**
- **One-Hot Encoding**: Converts product categories to binary dummy variables using `pd.get_dummies()`
- **Feature Concatenation**: Merges encoded features with numerical features

### 5. **Missing Value Handling**
- **Zero Filling**: Uses `fillna(0)` for lag features and rolling statistics to handle initial periods
- **Coercive Date Parsing**: Drops invalid dates with `errors='coerce'` and subsequent `dropna()`

### 6. **Time-Series Aware Data Splitting**
- **Chronological Split**: Uses last 30 days as test set to maintain temporal order
- **Future-Proof Validation**: Ensures no data leakage from future to past

## Key Points to Mention in Viva

### Core Concepts
- **Why preprocessing matters**: "Preprocessing transforms raw, messy data into a clean, model-ready format that improves accuracy and prevents training failures."
- **Impact on training**: "Proper preprocessing reduces noise, handles missing data, and ensures numerical stability during gradient boosting."

### Technical Implementation
- **Data cleaning approach**: "We remove complete null rows, filter out header duplicates, and validate critical fields like dates and product names."
- **Type conversion strategy**: "Convert strings to datetime and numeric types, with error handling for invalid entries."
- **Feature engineering**: "Create lag features for temporal dependencies, rolling statistics for trends, and one-hot encoding for categorical products."

### Time-Series Specifics
- **Chronological integrity**: "Use time-based splits instead of random splits to prevent data leakage in forecasting models."
- **Lag feature importance**: "1-day and 7-day lags capture recent sales patterns that are crucial for accurate predictions."

### Practical Considerations
- **Missing value strategy**: "Fill initial lag periods with zeros rather than dropping data, preserving maximum historical information."
- **Scalability**: "Pipeline handles large datasets efficiently using pandas vectorized operations."
- **Error resilience**: "Includes fallback mechanisms for tuning failures and data validation checks."

### Model-Specific Relevance
- **XGBoost compatibility**: "Preprocessing ensures all features are numeric and properly scaled for tree-based algorithms."
- **Feature consistency**: "Save feature order to JSON for deployment alignment between training and inference."

Remember to emphasize how each preprocessing steps directly contributes to the model's ability to learn meaningful sales patterns from historical e-commerce data.
