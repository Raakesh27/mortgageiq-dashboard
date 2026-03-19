// ─────────────────────────────────────────────
//  data/rates.js  — Rate data layer
//  In production: replace fetchFredRates() and fetchLenderRates()
//  with real API calls. FRED API is free, no key needed for basic queries.
//  Homebuyer.com API: https://homebuyer.com/api/rates (key required)
// ─────────────────────────────────────────────

// FRED API — real endpoint, publicly accessible, no key required
// https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&api_key=YOUR_KEY&file_type=json
// Series: MORTGAGE30US (30yr), MORTGAGE15US (15yr)

export async function fetchFredRates() {
  // NOTE: In production uncomment below and add your free FRED API key
  // const API_KEY = 'YOUR_FRED_API_KEY'; // get free at fred.stlouisfed.org
  // const res = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&api_key=${API_KEY}&sort_order=desc&limit=52&file_type=json`);
  // const data = await res.json();
  // return data.observations.reverse().map(o => ({ date: o.date, rate: parseFloat(o.value) }));

  // Simulated realistic data (52 weeks, based on actual 2024-2025 trend)
  const base = new Date('2024-03-15');
  const rates30yr = [
    6.87,6.94,7.02,7.17,7.09,6.99,6.87,6.76,6.82,6.94,
    7.03,7.08,6.95,6.88,6.78,6.71,6.69,6.74,6.81,6.89,
    6.92,6.84,6.77,6.65,6.53,6.47,6.42,6.54,6.61,6.58,
    6.52,6.49,6.55,6.63,6.71,6.79,6.82,6.74,6.68,6.61,
    6.57,6.53,6.49,6.58,6.66,6.72,6.80,6.85,6.91,6.88,
    6.82,6.78
  ];
  return rates30yr.map((rate, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    return { date: d.toISOString().slice(0, 10), rate };
  });
}

export async function fetch15YrRates() {
  const base = new Date('2024-03-15');
  const rates15yr = [
    6.21,6.28,6.35,6.49,6.41,6.31,6.21,6.12,6.17,6.28,
    6.36,6.40,6.28,6.21,6.12,6.06,6.04,6.08,6.14,6.21,
    6.24,6.17,6.11,6.00,5.89,5.84,5.79,5.89,5.96,5.93,
    5.88,5.85,5.90,5.97,6.04,6.11,6.14,6.07,6.02,5.96,
    5.92,5.89,5.85,5.93,6.00,6.05,6.12,6.17,6.22,6.19,
    6.14,6.10
  ];
  return rates15yr.map((rate, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    return { date: d.toISOString().slice(0, 10), rate };
  });
}

// ─── Lender rate engine ───────────────────────────────────────────
// In production: hit Homebuyer.com API or Zillow Mortgage API
// POST https://homebuyer.com/api/v1/rates with {state, creditScore, ltv, loanAmount, loanType}

export function computeLenderRates(inputs) {
  const { loanAmount, downPayment, creditScore, loanType, zipCode } = inputs;
  const ltv = Math.round((1 - downPayment / (loanAmount + downPayment)) * 100);
  const baseRate = getBaseRate(loanType);
  const creditAdj = getCreditAdj(creditScore);
  const ltvAdj = getLtvAdj(ltv);

  const lenders = [
    { name: 'Better Mortgage',     tier: 'Online',      spread: -0.14, points: 0.0, closingFee: 995   },
    { name: 'Rocket Mortgage',     tier: 'National',    spread: -0.04, points: 0.5, closingFee: 1200  },
    { name: 'Chase Bank',          tier: 'National',    spread: +0.06, points: 0.0, closingFee: 1450  },
    { name: 'LoanDepot',           tier: 'Online',      spread: +0.02, points: 0.0, closingFee: 1100  },
    { name: 'Wells Fargo',         tier: 'National',    spread: +0.11, points: 0.0, closingFee: 1600  },
    { name: 'PenFed Credit Union', tier: 'Credit Union',spread: -0.18, points: 1.0, closingFee: 800   },
    { name: 'Ally Bank',           tier: 'Online',      spread: -0.08, points: 0.0, closingFee: 1050  },
    { name: 'US Bank',             tier: 'National',    spread: +0.08, points: 0.0, closingFee: 1350  },
  ].map(l => {
    const rate = parseFloat((baseRate + creditAdj + ltvAdj + l.spread + (Math.random() * 0.04 - 0.02)).toFixed(3));
    const apr = parseFloat((rate + 0.05 + l.points * 0.08 + (l.closingFee / loanAmount * 100)).toFixed(3));
    const monthly = calcMonthly(loanAmount, rate, loanType === '15yr' ? 15 : loanType === 'arm5' ? 30 : 30);
    const totalCost = monthly * (loanType === '15yr' ? 180 : 360);
    return { ...l, rate, apr, monthly: Math.round(monthly), totalCost: Math.round(totalCost), ltv, points: l.points };
  });

  return lenders.sort((a, b) => a.apr - b.apr);
}

function getBaseRate(loanType) {
  const rates = { '30yr': 6.78, '15yr': 6.10, 'arm5': 6.30, 'fha': 6.45, 'va': 6.20, 'jumbo': 7.05 };
  return rates[loanType] || 6.78;
}
function getCreditAdj(score) {
  if (score >= 780) return -0.30;
  if (score >= 740) return -0.15;
  if (score >= 720) return -0.05;
  if (score >= 700) return +0.10;
  if (score >= 680) return +0.25;
  if (score >= 660) return +0.45;
  return +0.75;
}
function getLtvAdj(ltv) {
  if (ltv <= 60) return -0.10;
  if (ltv <= 75) return -0.05;
  if (ltv <= 80) return 0;
  if (ltv <= 90) return +0.15;
  return +0.25;
}
function calcMonthly(principal, annualRate, years) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// ─── Scenario comparisons ─────────────────────────────────────────
export function computeScenarios(loanAmount, bestRate) {
  const scenarios = [
    { label: '30yr fixed',  rate: bestRate,        years: 30 },
    { label: '15yr fixed',  rate: bestRate - 0.62, years: 15 },
    { label: '5/1 ARM',     rate: bestRate - 0.46, years: 30 },
    { label: 'Pay 1 point', rate: bestRate - 0.25, years: 30, costExtra: loanAmount * 0.01 },
  ];
  const baseline = calcMonthly(loanAmount, scenarios[0].rate, 30);
  return scenarios.map(s => {
    const monthly = Math.round(calcMonthly(loanAmount, s.rate, s.years));
    const total = Math.round(monthly * s.years * 12 + (s.costExtra || 0));
    return { ...s, monthly, total, diffMonthly: monthly - Math.round(baseline) };
  });
}

// ─── AI advisor responses ─────────────────────────────────────────
// In production: call Claude or GPT-4 API with context about current rates + user inputs
// The context would be: current lender rates, user's FICO, LTV, loan type, and question

export async function askAIAdvisor(question, context) {
  // In production, this calls the Claude API:
  // const response = await fetch("https://api.anthropic.com/v1/messages", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({
  //     model: "claude-sonnet-4-20250514",
  //     max_tokens: 400,
  //     messages: [{
  //       role: "user",
  //       content: `You are a helpful mortgage advisor. Context: ${JSON.stringify(context)}. User question: ${question}. Give a concise, practical answer in 2-3 sentences.`
  //     }]
  //   })
  // });
  // const data = await response.json();
  // return data.content[0].text;

  await new Promise(r => setTimeout(r, 800 + Math.random() * 600));

  const q = question.toLowerCase();
  const { loanAmount, creditScore, bestRate, loanType } = context;
  const fmtRate = bestRate?.toFixed(2);
  const fmtLoan = loanAmount ? `$${(loanAmount/1000).toFixed(0)}k` : 'your loan';

  if (q.includes('point') || q.includes('buy down')) {
    return `Buying 1 discount point (~$${Math.round(loanAmount * 0.01).toLocaleString()}) would lower your rate by ~0.25%, saving you roughly $${Math.round(loanAmount * 0.0002 * 12).toLocaleString()}/month. At that savings rate, your break-even is around 4-5 years — worth it if you plan to stay that long.`;
  }
  if (q.includes('credit') || q.includes('fico') || q.includes('score')) {
    if (creditScore && creditScore < 740) {
      return `With a ${creditScore} score, you're paying roughly a ${getCreditAdj(creditScore) * -100 + 30}bps premium vs. 740+ borrowers. Getting to 740 could save you ~0.15-0.25% — on ${fmtLoan} that's $${Math.round(loanAmount * 0.002 / 12).toLocaleString()}/month. Even 60-90 days of credit repair could make a meaningful difference.`;
    }
    return `Your credit score looks strong! Scores above 740 typically get the best rate tiers. Keep utilization below 30% and avoid any new credit applications during the mortgage process.`;
  }
  if (q.includes('arm') || q.includes('adjustable')) {
    return `A 5/1 ARM offers a lower initial rate (~${(parseFloat(fmtRate) - 0.46).toFixed(2)}%) that's fixed for 5 years, then adjusts annually. It makes sense if you plan to move or refinance within 5 years. With current rates, the initial savings vs. a 30yr fixed is about $${Math.round(loanAmount * 0.0004 * 12).toLocaleString()}/month.`;
  }
  if (q.includes('15') || q.includes('fifteen')) {
    const diff = Math.round(calcMonthly(loanAmount, parseFloat(fmtRate) - 0.62, 15) - calcMonthly(loanAmount, parseFloat(fmtRate), 30));
    return `A 15yr mortgage at ~${(parseFloat(fmtRate) - 0.62).toFixed(2)}% builds equity much faster and saves you enormous interest over the life of the loan — but your monthly payment would be roughly $${diff.toLocaleString()} higher. A good rule: only go 15yr if the higher payment is comfortably under 28% of your gross monthly income.`;
  }
  if (q.includes('down') || q.includes('20%') || q.includes('pmi')) {
    return `If your down payment is below 20%, you'll pay PMI (typically 0.5-1.5% of the loan/year). On a $${(loanAmount/1000).toFixed(0)}k loan, that's $${Math.round(loanAmount * 0.01 / 12).toLocaleString()}-$${Math.round(loanAmount * 0.015 / 12).toLocaleString()}/month extra until you hit 20% equity. Putting 20% down eliminates this entirely.`;
  }
  if (q.includes('lock') || q.includes('float')) {
    return `Rate locks typically run 30-60 days at no cost, with 90-day locks adding ~0.125-0.25%. Given rates have been ${fmtRate && parseFloat(fmtRate) > 6.5 ? 'elevated' : 'moderating'}, locking in once you're under contract is generally the safer move for most buyers.`;
  }
  if (q.includes('fha') || q.includes('conventional')) {
    return `FHA loans require only 3.5% down and are more lenient on credit, but they carry mandatory MIP for the life of the loan unless you put 10%+ down. Conventional is usually better if your credit score is above 680 and you can hit 5%+ down — you can eventually cancel PMI once you hit 20% equity.`;
  }
  return `With a best rate of ${fmtRate}% on ${fmtLoan}, your estimated monthly payment is $${Math.round(calcMonthly(loanAmount, parseFloat(fmtRate), 30)).toLocaleString()}. To get a lower rate, consider: (1) improving your credit score, (2) increasing your down payment to reduce LTV, or (3) buying points if you plan to stay 5+ years.`;
}

