import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ─── Helpers ────────────────────────────────────────────────────────────────

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function vixStatus(v) {
  if (v == null) return "Unknown";
  if (v >= 30) return "Critical";
  if (v >= 25) return "Elevated";
  if (v >= 20) return "Watch";
  return "Normal";
}
function vvixStatus(v) {
  if (v == null) return "Unknown";
  if (v >= 120) return "Critical";
  if (v >= 100) return "Elevated";
  if (v >= 90) return "Watch";
  return "Normal";
}
function sofrStatus(v) {
  if (v == null) return "Unknown";
  if (v >= 5.5) return "Critical";
  if (v >= 5.0) return "Elevated";
  if (v >= 4.5) return "Watch";
  return "Normal";
}
function etfChgStatus(v) {
  if (v == null) return "Unknown";
  const abs = Math.abs(v);
  if (abs >= 3) return "Critical";
  if (abs >= 2) return "Elevated";
  if (abs >= 1) return "Watch";
  return "Normal";
}

// ─── Yahoo Finance v8 chart API (no npm package needed) ─────────────────────

async function fetchYahooV8(ticker, retries = 3) {
  // Fetch 1 year of daily data for percentile context
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (resp.status === 429) {
        const wait = 5000 * attempt;
        console.warn(`  Yahoo ${ticker}: 429 rate limited, waiting ${wait / 1000}s (attempt ${attempt}/${retries})`);
        await sleep(wait);
        continue;
      }

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      }

      const json = await resp.json();
      const result = json?.chart?.result?.[0];
      if (!result) throw new Error("No chart data returned");

      const meta = result.meta;
      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose;
      const change = prevClose ? price - prevClose : null;
      const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : null;

      // Extract 1-year closing prices for percentile & context
      const closes = result.indicators?.quote?.[0]?.close?.filter(c => c != null) || [];
      const timestamps = result.timestamp || [];

      // Percentile: what % of the last year's closes are below current price
      let percentile = null;
      let high52w = null;
      let low52w = null;
      if (closes.length > 20) {
        const sorted = [...closes].sort((a, b) => a - b);
        high52w = sorted[sorted.length - 1];
        low52w = sorted[0];
        const belowCount = sorted.filter(c => c < price).length;
        percentile = Math.round((belowCount / sorted.length) * 100);
      }

      // 5-day cumulative change (for flow signals like SPY/QQQ/EEM)
      let cumulative5d = null;
      if (closes.length >= 6) {
        const fiveDaysAgo = closes[closes.length - 6];
        const latest = closes[closes.length - 1];
        if (fiveDaysAgo && latest) {
          cumulative5d = parseFloat((((latest - fiveDaysAgo) / fiveDaysAgo) * 100).toFixed(2));
        }
      }

      // Daily move in standard deviations (z-score vs 1Y daily returns)
      let zScore = null;
      if (closes.length > 30 && changePercent != null) {
        const dailyReturns = [];
        for (let i = 1; i < closes.length; i++) {
          if (closes[i] && closes[i - 1]) {
            dailyReturns.push(((closes[i] - closes[i - 1]) / closes[i - 1]) * 100);
          }
        }
        if (dailyReturns.length > 20) {
          const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
          const std = Math.sqrt(dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / dailyReturns.length);
          if (std > 0) {
            zScore = parseFloat(((changePercent - mean) / std).toFixed(2));
          }
        }
      }

      // Last 30 trading days for mini chart
      let chart30d = null;
      if (closes.length > 30 && timestamps.length > 30) {
        const last30 = closes.slice(-30);
        const last30t = timestamps.slice(-30);
        chart30d = last30.map((c, i) => ({
          d: new Date(last30t[i] * 1000).toISOString().slice(5, 10),
          v: parseFloat(c.toFixed(2)),
        }));
      }

      return {
        price,
        change,
        changePercent,
        previousClose: prevClose,
        marketState: meta.currentTradingPeriod ? "available" : null,
        shortName: meta.shortName ?? meta.symbol ?? ticker,
        timestamp: new Date(meta.regularMarketTime * 1000).toISOString(),
        percentile,
        high52w: high52w ? parseFloat(high52w.toFixed(2)) : null,
        low52w: low52w ? parseFloat(low52w.toFixed(2)) : null,
        zScore,
        cumulative5d,
        chart30d,
      };
    } catch (err) {
      console.warn(`  Yahoo ${ticker} attempt ${attempt}/${retries}: ${err.message}`);
      if (attempt < retries) await sleep(2000 * attempt);
    }
  }

  console.error(`  Yahoo ${ticker}: all attempts failed`);
  return { price: null, error: "All fetch attempts failed" };
}

// ─── SOFR from NY Fed ───────────────────────────────────────────────────────

async function fetchSOFR() {
  try {
    const url = "https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json";
    const resp = await fetch(url);
    const json = await resp.json();
    const rate = json?.refRates?.[0];
    if (rate) {
      return {
        value: parseFloat(rate.percentRate),
        date: rate.effectiveDate,
        source: "NY Fed",
      };
    }
    throw new Error("No rate data");
  } catch (err) {
    console.warn("  SOFR fetch error:", err.message);
    return { value: null, error: err.message };
  }
}

// ─── Finnhub quote + candle for ETFs (more reliable than Yahoo for stocks) ──

async function fetchFinnhubQuote(symbol, retries = 2) {
  if (!FINNHUB_KEY) return null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Quote
      const qUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`;
      const qResp = await fetch(qUrl);
      if (!qResp.ok) throw new Error(`HTTP ${qResp.status}`);
      const q = await qResp.json();
      if (!q.c) throw new Error("No quote data");

      await sleep(500);

      // 1Y candle for percentile + chart
      const now = Math.floor(Date.now() / 1000);
      const yearAgo = now - 365 * 86400;
      const cUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${yearAgo}&to=${now}&token=${FINNHUB_KEY}`;
      const cResp = await fetch(cUrl);
      const candle = await cResp.json();

      const closes = candle?.c?.filter(c => c != null) || [];
      const candleTimestamps = candle?.t || [];

      // Percentile
      let percentile = null, high52w = null, low52w = null;
      if (closes.length > 20) {
        const sorted = [...closes].sort((a, b) => a - b);
        high52w = parseFloat(sorted[sorted.length - 1].toFixed(2));
        low52w = parseFloat(sorted[0].toFixed(2));
        percentile = Math.round((sorted.filter(c => c < q.c).length / sorted.length) * 100);
      }

      // 5D cumulative
      let cumulative5d = null;
      if (closes.length >= 6) {
        const a = closes[closes.length - 6], b = closes[closes.length - 1];
        if (a && b) cumulative5d = parseFloat((((b - a) / a) * 100).toFixed(2));
      }

      // Z-score
      let zScore = null;
      const chgPct = q.pc ? ((q.c - q.pc) / q.pc) * 100 : null;
      if (closes.length > 30 && chgPct != null) {
        const rets = [];
        for (let i = 1; i < closes.length; i++) {
          if (closes[i] && closes[i - 1]) rets.push(((closes[i] - closes[i - 1]) / closes[i - 1]) * 100);
        }
        if (rets.length > 20) {
          const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
          const std = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length);
          if (std > 0) zScore = parseFloat(((chgPct - mean) / std).toFixed(2));
        }
      }

      // Chart 30d
      let chart30d = null;
      if (closes.length > 30 && candleTimestamps.length > 30) {
        chart30d = closes.slice(-30).map((c, i) => ({
          d: new Date(candleTimestamps.slice(-30)[i] * 1000).toISOString().slice(5, 10),
          v: parseFloat(c.toFixed(2)),
        }));
      }

      return {
        price: q.c,
        change: q.d,
        changePercent: q.dp,
        previousClose: q.pc,
        timestamp: new Date().toISOString(),
        percentile, high52w, low52w, zScore, cumulative5d, chart30d,
      };
    } catch (err) {
      console.warn(`  Finnhub ${symbol} attempt ${attempt}/${retries}: ${err.message}`);
      if (attempt < retries) await sleep(1000);
    }
  }
  return null; // fallback to Yahoo
}

let cachedData = null;
let lastFetchTime = null;

async function buildLiveFeed() {
  console.log("Fetching live data...");

  // SOFR first (different source)
  const sofr = await fetchSOFR();
  console.log(`  SOFR: ${sofr.value ?? "failed"}% (${sofr.source ?? sofr.error})`);

  // Yahoo tickers: indices only (Finnhub can't do these)
  const yahooTickers = ["^VIX", "^VVIX", "^VIX3M", "^MOVE"];
  const results = {};

  for (const ticker of yahooTickers) {
    results[ticker] = await fetchYahooV8(ticker);
    const p = results[ticker].price;
    console.log(`  ${ticker}: ${p != null ? p : "failed"} (Yahoo)`);
    await sleep(1500);
  }

  // ETFs: try Finnhub first, fallback to Yahoo
  const etfTickers = ["SPY", "QQQ", "EEM"];
  for (const ticker of etfTickers) {
    const fhResult = await fetchFinnhubQuote(ticker);
    if (fhResult && fhResult.price != null) {
      results[ticker] = fhResult;
      console.log(`  ${ticker}: ${fhResult.price} (Finnhub)`);
    } else {
      results[ticker] = await fetchYahooV8(ticker);
      console.log(`  ${ticker}: ${results[ticker].price ?? "failed"} (Yahoo fallback)`);
    }
    await sleep(800);
  }

  // Also fetch SOFR chart data from Yahoo (^SOFR exists as a ticker)
  // This gives us the 30D trend chart even though the live rate comes from NY Fed
  let sofrChart = null;
  try {
    const sofrYahoo = await fetchYahooV8("^SOFR");
    if (sofrYahoo.chart30d) sofrChart = sofrYahoo;
    console.log(`  SOFR chart: ${sofrYahoo.chart30d ? sofrYahoo.chart30d.length + " days" : "failed"} (Yahoo)`);
  } catch(e) { console.warn("  SOFR chart fetch failed"); }
  await sleep(1500);

  const vix = results["^VIX"];
  const vvix = results["^VVIX"];
  const vix3m = results["^VIX3M"];
  const move = results["^MOVE"];
  const spy = results["SPY"];
  const qqq = results["QQQ"];
  const eem = results["EEM"];

  // VIX term structure: VIX / VIX3M ratio
  // < 1 = contango (normal), > 1 = backwardation (stress)
  let vixTermRatio = null;
  let vixTermStatus = "Unknown";
  if (vix.price != null && vix3m.price != null && vix3m.price > 0) {
    vixTermRatio = parseFloat((vix.price / vix3m.price).toFixed(3));
    if (vixTermRatio >= 1.15) vixTermStatus = "Critical";
    else if (vixTermRatio >= 1.05) vixTermStatus = "Elevated";
    else if (vixTermRatio >= 0.95) vixTermStatus = "Watch";
    else vixTermStatus = "Normal";
  }

  // MOVE status thresholds
  function moveStatus(v) {
    if (v == null) return "Unknown";
    if (v >= 140) return "Critical";
    if (v >= 120) return "Elevated";
    if (v >= 100) return "Watch";
    return "Normal";
  }

  const now = new Date().toISOString();

  // Helper to add context fields
  function ctx(d) {
    return { percentile: d.percentile, high52w: d.high52w, low52w: d.low52w, zScore: d.zScore, cumulative5d: d.cumulative5d, chart30d: d.chart30d };
  }

  const feed = {
    fetchedAt: now,
    marketState: vix.marketState,
    indicators: {
      VIX: {
        value: vix.price, change: vix.change, changePercent: vix.changePercent,
        status: vixStatus(vix.price), timestamp: vix.timestamp,
        source: "Yahoo Finance", ticker: "^VIX",
        label: "VIX Level & 30D Change", error: vix.error || null,
        ...ctx(vix),
      },
      VVIX: {
        value: vvix.price, change: vvix.change, changePercent: vvix.changePercent,
        status: vvixStatus(vvix.price), timestamp: vvix.timestamp,
        source: "Yahoo Finance", ticker: "^VVIX",
        label: "Vol-of-Vol (VVIX)", error: vvix.error || null,
        ...ctx(vvix),
      },
      VIX_TERM: {
        value: vixTermRatio,
        vix: vix.price, vix3m: vix3m.price,
        status: vixTermStatus, timestamp: vix.timestamp,
        source: "Yahoo Finance", ticker: "^VIX/^VIX3M",
        label: "VIX Term Structure (VIX/VIX3M)",
        error: (vix.error || vix3m.error) || null,
      },
      MOVE: {
        value: move.price, change: move.change, changePercent: move.changePercent,
        status: moveStatus(move.price), timestamp: move.timestamp,
        source: "Yahoo Finance", ticker: "^MOVE",
        label: "MOVE Index (Rates Vol)", error: move.error || null,
        ...ctx(move),
      },
      SOFR: {
        value: sofr.value, date: sofr.date,
        status: sofrStatus(sofr.value), source: sofr.source ?? "FRED",
        ticker: "SOFR", label: "GC Repo Rate (SOFR)", error: sofr.error || null,
        chart30d: sofrChart?.chart30d || null,
        percentile: sofrChart?.percentile || null,
        high52w: sofrChart?.high52w || null,
        low52w: sofrChart?.low52w || null,
      },
      SPY: {
        value: spy.price, change: spy.change, changePercent: spy.changePercent,
        status: etfChgStatus(spy.changePercent), timestamp: spy.timestamp,
        source: "Yahoo Finance", ticker: "SPY",
        label: "S&P 500 ETF Flow", error: spy.error || null,
        ...ctx(spy),
      },
      QQQ: {
        value: qqq.price, change: qqq.change, changePercent: qqq.changePercent,
        status: etfChgStatus(qqq.changePercent), timestamp: qqq.timestamp,
        source: "Yahoo Finance", ticker: "QQQ",
        label: "Nasdaq 100 ETF Flow", error: qqq.error || null,
        ...ctx(qqq),
      },
      EEM: {
        value: eem.price, change: eem.change, changePercent: eem.changePercent,
        status: etfChgStatus(eem.changePercent), timestamp: eem.timestamp,
        source: "Yahoo Finance", ticker: "EEM",
        label: "EM ETF Flow", error: eem.error || null,
        ...ctx(eem),
      },
    },
    thresholds: {
      VIX: { Normal: "<20", Watch: "20-25", Elevated: "25-30", Critical: ">30" },
      VVIX: { Normal: "<90", Watch: "90-100", Elevated: "100-120", Critical: ">120" },
      VIX_TERM: { Normal: "<0.95 (contango)", Watch: "0.95-1.05 (flat)", Elevated: "1.05-1.15 (inverted)", Critical: ">1.15 (deeply inverted)" },
      MOVE: { Normal: "<100", Watch: "100-120", Elevated: "120-140", Critical: ">140" },
      SOFR: { Normal: "<4.5%", Watch: "4.5-5%", Elevated: "5-5.5%", Critical: ">5.5%" },
      ETF_daily_chg: { Normal: "<1%", Watch: "1-2%", Elevated: "2-3%", Critical: ">3%" },
    },
    schedule: { interval: "15 minutes", activeHours: "09:30-16:00 ET, Mon-Fri" },
  };

  cachedData = feed;
  lastFetchTime = Date.now();
  console.log("Live feed ready.\n");
  return feed;
}

// ─── Multi-Source Hedge Fund News (Google News RSS + Yahoo Finance) ──────────

const HEDGE_FUND_NAMES = [
  "Citadel", "Bridgewater", "Millennium", "D.E. Shaw", "Point72",
  "Two Sigma", "Balyasny", "Renaissance", "Elliott", "Pershing Square",
  "Third Point", "Baupost", "Viking Global", "Lone Pine", "Tiger Global",
  "Coatue", "Appaloosa", "Man Group", "Winton", "AQR",
  "Muddy Waters", "Hindenburg", "Archegos", "Melvin Capital",
  "Citadel Securities", "Jane Street", "Hudson Bay", "Sculptor",
  "Marshall Wace", "Brevan Howard", "ExodusPoint", "Schonfeld",
  "Izzy Englander", "Ken Griffin", "Ray Dalio", "Steve Cohen",
  "David Shaw", "Jim Simons", "Bill Ackman", "Dan Loeb",
  "Paul Singer", "Seth Klarman", "Chase Coleman",
];

let cachedNews = null;
let lastNewsFetch = null;

// ── Google News RSS parser (no API key needed) ──
async function fetchGoogleNewsRSS(query) {
  const articles = [];
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!resp.ok) return articles;
    const xml = await resp.text();

    const items = xml.split("<item>").slice(1);
    for (const item of items.slice(0, 10)) {
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                     item.match(/<title>(.*?)<\/title>/) || [])[1] || "";
      const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || "";
      const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";
      const source = (item.match(/<source.*?>(.*?)<\/source>/) || [])[1] || "";

      if (title) {
        articles.push({
          title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
          publisher: source.replace(/&amp;/g, "&") || "Google News",
          link: link,
          publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
          thumbnail: null,
          source: "google",
        });
      }
    }
  } catch (err) {
    console.warn(`  Google News error for "${query}":`, err.message);
  }
  return articles;
}

// ── Generic RSS feed parser ──
async function fetchRSSFeed(feedUrl, sourceName) {
  const articles = [];
  try {
    const resp = await fetch(feedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!resp.ok) return articles;
    const xml = await resp.text();

    const items = xml.split("<item>").slice(1);
    for (const item of items.slice(0, 15)) {
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                     item.match(/<title>(.*?)<\/title>/) || [])[1] || "";
      const link = (item.match(/<link>(.*?)<\/link>/) ||
                    item.match(/<link[^>]*href="(.*?)"/) || [])[1] || "";
      const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) ||
                       item.match(/<dc:date>(.*?)<\/dc:date>/) || [])[1] || "";
      const desc = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                    item.match(/<description>(.*?)<\/description>/) || [])[1] || "";

      if (title) {
        articles.push({
          title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]*>/g, ""),
          publisher: sourceName,
          link: link,
          publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
          thumbnail: null,
          source: sourceName.toLowerCase().replace(/\s/g, "_"),
        });
      }
    }
  } catch (err) {
    console.warn(`  RSS error for ${sourceName}:`, err.message);
  }
  return articles;
}

// ── Finnhub News API ──

async function fetchFinnhubGeneralNews() {
  if (!FINNHUB_KEY) { console.warn("  No FINNHUB_API_KEY — skipping Finnhub"); return []; }
  const articles = [];
  try {
    const url = `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    for (const item of (json || []).slice(0, 20)) {
      articles.push({
        title: item.headline || "",
        publisher: item.source || "Finnhub",
        link: item.url || "",
        publishedAt: item.datetime ? new Date(item.datetime * 1000).toISOString() : null,
        thumbnail: item.image || null,
        summary: item.summary || null,
        source: "finnhub",
      });
    }
  } catch (err) {
    console.warn(`  Finnhub general news error:`, err.message);
  }
  return articles;
}

async function fetchFinnhubCompanyNews(symbol, name) {
  if (!FINNHUB_KEY) return [];
  const articles = [];
  try {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${weekAgo}&to=${today}&token=${FINNHUB_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) return articles;
    const json = await resp.json();
    for (const item of (json || []).slice(0, 5)) {
      articles.push({
        title: item.headline || "",
        publisher: item.source || "Finnhub",
        link: item.url || "",
        publishedAt: item.datetime ? new Date(item.datetime * 1000).toISOString() : null,
        thumbnail: item.image || null,
        summary: item.summary || null,
        fund: name,
        source: "finnhub",
      });
    }
  } catch (err) {
    // Silently skip — rate limit or not found
  }
  return articles;
}

// Publicly traded HF-related companies to monitor via Finnhub company news
const FINNHUB_TICKERS = [
  { symbol: "BN", name: "Brookfield" },
  { symbol: "BX", name: "Blackstone" },
  { symbol: "KKR", name: "KKR" },
  { symbol: "APO", name: "Apollo" },
  { symbol: "ARES", name: "Ares Management" },
  { symbol: "MAN.L", name: "Man Group" },
  { symbol: "GS", name: "Goldman Sachs" },
  { symbol: "MS", name: "Morgan Stanley" },
  { symbol: "JPM", name: "JP Morgan" },
];

// ── Fetch from ALL sources ──
async function fetchAllHeadlines() {
  const allArticles = [];

  // --- Google News: general hedge fund queries ---
  const googleQueries = [
    "hedge fund news",
    "hedge fund redemption",
    "hedge fund SEC regulatory",
    "hedge fund performance 2026",
    "short seller activist investor",
    "prime broker hedge fund",
  ];

  console.log("  Fetching Google News (general)...");
  const googleResults = await Promise.all(googleQueries.map(q => fetchGoogleNewsRSS(q)));
  googleResults.forEach(batch => allArticles.push(...batch));
  console.log(`  Google News (general): ${allArticles.length}`);

  // --- Google News: Hedgeweek specifically ---
  console.log("  Fetching Hedgeweek via Google News...");
  const hedgeweekQueries = [
    "site:hedgeweek.com",
    "site:hedgeweek.com hedge fund",
  ];
  const hwResults = await Promise.all(hedgeweekQueries.map(q => fetchGoogleNewsRSS(q)));
  let hwCount = 0;
  hwResults.forEach(batch => {
    // Tag these as Hedgeweek source
    batch.forEach(a => { a.publisher = a.publisher || "Hedgeweek"; a.source = "hedgeweek"; });
    hwCount += batch.length;
    allArticles.push(...batch);
  });
  console.log(`  Hedgeweek: ${hwCount}`);

  // --- Google News: other specialist sources ---
  console.log("  Fetching specialist HF sources...");
  const specialistQueries = [
    "site:institutionalinvestor.com hedge fund",
    "site:ft.com hedge fund",
    "site:risk.net hedge fund",
  ];
  const specResults = await Promise.all(specialistQueries.map(q => fetchGoogleNewsRSS(q)));
  let specCount = 0;
  specResults.forEach(batch => { specCount += batch.length; allArticles.push(...batch); });
  console.log(`  Specialist sources: ${specCount}`);

  // --- Direct RSS feeds (industry-specific) ---
  console.log("  Fetching direct RSS feeds...");
  const rssFeeds = [
    { url: "https://feeds.feedburner.com/insidermonkey", name: "Insider Monkey" },
    { url: "https://alpha-week.com/hedge-funds/feed", name: "Alpha Week" },
  ];

  const rssResults = await Promise.all(rssFeeds.map(f => fetchRSSFeed(f.url, f.name)));
  let rssCount = 0;
  rssResults.forEach(batch => { rssCount += batch.length; allArticles.push(...batch); });
  console.log(`  Direct RSS: ${rssCount}`);

  // --- Finnhub: general market news ---
  console.log("  Fetching Finnhub general news...");
  const finnhubGeneral = await fetchFinnhubGeneralNews();
  allArticles.push(...finnhubGeneral);
  console.log(`  Finnhub general: ${finnhubGeneral.length}`);

  // --- Finnhub: company-specific news for HF-adjacent tickers ---
  console.log("  Fetching Finnhub company news...");
  let finnhubCompanyCount = 0;
  for (const t of FINNHUB_TICKERS) {
    const batch = await fetchFinnhubCompanyNews(t.symbol, t.name);
    finnhubCompanyCount += batch.length;
    allArticles.push(...batch);
    await sleep(500); // respect 60 calls/min rate limit
  }
  console.log(`  Finnhub company: ${finnhubCompanyCount}`);

  console.log(`  Total raw: ${allArticles.length}`);

  // Deduplicate by normalized title
  const seen = new Set();
  return allArticles.filter(a => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (seen.has(key) || !key) return false;
    seen.add(key);
    return true;
  });
}

// ── Smart tagging (no API key needed) ──
function tagArticle(article) {
  const title = article.title.toLowerCase();

  // Match fund name
  const fund = HEDGE_FUND_NAMES.find(f => title.includes(f.toLowerCase())) || null;

  // Sentiment
  let sentiment = "neutral";
  if (/record|gain|raise|launch|strong|outperform|profit|surge|rally|beat|top/i.test(article.title)) sentiment = "positive";
  if (/loss|redemption|sec |probe|investig|resign|depart|close|liquidat|sued|fine|fraud|warning|risk|concern|slump|plunge|cut|slash|layoff|default/i.test(article.title)) sentiment = "negative";

  // Risk category
  let riskTag = null;
  if (/leverage|margin call|deleverage|gross exposure/i.test(title)) riskTag = "Leverage";
  else if (/redemption|outflow|withdraw|investor pull/i.test(title)) riskTag = "Redemption";
  else if (/sec |regulat|probe|fine|investig|compliance|enforcement|lawsuit/i.test(title)) riskTag = "Regulatory";
  else if (/return|perform|gain|loss|profit|beat|miss|alpha|drawdown/i.test(title)) riskTag = "Performance";
  else if (/hire|depart|turnover|talent|pm leave|recruit|poach/i.test(title)) riskTag = "Talent";
  else if (/short|squeeze|crowd|activist|position/i.test(title)) riskTag = "Concentration";
  else if (/liquidity|funding|credit|repo|prime broker/i.test(title)) riskTag = "Liquidity";
  else if (/rate|fed |inflation|tariff|trade war|macro|recession|gdp/i.test(title)) riskTag = "Macro";
  else if (/style drift|strategy change|mandate/i.test(title)) riskTag = "Style Drift";

  return { ...article, fund, sentiment, riskTag };
}

// ── Rank articles by relevance ──
function rankArticles(articles) {
  return articles
    .map(a => {
      let score = 0;
      if (a.fund) score += 30;           // Named fund = high relevance
      if (a.riskTag) score += 20;         // Has a risk tag
      if (a.sentiment === "negative") score += 15;  // Negative news more actionable
      if (a.sentiment === "positive") score += 5;
      // Source quality bonus
      if (a.source === "hedgeweek") score += 25;      // Hedgeweek = top HF source
      if (a.source === "finnhub") score += 20;         // Finnhub = institutional quality
      if (a.publisher === "Insider Monkey") score += 15;
      if (a.publisher === "Alpha Week") score += 15;
      if (a.publisher?.includes("Institutional Investor")) score += 20;
      if (a.publisher?.includes("Financial Times") || a.publisher?.includes("FT")) score += 15;
      if (a.publisher?.includes("Risk.net")) score += 15;
      if (a.source === "google") score += 5;
      // Recency bonus
      if (a.publishedAt) {
        const hoursAgo = (Date.now() - new Date(a.publishedAt).getTime()) / 3600000;
        if (hoursAgo < 6) score += 20;
        else if (hoursAgo < 24) score += 10;
        else if (hoursAgo < 72) score += 5;
      }
      return { ...a, _score: score };
    })
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...rest }) => rest);
}

// ── Main news function ──
async function fetchHedgeFundNews() {
  console.log("  Fetching news headlines...");
  const raw = await fetchAllHeadlines();

  const tagged = raw.map(tagArticle);
  const ranked = rankArticles(tagged);

  // Take top 25
  cachedNews = ranked.slice(0, 25);
  lastNewsFetch = Date.now();
  console.log(`  News ready: ${cachedNews.length} curated articles\n`);
  return cachedNews;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

app.get("/api/news", async (_req, res) => {
  try {
    // Cache news for 30 minutes
    if (cachedNews && lastNewsFetch && Date.now() - lastNewsFetch < 30 * 60 * 1000) {
      return res.json({ articles: cachedNews, cached: true });
    }
    const articles = await fetchHedgeFundNews();
    res.json({ articles });
  } catch (err) {
    console.error("news error:", err);
    res.status(500).json({ error: "Failed to fetch news", articles: [] });
  }
});

app.get("/api/live-feed", async (_req, res) => {
  try {
    if (cachedData && lastFetchTime && Date.now() - lastFetchTime < 2 * 60 * 1000) {
      return res.json({ ...cachedData, cached: true });
    }
    const data = await buildLiveFeed();
    res.json(data);
  } catch (err) {
    console.error("live-feed error:", err);
    res.status(500).json({ error: "Failed to fetch live data", details: err.message });
  }
});

app.get("/api/live-feed/force", async (_req, res) => {
  try {
    const data = await buildLiveFeed();
    res.json(data);
  } catch (err) {
    console.error("live-feed force error:", err);
    res.status(500).json({ error: "Failed to fetch live data", details: err.message });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", lastFetch: lastFetchTime ? new Date(lastFetchTime).toISOString() : null });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ─── Scheduled polling ──────────────────────────────────────────────────────

function isMarketHours() {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  if (day === 0 || day === 6) return false;
  const mins = et.getHours() * 60 + et.getMinutes();
  return mins >= 570 && mins <= 960;
}

const INTERVAL = (parseInt(process.env.REFRESH_INTERVAL_MIN) || 15) * 60 * 1000;

setInterval(async () => {
  if (isMarketHours()) {
    console.log(`[${new Date().toISOString()}] Market hours - refreshing...`);
    try { await buildLiveFeed(); } catch (err) { console.error("Scheduled refresh error:", err.message); }
  }
}, INTERVAL);

// ─── Start ──────────────────────────────────────────────────────────────────

import os from "os";

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal/loopback and non-IPv4
      if (iface.internal || iface.family !== "IPv4") continue;
      return iface.address;
    }
  }
  return null;
}

const PORT = process.env.PORT || 3001;

// Listen on 0.0.0.0 so other devices on the same network can connect
app.listen(PORT, "0.0.0.0", () => {
  const localIP = getLocalIP();

  console.log(`\n${"═".repeat(58)}`);
  console.log(`  Hedge Funds Market Surveillance v3.0`);
  console.log(`${"═".repeat(58)}`);
  console.log(`\n  Local:     http://localhost:${PORT}`);
  if (localIP) {
    console.log(`  Network:   http://${localIP}:${PORT}`);
    console.log(`\n  Share this link with others on the same WiFi:`);
    console.log(`  ➜  http://${localIP}:${PORT}`);
  }
  console.log(`\n  Polling every ${INTERVAL / 60000} min during market hours`);
  console.log(`${"─".repeat(58)}\n`);

  buildLiveFeed()
    .then(() => fetchHedgeFundNews())
    .then(() => {
      console.log(`Ready!\n`);
      if (localIP) {
        console.log(`Your link:   http://localhost:${PORT}`);
        console.log(`Share link:  http://${localIP}:${PORT}\n`);
      }
    })
    .catch(console.error);
});
