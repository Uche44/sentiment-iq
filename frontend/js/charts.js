(function () {
  const COLORS = { Happy: '#2e9e5b', Angry: '#d64545', Neutral: '#d9a21b' };
  const INK = '#111114';
  const INK_SOFT = '#4a4a52';
  const MONO = "'Space Mono', monospace";

  let distributionChart = null;
  let trendChart = null;

  if (window.Chart) {
    window.Chart.defaults.font.family = MONO;
    window.Chart.defaults.color = INK;
  }

  function tooltipOptions() {
    return {
      backgroundColor: INK,
      titleColor: '#fffcf4',
      bodyColor: '#fffcf4',
      titleFont: { family: MONO, size: 11 },
      bodyFont: { family: MONO, size: 11 },
      padding: 10,
      cornerRadius: 8,
      displayColors: true,
    };
  }

  function formatLabel(period, interval) {
    const date = new Date(period + 'T00:00:00Z');
    if (Number.isNaN(date.getTime())) return period;
    if (interval === 'month') {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        year: '2-digit',
        timeZone: 'UTC',
      });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  function renderDistribution(canvas, data) {
    if (!window.Chart) throw new Error('Chart library failed to load');
    const order = ['Happy', 'Neutral', 'Angry'];
    const values = order.map(function (key) {
      return data[key] || 0;
    });

    if (distributionChart) {
      distributionChart.data.datasets[0].data = values;
      distributionChart.update();
      return;
    }

    distributionChart = new window.Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: order,
        datasets: [
          {
            data: values,
            backgroundColor: order.map(function (key) {
              return COLORS[key];
            }),
            borderColor: INK,
            borderWidth: 3,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: tooltipOptions(),
        },
      },
    });
  }

  function renderTrend(canvas, points, interval) {
    if (!window.Chart) throw new Error('Chart library failed to load');
    const labels = points.map(function (point) {
      return formatLabel(point.period, interval);
    });
    const order = ['Happy', 'Neutral', 'Angry'];
    const series = order.map(function (key) {
      return {
        label: key,
        data: points.map(function (point) {
          return point[key] || 0;
        }),
        borderColor: COLORS[key],
        backgroundColor: COLORS[key],
        borderWidth: 2.5,
        pointRadius: 2,
        pointHoverRadius: 5,
        pointBorderColor: INK,
        pointBorderWidth: 1,
        tension: 0.3,
      };
    });

    if (trendChart) {
      trendChart.data.labels = labels;
      trendChart.data.datasets.forEach(function (dataset, index) {
        dataset.data = series[index].data;
      });
      trendChart.update();
      return;
    }

    trendChart = new window.Chart(canvas, {
      type: 'line',
      data: { labels: labels, datasets: series },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: tooltipOptions(),
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: INK, width: 2 },
            ticks: {
              color: INK_SOFT,
              font: { family: MONO, size: 10 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 9,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(17,17,20,0.12)', borderDash: [4, 4] },
            border: { display: false },
            ticks: {
              color: INK_SOFT,
              font: { family: MONO, size: 10 },
              precision: 0,
            },
          },
        },
      },
    });
  }

  function resizeAll() {
    if (distributionChart) distributionChart.resize();
    if (trendChart) trendChart.resize();
  }

  window.Charts = {
    COLORS: COLORS,
    renderDistribution: renderDistribution,
    renderTrend: renderTrend,
    resizeAll: resizeAll,
  };
})();
