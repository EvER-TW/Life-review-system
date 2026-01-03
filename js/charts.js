/**
 * Chart.js 圖表模組
 */

const HEATMAP_COLORS = {
    1: '#ff4444', 2: '#ff8844', 3: '#ffcc44', 4: '#aadd44', 5: '#44dd44'
};

function createRadarChart(canvasId, labels, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    return new Chart(ctx, {
        type: 'radar',
        data: {
            labels,
            datasets: [{
                data,
                fill: true,
                borderColor: '#00d9ff',
                backgroundColor: 'rgba(0, 217, 255, 0.2)',
                pointBackgroundColor: '#00d9ff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                r: {
                    beginAtZero: true, max: 5,
                    ticks: { stepSize: 1, color: '#6b6b7b', backdropColor: 'transparent' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    pointLabels: { color: '#a0a0b0', font: { size: 10 } }
                }
            }
        }
    });
}

function createBarChart(canvasId, labels, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: data.map(v => v >= 100 ? 'rgba(78,205,196,0.8)' : v >= 60 ? 'rgba(255,204,68,0.8)' : 'rgba(255,107,107,0.8)'),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, max: 200, ticks: { color: '#a0a0b0', callback: v => v + '%' } }
            }
        }
    });
}

function updateHeatmapCell(cell, value) {
    cell.setAttribute('data-value', Math.min(5, Math.max(1, parseInt(value) || 0)));
    cell.className = 'heat-cell';
}

function calculateHeatmapAverages(data) {
    return Array.from({ length: 24 }, (_, hour) => {
        let sum = 0, count = 0;
        for (let day = 0; day < 7; day++) {
            if (data[day]?.[hour]) { sum += parseInt(data[day][hour]) || 0; count++; }
        }
        return count > 0 ? Math.round(sum / count) : 0;
    });
}

export { createRadarChart, createBarChart, updateHeatmapCell, calculateHeatmapAverages, HEATMAP_COLORS };
