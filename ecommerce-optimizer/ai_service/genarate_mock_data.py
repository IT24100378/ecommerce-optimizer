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

    # Set the timeline: Jan 1, 2025 to Yesterday (March 2026)
    end_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
    start_date = end_date - timedelta(days=450)

    print(f"Generating orders from {start_date.date()} to {end_date.date()}...")

    orders = []
    order_id_counter = 100000
    current_date = start_date

    while current_date <= end_date:
        is_weekend = current_date.weekday() >= 5
        daily_multiplier = 1.4 if is_weekend else 1.0

        for product, info in catalog.items():
            base_volume = np.random.poisson(info["weight"])
            actual_volume = int(base_volume * daily_multiplier)

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