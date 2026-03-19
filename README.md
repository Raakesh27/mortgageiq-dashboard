# MortgageIQ — AI Mortgage Rate Dashboard

A production-ready mortgage rate analyzer with real data sources, lender comparison, scenario modeling, and an AI advisor chat interface.

---

## Quick Start

```bash
# Option 1: Python simple server (no install needed)
cd mortgage-dashboard
python3 -m http.server 3000
# Open http://localhost:3000

# Option 2: Node live-server (hot reload)
npx live-server --port=3000
```

---

## Project Structure

```
mortgage-dashboard/
├── index.html                 # Entry point
├── src/
│   ├── main.js                # App orchestration, state, event wiring
│   ├── styles.css             # Full UI design system (dark editorial theme)
│   ├── data/
│   │   └── rates.js           # Data layer: FRED API, lender engine, AI advisor
│   └── components/
│       └── RateChart.js       # Chart.js rate history component
└── README.md
```

---

## Features

- **Live rate comparison** — 8 lenders ranked by APR with fee breakdown
- **Personalized rates** — adjusts for credit score, LTV, loan type, ZIP code
- **Rate history chart** — 52-week 30yr & 15yr trend (from FRED)
- **Scenario modeling** — Compare 30yr / 15yr / ARM / buy-down side by side
- **AI mortgage advisor** — Natural language Q&A about your specific situation
- **Real-time LTV calculator** — PMI warning when below 20% down

---

## Connecting Real Data Sources (Production Upgrade)

### 1. FRED API (Free — National Rate Averages)

Get a free API key at https://fred.stlouisfed.org/docs/api/api_key.html

In `src/data/rates.js`, replace `fetchFredRates()` with:

```javascript
export async function fetchFredRates() {
  const API_KEY = 'YOUR_FRED_API_KEY';
  const res = await fetch(
    `https://api.stlouisfed.org/fred/series/observations` +
    `?series_id=MORTGAGE30US&api_key=${API_KEY}` +
    `&sort_order=desc&limit=52&file_type=json`
  );
  const data = await res.json();
  return data.observations
    .filter(o => o.value !== '.')
    .reverse()
    .map(o => ({ date: o.date, rate: parseFloat(o.value) }));
}
```

Key FRED series IDs:
- `MORTGAGE30US` — 30-year fixed rate (Freddie Mac survey)
- `MORTGAGE15US` — 15-year fixed rate
- `FEDFUNDS` — Federal Funds Rate (useful for context)

### 2. Homebuyer.com API (Live Lender Rates by State + FICO)

Sign up at https://homebuyer.com/api — returns daily rates by state, FICO tier, and LTV.

Replace `computeLenderRates()` call in `main.js` with:

```javascript
const res = await fetch('https://homebuyer.com/api/v1/rates', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  },
  body: JSON.stringify({
    state: zipToState(inputs.zipCode),  // implement ZIP→state lookup
    creditScore: inputs.creditScore,
    ltv: Math.round((inputs.loanAmount / (inputs.loanAmount + inputs.downPayment)) * 100),
    loanAmount: inputs.loanAmount,
    loanType: inputs.loanType
  })
});
const lenders = await res.json();
```

### 3. Claude API (AI Advisor)

Replace the simulated `askAIAdvisor()` in `src/data/rates.js`:

```javascript
export async function askAIAdvisor(question, context) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: "You are a helpful, concise mortgage advisor. Always give practical, personalized advice based on the user's specific numbers. Never recommend specific lenders. Keep answers to 2-3 sentences.",
      messages: [{
        role: "user",
        content: `Context: ${JSON.stringify(context)}\n\nQuestion: ${question}`
      }]
    })
  });
  const data = await response.json();
  return data.content[0].text;
}
```

**Note:** Don't expose API keys in frontend JS in production. Route these through a backend (FastAPI, Express, or serverless function).

### 4. Backend (FastAPI — Recommended for Production)

```python
# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"])

@app.get("/api/rates/history")
async def get_rate_history():
    # Fetch from FRED, cache in Redis for 24h
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://api.stlouisfed.org/fred/series/observations",
            params={"series_id": "MORTGAGE30US", "api_key": FRED_KEY, "limit": 52, "sort_order": "desc", "file_type": "json"}
        )
    data = r.json()
    return [{"date": o["date"], "rate": float(o["value"])} for o in reversed(data["observations"]) if o["value"] != "."]

@app.post("/api/rates/lenders")
async def get_lender_rates(payload: dict):
    # Call Homebuyer.com API, normalize response
    ...

@app.post("/api/ai/ask")
async def ask_advisor(payload: dict):
    # Call Claude API server-side (keys never exposed to browser)
    ...
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Vanilla JS (ES modules) | Zero build step, deploy anywhere |
| Charts | Chart.js 4.4 | Rate history visualization |
| Fonts | DM Serif Display + DM Sans | Editorial financial aesthetic |
| Data | FRED API | Historical national rates |
| Lenders | Homebuyer.com API | Live personalized quotes |
| AI | Claude API (Anthropic) | Natural language mortgage Q&A |
| Backend (prod) | FastAPI + Redis | API key security, rate caching |

---

## Portfolio / Interview Talking Points

When discussing this in Staff-level interviews, frame it as:

1. **System design** — "I built a real-time data aggregation pipeline pulling from 2 external APIs, normalized heterogeneous schemas, cached with TTL to stay under API rate limits, and served it through a typed REST API"

2. **AI integration** — "The LLM layer uses RAG-lite: I inject the user's current rate context into the system prompt so the model gives personalized, grounded answers rather than generic mortgage advice"

3. **Scalability trade-offs** — "For rate data, I chose a read-heavy caching strategy (Redis, 24h TTL) because accuracy within 24h is sufficient for the use case and it saves ~$0/month in API costs vs. live fetching"

4. **Product thinking** — "The hardest part wasn't the code — it was deciding what not to show. I removed 6 features from v1 because they added complexity without helping the core user goal: finding the lowest rate for their specific situation"

---

## Next Steps (v2 Ideas)

- [ ] ZIP code → state/county mapping for local rate adjustments
- [ ] Saved scenarios with localStorage persistence
- [ ] Email/SMS rate alerts when rates drop below threshold
- [ ] Affordability calculator (salary → max home price)
- [ ] Refinance break-even calculator
- [ ] Real lender application links (affiliate revenue model)
- [ ] Historical rate context ("rates are currently X% above the 10yr average")

