// main.js — MortgageIQ Dashboard
import { fetchFredRates, fetch15YrRates, computeLenderRates, computeScenarios, askAIAdvisor } from './data/rates.js';
import { RateChart } from './components/RateChart.js';

// ─── State ───────────────────────────────────────────────────────
let state = {
  inputs: { loanAmount: 500000, downPayment: 100000, creditScore: 740, loanType: '30yr', zipCode: '98004' },
  lenders: [],
  rateHistory30: [],
  rateHistory15: [],
  aiMessages: [],
  chart: null,
  loading: false,
  hasResults: false,
};

// ─── Render app shell ─────────────────────────────────────────────
function renderShell() {
  document.getElementById('app').innerHTML = `
    <header>
      <div class="logo">Mortgage<span>IQ</span></div>
      <div class="header-meta">
        <div class="live-dot"></div>
        <span>FRED data · Updated weekly</span>
        <span style="color:var(--border2)">|</span>
        <span id="current-rate-badge">Loading rates...</span>
      </div>
    </header>

    <main>
      <aside class="sidebar">
        <!-- Input form -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Your scenario</span>
            <span class="card-badge">PERSONALIZE</span>
          </div>
          <div class="card-body">
            <div class="field">
              <label>Home price</label>
              <div class="input-prefix">
                <span class="pfx">$</span>
                <input type="number" id="inp-price" value="600000" min="50000" max="5000000" step="5000" />
              </div>
            </div>
            <div class="field">
              <label>Down payment %</label>
              <div class="input-prefix">
                <span class="pfx">%</span>
                <input type="number" id="inp-down" value="20" min="0" max="100" step="1" />
              </div>
              <div style="font-size:0.72rem;color:var(--text3);font-family:var(--mono)" id="down-amount-display">$120,000 down</div>
              <div style="font-size:0.72rem;color:var(--text3);font-family:var(--mono)" id="ltv-display">LTV: 80% · No PMI</div>
            </div>
            <div class="field">
              <label>Credit score
                <span class="tooltip-wrap" style="margin-left:4px">
                  <span class="tooltip-icon">?</span>
                  <span class="tooltip">Scores 740+ get the best rates. Each tier change affects rate by 0.10-0.30%.</span>
                </span>
              </label>
              <div class="range-wrap">
                <input type="range" id="inp-credit" min="580" max="850" step="20" value="740" />
                <div class="range-labels">
                  <span>580</span>
                  <span id="credit-display" style="color:var(--accent);font-weight:500">740</span>
                  <span>850</span>
                </div>
              </div>
            </div>
            <div class="field">
              <label>Loan type</label>
              <select id="inp-type">
                <option value="30yr">30yr Fixed</option>
                <option value="15yr">15yr Fixed</option>
                <option value="arm5">5/1 ARM</option>
                <option value="fha">FHA Loan</option>
                <option value="va">VA Loan</option>
                <option value="jumbo">Jumbo</option>
              </select>
            </div>
            <div class="field">
              <label>ZIP code</label>
              <input type="text" id="inp-zip" value="98004" maxlength="5" placeholder="ZIP code" />
            </div>
            <div style="margin-top:0.5rem">
              <button class="btn-primary" id="btn-analyze">Compare rates &rarr;</button>
            </div>
          </div>
        </div>

        <!-- AI quick questions -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Quick questions</span>
            <span class="card-badge">AI</span>
          </div>
          <div style="padding:0.75rem 1rem;display:flex;flex-direction:column;gap:6px" id="quick-q-list">
            ${['Should I buy points?','Is a 15yr worth it?','What about an ARM?','How does PMI work?','When should I lock?'].map(q =>
              `<button class="apply-btn" style="text-align:left;width:100%" onclick="quickAsk('${q}')">${q} ↗</button>`
            ).join('')}
          </div>
        </div>
      </aside>

      <div class="results-panel" id="results-panel">
        <!-- Hero stats -->
        <div class="hero-stat-row" id="hero-stats">
          <div class="stat-card skeleton" style="height:100px"></div>
          <div class="stat-card skeleton" style="height:100px"></div>
          <div class="stat-card skeleton" style="height:100px"></div>
        </div>

        <!-- Lender comparison table -->
        <div class="card" id="lender-card">
          <div class="card-header">
            <span class="card-title">Lender comparison</span>
            <span class="card-badge" id="lender-count">—</span>
          </div>
          <div id="lender-table">
            <div class="empty-state">
              <div class="empty-icon">&#9698;</div>
              <div class="empty-title">Set your scenario</div>
              <div class="empty-sub">Enter your details and click "Compare rates" to see personalized lender quotes.</div>
            </div>
          </div>
        </div>

        <!-- Rate history chart -->
        <div class="card">
          <div class="chart-wrap">
            <div class="chart-title-row">
              <span class="chart-title">National rate history</span>
              <div class="chart-tabs">
                <button class="chart-tab" data-period="3mo">3mo</button>
                <button class="chart-tab" data-period="6mo">6mo</button>
                <button class="chart-tab active" data-period="1yr">1yr</button>
              </div>
            </div>
            <div style="height:200px;position:relative">
              <canvas id="rate-chart"></canvas>
            </div>
          </div>
        </div>

        <!-- Scenario comparisons -->
        <div class="card" id="scenario-card">
          <div class="card-header">
            <span class="card-title">Loan scenarios</span>
            <span class="card-badge">COMPARE</span>
          </div>
          <div class="scenario-grid" id="scenario-grid">
            ${[1,2,3,4].map(() => `<div class="scenario-card skeleton" style="height:100px"></div>`).join('')}
          </div>
        </div>

        <!-- AI Advisor -->
        <div class="ai-panel" id="ai-panel">
          <div class="card-header">
            <span class="card-title">AI mortgage advisor</span>
            <span class="card-badge">CLAUDE-POWERED</span>
          </div>
          <div class="ai-messages" id="ai-messages">
            <div class="msg ai">
              <span class="msg-label">Advisor</span>
              <div class="msg-bubble">Hi! I can answer questions about your mortgage options, rates, and strategy. Try asking about points, PMI, ARM vs fixed, or whether a 15yr makes sense for your budget.</div>
            </div>
          </div>
          <div class="ai-input-row">
            <input class="ai-input" id="ai-input" placeholder="Ask about your mortgage..." />
            <button class="send-btn" id="send-btn">&#8593;</button>
          </div>
        </div>
      </div>
    </main>
  `;
}

// ─── Update hero stats ────────────────────────────────────────────
function renderHeroStats(lenders, inputs) {
  const best = lenders[0];
  const worst = lenders[lenders.length - 1];
  const spread = (worst.rate - best.rate).toFixed(2);
  const ltv = Math.round((1 - inputs.downPayment / (inputs.loanAmount + inputs.downPayment)) * 100);
  const pmi = ltv > 80 ? Math.round(inputs.loanAmount * 0.01 / 12) : 0;

  document.getElementById('hero-stats').innerHTML = `
    <div class="stat-card best">
      <span class="stat-label">Best rate today</span>
      <span class="stat-value green">${best.rate.toFixed(2)}%</span>
      <span class="stat-sub">${best.name} &middot; APR ${best.apr.toFixed(2)}%</span>
      <span class="stat-delta down">Best offer</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Monthly payment</span>
      <span class="stat-value">$${best.monthly.toLocaleString()}</span>
      <span class="stat-sub">Principal + interest${pmi ? ` + $${pmi} PMI` : ''}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Rate spread</span>
      <span class="stat-value amber">${spread}%</span>
      <span class="stat-sub">Across ${lenders.length} lenders · shop around!</span>
    </div>
  `;

  const badge = document.getElementById('current-rate-badge');
  if (badge) badge.textContent = `30yr avg ${state.rateHistory30[state.rateHistory30.length - 1]?.rate?.toFixed(2)}%`;
}

// ─── Render lender table ──────────────────────────────────────────
function renderLenderTable(lenders) {
  const tableEl = document.getElementById('lender-table');
  const countEl = document.getElementById('lender-count');
  if (countEl) countEl.textContent = `${lenders.length} LENDERS`;

  tableEl.innerHTML = `
    <div class="lender-row header">
      <span class="col-hd">Lender</span>
      <span class="col-hd">Rate</span>
      <span class="col-hd">APR</span>
      <span class="col-hd">Monthly</span>
      <span class="col-hd">Points</span>
      <span class="col-hd"></span>
    </div>
    ${lenders.map((l, i) => `
      <div class="lender-row ${i === 0 ? 'top-pick' : ''}">
        <span class="lender-name">
          ${l.name}
          ${i === 0 ? '<span class="badge badge-best">Best APR</span>' : ''}
          ${l.tier === 'Credit Union' ? '<span class="badge badge-low">Low fees</span>' : ''}
        </span>
        <span class="rate-cell ${i === 0 ? 'green' : ''}">${l.rate.toFixed(3)}%</span>
        <span class="cell-mono">${l.apr.toFixed(3)}%</span>
        <span class="cell-sub">$${l.monthly.toLocaleString()}</span>
        <span class="cell-mono">${l.points > 0 ? l.points.toFixed(1) : '—'}</span>
        <button class="apply-btn" onclick="handleApply('${l.name}', ${l.rate})">Apply ↗</button>
      </div>
    `).join('')}
  `;
}

// ─── Render scenarios ─────────────────────────────────────────────
function renderScenarios(scenarios) {
  document.getElementById('scenario-grid').innerHTML = scenarios.map((s, i) => `
    <div class="scenario-card ${i === 0 ? 'active' : ''}" onclick="selectScenario(this)">
      <div class="sc-label">${s.label}</div>
      <div class="sc-rate">${s.rate.toFixed(2)}%</div>
      <div class="sc-monthly">$${s.monthly.toLocaleString()}/mo &middot; ${s.years}yr</div>
      <div class="sc-diff ${s.diffMonthly > 0 ? 'cost' : s.diffMonthly < 0 ? 'save' : ''}">
        ${s.diffMonthly === 0 ? 'baseline' : s.diffMonthly > 0 ? `+$${s.diffMonthly}/mo more` : `$${Math.abs(s.diffMonthly)}/mo less`}
      </div>
    </div>
  `).join('');
}

// ─── Analyze handler ──────────────────────────────────────────────
async function analyze() {
  const price = parseInt(document.getElementById('inp-price').value) || 600000;
  const downPercent = parseInt(document.getElementById('inp-down').value) || 20;
  const downAmount = Math.round(price * downPercent / 100);
  const credit = parseInt(document.getElementById('inp-credit').value) || 740;
  const loanType = document.getElementById('inp-type').value;
  const zip = document.getElementById('inp-zip').value;
  const loanAmount = price - downAmount;

  state.inputs = { loanAmount, downPayment: downAmount, creditScore: credit, loanType, zipCode: zip };

  const btn = document.getElementById('btn-analyze');
  btn.textContent = 'Analyzing...';
  btn.classList.add('loading');

  // Simulate slight async delay (real: API fetch)
  await new Promise(r => setTimeout(r, 600));

  const lenders = computeLenderRates(state.inputs);
  const scenarios = computeScenarios(loanAmount, lenders[0].rate);

  state.lenders = lenders;
  state.hasResults = true;

  renderHeroStats(lenders, state.inputs);
  renderLenderTable(lenders);
  renderScenarios(scenarios);

  btn.textContent = 'Compare rates →';
  btn.classList.remove('loading');

  // Scroll to results on mobile
  if (window.innerWidth <= 960) {
    document.getElementById('hero-stats').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ─── AI chat ──────────────────────────────────────────────────────
async function sendAIMessage(question) {
  const messagesEl = document.getElementById('ai-messages');

  // Add user message
  messagesEl.insertAdjacentHTML('beforeend', `
    <div class="msg user">
      <span class="msg-label">You</span>
      <div class="msg-bubble">${question}</div>
    </div>
  `);

  // Typing indicator
  const typingId = 'typing-' + Date.now();
  messagesEl.insertAdjacentHTML('beforeend', `
    <div class="msg ai" id="${typingId}">
      <span class="msg-label">Advisor</span>
      <div class="msg-bubble">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const context = {
    loanAmount: state.inputs.loanAmount,
    creditScore: state.inputs.creditScore,
    loanType: state.inputs.loanType,
    bestRate: state.lenders[0]?.rate || 6.78,
  };

  const answer = await askAIAdvisor(question, context);

  // Replace typing with answer
  document.getElementById(typingId)?.remove();
  messagesEl.insertAdjacentHTML('beforeend', `
    <div class="msg ai">
      <span class="msg-label">Advisor</span>
      <div class="msg-bubble">${answer}</div>
    </div>
  `);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ─── LTV & Down Payment live update ──────────────────────────
function updateLtvDisplay() {
  const price = parseInt(document.getElementById('inp-price')?.value) || 0;
  const downPercent = parseInt(document.getElementById('inp-down')?.value) || 20;
  const downAmount = Math.round(price * downPercent / 100);
  const loan = price - downAmount;
  const ltv = price > 0 ? Math.round((loan / price) * 100) : 0;
  
  const downDisplay = document.getElementById('down-amount-display');
  if (downDisplay) {
    downDisplay.textContent = `$${downAmount.toLocaleString()} down`;
  }
  
  const el = document.getElementById('ltv-display');
  if (el) {
    const pmi = ltv > 80;
    el.innerHTML = `LTV: <span style="color:${pmi ? 'var(--amber)' : 'var(--green)'}">${ltv}%</span> · ${pmi ? 'PMI required' : 'No PMI'}`;
  }
}

// ─── Event wiring ─────────────────────────────────────────────────
function wireEvents() {
  document.getElementById('btn-analyze').addEventListener('click', analyze);

  document.getElementById('inp-credit').addEventListener('input', e => {
    document.getElementById('credit-display').textContent = e.target.value;
  });

  document.getElementById('inp-price').addEventListener('input', updateLtvDisplay);
  document.getElementById('inp-down').addEventListener('input', updateLtvDisplay);

  document.getElementById('send-btn').addEventListener('click', () => {
    const inp = document.getElementById('ai-input');
    if (inp.value.trim()) { sendAIMessage(inp.value.trim()); inp.value = ''; }
  });
  document.getElementById('ai-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { document.getElementById('send-btn').click(); }
  });

  document.querySelectorAll('.chart-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.chart?.updatePeriod(btn.dataset.period);
    });
  });
}

// ─── Global handlers (called from inline HTML) ───────────────────
window.quickAsk = (q) => {
  const inp = document.getElementById('ai-input');
  if (inp) { inp.value = q; document.getElementById('send-btn').click(); }
  document.getElementById('ai-panel').scrollIntoView({ behavior: 'smooth' });
};

window.handleApply = (lender, rate) => {
  sendAIMessage(`I'm considering applying with ${lender} at ${rate.toFixed(3)}%. What should I know before applying?`);
  document.getElementById('ai-panel').scrollIntoView({ behavior: 'smooth' });
};

window.selectScenario = (el) => {
  document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
};

// ─── Init ─────────────────────────────────────────────────────────
async function init() {
  renderShell();
  wireEvents();
  updateLtvDisplay();

  // Load rate history in background
  const [hist30, hist15] = await Promise.all([fetchFredRates(), fetch15YrRates()]);
  state.rateHistory30 = hist30;
  state.rateHistory15 = hist15;

  // Init chart
  const canvas = document.getElementById('rate-chart');
  if (canvas) state.chart = new RateChart(canvas, hist30, hist15);

  // Update header badge
  const badge = document.getElementById('current-rate-badge');
  if (badge) badge.textContent = `30yr avg ${hist30[hist30.length - 1]?.rate?.toFixed(2)}%`;

  // Auto-run initial analysis
  await analyze();
}

init();
