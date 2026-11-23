/* DESIGN PREVIEW ONLY. Synthetic events; no visitor collection or network calls. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const sampleToday = '2026-11-23';
  const sources = [
    {id: 'kijiji-coins', platform: 'kijiji', name: 'Kijiji · Coin collection', detail: 'Example ad A'},
    {id: 'kijiji-dollars', platform: 'kijiji', name: 'Kijiji · Silver dollars', detail: 'Example ad B'},
    {id: 'facebook-coins', platform: 'facebook', name: 'Facebook · Coin collection', detail: 'Example campaign'},
    {id: 'direct', platform: 'direct', name: 'Direct / unknown', detail: 'No campaign identified'}
  ];
  const products = [
    {id: 'coin-001', title: '2013 Santa Silver Coin'},
    {id: 'coin-009', title: '1984 Toronto Silver Dollar'},
    {id: 'coin-015', title: '1993 Stanley Cup Silver Dollar'},
    {id: 'coin-016', title: '1996 John McIntosh Silver Dollar'},
    {id: 'coin-007', title: '1982 Regina Silver Dollar'}
  ];
  // Deliberately fixed example history, independent of real visitors or orders.
  const events = [];
  for (let day = 1; day <= 23; day++) {
    const date = `2026-11-${String(day).padStart(2, '0')}`;
    const volume = day < 12 ? 2 + day % 4 : day < 18 ? 6 + day % 5 : 12 + day % 7;
    const split = [day < 12 ? 0 : Math.floor(volume * .35), day < 18 ? 0 : Math.floor(volume * .2), day % 3 === 0 ? 2 : 0];
    split.push(volume - split.reduce((sum, count) => sum + count, 0));
    sources.forEach((source, sourceIndex) => {
      const visits = split[sourceIndex];
      for (let i = 0; i < visits; i++) {
        events.push({date, hour: (i * 7 + day * 3 + sourceIndex) % 24, source: source.id, platform: source.platform, type: 'visits'});
      }
      const clicks = Math.floor(visits * (sourceIndex === 0 ? 1.2 : .75));
      for (let i = 0; i < clicks; i++) {
        events.push({date, hour: (i * 5 + day * 3 + sourceIndex + 1) % 24, source: source.id, platform: source.platform, type: 'clicks', product: products[(day + i + sourceIndex) % products.length].id});
      }
    });
  }
  let metric = 'visits';
  let buckets = [];
  let plotted = [];
  let points = [];
  let activeIndex = null;
  let chartWidth = 1100;
  let plotRight = 1040;
  const dayMs = 86400000;
  const endDate = new Date(`${sampleToday}T12:00:00Z`);
  const dateLabel = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-CA', {month: 'short', day: 'numeric', timeZone: 'UTC'});
  const metricName = () => metric === 'visits' ? 'site visits' : 'inventory clicks';
  function period() {
    const selection = $('#period-filter').value;
    const days = selection === 'today' ? 1 : selection === 'all' ? 23 : Number(selection);
    const start = new Date(endDate.getTime() - (days - 1) * dayMs).toISOString().slice(0, 10);
    return {start, end: sampleToday, hourly: selection === 'today'};
  }
  function currentEvents(range) {
    const source = $('#source-filter').value;
    return events.filter(event => event.date >= range.start && event.date <= range.end && (source === 'all' || event.platform === source));
  }
  function buildBuckets(range, selected) {
    const result = [];
    if (range.hourly) {
      for (let hour = 0; hour < 24; hour++) result.push({key: hour, label: `${String(hour).padStart(2, '0')}:00`, tooltip: `${dateLabel(range.end)}, ${String(hour).padStart(2, '0')}:00`, visits: 0, clicks: 0});
    } else {
      for (let time = Date.parse(`${range.start}T12:00:00Z`); time <= endDate.getTime(); time += dayMs) {
        const key = new Date(time).toISOString().slice(0, 10);
        result.push({key, label: dateLabel(key), tooltip: dateLabel(key), visits: 0, clicks: 0});
      }
    }
    const lookup = new Map(result.map(row => [row.key, row]));
    for (const event of selected) lookup.get(range.hourly ? event.hour : event.date)[event.type]++;
    return result;
  }
  function hideTooltip() {
    activeIndex = null;
    $('#chart-tooltip').hidden = true;
    $('#chart-cursor')?.setAttribute('visibility', 'hidden');
    $('#chart-dot')?.setAttribute('visibility', 'hidden');
  }
  function showTooltip(index) {
    const row = buckets[index];
    if (!row) return;
    activeIndex = index;
    const cumulative = $('#cumulative').checked;
    const tooltip = $('#chart-tooltip');
    const date = document.createElement('span');
    date.textContent = row.tooltip;
    const count = document.createElement('strong');
    count.textContent = `${plotted[index]} ${cumulative ? 'cumulative ' : ''}${metricName()}`;
    tooltip.replaceChildren(date, count);
    tooltip.hidden = false;
    const wrap = $('#chart-wrap');
    const width = wrap.clientWidth;
    const desired = points[index].x / chartWidth * width;
    const half = tooltip.offsetWidth / 2;
    tooltip.style.left = `${Math.max(half + 4, Math.min(width - half - 4, desired))}px`;
    $('#chart-cursor').setAttribute('x1', points[index].x);
    $('#chart-cursor').setAttribute('x2', points[index].x);
    $('#chart-cursor').setAttribute('visibility', 'visible');
    $('#chart-dot').setAttribute('cx', points[index].x);
    $('#chart-dot').setAttribute('cy', points[index].y);
    $('#chart-dot').setAttribute('visibility', 'visible');
  }
  function renderChart(range) {
    const svg = $('#traffic-chart');
    chartWidth = Math.max(280, svg.getBoundingClientRect().width);
    const height = svg.clientHeight || 300;
    svg.setAttribute('viewBox', `0 0 ${chartWidth} ${height}`);
    const left = 12, right = chartWidth - 42, top = 28, bottom = height - 42;
    plotRight = right;
    let running = 0;
    plotted = buckets.map(row => $('#cumulative').checked ? (running += row[metric]) : row[metric]);
    const step = Math.max(1, Math.ceil(Math.max(...plotted, 1) / 4));
    const ceiling = step * 4;
    points = plotted.map((count, index) => ({x: left + index / Math.max(1, plotted.length - 1) * (right - left), y: bottom - count / ceiling * (bottom - top)}));
    const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
    const grid = Array.from({length: 5}, (_, index) => {
      const y = bottom - index / 4 * (bottom - top);
      return `<line class="grid-line" x1="${left}" y1="${y}" x2="${right}" y2="${y}"/><text class="axis-label" x="${right + 15}" y="${y + 4}">${index * step}</text>`;
    }).join('');
    const labelCount = Math.min(chartWidth < 500 ? 3 : 6, buckets.length);
    const indices = [...new Set(Array.from({length: labelCount}, (_, index) => Math.round(index / Math.max(1, labelCount - 1) * (buckets.length - 1))))];
    const labels = indices.map((index, order) => `<text class="axis-label" x="${points[index].x}" y="${height - 14}" text-anchor="${order === 0 ? 'start' : order === indices.length - 1 ? 'end' : 'middle'}">${buckets[index].label}</text>`).join('');
    const targets = points.map((point, index) => `<circle class="chart-target" cx="${point.x}" cy="${point.y}" r="9" tabindex="0" role="button" data-index="${index}" aria-label="Sample ${buckets[index].tooltip}: ${plotted[index]} ${$('#cumulative').checked ? 'cumulative ' : ''}${metricName()}"/>`).join('');
    svg.innerHTML = `<defs><linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#50c5d9" stop-opacity=".13"/><stop offset="100%" stop-color="#50c5d9" stop-opacity="0"/></linearGradient></defs>${grid}<path class="chart-area" d="${line} L${right},${bottom} L${left},${bottom} Z"/><path class="chart-line" d="${line}"/>${labels}<line id="chart-cursor" class="chart-cursor" x1="0" x2="0" y1="${top}" y2="${bottom}" visibility="hidden"/><circle id="chart-dot" class="chart-dot" r="5" visibility="hidden"/>${targets}`;
    svg.querySelectorAll('.chart-target').forEach(target => {
      target.addEventListener('focus', () => showTooltip(Number(target.dataset.index)));
      target.addEventListener('blur', hideTooltip);
      target.addEventListener('click', () => showTooltip(Number(target.dataset.index)));
      target.addEventListener('keydown', event => {
        const index = Number(target.dataset.index);
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          const next = Math.max(0, Math.min(points.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
          svg.querySelector(`[data-index="${next}"]`).focus();
        }
        if (event.key === 'Escape') hideTooltip();
      });
    });
    const cumulativeLabel = $('#cumulative').checked ? 'cumulative total' : range.hourly ? 'per hour' : 'per day';
    $('#chart-title').textContent = `${metric === 'visits' ? 'Site visits' : 'Inventory clicks'} over time`;
    $('#chart-description').textContent = `Sample ${metricName()} · ${cumulativeLabel}`;
    $('#chart-accessible-description').textContent = `Design preview with sample data. ${$('#headline-value').textContent} ${metricName()} in the selected period. ${$('#chart-description').textContent}. A complete data table follows the chart.`;
    $('#series-label').textContent = metric === 'visits' ? 'Site visits' : 'Inventory clicks';
    hideTooltip();
  }
  function renderDetails(selected) {
    const sourceCounts = sources.map(source => ({...source, count: selected.filter(event => event.type === 'visits' && event.source === source.id).length})).sort((a, b) => b.count - a.count);
    const total = sourceCounts.reduce((sum, source) => sum + source.count, 0);
    $('#source-rows').innerHTML = sourceCounts.map(source => `<div class="source-row"><div class="source-info"><span>${source.name}<small>${source.detail}</small></span><span class="source-count">${source.count}</span></div><div class="source-bar"><span style="width:${total ? source.count / total * 100 : 0}%"></span></div></div>`).join('');
    const productCounts = products.map(product => ({...product, count: selected.filter(event => event.type === 'clicks' && event.product === product.id).length})).sort((a, b) => b.count - a.count);
    $('#inventory-rows').innerHTML = productCounts.map(product => `<tr><td>${product.title}</td><td>${product.count}</td></tr>`).join('');
    $('#daily-rows').innerHTML = buckets.map(row => `<tr><td>${row.tooltip}</td><td>${row.visits}</td><td>${row.clicks}</td></tr>`).join('');
  }
  function render() {
    const range = period();
    const selected = currentEvents(range);
    buckets = buildBuckets(range, selected);
    const total = selected.filter(event => event.type === metric).length;
    $('#headline-value').textContent = total.toLocaleString('en-CA');
    $('#headline-label').textContent = `Sample ${metricName()}`;
    $('#headline-range').textContent = `${dateLabel(range.start)}${range.start === range.end ? '' : ' – ' + dateLabel(range.end)}, 2026`;
    document.querySelectorAll('[data-metric]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.metric === metric)));
    renderChart(range);
    renderDetails(selected);
    $('#filter-status').textContent = `Sample data: ${total} ${metricName()}, ${$('#headline-range').textContent}, ${$('#source-filter').selectedOptions[0].textContent}.`;
  }
  document.querySelectorAll('[data-metric]').forEach(button => button.addEventListener('click', () => {metric = button.dataset.metric; render();}));
  ['#period-filter', '#source-filter', '#cumulative'].forEach(selector => $(selector).addEventListener('change', render));
  $('#show-data').addEventListener('click', () => {
    const open = $('#chart-data').hidden;
    $('#chart-data').hidden = !open;
    $('#show-data').setAttribute('aria-expanded', String(open));
    $('#show-data').textContent = open ? 'Hide data table' : 'View data table';
  });
  $('#traffic-chart').addEventListener('pointermove', event => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * chartWidth;
    const index = Math.max(0, Math.min(points.length - 1, Math.round((x - 12) / (plotRight - 12) * (points.length - 1))));
    if (index !== activeIndex) showTooltip(index);
  });
  $('#traffic-chart').addEventListener('pointerleave', hideTooltip);
  let resizePending = false;
  window.addEventListener('resize', () => {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => {resizePending = false; renderChart(period());});
  });
  render();
})();
