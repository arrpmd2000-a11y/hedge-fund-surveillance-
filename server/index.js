<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Hedge Funds Market Surveillance</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#f4f5f7;--card:#fff;--surface:#eef0f4;--hover:#e8eaef;--border:#dcdfe7;--border-s:#c4c9d6;--text:#1b1f2e;--text-s:#4a5068;--text-m:#878da4;--accent:#3654b3;--accent-bg:#edf1ff;--green:#0e8a4f;--green-bg:#eef8f2;--green-bd:#aedfc4;--yellow:#b47300;--yellow-bg:#fdf6e5;--yellow-bd:#efd07e;--orange:#b34800;--orange-bg:#fdeee5;--orange-bd:#efab7e;--red:#b52525;--red-bg:#fdeeee;--red-bd:#ee9898;--gray:#7e849a;--gray-bg:#f2f3f6;--f:'DM Mono',monospace;--fb:'Source Sans 3',sans-serif;--sh:0 1px 3px rgba(0,0,0,0.04)}
body{background:var(--bg);color:var(--text);font-family:var(--fb);min-height:100vh;-webkit-font-smoothing:antialiased;font-size:14px;line-height:1.5}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes pr{0%{transform:scale(1);opacity:0.4}100%{transform:scale(2.5);opacity:0}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes spin{to{transform:rotate(360deg)}}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">

/* ═══ SIGNAL DEFINITIONS ═══ */
const SIGNALS = {
  "Concentration":{icon:"⚡",desc:"Crowded positions, correlation breakdowns, volatility regime shifts, and short squeeze exposure.",relatedTags:["Concentration","Performance","Regulatory"],signals:[
    {id:"crowding",name:"Crowding",metric:"Peer overlap %",value:"32%",status:"Normal",
      def:"HF ownership as % of float, 13F overlap with top 10 peers, Goldman GSTHHFHI basket, CFTC positioning, momentum factor Z-score, cash-futures basis.",
      trigger:"Normal <30% · Watch 30-40% · Elevated >40% · Critical >50%",
      action:"Review overlap with peer 13Fs. Trim names where HF ownership >30% of float."},
    {id:"correlation",name:"Correlation",metric:"Avg ρ",value:"0.58",status:"Watch",
      def:"Intra-portfolio pairwise correlation, cross-asset (eq-credit, eq-FX), Barra factor correlation, beta dispersion.",
      trigger:"Normal ρ<0.5 · Watch 0.5-0.7 · Elevated >0.7 · Critical >0.85",
      action:"Stress-test under correlation=1 scenario."},
    {id:"vix",name:"VIX",value:null,status:"Normal",live:true,ticker:"VIX",metric:"Level",
      def:"CBOE VIX — 30-day S&P 500 implied vol.",
      trigger:"Normal <20 · Watch 20-25 · Elevated 25-30 · Critical >30",action:"Review vol-sensitive positions."},
    {id:"vix_term",name:"VIX Term",value:null,status:"Normal",live:true,ticker:"VIX_TERM",metric:"VIX/VIX3M",
      def:"Spot VIX / 3M VIX ratio. Inversion = acute near-term fear.",
      trigger:"Normal <0.95 · Watch 0.95-1.05 · Elevated 1.05-1.15 · Critical >1.15",action:"If inverted: assume systematic selling imminent."},
    {id:"vvix",name:"VVIX",value:null,status:"Normal",live:true,ticker:"VVIX",metric:"Level",
      def:"Vol of VIX. Tail hedge cost proxy.",
      trigger:"Normal <90 · Watch 90-100 · Elevated 100-120 · Critical >120",action:"Verify tail hedges sized."},
    {id:"move",name:"MOVE",value:null,status:"Normal",live:true,ticker:"MOVE",metric:"Level",
      def:"ICE BofAML MOVE — rates implied vol. Often leads equity vol.",
      trigger:"Normal <100 · Watch 100-120 · Elevated 120-140 · Critical >140",action:"Review duration & rates RV book."},
    {id:"squeeze",name:"Squeeze Risk",metric:"DTC",value:"3.2d",status:"Watch",
      def:"Short interest % float, days-to-cover, borrow costs, Goldman GSCBMSAL basket.",
      trigger:"Normal DTC<3 · Watch 3-5 · Elevated 5-8 · Critical >8",action:"Review short book for rising borrow costs."},
  ]},
  "Leverage":{icon:"📊",desc:"Gross/net leverage, repo, derivatives notional, margin buffers.",relatedTags:["Leverage","Liquidity"],signals:[
    {id:"gross",name:"Gross Leverage",metric:"x NAV",value:"2.8x",status:"Normal",def:"Gross leverage by style from PB reports (GS, MS, JPM).",trigger:"Normal <3x · Watch 3-4x · Elevated 4-5x · Critical >5x",action:"Prepare deleveraging plan if approaching limit."},
    {id:"net",name:"Net Leverage",metric:"x NAV",value:"1.4x",status:"Normal",def:"Net leverage + L/S ratio skew.",trigger:"Normal <1.5x · Watch 1.5-2x · Elevated >2x",action:"Verify directional tilt is intentional."},
    {id:"repo",name:"Repo & Funding",metric:"Avg tenor",value:"8.2d",status:"Watch",def:"Repo outstanding, % of gross, avg tenor.",trigger:"Normal >14d · Watch 7-14d · Elevated <7d · Critical: >40% matures <48h",action:"Extend tenors, diversify counterparties."},
    {id:"deriv",name:"Derivatives",metric:"Delta-adj",value:"1.6x",status:"Normal",def:"Notional, delta-adj exposure, 30D growth.",trigger:"Normal <2x · Watch 2-3x · Elevated 3-5x · Critical >5x",action:"Review delta/gamma/vega exposures."},
    {id:"margin",name:"Margin Buffer",metric:"Util %",value:"72%",status:"Elevated",def:"Unemb cash %, margin util, excess margin days.",trigger:"Normal <50% · Watch 50-70% · Elevated 70-85% · Critical >85%",action:"Prepare liquidity waterfall. Alert treasury."},
  ]},
  "Liquidity":{icon:"💧",desc:"Market liquidity, funding costs, EM flows, redemption pressure.",relatedTags:["Liquidity","Redemption","Macro"],signals:[
    {id:"liq",name:"Liquidation Risk",metric:"Days 50%",value:"7d",status:"Normal",def:"Spreads, depth, liquidation days, illiquid %, gate usage.",trigger:"Normal <7d · Watch 7-10d · Elevated 10-20d · Critical >20d",action:"Pre-identify liquidation priority."},
    {id:"sofr",name:"SOFR",value:null,status:"Normal",live:true,ticker:"SOFR",metric:"Rate",def:"Secured O/N rate from NY Fed.",trigger:"Normal <4.5% · Watch 4.5-5% · Elevated 5-5.5% · Critical >5.5%",action:"Calculate funding cost P&L impact."},
    {id:"fund_stress",name:"Funding Stress",metric:"PB util",value:"58%",status:"Normal",def:"PB credit util, haircut changes, rollover cliff.",trigger:"Normal <50% · Watch 50-65% · Elevated 65-75% · Critical >75%",action:"Engage PB proactively."},
    {id:"redemption",name:"Redemptions",metric:"Flow %",value:"-1.2%",status:"Normal",def:"30D redemptions, net flow, LP concentration.",trigger:"Normal >-2% · Watch -2 to -5% · Elevated >-5% · Critical: top 3 LPs >50%",action:"Engage IR. Review gate provisions."},
    {id:"etf",name:"ETF Flows",value:null,status:"Normal",live:true,ticker:"SPY",metric:"Chg %",def:"SPY/QQQ/EEM daily change as flow proxy.",trigger:"Normal <1% · Watch 1-2% · Elevated 2-3% · Critical >3%",action:"Monitor dark pool prints."},
  ]},
  "Manager / Style":{icon:"🎯",desc:"RV positioning, strategy-specific basis risks, fees, talent.",relatedTags:["Talent","Performance","Concentration"],signals:[
    {id:"rv",name:"RV Stretch",metric:"Z-score",value:"1.8σ",status:"Normal",def:"Spread Z across RV pairs: rates curve, commodity calendar, FX carry, momentum vs value.",trigger:"Normal <2σ · Watch 2-2.5σ · Elevated >2.5σ",action:"Stress-test RV book."},
    {id:"rv_dd",name:"RV Drawdown",metric:"P&L/1σ",value:"$4.2M",status:"Watch",def:"Dollar P&L impact per 1σ adverse spread move.",trigger:"Flag if >2% NAV per 1σ",action:"Run scenario analysis. Define stop-losses."},
    {id:"cost",name:"Fee Drag",metric:"Gross vs Net",value:"4.1%",status:"Normal",def:"Pass-through expense ratio, PM comp % P&L, hurdle coverage.",trigger:"Normal <5% · Watch 5-7% · Elevated >7%",action:"Review fee sustainability for LPs."},
    {id:"talent",name:"Talent",metric:"Turnover",value:"12%",status:"Normal",def:"PM turnover 12M, onboarding cost per PM.",trigger:"Normal <15% · Watch 15-20% · Elevated >20%",action:"Assess strategy continuity."},
  ]},
};

const THEMES = [
  {name:"Long Mega-Cap AI / Big Tech",status:"Watch",risk:"Momentum unwind, AI capex slowdown"},
  {name:"Long EM Rotation",status:"Normal",risk:"Dollar rally, geopolitical shocks"},
  {name:"Long Industrials & Defence",status:"Normal",risk:"Fiscal turning, PMI <50"},
  {name:"Long Financials / Banks",status:"Normal",risk:"HY spreads >150bps"},
  {name:"Short Software / SaaS",status:"Watch",risk:"SI >20% float, squeeze if rates pivot"},
];

const SC={Normal:{c:"var(--green)",bg:"var(--green-bg)",bd:"var(--green-bd)",dot:"#0d9455",ring:"rgba(13,148,85,0.10)"},Watch:{c:"var(--yellow)",bg:"var(--yellow-bg)",bd:"var(--yellow-bd)",dot:"#c27c00",ring:"rgba(194,124,0,0.10)"},Elevated:{c:"var(--orange)",bg:"var(--orange-bg)",bd:"var(--orange-bd)",dot:"#c24e00",ring:"rgba(194,78,0,0.12)"},Critical:{c:"var(--red)",bg:"var(--red-bg)",bd:"var(--red-bd)",dot:"#c92a2a",ring:"rgba(201,42,42,0.15)"},Unknown:{c:"var(--gray)",bg:"var(--gray-bg)",bd:"var(--border)",dot:"#868e9e",ring:"rgba(0,0,0,0.04)"}};
const SO=["Normal","Watch","Elevated","Critical","Unknown"];
function worst(a){let w=0;a.forEach(s=>{const i=SO.indexOf(s);if(i>w)w=i});return SO[w];}
function timeAgo(iso){if(!iso)return"";const m=Math.floor((Date.now()-new Date(iso).getTime())/60000);if(m<1)return"now";if(m<60)return m+"m";const h=Math.floor(m/60);if(h<24)return h+"h";return Math.floor(h/24)+"d";}
const SENT={positive:"#0d9455",negative:"#c92a2a",neutral:"#8c92a8"};
const TAG_C={Concentration:"#7c3aed",Leverage:"#db2777",Liquidity:"#0891b2",Redemption:"#c24e00",Regulatory:"#c92a2a",Performance:"#0d9455",Talent:"#6366f1",Macro:"#525973"};

function getStatus(sig,live,saved){
  if(sig.live&&sig.ticker&&live?.indicators){const k=sig.ticker;if(live.indicators[k]?.status)return live.indicators[k].status;}
  // Check saved signals from PB reports
  if(saved?.latest?.signals){const s=saved.latest.signals.find(x=>x.id===sig.id);if(s?.status)return s.status;}
  return sig.status;
}
function getValue(sig,live,saved){
  if(sig.live&&sig.ticker&&live?.indicators){const d=live.indicators[sig.ticker];if(d&&d.value!=null){if(sig.ticker==="SOFR")return d.value+"%";if(sig.ticker==="VIX_TERM")return d.value;return d.value.toLocaleString(undefined,{maximumFractionDigits:2});}}
  // Check saved signals from PB reports
  if(saved?.latest?.signals){const s=saved.latest.signals.find(x=>x.id===sig.id);if(s?.value)return s.value;}
  return sig.value;
}
// Get previous month status from saved history (for non-live signals)
function getSavedPrevStatus(sig,saved){
  if(!saved?.previous?.signals)return null;
  const s=saved.previous.signals.find(x=>x.id===sig.id);
  return s?.status||null;
}

function getAlerts(liveData,savedSignals){
  const alerts=[];
  Object.entries(SIGNALS).forEach(([domain,area])=>{area.signals.forEach(s=>{
    const st=getStatus(s,liveData,savedSignals);const val=getValue(s,liveData,savedSignals)||s.value;
    if(st!=="Normal")alerts.push({level:st,domain,signal:s.name,value:val,icon:area.icon});
  });});
  alerts.sort((a,b)=>SO.indexOf(b.level)-SO.indexOf(a.level));
  return alerts;
}

function Pulse({color,size=5}){return <span style={{position:"relative",display:"inline-block",width:size,height:size}}><span style={{position:"absolute",inset:-2,borderRadius:"50%",background:color,opacity:0.3,animation:"pr 2s ease-out infinite"}}/><span style={{display:"block",width:size,height:size,borderRadius:"50%",background:color}}/></span>;}

/* ── Threat Level ── */
function ThreatLevel({liveData,savedSignals}){
  const all=Object.values(SIGNALS).flatMap(a=>a.signals.map(s=>getStatus(s,liveData,savedSignals)));
  const overall=worst(all);const sc=SC[overall];
  const counts={Critical:0,Elevated:0,Watch:0,Normal:0};all.forEach(s=>{if(counts[s]!==undefined)counts[s]++;});
  return <div style={{background:sc.bg,border:`2px solid ${sc.bd}`,borderRadius:14,padding:"18px 24px",display:"flex",alignItems:"center",gap:20,boxShadow:`0 0 30px ${sc.ring}`}}>
    <div style={{width:64,height:64,borderRadius:"50%",flexShrink:0,background:`radial-gradient(circle at 40% 35%,${sc.dot}22,${sc.dot}08)`,border:`3px solid ${sc.dot}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{fontFamily:"var(--f)",fontSize:10,fontWeight:800,color:sc.c,textTransform:"uppercase",textAlign:"center",lineHeight:1.2}}>{overall}</div>
    </div>
    <div style={{flex:1}}>
      <div style={{fontFamily:"var(--f)",fontSize:9,fontWeight:700,letterSpacing:"0.1em",color:sc.c,textTransform:"uppercase",marginBottom:3}}>Overall Risk Assessment</div>
      <div style={{fontFamily:"var(--fb)",fontSize:13,fontWeight:600,color:"var(--text)",lineHeight:1.5,marginBottom:6}}>
        {overall==="Critical"?"Immediate action required across multiple risk domains."
         :overall==="Elevated"?"Active risk signals detected. Review flagged domains below."
         :overall==="Watch"?"Several indicators approaching thresholds. Monitoring conditions."
         :"All risk signals within normal bounds. No action required."}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {["Critical","Elevated","Watch","Normal"].map(s=>{const ssc=SC[s];return <div key={s} style={{display:"flex",alignItems:"center",gap:3}}><span style={{fontFamily:"var(--f)",fontSize:16,fontWeight:800,color:counts[s]>0?ssc.c:"#c8cdd8"}}>{counts[s]}</span><span style={{fontFamily:"var(--f)",fontSize:8,fontWeight:700,color:counts[s]>0?ssc.c:"var(--text-m)",textTransform:"uppercase"}}>{s}</span></div>;})}
      </div>
    </div>
  </div>;
}

/* ── Consolidated Live Card ── */
function LiveCard({question,mainLabel,mainValue,mainChg,mainStatus,subs,percentile,zScore,high52w,low52w,cumulative5d,chart30d}){
  const [showChart,setShowChart]=React.useState(false);
  const allSt=[mainStatus,...(subs||[]).map(s=>s.status)].filter(Boolean);const w=worst(allSt);const sc=SC[w];const up=mainChg&&!String(mainChg).startsWith("-");
  let pctColor="var(--green)";
  if(percentile!=null){if(percentile>=90)pctColor="var(--red)";else if(percentile>=75)pctColor="var(--orange)";else if(percentile>=60)pctColor="var(--yellow)";}

  // SVG sparkline from chart30d
  function Sparkline({data,color}){
    if(!data||data.length<2) return null;
    const vals=data.map(d=>d.v);const mn=Math.min(...vals);const mx=Math.max(...vals);const range=mx-mn||1;
    const w=280;const h=60;const pad=2;
    const pts=vals.map((v,i)=>{const x=pad+(i/(vals.length-1))*(w-pad*2);const y=h-pad-((v-mn)/range)*(h-pad*2);return `${x},${y}`;});
    const lastVal=vals[vals.length-1];const firstVal=vals[0];const trendUp=lastVal>=firstVal;
    return <div style={{marginTop:8}}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:60}}>
        <defs><linearGradient id={`grad-${mainLabel}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.15"/><stop offset="100%" stopColor={color} stopOpacity="0.02"/></linearGradient></defs>
        <polygon points={`${pad},${h} ${pts.join(" ")} ${w-pad},${h}`} fill={`url(#grad-${mainLabel})`}/>
        <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx={parseFloat(pts[pts.length-1].split(",")[0])} cy={parseFloat(pts[pts.length-1].split(",")[1])} r="2.5" fill={color}/>
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",fontFamily:"var(--f)",fontSize:7,color:"var(--text-m)",marginTop:2}}>
        <span>{data[0].d}</span>
        <span style={{color:trendUp?"var(--red)":"var(--green)",fontWeight:500}}>30D: {trendUp?"+":""}{((lastVal-firstVal)/firstVal*100).toFixed(1)}%</span>
        <span>{data[data.length-1].d}</span>
      </div>
    </div>;
  }

  return <div style={{flex:"1 1 220px",background:"var(--card)",border:`1px solid ${w!=="Normal"?sc.bd:"var(--border)"}`,borderRadius:10,padding:"10px 14px",minWidth:200,boxShadow:w!=="Normal"?`0 1px 8px ${sc.ring}`:"var(--sh)",cursor:"pointer",transition:"all 0.15s"}} onClick={()=>setShowChart(!showChart)}>
    <div style={{fontFamily:"var(--fb)",fontSize:10,fontWeight:600,color:"var(--text-s)",marginBottom:6,lineHeight:1.3}}>{question}</div>
    <div style={{display:"flex",alignItems:"flex-end",gap:8,marginBottom:6}}>
      <div><div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}><Pulse color={sc.dot}/><span style={{fontFamily:"var(--f)",fontSize:8,fontWeight:500,letterSpacing:"0.06em",color:sc.c}}>{mainLabel}</span></div>
        <div style={{fontFamily:"var(--f)",fontSize:20,fontWeight:500,color:"var(--text)",lineHeight:1}}>{mainValue||"---"}</div></div>
      <div style={{marginLeft:"auto",textAlign:"right"}}>
        {mainChg!=null&&<div style={{fontFamily:"var(--f)",fontSize:9,fontWeight:500,color:up?"var(--red)":"var(--green)",marginBottom:2}}>{up?"▲":"▼"} {String(mainChg).replace("-","")}</div>}
        <div style={{fontFamily:"var(--f)",fontSize:8,fontWeight:500,color:sc.c,background:sc.bg,padding:"2px 6px",borderRadius:3,border:`1px solid ${sc.bd}`,textTransform:"uppercase",display:"inline-block"}}>{mainStatus||"..."}</div>
      </div>
    </div>

    {/* Percentile bar */}
    {percentile!=null&&<div style={{marginBottom:6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
        <span style={{fontFamily:"var(--f)",fontSize:8,color:"var(--text-m)"}}>1Y Percentile</span>
        <span style={{fontFamily:"var(--f)",fontSize:9,fontWeight:500,color:pctColor}}>{percentile}th</span>
      </div>
      <div style={{height:4,background:"var(--surface)",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${percentile}%`,background:pctColor,borderRadius:2}}/>
      </div>
      {high52w!=null&&low52w!=null&&<div style={{display:"flex",justifyContent:"space-between",marginTop:1}}>
        <span style={{fontFamily:"var(--f)",fontSize:7,color:"var(--text-m)"}}>{low52w}</span>
        <span style={{fontFamily:"var(--f)",fontSize:7,color:"var(--text-m)"}}>{high52w}</span>
      </div>}
    </div>}

    {/* Z-score alert */}
    {zScore!=null&&Math.abs(zScore)>=1.5&&<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:5,padding:"3px 6px",borderRadius:4,background:Math.abs(zScore)>=2?"var(--red-bg)":"var(--yellow-bg)",border:`1px solid ${Math.abs(zScore)>=2?"var(--red-bd)":"var(--yellow-bd)"}`}}>
      <span style={{fontFamily:"var(--f)",fontSize:8,fontWeight:500,color:Math.abs(zScore)>=2?"var(--red)":"var(--yellow)"}}>⚠ Today: {zScore>0?"+":""}{zScore}σ {Math.abs(zScore)>=2?"unusual":"notable"}</span>
    </div>}

    {/* 5-day cumulative */}
    {cumulative5d!=null&&<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:5}}>
      <span style={{fontFamily:"var(--f)",fontSize:8,color:"var(--text-m)"}}>5D:</span>
      <span style={{fontFamily:"var(--f)",fontSize:9,fontWeight:500,color:cumulative5d<=-2?"var(--red)":cumulative5d<0?"var(--yellow)":"var(--green)"}}>{cumulative5d>=0?"+":""}{cumulative5d}%</span>
      {cumulative5d<=-3&&<span style={{fontFamily:"var(--f)",fontSize:6,fontWeight:500,color:"var(--red)",background:"var(--red-bg)",padding:"1px 3px",borderRadius:2,border:"1px solid var(--red-bd)"}}>SUSTAINED</span>}
    </div>}

    {/* 30-day chart (expandable) */}
    {showChart&&chart30d&&<Sparkline data={chart30d} color={sc.dot}/>}
    {!showChart&&chart30d&&<div style={{fontFamily:"var(--f)",fontSize:7,color:"var(--text-m)",textAlign:"center",marginTop:4}}>Click for 30D chart</div>}

    {/* Sub-indicators */}
    {subs&&subs.length>0&&<div style={{borderTop:"1px solid var(--surface)",paddingTop:5,display:"flex",flexDirection:"column",gap:3}}>
      {subs.map((s,i)=>{const ssc=SC[s.status]||SC.Unknown;return <div key={i} style={{display:"flex",alignItems:"center",gap:5}}>
        <div style={{width:3,height:3,borderRadius:"50%",background:ssc.dot}}/><span style={{fontFamily:"var(--f)",fontSize:9,color:"var(--text-s)",flex:1}}>{s.label}</span><span style={{fontFamily:"var(--f)",fontSize:9,fontWeight:500,color:"var(--text)"}}>{s.value||"--"}</span>
        {s.status&&s.status!=="Normal"&&<span style={{fontFamily:"var(--f)",fontSize:6,fontWeight:500,color:ssc.c,background:ssc.bg,padding:"1px 3px",borderRadius:2,border:`1px solid ${ssc.bd}`,textTransform:"uppercase"}}>{s.status}</span>}
      </div>;})}
    </div>}
  </div>;
}

/* ── Domain Card ── */
function DomainCard({name,icon,signals,liveData}){
  const statuses=signals.map(s=>getStatus(s,liveData,savedSignals));const w=worst(statuses);const sc=SC[w];const flagged=statuses.filter(s=>s!=="Normal").length;
  return <div style={{flex:"1 1 220px",background:"var(--card)",border:`1.5px solid ${flagged>0?sc.bd:"var(--border)"}`,borderRadius:12,padding:"14px 16px",boxShadow:flagged>0?`0 2px 12px ${sc.ring}`:"var(--sh)"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>{icon}</span><span style={{fontFamily:"var(--fb)",fontSize:14,fontWeight:700}}>{name}</span></div>
      <div style={{fontFamily:"var(--f)",fontSize:10,fontWeight:800,color:sc.c,background:sc.bg,padding:"3px 10px",borderRadius:5,border:`1px solid ${sc.bd}`,textTransform:"uppercase"}}>{w}</div>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      {signals.filter(s=>flagged>0?getStatus(s,liveData,savedSignals)!=="Normal":true).slice(0,3).map(s=>{
        const st=getStatus(s,liveData,savedSignals);const ssc=SC[st];const val=getValue(s,liveData,savedSignals)||s.value;
        return <div key={s.id} style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:4,height:4,borderRadius:"50%",background:ssc.dot}}/><span style={{fontFamily:"var(--fb)",fontSize:11,flex:1}}>{s.name}</span><span style={{fontFamily:"var(--f)",fontSize:11,fontWeight:700}}>{val}</span><span style={{fontFamily:"var(--f)",fontSize:8,fontWeight:700,color:ssc.c,minWidth:50,textAlign:"right"}}>{st}</span>
        </div>;
      })}
      {flagged>0&&signals.filter(s=>getStatus(s,liveData,savedSignals)==="Normal").length>0&&<div style={{fontFamily:"var(--f)",fontSize:9,color:"var(--text-m)",marginTop:2}}>+ {signals.filter(s=>getStatus(s,liveData,savedSignals)==="Normal").length} normal</div>}
    </div>
  </div>;
}

/* ── Alerts ── */
function TopAlerts({liveData,savedSignals}){
  const [expanded,setExpanded]=React.useState(false);
  const alerts=getAlerts(liveData,savedSignals);if(!alerts.length)return <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:20,textAlign:"center",boxShadow:"var(--sh)"}}><div style={{fontFamily:"var(--f)",fontSize:10,color:"var(--green)",fontWeight:500}}>ALL CLEAR — No priority alerts</div></div>;
  const shown=expanded?alerts:alerts.slice(0,5);
  return <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden",boxShadow:"var(--sh)"}}>
    <div style={{padding:"10px 16px",background:"#fafbfc",borderBottom:"1px solid #eaecf2",display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:14}}>🚨</span><span style={{fontFamily:"var(--fb)",fontSize:13,fontWeight:700}}>Priority Alerts</span><span style={{fontFamily:"var(--f)",fontSize:9,color:"var(--text-m)",marginLeft:"auto"}}>{alerts.length} flagged</span></div>
    <div style={{maxHeight:expanded?400:"none",overflowY:expanded?"auto":"visible"}}>
      {shown.map((a,i)=>{const sc=SC[a.level];return <div key={i} style={{padding:"9px 16px",borderBottom:"1px solid #f5f6f8",display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:4,height:26,borderRadius:2,background:sc.dot}}/><span style={{fontSize:13}}>{a.icon}</span>
        <div style={{flex:1}}><div style={{fontFamily:"var(--fb)",fontSize:12,fontWeight:600}}>{a.signal}</div><div style={{fontFamily:"var(--f)",fontSize:9,color:"var(--text-m)"}}>{a.domain}</div></div>
        <span style={{fontFamily:"var(--f)",fontSize:13,fontWeight:500}}>{a.value}</span>
        <span style={{fontFamily:"var(--f)",fontSize:8,fontWeight:500,color:sc.c,background:sc.bg,padding:"2px 7px",borderRadius:3,border:`1px solid ${sc.bd}`,textTransform:"uppercase"}}>{a.level}</span>
      </div>;})}
    </div>
    {alerts.length>5&&<div onClick={()=>setExpanded(!expanded)} style={{padding:"8px 16px",borderTop:"1px solid #eaecf2",background:"#fafbfc",fontFamily:"var(--f)",fontSize:10,fontWeight:500,color:"var(--accent)",cursor:"pointer",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:4,transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"} onMouseLeave={e=>e.currentTarget.style.background="#fafbfc"}>
      <span style={{transform:expanded?"rotate(180deg)":"rotate(0)",transition:"transform 0.2s",display:"inline-block",fontSize:8}}>▼</span>
      {expanded?"Show less":"View all "+alerts.length+" alerts"}
    </div>}
  </div>;
}

/* ── Themes ── */
function ThemesCompact(){
  return <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden",boxShadow:"var(--sh)"}}>
    <div style={{padding:"10px 16px",background:"#fafbfc",borderBottom:"1px solid #eaecf2",display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:14}}>🎯</span><span style={{fontFamily:"var(--fb)",fontSize:13,fontWeight:700}}>Crowded Themes</span></div>
    {THEMES.map((t,i)=>{const sc=SC[t.status];return <div key={i} style={{padding:"8px 16px",borderBottom:"1px solid #f5f6f8"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:t.status!=="Normal"?2:0}}><div style={{width:4,height:4,borderRadius:"50%",background:sc.dot}}/><span style={{fontFamily:"var(--fb)",fontSize:12,fontWeight:600,flex:1}}>{t.name}</span><span style={{fontFamily:"var(--f)",fontSize:8,fontWeight:800,color:sc.c,background:sc.bg,padding:"2px 6px",borderRadius:3,border:`1px solid ${sc.bd}`,textTransform:"uppercase"}}>{t.status}</span></div>
      {t.status!=="Normal"&&<div style={{fontFamily:"var(--fb)",fontSize:10,color:"var(--text-m)",paddingLeft:10,lineHeight:1.4}}>Risk: {t.risk}</div>}
    </div>;})}
  </div>;
}

/* ── Action News ── */
function ActionNews({articles}){
  const [expanded,setExpanded]=React.useState(false);
  const [filter,setFilter]=React.useState("negative");
  const negative=articles.filter(n=>n.sentiment==="negative");
  const all=articles;
  const filtered=expanded?(filter==="all"?all:articles.filter(n=>n.sentiment===filter)):negative.slice(0,3);
  const counts={all:all.length,negative:negative.length,neutral:articles.filter(n=>n.sentiment==="neutral").length,positive:articles.filter(n=>n.sentiment==="positive").length};

  return <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden",boxShadow:"var(--sh)"}}>
    <div style={{padding:"10px 16px",background:"#fafbfc",borderBottom:"1px solid #eaecf2",display:"flex",alignItems:"center",gap:6}}>
      <span style={{fontSize:14}}>📰</span><span style={{fontFamily:"var(--fb)",fontSize:13,fontWeight:700}}>Headlines to Watch</span>
      <span style={{fontFamily:"var(--f)",fontSize:9,color:"var(--text-m)",marginLeft:"auto"}}>{negative.length} actionable</span>
    </div>

    {/* Filter tabs when expanded */}
    {expanded&&<div style={{display:"flex",borderBottom:"1px solid #eaecf2",background:"#fafbfc",padding:"0 12px"}}>
      {[{id:"negative",label:"Actionable",color:"#c92a2a"},{id:"all",label:"All",color:"var(--text-s)"},{id:"neutral",label:"Neutral",color:"#8c92a8"},{id:"positive",label:"Positive",color:"#0d9455"}].map(t=>
        <div key={t.id} onClick={()=>setFilter(t.id)} style={{padding:"6px 10px",fontFamily:"var(--f)",fontSize:9,fontWeight:600,cursor:"pointer",color:filter===t.id?t.color:"var(--text-m)",borderBottom:filter===t.id?`2px solid ${t.color}`:"2px solid transparent",display:"flex",alignItems:"center",gap:4}}>
          {t.label}<span style={{fontSize:8,opacity:0.7}}>({counts[t.id]})</span>
        </div>
      )}
    </div>}

    {/* Articles list */}
    <div style={{maxHeight:expanded?400:"none",overflowY:expanded?"auto":"visible"}}>
      {filtered.length===0&&<div style={{padding:16,fontFamily:"var(--f)",fontSize:10,color:"var(--text-m)",textAlign:"center"}}>No headlines in this category</div>}
      {filtered.map((a,i)=>{
        const sentColor=SENT[a.sentiment]||SENT.neutral;
        const tagColor=TAG_C[a.riskTag]||"var(--text-m)";
        return <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" style={{display:"block",padding:"9px 16px",borderBottom:"1px solid #f5f6f8",textDecoration:"none",color:"inherit",transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <div style={{display:"flex",gap:7,alignItems:"flex-start"}}>
            <div style={{width:4,height:4,borderRadius:"50%",background:sentColor,marginTop:5,flexShrink:0}}/>
            <div><div style={{fontFamily:"var(--fb)",fontSize:12,color:"var(--text)",lineHeight:1.45,fontWeight:500}}>{a.fund&&<span style={{fontWeight:700,color:"var(--accent)"}}>{a.fund} — </span>}{a.title}</div>
              {a.insight&&<div style={{fontFamily:"var(--fb)",fontSize:10,color:"var(--accent)",marginTop:2,fontStyle:"italic"}}>→ {a.insight}</div>}
              <div style={{display:"flex",gap:5,marginTop:3,alignItems:"center"}}>{a.riskTag&&<span style={{fontFamily:"var(--f)",fontSize:7,fontWeight:700,color:tagColor,background:tagColor+"10",padding:"1px 4px",borderRadius:2,border:`1px solid ${tagColor}30`}}>{a.riskTag}</span>}{a.llmTagged&&<span style={{fontFamily:"var(--f)",fontSize:6,color:"var(--accent)",background:"var(--accent-bg)",padding:"1px 3px",borderRadius:2}}>AI</span>}<span style={{fontFamily:"var(--f)",fontSize:8,color:"var(--text-m)"}}>{a.publisher} · {timeAgo(a.publishedAt)}</span></div>
            </div>
          </div>
        </a>;
      })}
    </div>

    {/* Expand/collapse toggle */}
    <div onClick={()=>{setExpanded(!expanded);if(!expanded)setFilter("negative");}} style={{
      padding:"8px 16px",borderTop:"1px solid #eaecf2",background:"#fafbfc",
      fontFamily:"var(--f)",fontSize:10,fontWeight:600,color:"var(--accent)",
      cursor:"pointer",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:4,
      transition:"background 0.1s",
    }} onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"} onMouseLeave={e=>e.currentTarget.style.background="#fafbfc"}>
      <span style={{transform:expanded?"rotate(180deg)":"rotate(0)",transition:"transform 0.2s",display:"inline-block",fontSize:8}}>▼</span>
      {expanded?"Show less":"View all "+all.length+" headlines"}
    </div>
  </div>;
}

/* ── Detail Row ── */
function DetailRow({sig,liveData,expanded,onToggle}){
  const st=getStatus(sig,liveData);const sc=SC[st];const val=getValue(sig,liveData)||sig.value;
  return <div style={{borderBottom:"1px solid #f0f1f5"}}><div onClick={onToggle} style={{padding:"7px 14px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",transition:"background 0.1s",background:expanded?"#f8f9fb":"transparent"}} onMouseEnter={e=>{if(!expanded)e.currentTarget.style.background="#fafbfc"}} onMouseLeave={e=>{if(!expanded)e.currentTarget.style.background="transparent"}}>
    <div style={{width:3,height:22,borderRadius:2,background:sc.dot}}/><span style={{fontFamily:"var(--fb)",fontSize:12,fontWeight:500,flex:1}}>{sig.name}{sig.live&&<span style={{fontFamily:"var(--f)",fontSize:7,color:"var(--green)",background:"var(--green-bg)",padding:"1px 3px",borderRadius:2,fontWeight:700,border:"1px solid var(--green-bd)",marginLeft:4}}>LIVE</span>}</span>
    <span style={{fontFamily:"var(--f)",fontSize:12,fontWeight:700,minWidth:55,textAlign:"right"}}>{val}</span>
    <span style={{fontFamily:"var(--f)",fontSize:8,fontWeight:800,color:sc.c,background:sc.bg,padding:"2px 7px",borderRadius:3,border:`1px solid ${sc.bd}`,textTransform:"uppercase",minWidth:60,textAlign:"center"}}>{st}</span>
    <div style={{color:"var(--border-s)",fontSize:10,transition:"transform 0.15s",transform:expanded?"rotate(90deg)":"rotate(0)"}}>▶</div>
  </div>
  {expanded&&<div style={{padding:"6px 14px 10px 26px",borderTop:"1px solid #f0f1f5",animation:"fadeUp 0.15s ease-out"}}>
    <div style={{fontFamily:"var(--fb)",fontSize:11,color:"var(--text-s)",lineHeight:1.6,marginBottom:5}}>{sig.def}</div>
    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:140}}><div style={{fontFamily:"var(--f)",fontSize:8,fontWeight:700,color:"var(--text-m)",textTransform:"uppercase",marginBottom:2}}>Thresholds</div><div style={{fontFamily:"var(--f)",fontSize:9,color:"var(--text-s)",lineHeight:1.5}}>{sig.trigger}</div></div>
      <div style={{flex:1,minWidth:140}}><div style={{fontFamily:"var(--f)",fontSize:8,fontWeight:700,color:"var(--text-m)",textTransform:"uppercase",marginBottom:2}}>Action</div><div style={{fontFamily:"var(--fb)",fontSize:11,color:"var(--text)",lineHeight:1.4}}>{sig.action}</div></div>
    </div>
  </div>}</div>;
}

/* ═══ RISK GUIDE ═══ */
function RiskGuide({onClose}){
  const [tab,setTab]=React.useState("overview");
  const tabs=[{id:"overview",l:"Overview"},{id:"signals",l:"Signals"},{id:"feeds",l:"Live Feeds"}];
  return <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",animation:"fadeUp 0.2s ease-out"}}>
    <div style={{padding:"10px 16px",borderBottom:"1px solid #eaecf2",background:"#fafbfc",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:14}}>📖</span><span style={{fontFamily:"var(--fb)",fontSize:13,fontWeight:700}}>Risk Guide & Methodology</span></div>
      <span onClick={onClose} style={{cursor:"pointer",color:"var(--text-m)",fontSize:16,width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:5,transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>×</span>
    </div>
    <div style={{display:"flex",borderBottom:"1px solid #eaecf2",background:"#fafbfc"}}>{tabs.map(t=><div key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 16px",fontFamily:"var(--f)",fontSize:9,fontWeight:600,color:tab===t.id?"var(--accent)":"var(--text-m)",borderBottom:tab===t.id?"2px solid var(--accent)":"2px solid transparent",cursor:"pointer"}}>{t.l}</div>)}</div>
    <div style={{maxHeight:700,overflowY:"auto",padding:"16px"}}>

      {tab==="overview"&&<div>
        <h3 style={{fontFamily:"var(--fb)",fontSize:14,fontWeight:700,marginBottom:6}}>Methodology</h3>
        <p style={{fontFamily:"var(--fb)",fontSize:12,color:"var(--text-s)",lineHeight:1.7,marginBottom:14}}>This platform monitors hedge fund risk across four domains: Concentration, Leverage, Liquidity, and Manager/Style. 43+ underlying indicators consolidate into 21 actionable signals. 8 live market feeds refresh every 15 minutes during US market hours. A Crowded Themes widget tracks top consensus HF positions with their specific risk triggers.</p>

        <h3 style={{fontFamily:"var(--fb)",fontSize:14,fontWeight:700,marginBottom:6}}>Classification Methodology</h3>
        <p style={{fontFamily:"var(--fb)",fontSize:12,color:"var(--text-s)",lineHeight:1.7,marginBottom:10}}>Each of the 21 signals is classified into one of four risk levels based on pre-defined thresholds. These thresholds are calibrated against historical data, regulatory guidelines, and industry best practice.</p>

        {[
          {s:"Normal",d:"All underlying indicators within acceptable bounds. No action required.",detail:"The signal is operating within its expected range based on 1-year historical context. For live feeds, the value is below the first threshold (e.g. VIX <20, MOVE <100, SOFR <4.5%). For non-live signals, the metric is within its mandate or benchmark range."},
          {s:"Watch",d:"Approaching threshold. Monitor actively; prepare contingency.",detail:"The signal has entered a transitional zone — not yet breached, but trending toward stress. This is the early warning. Examples: VIX 20-25, correlation ρ 0.5-0.7, margin utilisation 50-70%, short interest days-to-cover 3-5. Action: increase monitoring frequency, review hedges, prepare contingency plans."},
          {s:"Elevated",d:"Threshold breached. Immediate review required. Escalate to risk committee.",detail:"The signal has crossed into a historically unusual range that typically precedes adverse portfolio impact. Examples: VIX 25-30, MOVE 120-140, margin utilisation 70-85%, repo tenor <7 days, redemptions >5% NAV in 30 days. Action: escalate to CIO/risk committee, execute pre-defined risk reduction, verify counterparty exposure."},
          {s:"Critical",d:"Severe risk. Execute pre-defined response plan. Notify senior management.",detail:"The signal is at an extreme level associated with market dislocations, forced liquidations, or systemic stress events. Examples: VIX >30, MOVE >140, VIX term structure deeply inverted (>1.15), margin utilisation >85%, top 3 LPs >50% AUM. Action: activate crisis playbook, notify board/senior management, execute immediate de-risking, engage legal/compliance."}
        ].map(item=>{const sc=SC[item.s];return <div key={item.s} style={{marginBottom:12,padding:"10px 14px",background:sc.bg,border:`1px solid ${sc.bd}`,borderRadius:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <div style={{fontFamily:"var(--f)",fontSize:9,fontWeight:500,color:sc.c,background:"#fff",padding:"3px 10px",borderRadius:4,border:`1px solid ${sc.bd}`,textTransform:"uppercase",flexShrink:0}}>{item.s}</div>
            <div style={{fontFamily:"var(--fb)",fontSize:12,fontWeight:600,color:"var(--text)"}}>{item.d}</div>
          </div>
          <div style={{fontFamily:"var(--fb)",fontSize:11,color:"var(--text-s)",lineHeight:1.6}}>{item.detail}</div>
        </div>;})}

        <h3 style={{fontFamily:"var(--fb)",fontSize:14,fontWeight:700,marginBottom:6,marginTop:14}}>How Classification is Determined</h3>
        <div style={{fontFamily:"var(--fb)",fontSize:12,color:"var(--text-s)",lineHeight:1.7,marginBottom:10}}>
          <p style={{marginBottom:6}}><strong style={{color:"var(--text)"}}>Live feeds (8 signals):</strong> Classification is automatic based on real-time values against fixed thresholds. For example, when VIX crosses 25, the Equity Vol signal moves from Watch to Elevated instantly on the next refresh cycle (every 15 minutes).</p>
          <p style={{marginBottom:6}}><strong style={{color:"var(--text)"}}>Non-live signals (13 signals):</strong> These are updated manually based on prime broker reports, 13F filings, fund administrator data, and risk system outputs. Classification uses the same threshold framework but sourced from periodic data (daily, weekly, or monthly depending on the signal).</p>
          <p style={{marginBottom:6}}><strong style={{color:"var(--text)"}}>Percentile context:</strong> For live feeds, a 1-year percentile rank provides additional context. A VIX of 25 at the 90th percentile (higher than 90% of the past year) is more concerning than a VIX of 25 at the 60th percentile, even though both trigger Elevated status.</p>
          <p><strong style={{color:"var(--text)"}}>Domain-level rollup:</strong> Each domain's status is the worst (highest severity) among its constituent signals. The overall threat level is the worst across all 4 domains. This ensures no critical signal is hidden by averaging.</p>
        </div>

        <h3 style={{fontFamily:"var(--fb)",fontSize:14,fontWeight:700,marginBottom:6,marginTop:14}}>Escalation Logic</h3>
        <p style={{fontFamily:"var(--fb)",fontSize:12,color:"var(--text-s)",lineHeight:1.7,marginBottom:10}}>Each domain's status is the worst among its signals. The overall threat level is the worst across all 21 signals. The Command Center banner auto-generates a plain-English summary. Priority Alerts surface the top non-normal signals sorted by severity.</p>

        <h3 style={{fontFamily:"var(--fb)",fontSize:14,fontWeight:700,marginBottom:6,marginTop:14}}>Risk Domains</h3>
        {Object.entries(SIGNALS).map(([name,area])=><div key={name} style={{marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}><span style={{fontSize:14}}>{area.icon}</span><span style={{fontFamily:"var(--fb)",fontSize:13,fontWeight:700}}>{name}</span><span style={{fontFamily:"var(--f)",fontSize:10,color:"var(--text-m)"}}>{area.signals.length} signals</span></div>
          <p style={{fontFamily:"var(--fb)",fontSize:11,color:"var(--text-s)",lineHeight:1.6,paddingLeft:22}}>{area.desc}</p>
        </div>)}

        <h3 style={{fontFamily:"var(--fb)",fontSize:14,fontWeight:700,marginBottom:6,marginTop:14}}>Improvements Beyond Original Requirements</h3>
        <div style={{fontFamily:"var(--fb)",fontSize:11,color:"var(--text-s)",lineHeight:1.65}}>
          <p style={{marginBottom:6}}><strong style={{color:"var(--text)"}}>Added:</strong> MOVE index (rates vol), VIX term structure (contango/backwardation as leading indicator), EEM (EM flows), Crowded Themes widget with risk triggers, strategy-specific RV examples, Gross PnL vs Net PnL metric, Form PF/OFR/CFTC data source references.</p>
          <p style={{marginBottom:6}}><strong style={{color:"var(--text)"}}>Cross-domain linking:</strong> Signals flag compounding risks (e.g. leverage rising while liquidity dries up). VIX term structure fires before VIX level alone — gives 1-2 days earlier warning.</p>
          <p><strong style={{color:"var(--text)"}}>Future additions:</strong> FRA-OIS spread live feed (requires Bloomberg), CFTC COT weekly parser, Goldman GSTHHFHI basket feed, PCA analysis for crowding detection.</p>
        </div>
      </div>}

      {tab==="signals"&&<div>
        {Object.entries(SIGNALS).map(([name,area])=><div key={name} style={{marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,paddingBottom:5,borderBottom:"1px solid #eaecf2"}}><span style={{fontSize:14}}>{area.icon}</span><span style={{fontFamily:"var(--fb)",fontSize:14,fontWeight:700}}>{name}</span></div>
          {area.signals.map(sig=>{const sc=SC[sig.status];return <div key={sig.id} style={{marginBottom:12,paddingLeft:6,borderLeft:`3px solid ${sc.dot}`,paddingBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,paddingLeft:8}}>
              <span style={{fontFamily:"var(--fb)",fontSize:12,fontWeight:700}}>{sig.name}</span>
              {sig.live&&<span style={{fontFamily:"var(--f)",fontSize:7,color:"var(--green)",background:"var(--green-bg)",padding:"1px 4px",borderRadius:2,fontWeight:700,border:"1px solid var(--green-bd)"}}>LIVE</span>}
              <span style={{fontFamily:"var(--f)",fontSize:9,color:"var(--text-m)",marginLeft:"auto"}}>{sig.metric}</span>
            </div>
            <div style={{paddingLeft:8}}>
              <p style={{fontFamily:"var(--fb)",fontSize:11,color:"var(--text-s)",lineHeight:1.6,marginBottom:4}}>{sig.def}</p>
              <div style={{fontFamily:"var(--f)",fontSize:9,color:"var(--text-m)",marginBottom:3}}><span style={{fontWeight:700}}>Thresholds: </span>{sig.trigger}</div>
              <div style={{fontFamily:"var(--fb)",fontSize:11,color:"var(--text)"}}><span style={{fontFamily:"var(--f)",fontSize:9,fontWeight:700,color:"var(--text-m)"}}>Action: </span>{sig.action}</div>
            </div>
          </div>;})}
        </div>)}
      </div>}

      {tab==="feeds"&&<div>
        <p style={{fontFamily:"var(--fb)",fontSize:12,color:"var(--text-s)",lineHeight:1.7,marginBottom:14}}>8 live feeds refresh every 15 minutes during US market hours (9:30 AM – 4:00 PM ET, Mon–Fri). Data fetched server-side via Yahoo Finance v8 API and NY Fed.</p>
        <h3 style={{fontFamily:"var(--fb)",fontSize:13,fontWeight:700,marginBottom:8}}>Market Data</h3>
        {[
          {t:"VIX",d:"30-day S&P 500 implied vol. The primary equity fear gauge. Feeds → Concentration: Volatility Regime."},
          {t:"VVIX",d:"Vol-of-vol. Tail hedge cost proxy. When high, VIX can gap violently. Feeds → Concentration: Vol-of-Vol."},
          {t:"VIX Term",d:"VIX/VIX3M ratio. Inversion (>1.0) = acute near-term stress. Leading indicator — fires before VIX level alone. Feeds → Concentration: VIX Term Structure."},
          {t:"MOVE",d:"ICE BofAML rates implied vol. Cross-asset stress lead indicator — rates vol often precedes equity vol. Feeds → Concentration: Rates Volatility."},
          {t:"SOFR",d:"Secured Overnight Financing Rate from NY Fed. Funding cost for leveraged strategies. Feeds → Liquidity: Funding Cost."},
          {t:"SPY",d:"S&P 500 ETF daily change. Broad institutional/retail flow proxy. Feeds → Liquidity: ETF Flow Proxy."},
          {t:"QQQ",d:"Nasdaq 100 ETF daily change. Tech-heavy flow signal. Feeds → Liquidity: ETF Flow Proxy."},
          {t:"EEM",d:"Emerging Markets ETF daily change. EM rotation/de-risking signal. Feeds → Liquidity: ETF Flow Proxy."},
        ].map(item=><div key={item.t} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:8}}>
          <span style={{fontFamily:"var(--f)",fontSize:10,fontWeight:800,color:"var(--accent)",minWidth:58}}>{item.t}</span>
          <span style={{fontFamily:"var(--fb)",fontSize:11,color:"var(--text-s)",lineHeight:1.5}}>{item.d}</span>
        </div>)}

        <h3 style={{fontFamily:"var(--fb)",fontSize:13,fontWeight:700,marginBottom:8,marginTop:14}}>News Sources</h3>
        <p style={{fontFamily:"var(--fb)",fontSize:12,color:"var(--text-s)",lineHeight:1.7,marginBottom:10}}>Headlines aggregated from 7 sources across 14 search queries:</p>
        {[
          {s:"Hedgeweek",d:"Industry-leading HF news. Fetched via Google News RSS (site:hedgeweek.com). Highest relevance weighting."},
          {s:"Institutional Investor",d:"In-depth HF analysis and allocator perspectives. Via Google News RSS."},
          {s:"Financial Times",d:"Global financial news with strong HF coverage. Via Google News RSS."},
          {s:"Risk.net",d:"Derivatives, risk management, and prime brokerage news. Via Google News RSS."},
          {s:"Insider Monkey",d:"HF holdings analysis, 13F tracking. Direct RSS feed."},
          {s:"Alpha Week",d:"Alternative investment industry news. Direct RSS feed."},
          {s:"Finnhub",d:"Institutional-grade general market news + company-specific news for 9 HF-adjacent tickers (Blackstone, KKR, Apollo, Goldman, MS, JPM, etc). Free API."},
          {s:"Google News",d:"General hedge fund, activist, regulatory, and performance queries. 6 queries."},
        ].map(item=><div key={item.s} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:6}}>
          <span style={{fontFamily:"var(--f)",fontSize:10,fontWeight:700,color:"var(--text)",minWidth:110}}>{item.s}</span>
          <span style={{fontFamily:"var(--fb)",fontSize:11,color:"var(--text-s)",lineHeight:1.5}}>{item.d}</span>
        </div>)}
        <p style={{fontFamily:"var(--fb)",fontSize:11,color:"var(--text-m)",marginTop:10,lineHeight:1.6}}>Articles are deduplicated, matched against 40+ fund names and key people, tagged with risk categories and sentiment, ranked by relevance (Hedgeweek +25, fund-specific +30, negative +15, recent +20), and the top 25 are displayed. News refreshes every 30 minutes.</p>
      </div>}
    </div>
  </div>;
}

/* ═══ INDEX CARDS WITH CUSTOM CHARTS ═══ */

function ChartSVG({data,thresholds,color,height=140}){
  if(!data||data.length<2) return <div style={{height,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--f)",fontSize:9,color:"var(--text-m)"}}>No chart data</div>;
  const vals=data.map(d=>d.v);
  // Include threshold values in min/max so lines are visible
  const threshVals=thresholds?.map(t=>t.y)||[];
  const allVals=[...vals,...threshVals];
  const mn=Math.min(...allVals)*0.98;const mx=Math.max(...allVals)*1.02;const range=mx-mn||1;
  const w=500;const h=height;const pad=4;
  const toX=(i)=>pad+(i/(vals.length-1))*(w-pad*2);
  const toY=(v)=>h-pad-((v-mn)/range)*(h-pad*2);
  const pts=vals.map((v,i)=>`${toX(i)},${toY(v)}`);

  // Percentile band (25th-75th)
  const sorted=[...vals].sort((a,b)=>a-b);
  const p25=sorted[Math.floor(sorted.length*0.25)];
  const p75=sorted[Math.floor(sorted.length*0.75)];

  return <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height}}>
    {/* 25-75 percentile band */}
    <rect x={pad} y={toY(p75)} width={w-pad*2} height={Math.max(toY(p25)-toY(p75),1)} fill={color} opacity="0.06" rx="2"/>
    {/* Threshold lines */}
    {thresholds?.map((t,i)=><g key={i}><line x1={pad} y1={toY(t.y)} x2={w-pad} y2={toY(t.y)} stroke={t.c} strokeWidth="0.8" strokeDasharray="4,3" opacity="0.6"/>
      <text x={w-pad-2} y={toY(t.y)-3} textAnchor="end" fill={t.c} fontSize="7" fontFamily="var(--f)" opacity="0.7">{t.label} ({t.y})</text></g>)}
    {/* Area fill */}
    <defs><linearGradient id={`ig-${color.replace(/[^a-z0-9]/g,"")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.12"/><stop offset="100%" stopColor={color} stopOpacity="0.01"/></linearGradient></defs>
    <polygon points={`${toX(0)},${h-pad} ${pts.join(" ")} ${toX(vals.length-1)},${h-pad}`} fill={`url(#ig-${color.replace(/[^a-z0-9]/g,"")})`}/>
    {/* Line */}
    <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    {/* Current dot */}
    <circle cx={toX(vals.length-1)} cy={toY(vals[vals.length-1])} r="3" fill={color} stroke="#fff" strokeWidth="1"/>
    {/* Date labels */}
    <text x={pad} y={h-1} fill="var(--text-m)" fontSize="7" fontFamily="var(--f)">{data[0].d}</text>
    <text x={w-pad} y={h-1} textAnchor="end" fill="var(--text-m)" fontSize="7" fontFamily="var(--f)">{data[data.length-1].d}</text>
  </svg>;
}

function MultiLineChart({lines,height=140}){
  if(!lines||!lines.some(l=>l.data?.length>1)) return <div style={{height,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--f)",fontSize:9,color:"var(--text-m)"}}>No chart data</div>;
  // Compute cumulative returns for each line
  const cumLines=lines.map(l=>{
    if(!l.data||l.data.length<2)return{...l,cum:[]};
    const base=l.data[0].v;
    return{...l,cum:l.data.map(d=>({d:d.d,v:parseFloat(((d.v-base)/base*100).toFixed(2))}))};
  }).filter(l=>l.cum.length>1);
  if(!cumLines.length) return null;
  const allVals=cumLines.flatMap(l=>l.cum.map(d=>d.v));
  const mn=Math.min(...allVals,-3);const mx=Math.max(...allVals,3);const range=mx-mn||1;
  const w=500;const h=height;const pad=4;const len=cumLines[0].cum.length;
  const toX=(i)=>pad+(i/(len-1))*(w-pad*2);
  const toY=(v)=>h-pad-((v-mn)/range)*(h-pad*2);
  return <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height}}>
    {/* Zero line */}
    <line x1={pad} y1={toY(0)} x2={w-pad} y2={toY(0)} stroke="var(--border)" strokeWidth="0.8" strokeDasharray="3,3"/>
    <text x={pad+2} y={toY(0)-3} fill="var(--text-m)" fontSize="7" fontFamily="var(--f)">0%</text>
    {/* Lines */}
    {cumLines.map((l,li)=>{const pts=l.cum.map((d,i)=>`${toX(i)},${toY(d.v)}`);
      return <g key={li}><polyline points={pts.join(" ")} fill="none" stroke={l.color} strokeWidth={li===0?"1.5":"1"} strokeLinejoin="round" opacity={li===0?1:0.6}/>
        <circle cx={toX(l.cum.length-1)} cy={toY(l.cum[l.cum.length-1].v)} r={li===0?3:2} fill={l.color} stroke="#fff" strokeWidth="0.8"/>
        <text x={w-pad-2} y={toY(l.cum[l.cum.length-1].v)+(li*10)-3} textAnchor="end" fill={l.color} fontSize="7" fontFamily="var(--f)" fontWeight="500">{l.label} {l.cum[l.cum.length-1].v>=0?"+":""}{l.cum[l.cum.length-1].v}%</text>
      </g>;})}
    <text x={pad} y={h-1} fill="var(--text-m)" fontSize="7" fontFamily="var(--f)">{cumLines[0].cum[0].d}</text>
    <text x={w-pad} y={h-1} textAnchor="end" fill="var(--text-m)" fontSize="7" fontFamily="var(--f)">{cumLines[0].cum[cumLines[0].cum.length-1].d}</text>
  </svg>;
}

const TIMEFRAMES=[{id:"1M",days:22,label:"1M"},{id:"3M",days:66,label:"3M"},{id:"6M",days:132,label:"6M"},{id:"1Y",days:252,label:"1Y"}];

function IndexCard({title,question,ticker,data,extraLines,thresholds,isSofr,def}){
  const [open,setOpen]=React.useState(false);
  const [tf,setTf]=React.useState("1M");
  if(!data) return <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 18px",boxShadow:"var(--sh)"}}><div style={{fontFamily:"var(--fb)",fontSize:11,color:"var(--text-m)"}}>{title}</div><div style={{fontFamily:"var(--f)",fontSize:16,color:"var(--border-s)",marginTop:4,animation:"blink 1.5s ease infinite"}}>---</div></div>;
  const sc=SC[data.status]||SC.Unknown;const up=(data.changePercent||0)>=0;
  let pctColor="var(--green)";
  if(data.percentile!=null){if(data.percentile>=90)pctColor="var(--red)";else if(data.percentile>=75)pctColor="var(--orange)";else if(data.percentile>=60)pctColor="var(--yellow)";}

  const tfDays=TIMEFRAMES.find(t=>t.id===tf)?.days||22;
  const chartData=data.chartHistory?data.chartHistory.slice(-tfDays).map(p=>({d:p.d.slice(5),v:p.v})):null;

  // 52wk range position (0-100%)
  let rangePos=null;
  if(data.high52w!=null&&data.low52w!=null&&data.value!=null){
    const range=data.high52w-data.low52w;
    rangePos=range>0?Math.round(((data.value-data.low52w)/range)*100):50;
  }

  return <div onClick={()=>{if(!open)setOpen(true);}} style={{background:"var(--card)",border:`1px solid ${data.status!=="Normal"?sc.bd:"var(--border)"}`,borderRadius:10,padding:"14px 18px",boxShadow:"var(--sh)",cursor:open?"default":"pointer",transition:"all 0.15s",borderLeft:`3px solid ${sc.dot}`,display:"flex",flexDirection:"column",height:"100%"}}>
    <div style={{fontFamily:"var(--fb)",fontSize:10,fontWeight:600,color:"var(--text-s)",marginBottom:2}}>{question}</div>
    {def&&<div style={{fontFamily:"var(--fb)",fontSize:9,color:"var(--text-m)",marginBottom:6,lineHeight:1.4}}>{def}</div>}
    <div style={{display:"flex",alignItems:"flex-end",gap:8,marginBottom:6}}>
      <div><div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}><Pulse color={sc.dot}/><span style={{fontFamily:"var(--f)",fontSize:8,fontWeight:500,color:sc.c}}>{ticker}</span></div>
        <div style={{fontFamily:"var(--f)",fontSize:22,fontWeight:500,color:"var(--text)",lineHeight:1}}>{isSofr?data.value+"%":data.value?.toLocaleString(undefined,{maximumFractionDigits:2})||"---"}</div></div>
      <div style={{marginLeft:"auto",textAlign:"right",display:"flex",alignItems:"center",gap:6}}>
        {data.changePercent!=null&&<span style={{fontFamily:"var(--f)",fontSize:9,fontWeight:500,color:up?"var(--red)":"var(--green)"}}>{up?"▲":"▼"}{Math.abs(data.changePercent).toFixed(2)}%</span>}
        <span style={{fontFamily:"var(--f)",fontSize:8,fontWeight:500,color:sc.c,background:sc.bg,padding:"2px 6px",borderRadius:3,border:`1px solid ${sc.bd}`,textTransform:"uppercase"}}>{data.status}</span>
      </div>
    </div>

    {/* 1Y Percentile bar */}
    {data.percentile!=null&&<div style={{marginBottom:6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
        <span style={{fontFamily:"var(--f)",fontSize:8,color:"var(--text-m)"}}>1Y Percentile</span>
        <span style={{fontFamily:"var(--f)",fontSize:10,fontWeight:500,color:pctColor}}>{data.percentile}th</span>
      </div>
      <div style={{height:5,background:"var(--surface)",borderRadius:3,overflow:"hidden",position:"relative"}}>
        <div style={{height:"100%",width:`${data.percentile}%`,background:pctColor,borderRadius:3}}/>
        <div style={{position:"absolute",top:-1,left:`${data.percentile}%`,width:2,height:7,background:pctColor,borderRadius:1,transform:"translateX(-1px)"}}/>
      </div>
    </div>}

    {/* 52wk range bar */}
    {data.high52w!=null&&data.low52w!=null&&<div style={{marginBottom:6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
        <span style={{fontFamily:"var(--f)",fontSize:8,color:"var(--text-m)"}}>52W Low: {data.low52w}</span>
        <span style={{fontFamily:"var(--f)",fontSize:8,color:"var(--text-m)"}}>52W High: {data.high52w}</span>
      </div>
      <div style={{height:5,background:"var(--surface)",borderRadius:3,overflow:"hidden",position:"relative"}}>
        <div style={{height:"100%",width:`${rangePos}%`,background:"var(--accent)",borderRadius:3,opacity:0.3}}/>
        <div style={{position:"absolute",top:-1,left:`${rangePos}%`,width:2,height:7,background:"var(--accent)",borderRadius:1,transform:"translateX(-1px)"}}/>
      </div>
    </div>}

    {/* Prev close */}
    {data.previousClose!=null&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
      <span style={{fontFamily:"var(--f)",fontSize:8,color:"var(--text-m)"}}>Prev Close:</span>
      <span style={{fontFamily:"var(--f)",fontSize:9,fontWeight:500,color:"var(--text)"}}>{isSofr?data.previousClose+"%":data.previousClose?.toLocaleString(undefined,{maximumFractionDigits:2})}</span>
    </div>}

    {/* Z-score alert */}
    {data.zScore!=null&&Math.abs(data.zScore)>=1.5&&<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:5,padding:"3px 6px",borderRadius:4,background:Math.abs(data.zScore)>=2?"var(--red-bg)":"var(--yellow-bg)",border:`1px solid ${Math.abs(data.zScore)>=2?"var(--red-bd)":"var(--yellow-bd)"}`}}>
      <span style={{fontFamily:"var(--f)",fontSize:8,fontWeight:500,color:Math.abs(data.zScore)>=2?"var(--red)":"var(--yellow)"}}>⚠ Today: {data.zScore>0?"+":""}{data.zScore}σ {Math.abs(data.zScore)>=2?"unusual":"notable"}</span>
    </div>}

    {/* Extra sub-lines */}
    {extraLines?.length>0&&<div style={{display:"flex",gap:12,marginBottom:5}}>
      {extraLines.map((e,i)=>{const esc=SC[e.status]||SC.Unknown;return <div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
        <div style={{width:3,height:3,borderRadius:"50%",background:esc.dot}}/><span style={{fontFamily:"var(--f)",fontSize:9,color:"var(--text-m)"}}>{e.label}:</span><span style={{fontFamily:"var(--f)",fontSize:9,fontWeight:500}}>{e.value!=null?typeof e.value==="number"?e.value.toFixed(1):e.value:"--"}</span>
        {e.status!=="Normal"&&e.status!=="Unknown"&&<span style={{fontFamily:"var(--f)",fontSize:6,fontWeight:500,color:esc.c,background:esc.bg,padding:"1px 3px",borderRadius:2,border:`1px solid ${esc.bd}`,textTransform:"uppercase"}}>{e.status}</span>}
      </div>;})}
    </div>}

    {/* Chart with timeframe tabs */}
    {open&&chartData&&<div style={{marginTop:8,animation:"fadeUp 0.15s ease-out"}}>
      <div style={{display:"flex",gap:2,marginBottom:6}}>{TIMEFRAMES.map(t=><div key={t.id} onClick={e=>{e.stopPropagation();setTf(t.id);}} style={{padding:"3px 10px",fontFamily:"var(--f)",fontSize:8,fontWeight:500,borderRadius:4,cursor:"pointer",color:tf===t.id?"#fff":"var(--text-m)",background:tf===t.id?sc.dot:"var(--surface)",transition:"all 0.1s"}}>{t.label}</div>)}</div>
      <ChartSVG data={chartData} thresholds={thresholds} color={sc.dot}/>
    </div>}
    {open&&!chartData&&<div style={{fontFamily:"var(--f)",fontSize:8,color:"var(--text-m)",textAlign:"center",marginTop:8,padding:20,background:"var(--surface)",borderRadius:6}}>Chart data loading on next refresh</div>}
    {open&&<div onClick={e=>{e.stopPropagation();setOpen(false);}} style={{fontFamily:"var(--f)",fontSize:8,color:"var(--accent)",textAlign:"center",marginTop:6,fontWeight:500,cursor:"pointer"}}>▲ Collapse</div>}
    {!open&&data.chartHistory&&<div style={{fontFamily:"var(--f)",fontSize:8,color:"var(--accent)",textAlign:"center",marginTop:"auto",paddingTop:6,fontWeight:500}}>▼ Click for chart</div>}
  </div>;
}

function FlowCard({title,question,spy,qqq,eem,def}){
  const [open,setOpen]=React.useState(false);
  const [tf,setTf]=React.useState("1M");
  const spySt=spy?.status||"Unknown";const sc=SC[spySt]||SC.Unknown;
  const tfDays=TIMEFRAMES.find(t=>t.id===tf)?.days||22;

  return <div onClick={()=>{if(!open)setOpen(true);}} style={{background:"var(--card)",border:`1px solid ${spySt!=="Normal"?sc.bd:"var(--border)"}`,borderRadius:10,padding:"14px 18px",boxShadow:"var(--sh)",borderLeft:`3px solid ${sc.dot}`,cursor:open?"default":"pointer",transition:"all 0.15s",display:"flex",flexDirection:"column",height:"100%"}}>
    <div style={{fontFamily:"var(--fb)",fontSize:10,fontWeight:600,color:"var(--text-s)",marginBottom:2}}>{question}</div>
    {def&&<div style={{fontFamily:"var(--fb)",fontSize:9,color:"var(--text-m)",marginBottom:6,lineHeight:1.4}}>{def}</div>}
    <div style={{display:"flex",gap:16,marginBottom:4}}>
      {[{l:"SPY",d:spy,c:"#3654b3"},{l:"QQQ",d:qqq,c:"#7c3aed"},{l:"EEM",d:eem,c:"#0891b2"}].map(({l,d,c})=>{if(!d)return null;const v=d.changePercent;
        return <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
          <Pulse color={c}/><span style={{fontFamily:"var(--f)",fontSize:8,fontWeight:500,color:c}}>{l}</span>
          <span style={{fontFamily:"var(--f)",fontSize:14,fontWeight:500,color:"var(--text)"}}>{v!=null?(v>=0?"+":"")+v.toFixed(2)+"%":"--"}</span>
          {d.cumulative5d!=null&&<span style={{fontFamily:"var(--f)",fontSize:8,color:d.cumulative5d<=-2?"var(--red)":"var(--text-m)"}}>5D:{d.cumulative5d>=0?"+":""}{d.cumulative5d}%</span>}
          {d.cumulative5d!=null&&d.cumulative5d<=-3&&<span style={{fontFamily:"var(--f)",fontSize:6,fontWeight:500,color:"var(--red)",background:"var(--red-bg)",padding:"1px 3px",borderRadius:2,border:"1px solid var(--red-bd)"}}>SUSTAINED</span>}
        </div>;})}
    </div>
    {/* Chart with timeframe tabs */}
    {open&&spy?.chartHistory&&<div style={{marginTop:8,animation:"fadeUp 0.15s ease-out"}}>
      <div style={{display:"flex",gap:2,marginBottom:6}}>{TIMEFRAMES.map(t=><div key={t.id} onClick={e=>{e.stopPropagation();setTf(t.id);}} style={{padding:"3px 10px",fontFamily:"var(--f)",fontSize:8,fontWeight:500,borderRadius:4,cursor:"pointer",color:tf===t.id?"#fff":"var(--text-m)",background:tf===t.id?sc.dot:"var(--surface)",transition:"all 0.1s"}}>{t.label}</div>)}</div>
      <MultiLineChart lines={[
        {label:"SPY",data:spy.chartHistory?.slice(-tfDays).map(p=>({d:p.d.slice(5),v:p.v})),color:"#3654b3"},
        {label:"QQQ",data:qqq?.chartHistory?.slice(-tfDays).map(p=>({d:p.d.slice(5),v:p.v})),color:"#7c3aed"},
        {label:"EEM",data:eem?.chartHistory?.slice(-tfDays).map(p=>({d:p.d.slice(5),v:p.v})),color:"#0891b2"},
      ]} />
      <div style={{fontFamily:"var(--f)",fontSize:7,color:"var(--text-m)",textAlign:"center",marginTop:2}}>Cumulative returns — broad vs concentrated de-risking</div>
    </div>}
    {open&&<div onClick={e=>{e.stopPropagation();setOpen(false);}} style={{fontFamily:"var(--f)",fontSize:8,color:"var(--accent)",textAlign:"center",marginTop:6,fontWeight:500,cursor:"pointer"}}>▲ Collapse</div>}
    {!open&&spy?.chartHistory&&<div style={{fontFamily:"var(--f)",fontSize:8,color:"var(--accent)",textAlign:"center",marginTop:"auto",paddingTop:6,fontWeight:500}}>▼ Click for flow chart</div>}
  </div>;
}

/* ═══ DOMAIN FOCUS PANEL ═══ */
/* ── Helper: get previous month-end value from chartHistory ── */
function getPrevMonthStatus(sig, liveData) {
  if (!sig.live || !sig.ticker || !liveData?.indicators) return null;
  const ind = liveData.indicators[sig.ticker];
  if (!ind?.chartHistory || ind.chartHistory.length < 25) return null;

  // Find last trading day of previous month
  const now = new Date();
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
  const prevMonthStr = prevMonthEnd.toISOString().slice(0, 7); // e.g. "2026-03"

  // Find the last data point in the previous month
  let prevVal = null;
  for (let i = ind.chartHistory.length - 1; i >= 0; i--) {
    if (ind.chartHistory[i].d.slice(0, 7) <= prevMonthStr) {
      prevVal = ind.chartHistory[i].v;
      break;
    }
  }
  if (prevVal == null) return null;

  // Apply same threshold logic based on ticker
  const t = sig.ticker;
  if (t === "VIX") { if (prevVal >= 30) return "Critical"; if (prevVal >= 25) return "Elevated"; if (prevVal >= 20) return "Watch"; return "Normal"; }
  if (t === "VVIX") { if (prevVal >= 120) return "Critical"; if (prevVal >= 100) return "Elevated"; if (prevVal >= 90) return "Watch"; return "Normal"; }
  if (t === "MOVE") { if (prevVal >= 140) return "Critical"; if (prevVal >= 120) return "Elevated"; if (prevVal >= 100) return "Watch"; return "Normal"; }
  if (t === "SOFR") { if (prevVal >= 5.5) return "Critical"; if (prevVal >= 5) return "Elevated"; if (prevVal >= 4.5) return "Watch"; return "Normal"; }
  if (t === "SPY" || t === "QQQ" || t === "EEM") return null; // ETF daily change not comparable month-over-month
  return null;
}

function DomainFocus({name,icon,area,liveData,news,onClose,savedSignals}){
  const [expId,setExpId]=React.useState(null);
  const relatedNews=(news||[]).filter(n=>area.relatedTags?.includes(n.riskTag));
  const w=worst(area.signals.map(s=>getStatus(s,liveData,savedSignals)));const sc=SC[w]||SC.Unknown;
  const soIdx={"Normal":0,"Watch":1,"Elevated":2,"Critical":3};

  // Compute previous month-end date label (e.g. "31 Mar 2026")
  const prevMonthEnd=new Date(new Date().getFullYear(),new Date().getMonth(),0);
  const prevMonthLabel=prevMonthEnd.toLocaleDateString([],{day:"2-digit",month:"short",year:"numeric"});

  return <div style={{background:"var(--card)",border:`2px solid ${sc.bd}`,borderRadius:14,overflow:"hidden",boxShadow:`0 4px 20px ${sc.ring}`,animation:"fadeUp 0.2s ease-out",marginTop:12,marginBottom:12}}>
    <div style={{padding:"10px 16px",background:sc.bg,borderBottom:`1px solid ${sc.bd}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>{icon}</span><span style={{fontFamily:"var(--fb)",fontSize:14,fontWeight:700}}>{name} — Deep Dive</span><span style={{fontFamily:"var(--f)",fontSize:9,fontWeight:500,color:sc.c,background:"#fff",padding:"2px 8px",borderRadius:4,border:`1px solid ${sc.bd}`,textTransform:"uppercase"}}>{w}</span></div>
      <span onClick={onClose} style={{cursor:"pointer",color:"var(--text-m)",fontSize:16,width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:5}}>×</span>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",minHeight:180}}>
      <div style={{borderRight:"1px solid #eaecf2"}}>
        <div style={{padding:"8px 14px",background:"#fafbfc",borderBottom:"1px solid #eaecf2",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontFamily:"var(--f)",fontSize:9,fontWeight:500,color:"var(--text-m)",letterSpacing:"0.06em",textTransform:"uppercase"}}>Current Status</span>
          <span style={{fontFamily:"var(--f)",fontSize:8,color:"var(--text-m)"}}>vs {prevMonthLabel}</span>
        </div>
        {area.signals.map(s=>{const st=getStatus(s,liveData,savedSignals);const ssc=SC[st]||SC.Unknown;const val=getValue(s,liveData,savedSignals)||s.value;const exp=expId===s.id;
          const prevSt=getPrevMonthStatus(s,liveData)||getSavedPrevStatus(s,savedSignals);
          const changed=prevSt&&prevSt!==st;
          const worsened=prevSt&&(soIdx[st]||0)>(soIdx[prevSt]||0);
          const improved=prevSt&&(soIdx[st]||0)<(soIdx[prevSt]||0);

          return <div key={s.id} style={{borderBottom:"1px solid #f5f6f8"}}>
            <div onClick={()=>setExpId(exp?null:s.id)} style={{padding:"8px 14px",display:"flex",alignItems:"center",gap:6,cursor:"pointer",background:exp?"#f8f9fb":"transparent",transition:"background 0.1s"}} onMouseEnter={e=>{if(!exp)e.currentTarget.style.background="#fafbfc"}} onMouseLeave={e=>{if(!exp)e.currentTarget.style.background="transparent"}}>
              <div style={{width:3,height:22,borderRadius:2,background:ssc.dot}}/>
              <div style={{flex:1}}><div style={{fontFamily:"var(--fb)",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>{s.name}{s.live&&<span style={{fontFamily:"var(--f)",fontSize:6,color:"var(--green)",background:"var(--green-bg)",padding:"1px 3px",borderRadius:2,fontWeight:500,border:"1px solid var(--green-bd)"}}>LIVE</span>}</div></div>
              <span style={{fontFamily:"var(--f)",fontSize:12,fontWeight:500}}>{val}</span>
              <span style={{fontFamily:"var(--f)",fontSize:7,fontWeight:500,color:ssc.c,background:ssc.bg,padding:"2px 6px",borderRadius:3,border:`1px solid ${ssc.bd}`,textTransform:"uppercase"}}>{st}</span>
              <div style={{minWidth:68,textAlign:"right"}}>
                {prevSt&&worsened&&<span style={{fontFamily:"var(--f)",fontSize:7,fontWeight:500,color:"var(--red)"}}>Worsened</span>}
                {prevSt&&improved&&<span style={{fontFamily:"var(--f)",fontSize:7,fontWeight:500,color:"var(--green)"}}>Improved</span>}
                {prevSt&&!changed&&<span style={{fontFamily:"var(--f)",fontSize:7,color:"var(--text-m)"}}>Unchanged</span>}
                {!prevSt&&<span style={{fontFamily:"var(--f)",fontSize:7,color:"var(--text-m)"}}>N/A</span>}
              </div>
              <span style={{color:"var(--border-s)",fontSize:9,transform:exp?"rotate(90deg)":"rotate(0)",transition:"transform 0.15s"}}>▶</span>
            </div>
            {exp&&<div style={{padding:"6px 14px 10px 24px",borderTop:"1px solid #f0f1f5",animation:"fadeUp 0.15s ease-out"}}>
              <div style={{fontFamily:"var(--fb)",fontSize:11,color:"var(--text-s)",lineHeight:1.6,marginBottom:5}}>{s.def}</div>
              <div style={{fontFamily:"var(--f)",fontSize:9,color:"var(--text-m)",marginBottom:3}}><b>Thresholds:</b> {s.trigger}</div>
              <div style={{fontFamily:"var(--fb)",fontSize:11,color:"var(--text)"}}><span style={{fontFamily:"var(--f)",fontSize:9,fontWeight:500,color:"var(--text-m)"}}>Action: </span>{s.action}</div>
            </div>}
          </div>;
        })}
      </div>
      <div>
        <div style={{padding:"8px 14px",background:"#fafbfc",borderBottom:"1px solid #eaecf2",fontFamily:"var(--f)",fontSize:9,fontWeight:500,color:"var(--text-m)",letterSpacing:"0.06em",textTransform:"uppercase"}}>Related Headlines ({relatedNews.length})</div>
        {relatedNews.length===0&&<div style={{padding:16,fontFamily:"var(--f)",fontSize:10,color:"var(--text-m)",textAlign:"center"}}>No related headlines</div>}
        <div style={{maxHeight:300,overflowY:"auto"}}>{relatedNews.map((a,i)=>{const tc=TAG_C[a.riskTag]||"var(--text-m)";return <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" style={{display:"block",padding:"8px 14px",borderBottom:"1px solid #f5f6f8",textDecoration:"none",color:"inherit",transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
            <div style={{width:4,height:4,borderRadius:"50%",background:SENT[a.sentiment]||SENT.neutral,marginTop:5,flexShrink:0}}/>
            <div><div style={{fontFamily:"var(--fb)",fontSize:11,color:"var(--text)",lineHeight:1.4,fontWeight:500}}>{a.fund&&<span style={{fontWeight:700,color:"var(--accent)"}}>{a.fund} — </span>}{a.title}</div>
              <div style={{display:"flex",gap:4,marginTop:2}}><span style={{fontFamily:"var(--f)",fontSize:6,fontWeight:500,color:tc,background:tc+"10",padding:"1px 3px",borderRadius:2,border:`1px solid ${tc}30`}}>{a.riskTag}</span><span style={{fontFamily:"var(--f)",fontSize:7,color:"var(--text-m)"}}>{a.publisher} · {timeAgo(a.publishedAt)}</span></div>
            </div>
          </div>
        </a>;})}</div>
      </div>
    </div>
  </div>;
}

/* ═══ APP ═══ */
function App(){
  const [liveData,setLiveData]=React.useState(null);
  const [news,setNews]=React.useState([]);
  const [newsLoading,setNewsLoading]=React.useState(true);
  const [showDetail,setShowDetail]=React.useState(false);
  const [showGuide,setShowGuide]=React.useState(false);
  const [expandedId,setExpandedId]=React.useState(null);
  const [selDomain,setSelDomain]=React.useState(null);
  const [loading,setLoading]=React.useState(true);
  const [lastRefresh,setLastRefresh]=React.useState(null);

  const [savedSignals,setSavedSignals]=React.useState(null);

  const fetchLive=React.useCallback(async(force)=>{setLoading(true);try{const r=await fetch(force?"/api/live-feed/force":"/api/live-feed");if(r.ok){const d=await r.json();setLiveData(d);setLastRefresh(d.fetchedAt);}}catch{}setLoading(false);},[]);
  const fetchNews=React.useCallback(async()=>{setNewsLoading(true);try{const r=await fetch("/api/news");if(r.ok){const d=await r.json();setNews(d.articles||[]);}}catch{}setNewsLoading(false);},[]);
  const fetchSavedSignals=React.useCallback(async()=>{try{const r=await fetch("/api/signals/latest");if(r.ok){const d=await r.json();setSavedSignals(d);}}catch{}},[]);
  React.useEffect(()=>{fetchLive();fetchNews();fetchSavedSignals();},[]);

  const ind=liveData?.indicators||{};
  const toggle=(id)=>setExpandedId(expandedId===id?null:id);

  // Build live card data
  const vixVal=ind.VIX?.value;const vixChg=ind.VIX?.changePercent;const vixSt=ind.VIX?.status||"Unknown";
  const vvixVal=ind.VVIX?.value;const vvixSt=ind.VVIX?.status||"Unknown";
  const vtVal=ind.VIX_TERM?.value;const vtSt=ind.VIX_TERM?.status||"Unknown";
  const moveVal=ind.MOVE?.value;const moveChg=ind.MOVE?.changePercent;const moveSt=ind.MOVE?.status||"Unknown";
  const sofrVal=ind.SOFR?.value;const sofrSt=ind.SOFR?.status||"Unknown";
  const spyVal=ind.SPY?.changePercent;const spySt=ind.SPY?.status||"Unknown";
  const qqqVal=ind.QQQ?.changePercent;const qqqSt=ind.QQQ?.status||"Unknown";
  const eemVal=ind.EEM?.changePercent;const eemSt=ind.EEM?.status||"Unknown";

  return <div style={{maxWidth:1300,margin:"0 auto",padding:"18px 20px 50px"}}>
    {/* Header */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div><div style={{fontFamily:"var(--f)",fontSize:7,fontWeight:500,letterSpacing:"0.14em",color:"var(--accent)",textTransform:"uppercase"}}>SURVEILLANCE · v3.0</div><div style={{fontFamily:"var(--fb)",fontSize:18,fontWeight:700,letterSpacing:"-0.02em"}}>Hedge Funds Market Surveillance</div></div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <span style={{fontFamily:"var(--f)",fontSize:9,color:"var(--text-m)"}}>{lastRefresh?new Date(lastRefresh).toLocaleDateString([],{day:"2-digit",month:"short",year:"numeric"})+" "+new Date(lastRefresh).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"..."}</span>
        <button onClick={()=>fetchLive(true)} disabled={loading} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:5,padding:"4px 10px",fontFamily:"var(--f)",fontSize:9,fontWeight:500,color:"var(--text-s)",cursor:loading?"wait":"pointer",display:"flex",alignItems:"center",gap:3}}><span style={{display:"inline-block",animation:loading?"spin 1s linear infinite":"none"}}>↻</span>Refresh</button>
      </div>
    </div>

    {/* 1. Threat Level */}
    <div style={{marginBottom:14}}><ThreatLevel liveData={liveData} savedSignals={savedSignals}/></div>

    {/* 2. DOMAIN CARDS — PRIMARY FOCUS (single row of 4) */}
    <div style={{display:"flex",gap:14,marginBottom:selDomain?0:14}}>
      {Object.entries(SIGNALS).map(([name,area])=>{
        const isSel=selDomain===name;const sts=area.signals.map(s=>getStatus(s,liveData,savedSignals));const w=worst(sts);const sc=SC[w]||SC.Unknown;const fl=sts.filter(s=>s!=="Normal").length;
        return <div key={name} onClick={()=>setSelDomain(isSel?null:name)} style={{flex:1,background:"var(--card)",border:`${isSel?"2.5px":"1px"} solid ${isSel?sc.dot:fl>0?sc.bd:"var(--border)"}`,borderRadius:14,padding:"20px 22px",cursor:"pointer",transition:"all 0.15s",boxShadow:isSel?`0 4px 20px ${sc.ring}`:fl>0?`0 2px 12px ${sc.ring}`:"var(--sh)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:26}}>{area.icon}</span><span style={{fontFamily:"var(--fb)",fontSize:16,fontWeight:700}}>{name}</span></div>
            <div style={{fontFamily:"var(--f)",fontSize:11,fontWeight:500,color:sc.c,background:sc.bg,padding:"4px 12px",borderRadius:6,border:`1px solid ${sc.bd}`,textTransform:"uppercase"}}>{w}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {area.signals.filter(s=>fl>0?getStatus(s,liveData,savedSignals)!=="Normal":true).slice(0,3).map(s=>{const st=getStatus(s,liveData,savedSignals);const ssc=SC[st];const val=getValue(s,liveData,savedSignals)||s.value;
              return <div key={s.id} style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:ssc.dot}}/>
                <span style={{fontFamily:"var(--fb)",fontSize:13,flex:1}}>{s.name}</span>
                <span style={{fontFamily:"var(--f)",fontSize:13,fontWeight:500}}>{val}</span>
                <span style={{fontFamily:"var(--f)",fontSize:9,fontWeight:500,color:ssc.c,minWidth:55,textAlign:"right"}}>{st}</span>
              </div>;
            })}
            {fl>0&&area.signals.filter(s=>getStatus(s,liveData,savedSignals)==="Normal").length>0&&<div style={{fontFamily:"var(--f)",fontSize:9,color:"var(--text-m)",marginTop:2}}>+ {area.signals.filter(s=>getStatus(s,liveData,savedSignals)==="Normal").length} normal</div>}
          </div>
          <div style={{display:"flex",gap:4,marginTop:14}}>{sts.map((s,i)=><div key={i} style={{width:10,height:10,borderRadius:3,background:s==="Normal"?"var(--surface)":SC[s]?.bg,border:`1.5px solid ${s==="Normal"?"var(--border)":SC[s]?.dot}`}}/>)}</div>
          {isSel&&<div style={{fontFamily:"var(--f)",fontSize:9,color:sc.c,marginTop:8,textAlign:"center",fontWeight:500}}>▼ Detail below</div>}
        </div>;
      })}
    </div>

    {/* Domain Focus Panel */}
    {selDomain&&SIGNALS[selDomain]&&<DomainFocus name={selDomain} icon={SIGNALS[selDomain].icon} area={SIGNALS[selDomain]} liveData={liveData} news={news} onClose={()=>setSelDomain(null)} savedSignals={savedSignals}/>}

    {/* 3. INDEX CARDS with custom charts (2x2, equal size) */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gridAutoRows:"1fr",gap:12,marginBottom:14,marginTop:selDomain?14:0}}>
      <IndexCard title="Equity Volatility" question="Is equity vol elevated?" ticker="VIX" data={ind.VIX}
        def="CBOE Volatility Index — 30-day implied volatility of S&P 500 options."
        extraLines={[{label:"VVIX",value:vvixVal,status:vvixSt},{label:"Term (VIX/VIX3M)",value:vtVal,status:vtSt}]}
        thresholds={[{y:20,label:"Watch",c:"var(--yellow)"},{y:25,label:"Elevated",c:"var(--orange)"},{y:30,label:"Critical",c:"var(--red)"}]} />
      <IndexCard title="Rates Volatility" question="Are rates markets stressed?" ticker="MOVE" data={ind.MOVE}
        def="ICE BofAML MOVE Index — implied volatility of US Treasury options."
        extraLines={[]}
        thresholds={[{y:100,label:"Watch",c:"var(--yellow)"},{y:120,label:"Elevated",c:"var(--orange)"},{y:140,label:"Critical",c:"var(--red)"}]} />
      <IndexCard title="Funding Cost" question="Is funding tight?" ticker="SOFR" data={ind.SOFR} isSofr={true}
        def="Secured Overnight Financing Rate."
        extraLines={[]}
        thresholds={[{y:4.5,label:"Watch",c:"var(--yellow)"},{y:5.0,label:"Elevated",c:"var(--orange)"}]} />
      <FlowCard title="Market Flows" question="Are flows de-risking?" spy={ind.SPY} qqq={ind.QQQ} eem={ind.EEM}
        def="Daily ETF price changes as institutional/retail flow proxy. SPY (S&P 500), QQQ (Nasdaq 100), EEM (Emerging Markets)." />
    </div>

    {/* 4. Alerts + Themes + News */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
      <TopAlerts liveData={liveData} savedSignals={savedSignals}/>
      <ThemesCompact/>
      <ActionNews articles={news}/>
    </div>

    {/* 5. Risk Guide at bottom */}
    <div onClick={()=>setShowGuide(!showGuide)} style={{textAlign:"center",padding:"10px",cursor:"pointer",fontFamily:"var(--f)",fontSize:11,fontWeight:500,color:"var(--accent)",background:"var(--card)",border:"1px solid var(--border)",borderRadius:8,boxShadow:"var(--sh)",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
      <span style={{transform:showGuide?"rotate(180deg)":"rotate(0)",transition:"transform 0.2s",display:"inline-block"}}>▼</span>
      📖 {showGuide?"Hide":"Show"} Risk Guide & Methodology
    </div>

    {showGuide&&<div style={{marginTop:14,animation:"fadeUp 0.25s ease-out"}}><RiskGuide onClose={()=>setShowGuide(false)}/></div>}

    <div style={{marginTop:24,paddingTop:10,borderTop:"1px solid var(--border)",fontFamily:"var(--f)",fontSize:8,color:"var(--text-m)",display:"flex",justifyContent:"space-between"}}>
      <span>Hedge Funds Market Surveillance v3.0 · 21 signals · 8 live feeds</span>
      <span>News: Finnhub, Hedgeweek, FT, Insider Monkey, Alpha Week, Google News</span>
    </div>
  </div>;
}

ReactDOM.render(<App/>,document.getElementById("root"));
</script>
</body>
</html>
