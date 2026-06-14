let pyodide;
let salesChart;
let rawCsvData = null;

async function init() {
    console.log("Initializing In-Browser ML Engine...");
    document.getElementById('loading-spinner').style.display = 'block';
    document.getElementById('accuracy-score').textContent = "Loading Engine...";
    
    try {
        log("Booting Python environment...");
        pyodide = await loadPyodide();
        log("Environment mounted. Installing packages...");
        await pyodide.loadPackage(['pandas', 'scikit-learn', 'numpy']);
        log("All systems online. Ready to forecast.");
        document.getElementById('accuracy-score').textContent = "Ready";
        document.getElementById('active-model-name').textContent = "None Selected";
    } catch (e) {
        console.error("Pyodide failed to load:", e);
        log("Engine Error: " + e.message);
        document.getElementById('accuracy-score').textContent = "Engine Error";
    } finally {
        document.getElementById('loading-spinner').style.display = 'none';
    }

    setupEventListeners();
    loadDefaultData();
}

function setupEventListeners() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('csv-upload');
    const trainBtn = document.getElementById('train-btn');

    dropzone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--accent)';
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--card-border)';
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    trainBtn.addEventListener('click', runMLForecast);
    document.getElementById('export-pdf').addEventListener('click', exportPDF);
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("InsightFlow AI - Business Report", 20, 30);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 45);
    
    doc.text("Current Forecast Summary:", 20, 60);
    doc.text(`- Projected Revenue: ${document.getElementById('projected-revenue').textContent}`, 30, 75);
    doc.text(`- Avg Daily Sales: ${document.getElementById('avg-daily').textContent}`, 30, 85);
    doc.text(`- Model Accuracy: ${document.getElementById('accuracy-score').textContent}`, 30, 95);
    
    doc.text("Strategic Recommendations:", 20, 115);
    const insights = document.querySelectorAll('.insight-content');
    let y = 130;
    insights.forEach(el => {
        const title = el.querySelector('strong').textContent;
        const text = el.querySelector('p').textContent;
        doc.setFont("helvetica", "bold");
        doc.text(title, 30, y);
        doc.setFont("helvetica", "normal");
        doc.text(text, 30, y + 7, { maxWidth: 150 });
        y += 25;
    });

    doc.save("insightflow_report.pdf");
}

function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        rawCsvData = e.target.result;
        document.getElementById('dropzone').querySelector('p').textContent = `File Loaded: ${file.name}`;
        log(`File loaded: ${file.name}`);
    };
    reader.readAsText(file);
}

async function runMLForecast() {
    if (!rawCsvData) {
        alert("Please upload a CSV file first or wait for default data to load.");
        return;
    }

    const modelType = document.getElementById('model-select').value;
    const days = parseInt(document.getElementById('forecast-period').value);
    
    document.getElementById('loading-spinner').style.display = 'block';
    document.getElementById('train-btn').disabled = true;
    document.getElementById('train-btn').textContent = "Training...";
    log(`Initializing ${modelType === 'rf' ? 'Random Forest' : 'Linear Regression'}...`);

    const pythonCode = `
import pandas as pd
import numpy as np
from io import StringIO
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score

# Load data
data = pd.read_csv(StringIO(raw_csv))

# Auto-detect column names (case-insensitive)
col_map = {c.lower().strip(): c for c in data.columns}

# Find date column
date_col = None
for candidate in ['date', 'dates', 'day', 'time', 'month', 'year', 'period']:
    if candidate in col_map:
        date_col = col_map[candidate]
        break
if date_col is None:
    for c in data.columns:
        try:
            pd.to_datetime(data[c].head(3))
            date_col = c
            break
        except:
            pass

# Find sales column
sales_col = None
for candidate in ['sales', 'sale', 'revenue', 'amount', 'value', 'price', 'total', 'income']:
    if candidate in col_map:
        sales_col = col_map[candidate]
        break
if sales_col is None:
    for c in data.columns:
        if c != date_col and pd.api.types.is_numeric_dtype(data[c]):
            sales_col = c
            break

if date_col is None or sales_col is None:
    raise ValueError(f"Could not find Date/Sales columns. Columns found: {list(data.columns)}")

# Rename for consistency
data = data.rename(columns={date_col: 'Date', sales_col: 'Sales'})
data['Sales'] = pd.to_numeric(data['Sales'], errors='coerce').fillna(0)
data['Date'] = pd.to_datetime(data['Date'], infer_datetime_format=True)
data = data.sort_values('Date').reset_index(drop=True)

data['DayIndex'] = (data['Date'] - data['Date'].min()).dt.days
data['IsWeekend'] = data['Date'].dt.dayofweek.apply(lambda x: 1 if x >= 5 else 0)

X = data[['DayIndex', 'IsWeekend']]
y = data['Sales']

# Select model
if model_type == 'rf':
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    name = "Random Forest"
else:
    model = LinearRegression()
    name = "Linear Regression"

# Train
model.fit(X, y)
score = r2_score(y, model.predict(X))

# Forecast
last_day = data['DayIndex'].max()
future_indices = np.arange(last_day + 1, last_day + 1 + forecast_days)
future_dates = pd.date_range(start=data['Date'].max() + pd.Timedelta(days=1), periods=forecast_days)
future_is_weekend = future_dates.dayofweek.map(lambda x: 1 if x >= 5 else 0)

X_future = pd.DataFrame({'DayIndex': future_indices, 'IsWeekend': future_is_weekend})
predictions = model.predict(X_future)

result = {
    "dates": future_dates.strftime('%Y-%m-%d').tolist(),
    "sales": predictions.round(2).tolist(),
    "accuracy": f"{score*100:.1f}%",
    "model_name": name,
    "total_revenue": float(np.sum(predictions)),
    "avg_daily": float(np.mean(predictions)),
    "history_dates": data['Date'].dt.strftime('%Y-%m-%d').tolist()[-30:],
    "history_sales": data['Sales'].tolist()[-30:]
}
result
    `;

    try {
        pyodide.globals.set("raw_csv", rawCsvData);
        pyodide.globals.set("model_type", modelType);
        pyodide.globals.set("forecast_days", days);
        
        log("Parsing dataset...");
        const output = await pyodide.runPythonAsync(pythonCode);
        log("Training model on device...");
        const result = output.toJs({dict_converter: Object.fromEntries});
        
        log("Model fit complete. Generating dashboard...");
        updateDashboard(result);
        generateRecommendations(result);
        log("Success! Data updated.");
    } catch (e) {
        console.error("ML Error:", e);
        const errorMsg = e.message.split('\n')[0];
        log(`System Error: ${errorMsg}`);
        alert(`Error: ${errorMsg}\n\nHint: Ensure your CSV has a Date column and a numeric Sales column.`);
    } finally {
        document.getElementById('loading-spinner').style.display = 'none';
        document.getElementById('train-btn').disabled = false;
        document.getElementById('train-btn').textContent = "Train Model";
    }
}

function updateDashboard(data) {
    document.getElementById('projected-revenue').textContent = `$${data.total_revenue.toLocaleString()}`;
    document.getElementById('avg-daily').textContent = `$${data.avg_daily.toLocaleString()}`;
    document.getElementById('accuracy-score').textContent = data.accuracy;
    document.getElementById('active-model-name').textContent = data.model_name;
    updateChart(data);
}

function updateChart(data) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    if (salesChart) salesChart.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [...data.history_dates, ...data.dates],
            datasets: [
                {
                    label: 'Historical',
                    data: [...data.history_sales, ...new Array(data.sales.length).fill(null)],
                    borderColor: '#94a3b8',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Forecast',
                    data: [...new Array(data.history_sales.length - 1).fill(null), data.history_sales[data.history_sales.length-1], ...data.sales],
                    borderColor: '#6366f1',
                    borderWidth: 3,
                    borderDash: [5, 5],
                    pointRadius: 4,
                    pointBackgroundColor: '#6366f1',
                    tension: 0.3,
                    fill: true,
                    backgroundColor: gradient
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#94a3b8',
                    padding: 12,
                    borderRadius: 8,
                    displayColors: false
                }
            },
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', padding: 10 } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 10 } }
            }
        }
    });
}

function generateRecommendations(data) {
    const list = document.querySelector('.insights-list');
    list.innerHTML = "";

    const maxForecast = Math.max(...data.sales);
    const maxDate = data.dates[data.sales.indexOf(maxForecast)];
    const minForecast = Math.min(...data.sales);
    const minDate = data.dates[data.sales.indexOf(minForecast)];
    
    const recommendations = [
        {
            icon: '🚀',
            title: 'Peak Performance Predicted',
            text: `Expect highest revenue of $${maxForecast.toLocaleString()} on ${maxDate}. Prepare inventory and staff accordingly.`
        },
        {
            icon: '📉',
            title: 'Low Period Alert',
            text: `Sales may dip to $${minForecast.toLocaleString()} around ${minDate}. Consider promotions to offset the slowdown.`
        },
        {
            icon: '💡',
            title: 'AI Budget Recommendation',
            text: `Model confidence is ${data.accuracy}. Increase weekend marketing budget by 10-15% to capture peak demand.`
        }
    ];

    recommendations.forEach(rec => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="insight-icon">${rec.icon}</span>
            <div class="insight-content">
                <strong>${rec.title}</strong>
                <p>${rec.text}</p>
            </div>
        `;
        list.appendChild(li);
    });
}

async function loadDefaultData() {
    try {
        log("Fetching default data...");
        const response = await fetch('data/historical_sales.csv');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        rawCsvData = await response.text();
        log("Default dataset loaded and ready.");
        document.getElementById('dropzone').querySelector('p').textContent = `Ready: historical_sales.csv`;
    } catch (e) {
        log(`Warning: Could not load default data (${e.message}). Please upload a CSV.`);
        console.warn("Could not load default data:", e);
    }
}

function log(msg) {
    const logEl = document.getElementById('process-log');
    if (!logEl) return;
    const span = document.createElement('span');
    span.textContent = `> ${msg}`;
    logEl.appendChild(span);
    logEl.scrollTop = logEl.scrollHeight;
}

// Start the engine
init();
