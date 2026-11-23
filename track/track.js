/* Authenticated aggregate reporting. No sample figures or visitor identifiers. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const API = 'https://tpf-api.onrender.com/analytics';
  const TOKEN_KEY = 'tpf_track_token';
  const EXCLUDE = 'tpf_analytics_exclude';
  let token = '';
  try { token = sessionStorage.getItem(TOKEN_KEY) || ''; } catch { /* In-memory sign-in still works. */ }
  let metric = 'visits';
  let data = null;
  let buckets = [], plotted = [], points = [];
  let activeIndex = null, chartWidth = 1100, plotRight = 1040;
  let requestSequence = 0;
  const dateLabel = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-CA', {month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
  const shortDate = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-CA', {month:'short',day:'numeric',timeZone:'UTC'});
  const metricName = () => metric === 'visits' ? 'page views' : 'inventory clicks';
  const period = () => ({hourly: data?.hourly === true});
  function textCell(value) { const cell = document.createElement('td'); cell.textContent = String(value); return cell; }
  function error(message) { $('#report-error').textContent = message; $('#report-error').hidden = !message; }
  function clearReport() {
    data = null; buckets = []; points = []; plotted = [];
    $('#headline-value').textContent = '—';
    ['#traffic-chart','#source-rows','#inventory-rows','#daily-rows'].forEach(id => $(id).replaceChildren());
    $('#chart-tooltip').hidden = true;
  }
  function signedOut(message = '') {
    ++requestSequence;
    token = '';
    try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
    clearReport();
    $('#main').hidden = true; $('#login-panel').hidden = false; $('#sign-out').hidden = true;
    $('#login-feedback').textContent = message;
    $('#tracking-status').textContent = 'Sign in to view the private report.';
  }
  function exclusionState() {
    let excluded = false;
    try { excluded = localStorage.getItem(EXCLUDE) === '1'; } catch {}
    $('#exclusion-status').textContent = excluded ? 'This browser is excluded from counting.' : 'This browser is included in counting.';
    $('#toggle-exclusion').textContent = excluded ? 'Include this browser' : 'Exclude this browser';
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
    const targets = points.map((point, index) => `<circle class="chart-target" cx="${point.x}" cy="${point.y}" r="9" tabindex="0" role="button" data-index="${index}" aria-label="${buckets[index].tooltip}: ${plotted[index]} ${$('#cumulative').checked ? 'cumulative ' : ''}${metricName()}"/>`).join('');
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
    $('#chart-title').textContent = `${metric === 'visits' ? 'Page views' : 'Inventory clicks'} over time`;
    $('#chart-description').textContent = `${metricName()} · ${cumulativeLabel}`;
    $('#chart-accessible-description').textContent = `${$('#headline-value').textContent} ${metricName()} in the selected period. ${$('#chart-description').textContent}. A complete data table is available below the chart.`;
    $('#series-label').textContent = metric === 'visits' ? 'Page views' : 'Inventory clicks';
    hideTooltip();
  }
  function renderDetails() {
    $('#source-rows').replaceChildren();
    const sourceTotal = data.sources.reduce((sum, source) => sum + source.count, 0);
    if (!data.sources.length) { const p = document.createElement('p'); p.className = 'panel-description'; p.textContent = 'No page views recorded for this selection.'; $('#source-rows').append(p); }
    for (const source of data.sources) {
      const row = document.createElement('div'); row.className = 'source-row';
      const info = document.createElement('div'); info.className = 'source-info';
      const name = document.createElement('span'); name.textContent = source.name;
      const count = document.createElement('span'); count.className = 'source-count'; count.textContent = source.count.toLocaleString('en-CA');
      info.append(name, count);
      const bar = document.createElement('div'); bar.className = 'source-bar';
      const fill = document.createElement('span'); fill.style.width = `${sourceTotal ? source.count / sourceTotal * 100 : 0}%`; bar.append(fill); row.append(info,bar); $('#source-rows').append(row);
    }
    $('#inventory-rows').replaceChildren();
    for (const product of data.products) {
      const row = document.createElement('tr'); row.append(textCell(product.title),textCell(product.views),textCell(product.count)); $('#inventory-rows').append(row);
    }
    if (!data.products.length) { const row = document.createElement('tr'); const cell = textCell('No product activity recorded for this selection.'); cell.colSpan = 3; row.append(cell); $('#inventory-rows').append(row); }
    $('#daily-rows').replaceChildren();
    for (const bucket of buckets) { const row = document.createElement('tr'); row.append(textCell(bucket.tooltip),textCell(bucket.visits),textCell(bucket.clicks)); $('#daily-rows').append(row); }
  }
  function render() {
    if (!data) return;
    buckets = data.buckets.map(row => ({...row,label:data.hourly ? row.key : shortDate(row.key),tooltip:data.hourly ? `${shortDate(data.end)}, ${row.key}` : dateLabel(row.key)}));
    const total = buckets.reduce((sum,row) => sum + row[metric],0);
    $('#headline-value').textContent = total.toLocaleString('en-CA');
    $('#headline-label').textContent = metricName();
    $('#headline-range').textContent = `${dateLabel(data.start)}${data.start === data.end ? '' : ' – ' + dateLabel(data.end)}`;
    document.querySelectorAll('[data-metric]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.metric === metric)));
    renderChart(period()); renderDetails();
    const started = new Date(data.startedAt).toLocaleString('en-CA',{timeZone:'America/Moncton',dateStyle:'medium',timeStyle:'short'});
    $('#tracking-started').textContent = `Counting began ${started}, Atlantic time. Earlier activity is unavailable.`;
    $('#tracking-status').textContent = 'Anonymous aggregate counting is active.';
    $('#filter-status').textContent = `${total} ${metricName()}, ${$('#headline-range').textContent}, ${$('#source-filter').selectedOptions[0].textContent}.`;
  }
  async function loadReport() {
    if (!token) return;
    const sequence = ++requestSequence;
    error(''); $('#refresh-report').disabled = true; $('#refresh-report').textContent = 'Loading…';
    $('#main').hidden = false; $('#login-panel').hidden = true; $('#sign-out').hidden = false;
    try {
      const query = new URLSearchParams({period:$('#period-filter').value,source:$('#source-filter').value});
      const response = await fetch(`${API}/report?${query}`,{headers:{Authorization:`Bearer ${token}`},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(90000)});
      if (sequence !== requestSequence) return;
      const body = await response.json();
      if (response.status === 401) {signedOut('Your sign-in has expired. Please enter your access code again.');return;}
      if (!response.ok) throw new Error(body.error || 'Reporting is temporarily unavailable.');
      data = body; render(); exclusionState();
    } catch (problem) {if (sequence === requestSequence) error((problem.message || 'Unable to load the report. Please try again.') + (data ? ' Showing the last loaded report.' : ''));}
    finally {if (sequence === requestSequence) {$('#refresh-report').disabled=false;$('#refresh-report').textContent='Refresh';}}
  }
  $('#login-form').addEventListener('submit',async event => {
    event.preventDefault(); const button = $('#login-submit'); button.disabled=true; $('#login-feedback').textContent='Signing in…';
    const code = $('#access-code').value; $('#access-code').value='';
    try {
      const response = await fetch(`${API}/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(90000)});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to sign in.');
      token=body.token;
      try {sessionStorage.setItem(TOKEN_KEY,token);localStorage.setItem(EXCLUDE,'1');} catch {}
      $('#login-feedback').textContent=''; await loadReport();
    } catch(problem) {$('#login-feedback').textContent=problem.message || 'Unable to sign in. Please try again.';}
    finally {button.disabled=false;}
  });
  $('#sign-out').addEventListener('click',()=>signedOut('Signed out.'));
  $('#refresh-report').addEventListener('click',loadReport);
  $('#toggle-exclusion').addEventListener('click',()=>{
    try {if(localStorage.getItem(EXCLUDE)==='1')localStorage.removeItem(EXCLUDE);else localStorage.setItem(EXCLUDE,'1');exclusionState();}
    catch {error('Browser storage must be available to remember this preference.');}
  });
  document.querySelectorAll('[data-metric]').forEach(button=>button.addEventListener('click',()=>{metric=button.dataset.metric;render();}));
  ['#period-filter','#source-filter'].forEach(id=>$(id).addEventListener('change',loadReport));
  $('#cumulative').addEventListener('change',()=>{if(data)renderChart(period());});
  $('#show-data').addEventListener('click',()=>{const open=$('#chart-data').hidden;$('#chart-data').hidden=!open;$('#show-data').setAttribute('aria-expanded',String(open));$('#show-data').textContent=open?'Hide data table':'View data table';});
  $('#traffic-chart').addEventListener('pointermove',event=>{
    if(!points.length)return;const bounds=event.currentTarget.getBoundingClientRect();const x=(event.clientX-bounds.left)/bounds.width*chartWidth;
    const index=Math.max(0,Math.min(points.length-1,Math.round((x-12)/(plotRight-12)*(points.length-1))));if(index!==activeIndex)showTooltip(index);
  });
  $('#traffic-chart').addEventListener('pointerleave',hideTooltip);
  let resizePending=false;window.addEventListener('resize',()=>{if(resizePending||!data)return;resizePending=true;requestAnimationFrame(()=>{resizePending=false;renderChart(period());});});
  if(token)loadReport();
})();
