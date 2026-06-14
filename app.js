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
    };
    reader.readAsText(file);
}

async function runMLForecast() {
    if (!rawCsvData) {
        alert("Please upload a CSV file first.");
        return;
    }

    const modelType = document.getElementById('model-select').value;
    const days = parseInt(document.getElementById('forecast-period').value);
    
    document.getElementById('loading-spinner').style.display = 'block';
    document.getElementById('train-btn').disabled = true;
    document.getElementById('train-btn').textContent = "Training...";
    log(`Initializing ${modelType === 'rf' ? 'Random Forest' : 'Linear Regression'}...`);

    // The Python Script
    const pythonCode = `
import pandas as pd
import numpy as np
from io import StringIO
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score

# Load data
data = pd.read_csv(StringIO(raw_csv))
data['Date'] = pd.to_datetime(data['Date'])
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
future_is_weekend = future_dates.dayofweek.apply(lambda x: 1 if x >= 5 else 0)

X_future = pd.DataFrame({'DayIndex': future_indices, 'IsWeekend': future_is_weekend})
predictions = model.predict(X_future)

# Prepare result
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
        alert(`Error processing CSV. Check the log for details.\n\nHint: Ensure your file has 'Date' and 'Sales' columns.`);
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

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [...data.history_dates, ...data.dates],
            datasets: [
                {
                    label: 'Historical',
                    data: [...data.history_sales, ...new Array(data.sales.length).fill(null)],
                    borderColor: '#94a3b8',
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Forecast',
                    data: [...new Array(data.history_sales.length - 1).fill(null), data.history_sales[data.history_sales.length-1], ...data.sales],
                    borderColor: '#6366f1',
                    borderDash: [5, 5],
                    tension: 0.3,
                    fill: true,
                    backgroundColor: 'rgba(99, 102, 241, 0.1)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 10 } }
            }
        }
    });
}

function generateRecommendations(data) {
    const list = document.querySelector('.insights-list');
    list.innerHTML = ""; // Clear existing

    // Simple AI logic for recommendations
    const maxForecast = Math.max(...data.sales);
    const maxDate = data.dates[data.sales.indexOf(maxForecast)];
    
    const recommendations = [
        {
            icon: '🚀',
            title: 'Peak Performance Predicted',
            text: `Expect highest revenue on ${maxDate}. Prepare inventory for $${maxForecast.toLocaleString()} peak.`
        },
        {
            icon: '💡',
            title: 'Budget Allocation',
            text: `Model suggests a ${data.accuracy} confidence level. Increase ad spend by 10% during weekend peaks.`
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
        log(`Warning: Failed to load default data (${e.message})`);
        console.warn("Could not load default data:", e);
    }
}

function log(msg) {
    const logEl = document.getElementById('process-log');
    const span = document.createElement('span');
    span.textContent = `> ${msg}`;
    logEl.appendChild(span);
    logEl.scrollTop = logEl.scrollHeight;
}

// Start the engine
init();
