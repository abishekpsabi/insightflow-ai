document.addEventListener('DOMContentLoaded', async () => {
    // Initial data fetch or mock data if file not yet ready
    let data;
    try {
        const response = await fetch('data/sales_forecast.json');
        if (!response.ok) throw new Error('File not found');
        data = await response.json();
    } catch (e) {
        console.warn('Backend data not found, using simulation.');
        data = getMockData();
    }

    updateDashboard(data);
    initChart(data);
});

function updateDashboard(data) {
    document.getElementById('projected-revenue').textContent = `$${data.metrics.total_projected_revenue.toLocaleString()}`;
    document.getElementById('avg-daily').textContent = `$${data.metrics.avg_daily_forecast.toLocaleString()}`;
}

function initChart(data) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    // Gradient for the forecast area
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

    const chartData = {
        labels: [...data.history.dates, ...data.forecast.dates],
        datasets: [
            {
                label: 'Historical Sales',
                data: [...data.history.sales, ...new Array(data.forecast.sales.length).fill(null)],
                borderColor: '#94a3b8',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.3,
                fill: false
            },
            {
                label: 'Forecasted Sales',
                data: [...new Array(data.history.sales.length - 1).fill(null), data.history.sales[data.history.sales.length-1], ...data.forecast.sales],
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
    };

    new Chart(ctx, {
        type: 'line',
        data: chartData,
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
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', padding: 10 }
                },
                x: {
                    grid: { display: false },
                    ticks: { 
                        color: '#94a3b8', 
                        maxRotation: 0, 
                        autoSkip: true, 
                        maxTicksLimit: 10 
                    }
                }
            }
        }
    });
}

function getMockData() {
    const dates = [];
    const sales = [];
    for (let i = 60; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
        sales.push(Math.floor(Math.random() * 2000) + 5000);
    }
    
    const fDates = [];
    const fSales = [];
    for (let i = 1; i <= 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        fDates.push(d.toISOString().split('T')[0]);
        fSales.push(Math.floor(Math.random() * 2000) + 6000);
    }

    return {
        history: { dates, sales },
        forecast: { dates: fDates, sales: fSales },
        metrics: {
            total_projected_revenue: 185420.50,
            avg_daily_forecast: 6180.68
        }
    };
}
