import sys
import os
import json # <-- Ensure json is imported
import xgboost as xgb
import pandas as pd
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional


def load_local_env_file(file_name: str = ".env"):
    """Load key=value pairs from ai_service/.env into process env if missing."""
    env_path = os.path.join(os.path.dirname(__file__), file_name)
    if not os.path.exists(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


load_local_env_file()

app = FastAPI(title="Sales Prediction AI Service")

# Security: Shared API key for microservice-to-microservice authentication.
# The Node.js backend must include this key in the X-API-Key header.
# Method used: Pre-shared API key validation between internal services.
AI_SERVICE_API_KEY = os.environ.get("AI_SERVICE_API_KEY", "")
ALLOW_UNSAFE_NO_API_KEY = os.environ.get("ALLOW_UNSAFE_NO_API_KEY", "false").lower() == "true"

# Security: Require API key unless explicitly allowed for local development.
if not AI_SERVICE_API_KEY and not ALLOW_UNSAFE_NO_API_KEY:
    print("[SECURITY ERROR] AI_SERVICE_API_KEY is not set. Refusing to start without service authentication.")
    sys.exit(1)

if not AI_SERVICE_API_KEY and ALLOW_UNSAFE_NO_API_KEY:
    print("[SECURITY WARNING] Running without AI_SERVICE_API_KEY because ALLOW_UNSAFE_NO_API_KEY=true")

def verify_api_key(x_api_key: Optional[str] = Header(default=None)):
    """Verify the incoming X-API-Key matches the configured secret."""
    if AI_SERVICE_API_KEY and x_api_key != AI_SERVICE_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing API key.")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print("\n--- 422 VALIDATION REJECTION ---")
    print(f"EXACT ERROR: {exc.errors()}")
    print("--------------------------------\n")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

print("--- Initializing AI Microservice ---")
try:
    model = xgb.XGBRegressor()
    model.load_model("xgboost_sales_model.json")

    # THE FIX: Read the exact features from the physical ledger we created
    with open("xgboost_features.json", "r") as f:
        EXPECTED_FEATURES = json.load(f)

    print(f"SUCCESS: Model loaded. Expecting {len(EXPECTED_FEATURES)} features.")
except Exception as e:
    print(f"\nFATAL STARTUP ERROR: {e}\n")
    sys.exit(1)


# ---------------------------------------------------------
# The Strict Schema
# ---------------------------------------------------------
class SalesPredictionRequest(BaseModel):
    product_name: str
    price_each: float = Field(alias="Price Each")
    sales_lag_1day: float = Field(alias="Sales_Lag_1Day")
    sales_lag_7days: float = Field(alias="Sales_Lag_7Days")
    month: int = Field(alias="Month")
    day_of_week: int = Field(alias="DayOfWeek")
    rolling_mean_7d: float = Field(alias="Rolling_Mean_7D")

# ---------------------------------------------------------
# The Prediction Engine
# ---------------------------------------------------------
@app.post("/predict")
def predict_sales(request: SalesPredictionRequest, x_api_key: Optional[str] = Header(default=None)):
    # Security: Verify the API key before processing any prediction request
    verify_api_key(x_api_key)
    try:
        # Step 1: Map the base temporal/lag features
        input_dict = {
            'Price Each': request.price_each,
            'Sales_Lag_1Day': request.sales_lag_1day,
            'Sales_Lag_7Days': request.sales_lag_7days,
            'Month': request.month,
            'DayOfWeek': request.day_of_week,
            'Rolling_Mean_7D': request.rolling_mean_7d
        }

        # Step 2: Initialize all expected AI features to 0.0
        for feature in EXPECTED_FEATURES:
            if feature not in input_dict:
                input_dict[feature] = 0.0

        # Step 3: Translate the product name into the 1.0 binary flag
        target_item_col = f"Item_{request.product_name}"
        if target_item_col in EXPECTED_FEATURES:
            input_dict[target_item_col] = 1.0
        else:
            print(f"WARNING: Unknown product '{request.product_name}' requested.")

        # Step 4: Construct DataFrame and Predict
        df = pd.DataFrame([input_dict])[EXPECTED_FEATURES]
        prediction = model.predict(df)[0]
        final_prediction = max(0.0, float(prediction))

        return {"predicted_quantity": round(final_prediction, 2)}

    except Exception as e:
        print(f"INFERENCE ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))