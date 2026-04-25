import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

def generate_ecommerce_data():
    print("--- 1. Initializing Synthetic Data Engine ---")

    # This catalog is mathematically synced to your exact PostgreSQL database strings.
    # DO NOT remove the trailing spaces on Alpha 7R V or Cinema Line FX6.
    catalog = {
        'iPhone 17 Pro Max': {"price": 1299, "weight": 20},
        'MacBook Pro 16 Inch': {"price": 2699, "weight": 5},
        'MacBook Neo': {"price": 599, "weight": 25},
        'iMac': {"price": 1699, "weight": 8},
        'MacBook Air 15 Inch': {"price": 1299, "weight": 11},
        'Sony WH-1000XM6': {"price": 459, "weight": 35},
        'Sony WF-1000XM6': {"price": 299, "weight": 35},
        'BRAVIA XR 65': {"price": 3499, "weight": 4},
        'BRAVIA XR 83': {"price": 3599, "weight": 4},
        'BRAVIA XR 77': {"price": 4499, "weight": 3},
        'BRAVIA XR8B 65': {"price": 1299, "weight": 11},
        'Alpha 7R V ': {"price": 3299, "weight": 4},
        'Alpha 7 V': {"price": 2899, "weight": 5},
        'Cinema Line FX6 ': {"price": 8299, "weight": 1},
        'Alpha 1': {"price": 6199, "weight": 2},
        'Samsung 85" Neo QLED QN80H': {"price": 3299, "weight": 4},
        'Galaxy Z Fold7': {"price": 1999, "weight": 7},
        'Galaxy S26 Ultra': {"price": 1299, "weight": 20},
        'Galaxy S26+': {"price": 1299, "weight": 20},
        'BRAVIA 3 II 65': {"price": 899, "weight": 16},
    }

    # Product-level popularity calibrated for a medium/small vendor profile.
    product_popularity = {
        'iPhone 17 Pro Max': 0.95,
        'MacBook Pro 16 Inch': 0.62,
        'MacBook Neo': 1.00,
        'iMac': 0.70,
        'MacBook Air 15 Inch': 0.82,
        'Sony WH-1000XM6': 0.72,
        'Sony WF-1000XM6': 1.05,
        'BRAVIA XR 65': 0.56,
        'BRAVIA XR 83': 0.40,
        'BRAVIA XR 77': 0.46,
        'BRAVIA XR8B 65': 0.78,
        'Alpha 7R V ': 0.48,
        'Alpha 7 V': 0.56,
        'Cinema Line FX6 ': 0.28,
        'Alpha 1': 0.34,
        'Samsung 85" Neo QLED QN80H': 0.50,
        'Galaxy Z Fold7': 0.62,
        'Galaxy S26 Ultra': 0.90,
        'Galaxy S26+': 0.86,
        'BRAVIA 3 II 65': 0.92,
    }

    # Modest weekly and seasonal variance to avoid unrealistic spikes.
    dow_factor = {0: 0.95, 1: 0.98, 2: 1.00, 3: 1.01, 4: 1.04, 5: 1.10, 6: 1.07}
    month_factor = {1: 0.96, 2: 0.98, 3: 1.00, 4: 1.01, 5: 1.01, 6: 1.00, 7: 0.99, 8: 1.00, 9: 1.01, 10: 1.03, 11: 1.06, 12: 1.08}

    def computed_lambda(product, base_weight, price, current_date, start_date):
        # Smooth price elasticity avoids abrupt demand jumps at hard tier boundaries.
        reference_price = 999.0
        elasticity = 0.22
        price_ratio = reference_price / max(float(price), 1.0)
        price_factor = float(np.clip(price_ratio ** elasticity, 0.72, 1.25))

        popularity_factor = product_popularity.get(product, 1.0)
        weekday_factor = dow_factor[current_date.weekday()]
        seasonality_factor = month_factor[current_date.month]

        # Keep rare promotion shocks small so forecasts remain stable and realistic.
        event_boost = 1.0
        if random.random() < 0.006:
            event_boost = random.uniform(1.04, 1.12)

        total_days = max((end_date - start_date).days, 1)
        progress = (current_date - start_date).days / total_days
        trend_factor = 1.0 + (0.02 * progress)

        demand_scale = 0.55
        lam = (
            base_weight
            * popularity_factor
            * price_factor
            * weekday_factor
            * seasonality_factor
            * event_boost
            * trend_factor
            * demand_scale
        )
        return max(0.2, min(48.0, lam))

    # Set the timeline: Jan 1, 2025 to Yesterday
    end_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
    start_date = end_date - timedelta(days=450)

    print(f"Generating orders from {start_date.date()} to {end_date.date()}...")

    orders = []
    order_id_counter = 100000
    current_date = start_date

    while current_date <= end_date:
        for product, info in catalog.items():
            lam = computed_lambda(product, info["weight"], info["price"], current_date, start_date)
            actual_volume = np.random.poisson(lam)

            for _ in range(actual_volume):
                order_time = current_date + timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))

                qty = 1
                if info["price"] < 1000 and random.random() > 0.8:
                    qty = random.randint(2, 4)

                orders.append({
                    "Order ID": str(order_id_counter),
                    "Product": product,
                    "Quantity Ordered": qty,
                    "Price Each": info["price"],
                    "Order Date": order_time.strftime('%m/%d/%y %H:%M')
                })
                order_id_counter += 1

        current_date += timedelta(days=1)

    print("\n--- 2. Formatting and Saving ---")
    df = pd.DataFrame(orders)
    df = df.sample(frac=1).reset_index(drop=True)

    output_file = 'merged_sales_data.csv'
    df.to_csv(output_file, index=False)

    print(f"SUCCESS: Generated {len(df)} realistic orders.")
    print(f"Saved to '{output_file}'. The AI is ready to be retrained.")

if __name__ == "__main__":
    generate_ecommerce_data()