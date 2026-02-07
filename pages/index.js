import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from "recharts";

const ELI5 = {
  treasuries: {
    emoji: "\u{1F3DB}\uFE0F", title: "Treasuries Held",
    short: "US government bonds sitting on the Fed\u2019s balance sheet",
    eli5: "The Fed bought US government bonds to inject money into the economy. The more it holds, the more cash it pumped in. Since Dec 2025, it stopped shrinking these (QT ended).",
  },
  agencyDebt: {
    emoji: "\u{1F3D8}\uFE0F", title: "Agency Debt",
    short: "Bonds from government agencies (Fannie Mae, Freddie Mac, FHLB)",
    eli5: "Debt issued by semi-government agencies tied to housing. A tiny sliver of the Fed\u2019s balance sheet now \u2014 just a few billion dollars.",
  },
  mbs: {
    emoji: "\u{1F3E0}", title: "MBS (Mortgage-Backed Securities)",
    short: "Bundles of home mortgages bought by the Fed",
    eli5: "Thousands of home loans packaged into one security. The Fed bought trillions in 2020-21 to keep mortgage rates low. Now it lets them roll off as people repay or refinance.",
  },
  tga: {
    emoji: "\u{1F4B0}", title: "Treasury General Account (TGA)",
    short: "The US government\u2019s checking account at the Fed",
    eli5: "The Treasury keeps its cash at the Fed, like you keep yours at a bank. When TGA RISES, the government sucks cash out of the system. When it FALLS, money flows back in.",
    impact: "\u2B06\uFE0F TGA rises = less liquidity  |  \u2B07\uFE0F TGA falls = more liquidity",
  },
  onRrp: {
    emoji: "\u{1F17F}\uFE0F", title: "Overnight Reverse Repo (ON RRP)",
    short: "The parking lot where money market funds park cash at the Fed",
    eli5: "Money market funds can park cash at the Fed overnight for a small return. When lots of money sits here, it\u2019s not circulating. Now it\u2019s near zero \u2014 the cash is back in play.",
    impact: "\u2B06\uFE0F ON RRP rises = less liquidity  |  \u2B07\uFE0F ON RRP falls = more liquidity",
  },
  netLiquidity: {
    emoji: "\u{1F30A}", title: "Net Liquidity",
    short: "The real fuel circulating in the financial system",
    eli5: "Formula: Fed Assets \u2212 TGA \u2212 ON RRP. It\u2019s how much money the Fed has actually put into circulation, minus what\u2019s locked up. Higher = more fuel for markets.",
    impact: "Historically highly correlated with stocks and crypto",
  },
};

function InfoCard({ info, isOpen, onToggle }) {
  return (
    <div style={{
      background: isOpen ? "rgba(167,139,250,0.06)" : "rgba(255,255,255,0.02)",
      border: "1px solid " + (isOpen ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.06)"),
      borderRadius: 8, marginBottom: 8, overflow: "hidden",
    }}>
      <button onClick={onToggle} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", background: "none", border: "none",
        cursor: "pointer", color: "#e0e0e0", fontFamily: "inherit", textAlign: "left",
      }}>
        <span style={{ fontSize: 18 }}>{info.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{info.title}</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{info.short}</div>
        </div>
        <span style={{ fontSize: 12, color: "#6b7280", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>{"\u25BC"}</span>
      </button>
      {isOpen && (
        <div style={{ padding: "0 14px 12px 44px" }}>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 6px", lineHeight: 1.6 }}>{info.eli5}</p>
          {info.impact && (
            <div style={{ fontSize: 11, color: "#a78bfa", background: "rgba(167,139,250,0.08)", padding: "6px 10px", borderRadius: 6, marginTop: 6, fontWeight: 500 }}>{info.impact}</div>
          )}
        </div>
      )}
    </div>
  );
}

function TipBar({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "10px 14px", fontSize: 13, fontFamily: "JetBrains Mono, monospace", color: "#e0e0e0" }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ color: payload[0].value >= 0 ? "#60a5fa" : "#fb923c" }}>
        {payload[0].value >= 0 ? "+" : ""}{payload[0].value.toFixed(1)}B
      </div>
    </div>
  );
}

function TipLine({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "10px 14px", fontSize: 13, fontFamily: "JetBrains Mono, monospace", color: "#e0e0e0" }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ color: "#60a5fa" }}>{payload[0].value.toFixed(1)}% of GDP</div>
    </div>
  );
}

function formatB(millions) {
  if (!millions || millions === 0) return "$0";
  if (millions >= 1000000) return "$" + (millions / 1000000).toFixed(2) + "T";
  if (millions >= 1000) return "$" + (millions / 1000).toFixed(0) + "B";
  return "$" + millions.toFixed(0) + "M";
}

export default function Home() {
  var [tab, setTab] = useState("ytd");
  var [eli5Open, setEli5Open] = useState(null);
  var [loading, setLoading] = useState(true);
  var [lastUpdate, setLastUpdate] = useState(null);
  var [error, setError] = useState(null);
  var [snap, setSnap] = useState({
    date: "Loading...", totalAssets: 0, treasuries: 0,
    agencyDebt: 0, mbs: 0, tga: 0, onRrp: 0, gdp: 30300,
  });
  var [ytdBars, setYtdBars] = useState(null);
  var [histData, setHistData] = useState([]);

  var refresh = useCallback(async function () {
    setLoading(true);
    setError(null);
    try {
      // Fetch snapshot data (recent)
      var snapRes = await fetch("/api/fred?ids=WALCL,TREAST,FEDDT,WSHOMCB,WTREGEN,RRPONTSYD,GDP&start=2024-12-01");
      if (!snapRes.ok) throw new Error("API returned " + snapRes.status);
      var data = await snapRes.json();
      if (data.error) throw new Error(data.error);

      var last = function (arr) { return arr && arr.length > 0 ? arr[arr.length - 1] : null; };
      var la = last(data.WALCL);
      var lt = last(data.TREAST);
      var lag = last(data.FEDDT) || { value: 2347 };
      var lm = last(data.WSHOMCB);
      var lg = last(data.WTREGEN);
      var lr = last(data.RRPONTSYD);
      var lgdp = last(data.GDP) || { value: 30300 };

      if (!la || !lt || !lm || !lg || !lr) throw new Error("Incomplete data");

      setSnap({
        date: la.date,
        totalAssets: la.value,
        treasuries: lt.value,
        agencyDebt: lag.value,
        mbs: lm.value,
        tga: lg.value,
        onRrp: lr.value * 1000, // convert billions to millions for consistent formatB display
        gdp: lgdp.value,
      });

      // YTD changes
      var ys = function (arr) {
        if (!arr || arr.length === 0) return null;
        // Try exact Dec 31 first, then closest to year-end
        var found = arr.find(function (d) { return d.date === "2025-12-31"; });
        if (!found) found = arr.find(function (d) { return d.date >= "2025-12-29" && d.date <= "2026-01-02"; });
        if (!found) found = arr.find(function (d) { return d.date >= "2025-12-24"; });
        return found || arr[0];
      };

      var dT = (lt.value - ys(data.TREAST).value) / 1000;
      var dAg = (lag.value - (ys(data.FEDDT) || lag).value) / 1000;
      var dM = (lm.value - ys(data.WSHOMCB).value) / 1000;
      var dTGA = (lg.value - ys(data.WTREGEN).value) / 1000;
      var dRRP = lr.value - ys(data.RRPONTSYD).value; // RRPONTSYD is already in billions
      var net = (dT + dAg + dM) - dTGA - dRRP;

      setYtdBars([
        { name: "Treasuries", value: Math.round(dT * 10) / 10 },
        { name: "Agency Debt", value: Math.round(dAg * 10) / 10 },
        { name: "MBS", value: Math.round(dM * 10) / 10 },
        { name: "TGA", value: Math.round(dTGA * 10) / 10 },
        { name: "ON RRP", value: Math.round(dRRP * 10) / 10 },
        { name: "NET LIQ \u0394", value: Math.round(net * 10) / 10 },
      ]);

      // Fetch full history for line chart
      var histRes = await fetch("/api/fred?ids=WALCL,WTREGEN,RRPONTSYD,GDP&start=2003-01-01");
      if (histRes.ok) {
        var hd = await histRes.json();
        if (hd.WALCL && hd.WTREGEN && hd.GDP) {
          // Interpolate GDP quarterly to daily
          var gdpDaily = {};
          for (var i = 0; i < hd.GDP.length; i++) {
            var curr = hd.GDP[i];
            var next = hd.GDP[i + 1];
            if (!next) {
              // Extend last value 400 days forward
              var baseT = new Date(curr.date).getTime();
              for (var j = 0; j <= 400; j++) {
                gdpDaily[new Date(baseT + j * 86400000).toISOString().slice(0, 10)] = curr.value;
              }
              break;
            }
            var d0 = new Date(curr.date).getTime();
            var d1 = new Date(next.date).getTime();
            var days = Math.round((d1 - d0) / 86400000);
            for (var j2 = 0; j2 <= days; j2++) {
              var dd = new Date(d0 + j2 * 86400000).toISOString().slice(0, 10);
              gdpDaily[dd] = curr.value + (next.value - curr.value) * (j2 / days);
            }
          }

          // Build TGA and RRP lookups
          var tgaMap = {};
          hd.WTREGEN.forEach(function (d) { tgaMap[d.date] = d.value; });
          var rrpMap = {};
          if (hd.RRPONTSYD) {
            hd.RRPONTSYD.forEach(function (d) { rrpMap[d.date] = d.value; });
          }

          // Compute weekly net liquidity / GDP
          var result = [];
          var prevTga = 0;
          var prevRrp = 0;
          for (var k = 0; k < hd.WALCL.length; k++) {
            var a = hd.WALCL[k];
            if (tgaMap[a.date] !== undefined) prevTga = tgaMap[a.date];
            if (rrpMap[a.date] !== undefined) prevRrp = rrpMap[a.date];
            var g = gdpDaily[a.date];
            if (!g || g <= 0) continue;
            var netLiqB = (a.value - prevTga - prevRrp) / 1000;
            var pct = (netLiqB / g) * 100;
            if (pct > 0 && pct < 50) {
              result.push({ date: a.date, pct: Math.round(pct * 100) / 100 });
            }
          }
          if (result.length > 50) {
            setHistData(result);
          }
        }
      }

      setLastUpdate(new Date());
    } catch (e) {
      console.error("Fetch error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(function () {
    refresh();
    var iv = setInterval(refresh, 30 * 60 * 1000);
    return function () { clearInterval(iv); };
  }, [refresh]);

  var netLiq = snap.totalAssets - snap.tga - snap.onRrp;
  var pctGdp = snap.gdp > 0 ? ((netLiq / 1000) / snap.gdp * 100) : 0;

  var bars = ytdBars || [
    { name: "Treasuries", value: 0 }, { name: "Agency Debt", value: 0 },
    { name: "MBS", value: 0 }, { name: "TGA", value: 0 },
    { name: "ON RRP", value: 0 }, { name: "NET LIQ \u0394", value: 0 },
  ];

  var cards = [
    { label: "Total Assets", val: formatB(snap.totalAssets), sub: "WALCL", k: null },
    { label: "Treasuries", val: formatB(snap.treasuries), sub: "TREAST", k: "treasuries" },
    { label: "Agency Debt", val: formatB(snap.agencyDebt), sub: "FEDDT", k: "agencyDebt" },
    { label: "MBS", val: formatB(snap.mbs), sub: "WSHOMCB", k: "mbs" },
    { label: "TGA", val: formatB(snap.tga), sub: "WTREGEN", k: "tga", alert: true },
    { label: "ON RRP", val: formatB(snap.onRrp), sub: "RRPONTSYD", k: "onRrp" },
    { label: "Net Liquidity", val: formatB(netLiq), sub: pctGdp.toFixed(1) + "% GDP", k: "netLiquidity", hl: true },
  ];

  return (
    <>
      <Head>
        <title>Fed Liquidity Monitor</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#x1F35D;</text></svg>" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a1a 0%, #0f1629 50%, #0a0a1a 100%)", color: "#e0e0e0", fontFamily: "JetBrains Mono, SF Mono, monospace", padding: "24px 16px" }}>

        <div style={{ maxWidth: 920, margin: "0 auto 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: error ? "#ef4444" : loading ? "#f59e0b" : "#22c55e", boxShadow: "0 0 8px " + (error ? "#ef4444" : loading ? "#f59e0b" : "#22c55e"), animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, color: "#6b7280", letterSpacing: 1.5, textTransform: "uppercase" }}>
              {loading ? "Fetching from FRED\u2026" : error ? "Offline \u00B7 " + error : "Live \u00B7 " + snap.date}
            </span>
            {lastUpdate && <span style={{ fontSize: 10, color: "#374151" }}>{"\u00B7"} updated {lastUpdate.toLocaleTimeString()} {"\u00B7"} auto-refresh 30min</span>}
            <button onClick={refresh} disabled={loading} style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 4, background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", color: "#60a5fa", cursor: loading ? "wait" : "pointer", fontSize: 11, fontFamily: "inherit" }}>
              {loading ? "\u23F3" : "\u{1F504}"} Refresh
            </button>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, background: "linear-gradient(90deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Fed Net Liquidity Monitor
          </h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "6px 0 0" }}>
            Net Liquidity = Fed Assets {"\u2212"} TGA {"\u2212"} ON RRP {"\u00B7"} <span style={{ color: "#4b5563" }}>Live from FRED</span>
          </p>
        </div>

        <div style={{ maxWidth: 920, margin: "0 auto 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
          {cards.map(function (c, i) {
            return (
              <div key={i} onClick={function () { if (c.k) setEli5Open(eli5Open === c.k ? null : c.k); }} style={{
                background: c.hl ? "linear-gradient(135deg, rgba(96,165,250,0.12), rgba(167,139,250,0.08))" : "rgba(255,255,255,0.025)",
                border: c.hl ? "1px solid rgba(96,165,250,0.25)" : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "12px 10px", cursor: c.k ? "pointer" : "default",
              }}>
                <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5 }}>
                  {(ELI5[c.k] || {}).emoji || "\u{1F4CA}"} {c.label}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: c.hl ? "#60a5fa" : c.alert ? "#fb923c" : "#e0e0e0" }}>{c.val}</div>
                <div style={{ fontSize: 9, color: "#4b5563", marginTop: 3 }}>{c.sub}{c.k ? " \u00B7 tap ?" : ""}</div>
              </div>
            );
          })}
        </div>

        {eli5Open && ELI5[eli5Open] && (
          <div style={{ maxWidth: 920, margin: "0 auto 20px", background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>{ELI5[eli5Open].emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{ELI5[eli5Open].title}</div>
                <div style={{ fontSize: 11, color: "#a78bfa" }}>{ELI5[eli5Open].short}</div>
              </div>
              <button onClick={function () { setEli5Open(null); }} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16 }}>{"\u2715"}</button>
            </div>
            <p style={{ fontSize: 13, color: "#c4b5fd", margin: "0 0 8px", lineHeight: 1.7 }}>{ELI5[eli5Open].eli5}</p>
            {ELI5[eli5Open].impact && (
              <div style={{ fontSize: 12, color: "#a78bfa", background: "rgba(167,139,250,0.1)", padding: "8px 12px", borderRadius: 6, fontWeight: 500 }}>{ELI5[eli5Open].impact}</div>
            )}
          </div>
        )}

        <div style={{ maxWidth: 920, margin: "0 auto 12px", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[{ k: "ytd", l: "\u{1F4CA} YTD Changes" }, { k: "history", l: "\u{1F4C8} Liquidity % GDP" }, { k: "glossary", l: "\u{1F4D6} Glossary" }].map(function (t) {
            return (
              <button key={t.k} onClick={function () { setTab(t.k); }} style={{
                padding: "7px 14px", borderRadius: 6, border: "none",
                background: tab === t.k ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.04)",
                color: tab === t.k ? "#60a5fa" : "#6b7280",
                cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: "inherit",
              }}>{t.l}</button>
            );
          })}
        </div>

        <div style={{ maxWidth: 920, margin: "0 auto", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "20px 14px" }}>

          {tab === "ytd" && (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 3px" }}>Year-to-Date Change in Liquidity Components</h2>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 16px" }}>
                Billions USD {"\u00B7"} Jan 1 {"\u2192"} {snap.date} {"\u00B7"} {"\u{1F535}"} adds liquidity {"\u00B7"} {"\u{1F7E0}"} drains liquidity
              </p>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={bars} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-25} textAnchor="end" interval={0} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                  <Tooltip content={TipBar} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {bars.map(function (e, i) {
                      return <Cell key={i} fill={e.name === "NET LIQ \u0394" ? (e.value >= 0 ? "#22c55e" : "#ef4444") : (e.value >= 0 ? "#2563eb" : "#ea580c")} opacity={e.name === "NET LIQ \u0394" ? 1 : 0.8} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {bars.length > 0 && (
                <div style={{
                  marginTop: 14, padding: "10px 14px", borderRadius: 8, fontSize: 12,
                  background: bars[bars.length - 1].value >= 0 ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
                  border: "1px solid " + (bars[bars.length - 1].value >= 0 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"),
                  color: "#9ca3af",
                }}>
                  <strong style={{ color: bars[bars.length - 1].value >= 0 ? "#22c55e" : "#ef4444" }}>
                    Net Liquidity YTD: {bars[bars.length - 1].value >= 0 ? "+" : ""}{bars[bars.length - 1].value}B
                  </strong>
                  <span style={{ marginLeft: 8 }}>{"\u2014"} The TGA is the main driver: when the government hoards cash, it drains liquidity from the system.</span>
                </div>
              )}
            </div>
          )}

          {tab === "history" && (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 3px" }}>Net Liquidity as % of Nominal GDP</h2>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 16px" }}>(Fed Assets {"\u2212"} TGA {"\u2212"} ON RRP) / Nominal GDP {"\u00B7"} 2003{"\u2013"}present {"\u00B7"} weekly</p>
              {histData.length > 0 ? (
                <ResponsiveContainer width="100%" height={420}>
                  <LineChart data={histData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} tickFormatter={function (d) { return d ? d.slice(0, 4) : ""; }} interval={Math.max(1, Math.floor(histData.length / 12))} />
                    <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} domain={[0, 38]} unit="%" />
                    <Tooltip content={TipLine} />
                    <Line type="monotone" dataKey="pct" stroke="#3b82f6" strokeWidth={1.5} dot={false} activeDot={{ r: 3, stroke: "#60a5fa", strokeWidth: 2, fill: "#0f1629" }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>Loading history from FRED...</div>
              )}
              <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.12)", fontSize: 12, color: "#9ca3af" }}>
                Current: <strong style={{ color: "#60a5fa" }}>~{pctGdp.toFixed(1)}%</strong> of GDP {"\u2014"} down from ~34% peak (mid-2021). QT ended Dec 2025, but elevated TGA keeps draining.
              </div>
            </div>
          )}

          {tab === "glossary" && (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>{"\u{1F4D6}"} What is each component? (ELI5)</h2>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 16px" }}>Tap each to expand</p>
              {Object.entries(ELI5).map(function (entry) {
                var k = entry[0], info = entry[1];
                return <InfoCard key={k} info={info} isOpen={eli5Open === k} onToggle={function () { setEli5Open(eli5Open === k ? null : k); }} />;
              })}
            </div>
          )}
        </div>

        <div style={{ maxWidth: 920, margin: "20px auto 0", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "14px" }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, margin: "0 0 8px", color: "#a78bfa" }}>{"\u2699\uFE0F"} Data Sources {"\u00B7"} Auto-refresh every 30 min</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "5px 16px", fontSize: 10, color: "#6b7280" }}>
            {[
              { s: "WALCL", d: "Total Assets \u00B7 Wed level" },
              { s: "TREAST", d: "Treasuries \u00B7 Wed level" },
              { s: "FEDDT", d: "Agency Debt \u00B7 Wed level" },
              { s: "WSHOMCB", d: "MBS \u00B7 Wed level" },
              { s: "WTREGEN", d: "TGA \u00B7 weekly avg" },
              { s: "RRPONTSYD", d: "ON RRP \u00B7 daily" },
              { s: "GDP", d: "Nominal GDP \u00B7 quarterly (BEA)" },
            ].map(function (s) {
              return (
                <div key={s.s} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <code style={{ background: "rgba(96,165,250,0.08)", padding: "1px 5px", borderRadius: 3, color: "#60a5fa" }}>{s.s}</code>
                  <span>{s.d}</span>
                </div>
              );
            })}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 9, color: "#374151" }}>
            All series from fred.stlouisfed.org {"\u00B7"} All values in Millions USD (except GDP in Billions) {"\u00B7"} H.4.1 released every Thu ~4:30 PM ET
          </p>
        </div>

        <style jsx global>{`
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #0a0a1a; }
        `}</style>
      </div>
    </>
  );
}
