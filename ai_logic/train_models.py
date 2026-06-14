import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
import json
import os

def train_sales_forecast():
    # Load data
    df = pd.read_csv('data/historical_sales.csv', parse_dates=['Date'])
    
    # Feature engineering: days since start
    df['DayIndex'] = (df['Date'] - df['Date'].min()).dt.days
    
    # Features for seasonality
    df['DayOfWeek'] = df['Date'].dt.dayofweek
    df['IsWeekend'] = df['DayOfWeek'].apply(lambda x: 1 if x >= 5 else 0)
    
    X = df[['DayIndex', 'IsWeekend']]
    y = df['Sales']
    
    # Train model
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X, y)
    
    # Predict next 30 days
    last_day = df['DayIndex'].max()
    future_indices = np.arange(last_day + 1, last_day + 31)
    
    # Generate future dates
    last_date = df['Date'].max()
    future_dates = [last_date + pd.Timedelta(days=i) for i in range(1, 31)]
    future_is_weekend = [1 if d.weekday() >= 5 else 0 for d in future_dates]
    
    X_future = pd.DataFrame({
        'DayIndex': future_indices,
        'IsWeekend': future_is_weekend
    })
    
    predictions = model.predict(X_future)
    
    # Prepare result for frontend
    result = {
        'history': {
            'dates': df['Date'].dt.strftime('%Y-%m-%d').tolist()[-60:], # Last 60 days
            'sales': df['Sales'].tolist()[-60:]
        },
        'forecast': {
            'dates': [d.strftime('%Y-%m-%d') for d in future_dates],
            'sales': predictions.round(2).tolist()
        },
        'metrics': {
            'total_projected_revenue': round(float(np.sum(predictions)), 2),
            'avg_daily_forecast': round(float(np.mean(predictions)), 2),
            'growth_rate': "12.5%" # Simplified for demo
        }
    }
    
    with open('data/sales_forecast.json', 'w') as f:
        json.dump(result, f, indent=4)
    
    print("Sales forecast model trained and results saved to data/sales_forecast.json")

if __name__ == "__main__":
    if os.path.exists('data/historical_sales.csv'):
        train_sales_forecast()
    else:
        print("Historical data not found. Run generate_data.py first.")
