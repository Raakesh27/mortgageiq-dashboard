// components/RateChart.js
export class RateChart {
  constructor(canvas, data30yr, data15yr) {
    this.canvas = canvas;
    this.data30yr = data30yr;
    this.data15yr = data15yr;
    this.chart = null;
    this.activeTab = '1yr';
    this.init();
  }

  getFilteredData(period) {
    const n = period === '3mo' ? 13 : period === '6mo' ? 26 : 52;
    const d30 = this.data30yr.slice(-n);
    const d15 = this.data15yr.slice(-n);
    return { d30, d15 };
  }

  init() {
    const { d30, d15 } = this.getFilteredData('1yr');
    const labels = d30.map(d => {
      const dt = new Date(d.date);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const cfg = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '30yr Fixed',
            data: d30.map(d => d.rate),
            borderColor: '#4f8ef7',
            backgroundColor: 'rgba(79,142,247,0.06)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#4f8ef7',
            tension: 0.3,
            fill: true,
          },
          {
            label: '15yr Fixed',
            data: d15.map(d => d.rate),
            borderColor: '#34d399',
            backgroundColor: 'rgba(52,211,153,0.04)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#34d399',
            tension: 0.3,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: '#8fa3c8',
              font: { family: "'DM Mono', monospace", size: 11 },
              boxWidth: 10, boxHeight: 2, padding: 16,
              usePointStyle: true, pointStyle: 'line',
            }
          },
          tooltip: {
            backgroundColor: '#1c2740',
            titleColor: '#8fa3c8',
            bodyColor: '#e8edf8',
            borderColor: 'rgba(99,140,230,0.22)',
            borderWidth: 1,
            padding: 10,
            titleFont: { family: "'DM Mono', monospace", size: 11 },
            bodyFont: { family: "'DM Serif Display', Georgia, serif", size: 15 },
            callbacks: {
              label: ctx => `  ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(99,140,230,0.06)', drawTicks: false },
            ticks: {
              color: '#4d6080',
              font: { family: "'DM Mono', monospace", size: 10 },
              maxTicksLimit: 8,
              maxRotation: 0,
            },
            border: { display: false }
          },
          y: {
            position: 'right',
            grid: { color: 'rgba(99,140,230,0.06)', drawTicks: false },
            ticks: {
              color: '#4d6080',
              font: { family: "'DM Mono', monospace", size: 10 },
              callback: v => v.toFixed(2) + '%',
            },
            border: { display: false }
          }
        }
      }
    };

    this.chart = new Chart(this.canvas, cfg);
  }

  updatePeriod(period) {
    this.activeTab = period;
    const { d30, d15 } = this.getFilteredData(period);
    const labels = d30.map(d => {
      const dt = new Date(d.date);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = d30.map(d => d.rate);
    this.chart.data.datasets[1].data = d15.map(d => d.rate);
    this.chart.update('active');
  }

  destroy() {
    this.chart?.destroy();
  }
}
