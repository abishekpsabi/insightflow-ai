import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

def generate_sales_data(days=365):
    np.random.seed(42)
    start_date = datetime.now() - timedelta(days=days)
    dates = [start_date + timedelta(days=i) for i in range(days)]
    
    # Base sales
    base_sales = 5000
    
    # Seasonality (weekly)
    weekly_seasonality = [1.2 if d.weekday() >= 5 else 1.0 for d in dates]
    
    # Trend (gradual growth)
    trend = np.linspace(1, 1.5, days)
    
    # Random noise
    noise = np.random.normal(0, 500, days)
    
    sales = (base_sales * trend * weekly_seasonality) + noise
    sales = np.maximum(sales, 0) # No negative sales
    
    df = pd.DataFrame({
        'Date': dates,
        'Sales': sales.round(2)
    })
    
    return df

if __name__ == "__main__":
    output_dir = "data"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    df = generate_sales_data()
    df.to_csv(os.path.join(output_dir, 'historical_sales.csv'), index=False)
    print(f"Generated {len(df)} rows of sales data in {output_dir}/historical_sales.csv")
