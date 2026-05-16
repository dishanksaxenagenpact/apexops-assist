/* ApexAssist v5 · Dynamic Dashboard Engine */
(function(){
'use strict';

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if(cls) e.className = cls; if(html!=null) e.innerHTML = html; return e; };
const labelFor = a => ({detector:'Monitoring',triage:'Triage',rca:'RCA',remediate:'Self Heal',validator:'Validator',comms:'Smart Notify',knowledge:'Learning Engine',orch:'Orchestrator'}[a]||a);

/* ====== REVEAL ====== */
const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')),{threshold:.12});
document.querySelectorAll('.reveal').forEach(n => io.observe(n));

/* ====== GLOBAL FILTER STATE ====== */
const F = { env:'prod', cluster:'all', severity:'all', timeRange:'30d' };

/* ====== DATA ENGINE ====== */
function seed(s){ let h=0; for(let i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0; return Math.abs(h); }
function jitter(base, pct){ return +(base*(1+(Math.random()*2-1)*pct/100)).toFixed(2); }

const ENV_PROFILES = {
  prod:    {mttr:87,autoRes:73,rcas:1284,healed:98,noise:62,p1s:47,uptime:99.97,sla:99.97,autoRate:73,avgMttr:'2m 41s',mttrPct:13,snr:62,incPerDay:47,agents:8},
  staging: {mttr:72,autoRes:58,rcas:412,healed:34,noise:48,p1s:12,uptime:99.82,sla:99.82,autoRate:58,avgMttr:'4m 12s',mttrPct:21,snr:48,incPerDay:18,agents:6},
  dev:     {mttr:54,autoRes:41,rcas:87,healed:11,noise:35,p1s:3,uptime:99.44,sla:99.44,autoRate:41,avgMttr:'7m 38s',mttrPct:38,snr:35,incPerDay:6,agents:4},
};

const CLUSTER_MULT = {all:1, orders:0.35, payments:0.28, auth:0.22, infra:0.15};
const SEV_MULT = {all:1, p1:0.14, p2:0.26, p3:0.38};

function getData(){
  const base = ENV_PROFILES[F.env];
  const cm = CLUSTER_MULT[F.cluster]||1;
  const sm = SEV_MULT[F.severity]||1;
  const m = cm * (F.severity==='all'?1:sm/0.38);
  return {
    mttr: Math.round(base.mttr * (0.9+cm*0.1)),
    autoRes: Math.round(base.autoRes * (0.85+cm*0.15)),
    rcas: Math.round(base.rcas * m),
    healed: Math.max(1,Math.round(base.healed * cm)),
    noise: Math.round(base.noise * (0.8+cm*0.2)),
    p1s: Math.max(0,Math.round(base.p1s * m)),
    uptime: +(base.uptime - (1-cm)*0.01).toFixed(2),
    sla: +(base.sla - (1-cm)*0.01).toFixed(2),
    autoRate: Math.round(base.autoRate * (0.85+cm*0.15)),
    avgMttr: base.avgMttr,
    mttrPct: base.mttrPct,
    snr: Math.round(base.snr * (0.8+cm*0.2)),
    incPerDay: Math.max(1,Math.round(base.incPerDay * m)),
    agents: base.agents,
    sevMix: F.severity==='all'
      ? {p1:14,p2:26,p3:38,info:22}
      : F.severity==='p1'?{p1:72,p2:18,p3:7,info:3}
      : F.severity==='p2'?{p1:8,p2:64,p3:20,info:8}
      : {p1:4,p2:12,p3:62,info:22},
    agentLoads: Object.fromEntries(AGENTS.map(a=>[a.key, Math.max(5,Math.min(99,Math.round(a.load*(0.7+cm*0.3)*(F.env==='prod'?1:F.env==='staging'?0.7:0.4)+jitter(0,10))))])),
  };
}

/* ====== AGENTS ====== */
const AGENTS = [
  {key:'orch',      name:'Orchestrator',    model:'sonnet', load:86},
  {key:'detector',  name:'Monitoring',      model:'sonnet', load:94},
  {key:'triage',    name:'Triage',          model:'sonnet', load:71},
  {key:'rca',       name:'RCA',             model:'sonnet', load:68},
  {key:'remediate', name:'Self Heal',       model:'sonnet', load:54},
  {key:'validator', name:'Validator',       model:'sonnet', load:61},
  {key:'comms',     name:'Smart Notify',    model:'sonnet', load:42},
  {key:'knowledge', name:'Learning Engine', model:'sonnet', load:38},
];

/* ====== ANIMATED VALUE UPDATE ====== */
function animVal(node, target, suffix, dur){
  if(!node) return;
  dur = dur||600;
  const start = parseFloat(node.textContent.replace(/[^0-9.\-]/g,''))||0;
  const dec = String(target).includes('.')?2:0;
  const t0 = performance.now();
  function step(t){
    const p = Math.min(1,(t-t0)/dur);
    const e = 1-Math.pow(1-p,3);
    const v = start+(target-start)*e;
    node.textContent = (dec?v.toFixed(dec):Math.round(v).toLocaleString())+(suffix||'');
    if(p<1) requestAnimationFrame(step);
    else { node.classList.add('val-flash'); setTimeout(()=>node.classList.remove('val-flash'),600); }
  }
  requestAnimationFrame(step);
}

/* ====== KPI FINDER ====== */
function kpiByLabel(label){
  const all = document.querySelectorAll('.kpi');
  for(const k of all){ if(k.querySelector('.kpi-label')?.textContent===label) return k; }
}
function kpiVal(label){ const k=kpiByLabel(label); return k?.querySelector('.kpi-value span'); }
function kpiDelta(label){ const k=kpiByLabel(label); return k?.querySelector('.kpi-delta'); }

/* ====== OP HEALTH FINDER ====== */
function opHealthItems(){
  const card = document.querySelector('.card-purple');
  if(!card) return [];
  return card.querySelectorAll('.space-y-4 > div');
}

/* ====== UPDATE ALL PANELS ====== */
function updateDashboard(animate){
  const d = getData();
  const dur = animate?600:0;

  /* KPIs */
  animVal(kpiVal('MTTR reduction'),d.mttr,'%',dur);
  animVal(kpiVal('Auto-resolved'),d.autoRes,'%',dur);
  animVal(kpiVal('RCAs delivered'),d.rcas,'',dur);
  const sh=$('selfHealed');
  if(sh) animVal(sh,d.healed,'',dur);
  animVal(kpiVal('Noise suppressed'),d.noise,'%',dur);
  animVal(kpiVal('P1s prevented'),d.p1s,'',dur);
  animVal(kpiVal('Uptime SLA'),d.uptime,'%',dur);

  /* KPI deltas */
  const mttrD=kpiDelta('MTTR reduction');
  if(mttrD) mttrD.innerHTML = F.env==='prod'?'▼ 20m→2m 41s':F.env==='staging'?'▼ 15m→4m 12s':'▼ 10m→7m 38s';
  const resD=kpiDelta('Auto-resolved');
  if(resD) resD.innerHTML = `▲ ${(d.autoRes*0.05).toFixed(1)} pts`;
  const noiseD=kpiDelta('Noise suppressed');
  if(noiseD) noiseD.innerHTML = `▲ ${Math.round(d.noise*0.12)} pts`;

  /* Header stats */
  const si=$('statIncidents');
  if(si) animVal(si,d.incPerDay,'',dur);

  /* Operational Health */
  const ohItems = opHealthItems();
  const ohData = [
    {val:d.sla+'%',pct:Math.min(100,d.sla),color:'#22C55E'},
    {val:d.autoRate+'%',pct:d.autoRate},
    {val:d.avgMttr,pct:d.mttrPct,color:'linear-gradient(90deg,#06B6D4,#22C55E)'},
    {val:d.snr+'%',pct:d.snr,color:'linear-gradient(90deg,#F59E0B,#FF4F59)'},
  ];
  ohItems.forEach((item,i)=>{
    if(!ohData[i]) return;
    const valEl = item.querySelector('.font-display');
    if(valEl && typeof ohData[i].val==='string') valEl.textContent = ohData[i].val;
    const bar = item.querySelector('.progress-fill');
    if(bar) bar.style.width = ohData[i].pct+'%';
  });
  const snrMeta = ohItems[3]?.querySelector('.font-mono.text-\\[10px\\]');
  if(snrMeta) snrMeta.textContent = `${100-d.snr}% noise suppressed by Detector`;

  /* Agent grid (right card) */
  const agentGrid = $('agentGrid');
  if(agentGrid){
    agentGrid.innerHTML='';
    AGENTS.forEach(a => {
      const load = d.agentLoads[a.key]||a.load;
      const r = el('div','flex items-center gap-3 text-[12.5px]');
      r.innerHTML = `
        <span class="atag atag-${a.key}" style="min-width:90px">${a.name}</span>
        <div class="flex-1"><div class="progress-bar"><div class="progress-fill" style="width:${load}%;transition:width .6s ease"></div></div></div>
        <span class="font-mono text-[color:var(--tx-3)] w-8 text-right">${load}%</span>
        <span class="${load>10?'dot-green':'dot-amber'} status-dot"></span>
      `;
      agentGrid.appendChild(r);
    });
  }

  /* Agent bars (bottom left) */
  const agentBars = $('agentBars');
  if(agentBars){
    agentBars.innerHTML='';
    AGENTS.forEach(a => {
      const load = d.agentLoads[a.key]||a.load;
      const r = el('div','');
      r.innerHTML = `
        <div class="flex items-center justify-between mb-1 text-[12px]">
          <span class="atag atag-${a.key}">${a.name}</span>
          <span class="font-mono text-[color:var(--tx-2)]">${load}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${load}%;transition:width .6s ease"></div></div>
      `;
      agentBars.appendChild(r);
    });
  }

  /* Severity donut */
  const sm = d.sevMix;
  const donutCard = document.querySelector('.col-span-12.lg\\:col-span-4:nth-child(2) svg') ||
    (() => { const cards = document.querySelectorAll('.col-span-12.lg\\:col-span-4'); return cards[1]?.querySelector('svg'); })();
  if(donutCard){
    const circles = donutCard.querySelectorAll('circle');
    const total = sm.p1+sm.p2+sm.p3+sm.info;
    const circ = 2*Math.PI*48;
    if(circles[1]) circles[1].setAttribute('stroke-dasharray',`${sm.p1/total*circ} ${circ}`);
    if(circles[2]){ circles[2].setAttribute('stroke-dasharray',`${sm.p2/total*circ} ${circ}`); circles[2].setAttribute('stroke-dashoffset',`${-sm.p1/total*circ}`); }
    if(circles[3]){ circles[3].setAttribute('stroke-dasharray',`${sm.p3/total*circ} ${circ}`); circles[3].setAttribute('stroke-dashoffset',`${-(sm.p1+sm.p2)/total*circ}`); }
    if(circles[4]){ circles[4].setAttribute('stroke-dasharray',`${sm.info/total*circ} ${circ}`); circles[4].setAttribute('stroke-dashoffset',`${-(sm.p1+sm.p2+sm.p3)/total*circ}`); }
  }
  // Update percentage labels
  const sevLabels = document.querySelectorAll('.col-span-12.lg\\:col-span-4');
  if(sevLabels[1]){
    const pcts = sevLabels[1].querySelectorAll('.font-mono.font-semibold');
    if(pcts[0]) pcts[0].textContent=sm.p1+'%';
    if(pcts[1]) pcts[1].textContent=sm.p2+'%';
    if(pcts[2]) pcts[2].textContent=sm.p3+'%';
    if(pcts[3]) pcts[3].textContent=sm.info+'%';
  }

  /* Severity resolution bars */
  if(sevLabels[1]){
    const resBars = sevLabels[1].querySelectorAll('.border-t .progress-fill');
    const selfH = d.autoRes;
    const withAppr = Math.round((100-selfH)*0.75);
    const esc = 100-selfH-withAppr;
    if(resBars[0]) resBars[0].style.width=selfH+'%';
    if(resBars[1]) resBars[1].style.width=withAppr+'%';
    if(resBars[2]) resBars[2].style.width=esc+'%';
    const resPcts = sevLabels[1].querySelectorAll('.border-t .font-mono');
    if(resPcts[0]) resPcts[0].textContent=selfH+'%';
    if(resPcts[1]) resPcts[1].textContent=withAppr+'%';
    if(resPcts[2]) resPcts[2].textContent=esc+'%';
  }

  /* Incidents table */
  updateIncidents(d);

  /* Chart */
  updateChart(F.timeRange);

  /* Responsible AI */
  updateResponsibleAI();
}

/* ====== INCIDENTS TABLE (filter-aware) ====== */
const ALL_INCIDENTS = [
  {id:'INC-205211',sev:'P1',cls:'pill-p1',svc:'orders-api',cluster:'orders',done:8,total:8,mttr:'2m 41s',st:'resolved',stCls:'pill-green'},
  {id:'INC-205207',sev:'P2',cls:'pill-p2',svc:'checkout-svc',cluster:'orders',done:8,total:8,mttr:'1m 12s',st:'resolved',stCls:'pill-green'},
  {id:'INC-205202',sev:'P2',cls:'pill-p2',svc:'payments-worker',cluster:'payments',done:7,total:8,mttr:'3m 04s',st:'validating',stCls:'pill-purple'},
  {id:'INC-205198',sev:'P3',cls:'pill-p3',svc:'search-api',cluster:'infra',done:5,total:8,mttr:'—',st:'remediating',stCls:'pill-p2'},
  {id:'INC-205190',sev:'P1',cls:'pill-p1',svc:'auth-gateway',cluster:'auth',done:8,total:8,mttr:'4m 18s',st:'resolved',stCls:'pill-green'},
  {id:'INC-205184',sev:'P3',cls:'pill-p3',svc:'reporting-job',cluster:'infra',done:3,total:8,mttr:'—',st:'awaiting gate',stCls:'pill-p1'},
  {id:'INC-205178',sev:'P2',cls:'pill-p2',svc:'payment-gateway',cluster:'payments',done:8,total:8,mttr:'1m 48s',st:'resolved',stCls:'pill-green'},
  {id:'INC-205172',sev:'P1',cls:'pill-p1',svc:'auth-token-svc',cluster:'auth',done:6,total:8,mttr:'—',st:'remediating',stCls:'pill-p2'},
  {id:'INC-205165',sev:'P3',cls:'pill-p3',svc:'log-aggregator',cluster:'infra',done:8,total:8,mttr:'0m 54s',st:'resolved',stCls:'pill-green'},
  {id:'INC-205159',sev:'P2',cls:'pill-p2',svc:'order-processor',cluster:'orders',done:4,total:8,mttr:'—',st:'investigating',stCls:'pill-p2'},
];

function miniPipe(d,t){
  let s='';for(let i=0;i<t;i++) s+=`<div style="flex:1;height:4px;border-radius:2px;${i<d?'background:linear-gradient(90deg,#8B5CF6,#EC4899)':'background:var(--bg-3)'}"></div>`;
  return `<div style="display:flex;gap:2px;min-width:120px">${s}</div>`;
}

function updateIncidents(d){
  const tbl=$('incidentRows');
  if(!tbl) return;
  tbl.innerHTML='';
  let rows = ALL_INCIDENTS;
  if(F.cluster!=='all') rows = rows.filter(r=>r.cluster===F.cluster);
  if(F.severity!=='all') rows = rows.filter(r=>r.sev.toLowerCase()===F.severity);
  if(rows.length===0) rows = ALL_INCIDENTS.slice(0,2); // fallback
  rows.forEach(r=>{
    const tr=el('tr');
    tr.style.cssText='opacity:0;transform:translateY(4px);transition:opacity .3s,transform .3s';
    tr.innerHTML=`<td class="font-mono">${r.id}</td><td><span class="pill ${r.cls}">${r.sev}</span></td><td>${r.svc}</td><td>${miniPipe(r.done,r.total)}</td><td class="font-mono">${r.mttr}</td><td><span class="pill ${r.stCls}">${r.st}</span></td>`;
    tbl.appendChild(tr);
    requestAnimationFrame(()=>{tr.style.opacity='1';tr.style.transform='none';});
  });
}

/* ====== RESPONSIBLE AI (env-aware) ====== */
function updateResponsibleAI(){
  const card = document.getElementById('responsible');
  if(!card) return;
  const bars = card.querySelectorAll('.progress-fill');
  const vals = card.querySelectorAll('.font-mono');
  const data = F.env==='prod'
    ? [98.7,100,100,99.2,100]
    : F.env==='staging'
    ? [94.2,100,100,96.8,98.5]
    : [88.1,95.0,100,91.4,92.0];
  data.forEach((v,i)=>{
    if(bars[i]) bars[i].style.width=v+'%';
    if(vals[i]) vals[i].textContent=v+'%';
  });
  // Human gates
  const gateSection = card.querySelector('.border-t');
  if(gateSection){
    const gateVal = gateSection.querySelector('.text-2xl');
    const gates = F.env==='prod'?14:F.env==='staging'?6:2;
    if(gateVal) animVal(gateVal,gates,'',400);
  }
}

/* ====== CHART (time-range + env + filter aware) ====== */
const chartSvg=$('incidentChart');
const chartTotal=$('chartTotal');
const chartDelta=$('chartDelta');

const CHART_DATA = {
  '24h': {
    xLabels:['00:00','03:00','06:00','09:00','12:00','15:00','18:00','21:00','Now'],
    prod: {
      yLabels:['35','25','15','5'], total:127, delta:'+12.3%',
      main:'M40,140 C80,155 140,160 200,130 S310,85 380,90 S480,110 540,75 S640,55 700,60',
      p1:'M40,178 C80,185 140,180 200,172 S310,165 380,175 S480,170 540,160 S640,155 700,162',
      dotCx:540,dotCy:75,tip:'+3.1%'
    },
    staging: {
      yLabels:['18','13','8','3'], total:48, delta:'+8.4%',
      main:'M40,165 C80,168 140,160 200,155 S310,148 380,152 S480,140 540,135 S640,128 700,122',
      p1:'M40,186 C80,188 140,185 200,182 S310,180 380,183 S480,178 540,175 S640,172 700,170',
      dotCx:540,dotCy:135,tip:'+1.8%'
    },
    dev: {
      yLabels:['6','4','2','1'], total:11, delta:'+22.1%',
      main:'M40,175 C80,180 140,172 200,178 S310,168 380,174 S480,165 540,170 S640,162 700,158',
      p1:'M40,192 C80,194 140,190 200,193 S310,189 380,192 S480,188 540,190 S640,187 700,185',
      dotCx:380,dotCy:174,tip:'+4.2%'
    }
  },
  '7d': {
    xLabels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun','',''],
    prod: {
      yLabels:['80','60','40','20'], total:412, delta:'+8.2%',
      main:'M40,150 C120,140 200,110 280,95 S440,70 520,65 S640,55 700,50',
      p1:'M40,182 C120,178 200,170 280,168 S440,155 520,150 S640,148 700,145',
      dotCx:520,dotCy:65,tip:'+2.4%'
    },
    staging: {
      yLabels:['40','30','20','10'], total:156, delta:'+5.6%',
      main:'M40,155 C120,150 200,142 280,138 S440,128 520,125 S640,120 700,115',
      p1:'M40,185 C120,183 200,180 280,178 S440,174 520,172 S640,170 700,168',
      dotCx:520,dotCy:125,tip:'+1.4%'
    },
    dev: {
      yLabels:['12','8','4','2'], total:34, delta:'+14.3%',
      main:'M40,172 C120,168 200,175 280,162 S440,170 520,158 S640,165 700,155',
      p1:'M40,190 C120,188 200,192 280,186 S440,190 520,185 S640,188 700,183',
      dotCx:280,dotCy:162,tip:'+3.6%'
    }
  },
  '30d': {
    xLabels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'],
    prod: {
      yLabels:['140','100','60','20'], total:1284, delta:'+6.7%',
      main:'M40,160 C120,145 200,120 280,100 S440,55 520,50 S640,42 700,38',
      p1:'M40,185 C120,180 200,172 280,165 S440,150 520,148 S640,142 700,140',
      dotCx:520,dotCy:50,tip:'+1.2%'
    },
    staging: {
      yLabels:['60','45','30','15'], total:487, delta:'+4.1%',
      main:'M40,152 C120,148 200,140 280,135 S440,122 520,118 S640,112 700,105',
      p1:'M40,182 C120,180 200,176 280,174 S440,168 520,165 S640,162 700,158',
      dotCx:520,dotCy:118,tip:'+0.8%'
    },
    dev: {
      yLabels:['14','10','6','2'], total:92, delta:'+9.8%',
      main:'M40,168 C120,172 200,162 280,170 S440,155 520,165 S640,150 700,145',
      p1:'M40,190 C120,192 200,188 280,191 S440,185 520,189 S640,183 700,180',
      dotCx:440,dotCy:155,tip:'+2.1%'
    }
  },
  '90d': {
    xLabels:['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov'],
    prod: {
      yLabels:['400','300','200','100'], total:3847, delta:'+4.1%',
      main:'M40,170 C120,160 200,142 280,125 S440,85 520,72 S640,50 700,42',
      p1:'M40,188 C120,185 200,178 280,170 S440,158 520,152 S640,148 700,144',
      dotCx:520,dotCy:72,tip:'+0.9%'
    },
    staging: {
      yLabels:['160','120','80','40'], total:1458, delta:'+3.2%',
      main:'M40,158 C120,152 200,145 280,138 S440,125 520,118 S640,110 700,102',
      p1:'M40,185 C120,182 200,178 280,175 S440,170 520,166 S640,162 700,158',
      dotCx:520,dotCy:118,tip:'+0.6%'
    },
    dev: {
      yLabels:['35','25','15','5'], total:276, delta:'+7.6%',
      main:'M40,170 C120,175 200,165 280,172 S440,158 520,168 S640,152 700,148',
      p1:'M40,192 C120,194 200,190 280,193 S440,188 520,191 S640,186 700,183',
      dotCx:440,dotCy:158,tip:'+1.8%'
    }
  }
};

function updateChart(range){
  if(!chartSvg) return;
  const tmpl = CHART_DATA[range];
  if(!tmpl) return;
  F.timeRange = range;

  const env = F.env||'prod';
  const d = tmpl[env]||tmpl.prod;

  const cm = CLUSTER_MULT[F.cluster]||1;
  const sm = F.severity==='all'?1:(SEV_MULT[F.severity]||1)/0.38;
  const total = Math.round(d.total * cm * sm);
  const scale = cm * (F.severity==='all'?1:sm);

  /* Scale path Y coords: push curves down (higher y) when filtering to smaller slice */
  function scalePath(path, factor){
    if(factor>=0.99) return path;
    const baseline=200;
    return path.replace(/([, ])([\d.]+)/g, (m, sep, val) => {
      const v=parseFloat(val);
      if(v>25 && v<201){ /* only Y coords in chart range */
        const dist=baseline-v; /* how far above baseline */
        const newDist=dist*factor;
        return sep+(baseline-newDist).toFixed(0);
      }
      return m;
    });
  }

  const mainScaled = scalePath(d.main, scale);
  const p1Scaled = scalePath(d.p1, scale);

  /* Scale dot position */
  const dotDist = 200-d.dotCy;
  const dotCyScaled = Math.round(200-dotDist*scale);

  /* Scale y-axis labels */
  const yLabels = d.yLabels.map(l => {
    const n = parseFloat(l);
    return String(Math.round(n * scale));
  });

  if(chartTotal) animVal(chartTotal, total, '', 500);
  if(chartDelta){ chartDelta.textContent=d.delta; chartDelta.className='pill pill-green text-[11px]'; }

  const xStep=660/8;
  const xHtml = tmpl.xLabels.map((l,i)=>l?`<text x="${40+i*xStep}" y="207">${l}</text>`:''  ).join('');
  const areaPath=mainScaled+' L700,200 L40,200 Z';
  const p1Area=p1Scaled+' L700,200 L40,200 Z';

  chartSvg.innerHTML = `
    <defs>
      <linearGradient id="aP1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF4F59" stop-opacity=".5"/><stop offset="1" stop-color="#FF4F59" stop-opacity="0"/></linearGradient>
      <linearGradient id="aP3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8B5CF6" stop-opacity=".5"/><stop offset="1" stop-color="#8B5CF6" stop-opacity="0"/></linearGradient>
      <linearGradient id="gLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8B5CF6"/><stop offset="1" stop-color="#EC4899"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g class="chart-grid"><line x1="40" y1="30" x2="700" y2="30"/><line x1="40" y1="80" x2="700" y2="80"/><line x1="40" y1="130" x2="700" y2="130"/><line x1="40" y1="180" x2="700" y2="180"/></g>
    <g class="chart-axis"><text x="34" y="34" text-anchor="end">${yLabels[0]}</text><text x="34" y="84" text-anchor="end">${yLabels[1]}</text><text x="34" y="134" text-anchor="end">${yLabels[2]}</text><text x="34" y="184" text-anchor="end">${yLabels[3]}</text></g>
    <path fill="url(#aP3)" stroke="none" d="${areaPath}" opacity=".6"/>
    <path fill="none" stroke="url(#gLine)" stroke-width="2.5" filter="url(#glow)" d="${mainScaled}"/>
    <path fill="url(#aP1)" stroke="none" d="${p1Area}" opacity=".4"/>
    <path fill="none" stroke="#EC4899" stroke-width="1.5" d="${p1Scaled}" opacity=".7"/>
    <circle cx="${d.dotCx}" cy="${dotCyScaled}" r="5" fill="#8B5CF6" stroke="#fff" stroke-width="2" filter="url(#glow)"/>
    <g transform="translate(${d.dotCx-45}, ${dotCyScaled-18})">
      <rect x="0" y="0" width="90" height="24" rx="6" fill="rgba(139,92,246,.25)" stroke="rgba(139,92,246,.5)"/>
      <text x="45" y="16" text-anchor="middle" fill="#fff" font-size="11" font-weight="600" font-family="Inter">${d.tip}</text>
    </g>
    <g class="chart-axis">${xHtml}</g>
  `;
}

/* ====== LIVE AGENT STREAM (filter-aware) ====== */
const liveActivity = $('liveActivity');
if(liveActivity){
  const EVENTS_BY_CLUSTER = {
    all:[
      ['orch','planned INC-205211 → invoked RCA · risk=low'],
      ['detector','correlated 6 signals across orders-api → INC-205212'],
      ['rca','top hypothesis (0.94): bad config in rel-2026.05.16-r3'],
      ['remediate','executed rb-orders-rollback → rollout 100% healthy'],
      ['validator','check_slo(orders-api, 90s) → green · holding'],
      ['comms','updated #sre-oncall · drafted exec summary'],
      ['triage','scored INC-205213 → P3 · blast=2svc · revenue=low'],
      ['knowledge','indexed postmortem-INC-205211 into runbook library'],
      ['detector','denoised 38 unrelated CPU alerts in payments cluster'],
      ['orch','hypothesis stable 60s → closed incident'],
      ['rca','fetched top-k postmortems · matched 2 prior incidents'],
      ['validator','p95=240ms · error_rate=0.04% · within SLO'],
      ['comms','posted to status page · 1.2k subscribers notified'],
      ['remediate','queued auto-scale policy for payments-worker pool'],
    ],
    orders:[
      ['detector','correlated 4 signals across orders-api → anomaly detected'],
      ['triage','scored INC-205212 → P2 · blast=orders-api · revenue=MED'],
      ['rca','hypothesis: order-processor OOM after batch import'],
      ['remediate','scaled order-processor replicas 3→6'],
      ['validator','orders-api p95=180ms · SLO recovered'],
      ['orch','closing INC-205212 · all SLOs green'],
    ],
    payments:[
      ['detector','payment-gateway latency spike detected · p99=4.2s'],
      ['triage','scored → P2 · blast=payment-gateway · revenue=HIGH'],
      ['rca','hypothesis: connection pool saturation on payments-db'],
      ['remediate','resized payments-db pool 50→100'],
      ['validator','payment-gateway p95=120ms · error_rate=0.01%'],
      ['comms','notified #payments-oncall · incident summary posted'],
    ],
    auth:[
      ['detector','auth-token-svc 5xx rate 12% → anomaly confirmed'],
      ['triage','scored → P1 · blast=global auth · revenue=CRITICAL'],
      ['rca','hypothesis: JWT signing key rotation missed'],
      ['remediate','rotated signing key + bounced gateway pods'],
      ['validator','auth-gateway success_rate=99.99%'],
      ['orch','auth incident auto-resolved · 2m 14s'],
    ],
    infra:[
      ['detector','k8s node ip-10-12-4-87 memory>92% · evictions started'],
      ['triage','scored → P2 · workload reschedulable'],
      ['rca','hypothesis: memory leak in log-aggregator DaemonSet'],
      ['remediate','cordoned node · pods rescheduled to healthy nodes'],
      ['validator','cluster healthy · no pod disruptions'],
      ['knowledge','indexed infra postmortem · updated runbook'],
    ],
  };

  let evtIdx=0;
  function streamTick(){
    const evts = EVENTS_BY_CLUSTER[F.cluster] || EVENTS_BY_CLUSTER.all;
    const [a,t]=evts[evtIdx%evts.length];
    const row=el('div','feed-row');
    row.style.cssText='opacity:0;transform:translateY(-4px);transition:opacity .35s,transform .35s';
    const now=new Date();
    const ts=[now.getHours(),now.getMinutes(),now.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');
    row.innerHTML=`<span class="feed-time">${ts}</span><span class="atag atag-${a}">${labelFor(a)}</span><span class="feed-msg">${t}</span>`;
    liveActivity.prepend(row);
    requestAnimationFrame(()=>{row.style.opacity='1';row.style.transform='none'});
    while(liveActivity.children.length>8) liveActivity.lastChild.remove();
    evtIdx++;
  }
  streamTick(); setInterval(streamTick,2200);
}

/* ====== LIVE CLOCK ====== */
function tickClock(){
  const c=$('liveClock');
  if(c){
    const now=new Date();
    c.textContent=now.toTimeString().slice(0,8);
  }
}
setInterval(tickClock,1000); tickClock();

/* ====== REFRESH INDICATOR ====== */
let lastRefreshTime = Date.now();
function tickRefresh(){
  const el=$('lastRefresh');
  if(!el) return;
  const ago = Math.round((Date.now()-lastRefreshTime)/1000);
  el.textContent = `↻ ${ago}s ago`;
}
setInterval(tickRefresh,1000);

/* ====== MICRO-JITTER (live feel) ====== */
setInterval(()=>{
  if(!$('selfHealed')) return;
  // Randomly bump self-healed
  if(Math.random()<0.35){
    const sh=$('selfHealed');
    const c=parseInt(sh.textContent.replace(/\D/g,''),10)||0;
    sh.textContent=(c+1).toLocaleString();
    sh.classList.add('val-flash'); setTimeout(()=>sh.classList.remove('val-flash'),600);
  }
  // Randomly bump RCAs
  const rcaEl = kpiVal('RCAs delivered');
  if(rcaEl && Math.random()<0.25){
    const c=parseInt(rcaEl.textContent.replace(/\D/g,''),10)||0;
    rcaEl.textContent=(c+1).toLocaleString();
    rcaEl.classList.add('val-flash'); setTimeout(()=>rcaEl.classList.remove('val-flash'),600);
  }
  // Jitter agent loads
  const agentGrid=$('agentGrid');
  if(agentGrid){
    const fills = agentGrid.querySelectorAll('.progress-fill');
    const pcts = agentGrid.querySelectorAll('.text-right');
    fills.forEach((f,i)=>{
      if(Math.random()<0.3){
        let w = parseInt(f.style.width)||50;
        w = Math.max(10,Math.min(99,w+Math.round(Math.random()*6-3)));
        f.style.width=w+'%';
        if(pcts[i]) pcts[i].textContent=w+'%';
      }
    });
  }
},3500);

/* ====== FILTER EVENT HANDLERS ====== */
document.querySelectorAll('.filter-pills').forEach(group=>{
  const filterKey = group.dataset.filter;
  group.querySelectorAll('.filter-pill').forEach(btn=>{
    btn.addEventListener('click',()=>{
      group.querySelectorAll('.filter-pill').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      F[filterKey] = btn.dataset.value;
      lastRefreshTime = Date.now();
      const ref=$('lastRefresh');
      if(ref){ ref.innerHTML='<span class="refresh-spinning">↻</span> updating…'; }
      setTimeout(()=>{
        updateDashboard(true);
        if(ref) ref.textContent='↻ 0s ago';
      },150);
    });
  });
});

/* ====== INITIAL RENDER ====== */
/* Counter animation for initial load */
document.querySelectorAll('[data-counter]').forEach(node=>{
  const target = parseFloat(node.dataset.counter);
  const dec = parseInt(node.dataset.decimals||'0',10);
  const suffix = node.dataset.suffix||'';
  const dur = 1200; const t0 = performance.now();
  function step(t){
    const p = Math.min(1,(t-t0)/dur);
    const e = 1 - Math.pow(1-p,3);
    node.textContent = (dec ? (target*e).toFixed(dec) : Math.round(target*e).toLocaleString()) + suffix;
    if(p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
});

/* Build initial dashboard (no animation, data already in HTML) */
setTimeout(()=>{
  /* Render agent grid + bars + incidents on first load */
  const d = getData();
  const agentGrid = $('agentGrid');
  if(agentGrid){
    agentGrid.innerHTML='';
    AGENTS.forEach(a => {
      const load = d.agentLoads[a.key]||a.load;
      const r = el('div','flex items-center gap-3 text-[12.5px]');
      r.innerHTML = `
        <span class="atag atag-${a.key}" style="min-width:90px">${a.name}</span>
        <div class="flex-1"><div class="progress-bar"><div class="progress-fill" style="width:${load}%;transition:width .6s ease"></div></div></div>
        <span class="font-mono text-[color:var(--tx-3)] w-8 text-right">${load}%</span>
        <span class="dot-green status-dot"></span>
      `;
      agentGrid.appendChild(r);
    });
  }
  const agentBars = $('agentBars');
  if(agentBars){
    agentBars.innerHTML='';
    AGENTS.forEach(a => {
      const load = d.agentLoads[a.key]||a.load;
      const r = el('div','');
      r.innerHTML = `
        <div class="flex items-center justify-between mb-1 text-[12px]">
          <span class="atag atag-${a.key}">${a.name}</span>
          <span class="font-mono text-[color:var(--tx-2)]">${load}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${load}%;transition:width .6s ease"></div></div>
      `;
      agentBars.appendChild(r);
    });
  }
  updateIncidents(d);
},100);

/* ====== Severity Mix title (filter-aware) ====== */
const sevTitle = document.querySelector('.col-span-12.lg\\:col-span-4:nth-child(2) .font-display');

/* ====================================================================
   DEMO PAGE
   ==================================================================== */

const SCENARIOS = [
  {key:'latency', sev:'P1',cls:'pill-p1',icon:'⚡',inc:'INC-204871',title:'orders-api latency spike',desc:'Revenue-critical API degraded after deploy',impact:'US-East',agents:7},
  {key:'db',      sev:'P2',cls:'pill-p2',icon:'🗄',inc:'INC-204902',title:'DB connection pool exhaustion',desc:'Shared Postgres pool saturated',impact:'EU-West',agents:6},
  {key:'k8s',     sev:'P2',cls:'pill-p2',icon:'☸',inc:'INC-204955',title:'K8s node memory pressure',desc:'Memory leak in payments-worker · 3 evictions',impact:'US-West',agents:7},
  {key:'auth',    sev:'P1',cls:'pill-p1',icon:'🔐',inc:'INC-205012',title:'auth-gateway 5xx surge',desc:'JWT validation failures across regions',impact:'Global',agents:8},
  {key:'kafka',   sev:'P2',cls:'pill-p2',icon:'📡',inc:'INC-205044',title:'Kafka broker partition lag',desc:'broker-3 falling behind · lag > 2M msgs',impact:'EU-Central',agents:7},
  {key:'cdn',     sev:'P1',cls:'pill-p1',icon:'🌐',inc:'INC-205078',title:'CDN origin 504s in EU',desc:'Edge → origin timeouts for storefront assets',impact:'EU-West',agents:7},
  {key:'cert',    sev:'P3',cls:'pill-p3',icon:'📜',inc:'INC-205102',title:'TLS cert near expiry',desc:'api.acme.com cert expires in 48h',impact:'UAE',agents:5},
  {key:'dns',     sev:'P2',cls:'pill-p2',icon:'🧭',inc:'INC-205134',title:'DNS resolver flapping',desc:'Intermittent service discovery failures',impact:'US-East',agents:6},
  {key:'storage', sev:'P2',cls:'pill-p2',icon:'💾',inc:'INC-205171',title:'EBS volume IOPS throttle',desc:'mongo-prod-2 throttled · write latency 4×',impact:'UAE',agents:7},
  {key:'datacorrupt', sev:'P1',cls:'pill-p1',icon:'🔥',inc:'INC-205199',title:'DB replication split-brain',desc:'Primary-replica divergence after network partition · data integrity at risk',impact:'US-East',agents:8,escalated:true},
];

const STAGES=[
  {key:'detect',   label:'Detected',   icon:'🔍',agent:'detector', desc:'Signals correlated'},
  {key:'triage',   label:'Triaged',    icon:'📋',agent:'triage',   desc:'Severity scored'},
  {key:'rca',      label:'RCA',        icon:'🧠',agent:'rca',      desc:'Hypotheses ranked'},
  {key:'plan',     label:'Plan',       icon:'📐',agent:'orch',     desc:'Remediation chosen'},
  {key:'gate',     label:'Approval',   icon:'🔒',agent:'comms',    desc:'Human gate'},
  {key:'remediate',label:'Self-heal',  icon:'🔧',agent:'remediate',desc:'Runbook executed'},
  {key:'validate', label:'Validated',  icon:'✅',agent:'validator', desc:'SLO recovered'},
  {key:'close',    label:'Closed',     icon:'📝',agent:'knowledge', desc:'Postmortem indexed'},
];

function stepsFor(key){
  const m=o=>Object.assign({},o);
  const all={
    latency:[
      m({stage:'detect', msg:'Ingested 5 correlated signals (Datadog · OTel · deploy webhook)'}),
      m({stage:'detect', msg:'Noise filter rejected 38 unrelated alerts (CPU, GC)'}),
      m({stage:'triage', msg:'severity=P1 · blast_radius=12 services · revenue=HIGH ($14k/min)'}),
      m({stage:'rca',    msg:'Fetched 24h change window · pulled top-3 prior postmortems'}),
      m({stage:'rca',    hyp:[{id:'H1',summary:'Bad config in deploy rel-2026.05.16-r3',conf:.94,evidence:['signal:err_rate','signal:p95_lat','change:rel-r3']},{id:'H2',summary:'DB connection pool exhaustion',conf:.22,evidence:['signal:pool_wait']},{id:'H3',summary:'Noisy neighbour on shared node',conf:.08,evidence:['signal:cpu']}], msg:'3 ranked hypotheses · top: bad config (0.94)'}),
      m({stage:'plan',   msg:'Plan: rollback rel-2026.05.16-r3 · destructive=YES → request approval'}),
      m({stage:'gate',   tool:{name:'comms.update',args:{channel:'slack',to:'@sre-oncall',payload:'Rollback rel-r3?'},status:'sent'}, msg:'Requested approval from @sre-oncall'}),
      m({stage:'gate',   gate:'✓ Approved by @sre-oncall in 38s'}),
      m({stage:'remediate', tool:{name:'remediator.execute',args:{runbook:'rb-orders-rollback',to:'rel-r2'},status:'running'}, msg:'Executing rollback → rolling 100% traffic to rel-r2'}),
      m({stage:'remediate', msg:'Rollout healthy · readiness probes OK · traffic shifted'}),
      m({stage:'validate',  tool:{name:'validator.check_slo',args:{service:'orders-api',window:'90s'},status:'green'}, msg:'p95=240ms · error_rate=0.04% · SLO recovered'}),
      m({stage:'validate',  msg:'Holding green for 90s confirmation window'}),
      m({stage:'close', tool:{name:'comms.update',args:{audience:'execs',channel:'email'},status:'sent'}, msg:'Exec summary delivered · status page updated'}),
      m({stage:'close', tool:{name:'knowledge.persist',args:{postmortem:'pm-INC-204871-v1'},status:'indexed'}, msg:'Postmortem-as-code published · runbook library updated'}),
    ],
    db:[
      m({stage:'detect', msg:'Anomaly detected: pool_wait_time 12× baseline across checkout · billing · profile services'}),
      m({stage:'detect', msg:'Correlated 14 signals from Datadog APM · Postgres pg_stat_activity · application OTel traces'}),
      m({stage:'detect', msg:'Active connections: 49/50 · waiting queries: 127 · avg wait: 4.2s (baseline 12ms)'}),
      m({stage:'triage', msg:'severity=P2 · shared dependency: postgres-primary-01 · blast_radius=3 customer-facing services'}),
      m({stage:'triage', msg:'Impact assessment: checkout error_rate 8.4% (SLO <1%) · billing webhook backlog 2,400 msgs · profile reads timing out'}),
      m({stage:'triage', msg:'Revenue impact estimated $2.1k/min · 340 active users affected · escalation timer started'}),
      m({stage:'rca',    msg:'Pulling 1h change window · querying deploy history · scanning slow query log'}),
      m({stage:'rca',    msg:'Fetched top-3 similar postmortems from runbook library (PM-1847, PM-2011, PM-2189)'}),
      m({stage:'rca',    hyp:[{id:'H1',summary:'Connection pool max_connections=50 too small for RPS surge (2.4× normal)',conf:.88,evidence:['signal:pool_wait','signal:rps_surge','pg:max_conn']},{id:'H2',summary:'Slow query on orders.line_items sequential scan holding connections',conf:.10,evidence:['signal:p95_query','pg:seq_scan']},{id:'H3',summary:'PgBouncer misconfiguration after last infra deploy',conf:.02,evidence:['change:infra-deploy-05.15']}], msg:'3 ranked hypotheses · top: pool undersized for traffic surge (0.88)'}),
      m({stage:'rca',    msg:'Evidence: RPS surged 1,200→2,880 at 14:02 UTC after marketing push · pool saturated at 14:04'}),
      m({stage:'plan',   msg:'Evaluating remediation options: (1) resize pool 50→120 (2) kill idle connections (3) enable PgBouncer transaction mode'}),
      m({stage:'plan',   msg:'Selected: resize pool 50→120 · reversible=YES · no downtime · estimated recovery <30s'}),
      m({stage:'plan',   msg:'Risk assessment: LOW · rollback plan: revert to max_conn=50 if latency increases'}),
      m({stage:'gate',   tool:{name:'comms.update',args:{channel:'slack',to:'#dba-alerts',payload:'Auto-resizing PG pool 50→120 on postgres-primary-01'},status:'sent'}, msg:'Notified #dba-alerts channel · auto-approval policy matched'}),
      m({stage:'gate',   gate:'⚙ Auto-approved by policy: reversible change · risk=LOW · no destructive mutations'}),
      m({stage:'remediate', tool:{name:'remediator.execute',args:{runbook:'rb-pg-pool-resize',target:'postgres-primary-01',max_conn:120,apply_to:'primary+replicas'},status:'running'}, msg:'Executing rb-pg-pool-resize on postgres-primary-01'}),
      m({stage:'remediate', msg:'Step 1/3: ALTER SYSTEM SET max_connections = 120 on primary · applied'}),
      m({stage:'remediate', msg:'Step 2/3: Propagating to replicas (replica-01, replica-02) · pg_reload_conf() sent'}),
      m({stage:'remediate', msg:'Step 3/3: Connection pool resized · 120 slots available · waiting queries draining'}),
      m({stage:'validate',  msg:'Monitoring SLO recovery window: 60s · checking checkout-svc, billing-svc, profile-svc'}),
      m({stage:'validate',  tool:{name:'validator.check_slo',args:{service:'checkout-svc',window:'60s'},status:'green'}, msg:'checkout-svc: error_rate 0.03% ✓ · p95 latency 180ms ✓ · pool_wait 8ms ✓'}),
      m({stage:'validate',  tool:{name:'validator.check_slo',args:{service:'billing-svc',window:'60s'},status:'green'}, msg:'billing-svc: webhook backlog draining 340/s · queue will clear in ~7s ✓'}),
      m({stage:'validate',  tool:{name:'validator.check_slo',args:{service:'profile-svc',window:'60s'},status:'green'}, msg:'profile-svc: read latency normalised to 24ms ✓ · all SLOs green across 3 services'}),
      m({stage:'close', tool:{name:'comms.update',args:{audience:'stakeholders',channel:'slack+email'},status:'sent'}, msg:'Incident summary posted to #incidents · stakeholder email sent · status page updated'}),
      m({stage:'close', tool:{name:'knowledge.persist',args:{postmortem:'pm-INC-204902-v1',proposal:'auto-scale pool by RPS'},status:'indexed'}, msg:'Postmortem-as-code published · learning: auto-scale pool threshold at 70% utilisation'}),
      m({stage:'close', msg:'Incident resolved in 1m 12s · fully autonomous · zero human intervention required'}),
    ],
    k8s:[
      m({stage:'detect', msg:'Node ip-10-12-4-87 memory>92% · 3 evictions in 4m'}),
      m({stage:'triage', msg:'severity=P2 · workload reschedulable · no data loss risk'}),
      m({stage:'rca',    hyp:[{id:'H1',summary:'Memory leak in payments-worker pod',conf:.84,evidence:['signal:rss_growth','signal:evictions']},{id:'H2',summary:'Noisy neighbour on shared node',conf:.12,evidence:['signal:cpu_steal']}], msg:'2 hypotheses · top: memory leak (0.84)'}),
      m({stage:'plan',   msg:'Plan: cordon+drain node · medium risk · requesting approval'}),
      m({stage:'gate',   gate:'✓ Approved by @platform-oncall in 42s'}),
      m({stage:'remediate', tool:{name:'remediator.execute',args:{runbook:'rb-k8s-cordon-drain',node:'ip-10-12-4-87'},status:'running'}, msg:'Cordoned · 7 pods rescheduled to healthy nodes'}),
      m({stage:'validate',  tool:{name:'validator.check_slo',args:{cluster:'prod-01',window:'90s'},status:'green'}, msg:'Cluster healthy · payments-worker stable'}),
      m({stage:'close', tool:{name:'knowledge.persist',args:{jira:'TECH-4821'},status:'created'}, msg:'Jira TECH-4821 created · postmortem indexed'}),
    ],
    auth:[
      m({stage:'detect', msg:'5xx surge on auth-gateway across us-east+eu-west'}),
      m({stage:'triage', msg:'severity=P1 · login flow broken · global blast radius'}),
      m({stage:'rca',    hyp:[{id:'H1',summary:'Expired JWT signing key not rotated',conf:.91,evidence:['log:invalid_signature','change:none_24h']},{id:'H2',summary:'IDP outage upstream',conf:.06,evidence:['signal:idp_latency']}], msg:'top: JWT key rotation missed (0.91)'}),
      m({stage:'plan',   msg:'Plan: rotate signing key + bounce gateways · destructive=YES'}),
      m({stage:'gate',   gate:'✓ Approved by @security-oncall in 51s'}),
      m({stage:'remediate', tool:{name:'remediator.execute',args:{runbook:'rb-jwt-rotate',kid:'2026-05-16'},status:'applied'}, msg:'New signing key issued · gateways bounced'}),
      m({stage:'validate',  tool:{name:'validator.check_slo',args:{service:'auth-gateway',window:'120s'},status:'green'}, msg:'Success rate 99.99% · login flow healthy'}),
      m({stage:'close', tool:{name:'knowledge.persist',args:{control:'auto-rotation alert -14d'},status:'indexed'}, msg:'Added control: alert 14d before key expiry'}),
    ],
    kafka:[
      m({stage:'detect', msg:'broker-3 consumer lag>2M msgs · partition reassignment detected'}),
      m({stage:'triage', msg:'severity=P2 · analytics delayed · no customer impact yet'}),
      m({stage:'rca',    hyp:[{id:'H1',summary:'Disk IO saturation on broker-3',conf:.86,evidence:['signal:disk_util','signal:io_wait']},{id:'H2',summary:'Leader skew across brokers',conf:.18,evidence:['signal:leader_imbalance']}], msg:'top: disk IO saturation (0.86)'}),
      m({stage:'plan',   msg:'Plan: rebalance partitions from broker-3 · low risk'}),
      m({stage:'gate',   gate:'⚙ Auto-approved (reversible rebalance)'}),
      m({stage:'remediate', tool:{name:'remediator.execute',args:{runbook:'rb-kafka-rebalance',from:'broker-3'},status:'running'}, msg:'Rebalancing · moving 18 leaders off broker-3'}),
      m({stage:'validate',  tool:{name:'validator.check_slo',args:{topic:'orders.events',window:'5m'},status:'green'}, msg:'Lag draining 320k/s · projected zero in 6m'}),
      m({stage:'close', msg:'Closed · proposal queued: NVMe storage for broker-3'}),
    ],
    cdn:[
      m({stage:'detect', msg:'Edge eu-west reporting 504s on /assets/* paths'}),
      m({stage:'triage', msg:'severity=P1 · storefront image loads failing · revenue impact'}),
      m({stage:'rca',    hyp:[{id:'H1',summary:'Origin S3 bucket regional outage',conf:.79,evidence:['signal:origin_5xx','aws:status_page']},{id:'H2',summary:'Edge cache eviction storm',conf:.18,evidence:['signal:cache_miss']}], msg:'top: origin regional outage (0.79)'}),
      m({stage:'plan',   msg:'Plan: failover origin to us-east replica'}),
      m({stage:'gate',   gate:'✓ Approved by @sre-oncall in 29s'}),
      m({stage:'remediate', tool:{name:'remediator.execute',args:{runbook:'rb-cdn-origin-failover',region:'us-east-1'},status:'applied'}, msg:'Origin failed over · TTL 60s'}),
      m({stage:'validate',  tool:{name:'validator.check_slo',args:{service:'storefront-cdn',window:'90s'},status:'green'}, msg:'504 rate→0.02% · cache warming'}),
      m({stage:'close', msg:'Postmortem indexed · AWS confirmed s3 eu-west event'}),
    ],
    cert:[
      m({stage:'detect', msg:'cert-monitor: api.acme.com expires in 47h 52m'}),
      m({stage:'triage', msg:'severity=P3 · pre-emptive · prevents future P1 outage'}),
      m({stage:'rca',    hyp:[{id:'H1',summary:'Auto-renewal lambda failed silently 3 cycles',conf:.97,evidence:['log:lambda_error','schedule:miss']}], msg:'top: auto-renew lambda failed (0.97)'}),
      m({stage:'plan',   msg:'Plan: issue new cert + repair lambda · low risk'}),
      m({stage:'gate',   gate:'⚙ Auto-approved (low risk · pre-emptive)'}),
      m({stage:'remediate', tool:{name:'remediator.execute',args:{runbook:'rb-acme-issue',host:'api.acme.com'},status:'applied'}, msg:'New cert issued via ACME · deployed'}),
      m({stage:'close', msg:'Lambda fixed · alerting added for renewal failures'}),
    ],
    dns:[
      m({stage:'detect', msg:'Intermittent NXDOMAIN across 3 services · last 8m'}),
      m({stage:'triage', msg:'severity=P2 · partial degradation'}),
      m({stage:'rca',    hyp:[{id:'H1',summary:'Resolver pod restart loop in vpc-prod-1',conf:.82,evidence:['k8s:restart_count','signal:dns_nxdomain']}], msg:'top: resolver flapping (0.82)'}),
      m({stage:'plan',   msg:'Plan: scale coredns 3→6 · low risk'}),
      m({stage:'gate',   gate:'⚙ Auto-approved'}),
      m({stage:'remediate', tool:{name:'remediator.execute',args:{runbook:'rb-coredns-scale',replicas:6},status:'applied'}, msg:'Scaled coredns to 6 · old pods recycled'}),
      m({stage:'validate', msg:'NXDOMAIN rate→baseline · service discovery healthy'}),
      m({stage:'close', msg:'HPA policy updated to min 6 replicas'}),
    ],
    storage:[
      m({stage:'detect', msg:'mongo-prod-2: write latency 4× baseline · IOPS limit hit'}),
      m({stage:'triage', msg:'severity=P2 · degraded writes · reporting jobs queueing'}),
      m({stage:'rca',    hyp:[{id:'H1',summary:'EBS gp3 baseline IOPS exhausted',conf:.89,evidence:['aws:ebs_throttle','signal:write_latency']},{id:'H2',summary:'Index missing on hot collection',conf:.09,evidence:['mongo:collscan']}], msg:'top: EBS IOPS throttle (0.89)'}),
      m({stage:'plan',   msg:'Plan: upgrade volume 3000→12000 IOPS · +$140/mo'}),
      m({stage:'gate',   gate:'✓ Approved by @platform-oncall in 33s'}),
      m({stage:'remediate', tool:{name:'remediator.execute',args:{runbook:'rb-ebs-modify',iops:12000},status:'applied'}, msg:'Volume modified to 12k IOPS · no downtime'}),
      m({stage:'validate',  tool:{name:'validator.check_slo',args:{db:'mongo-prod-2'},status:'green'}, msg:'Write latency→8ms · queue draining'}),
      m({stage:'close', msg:'Postmortem indexed · added IOPS headroom alert'}),
    ],
    datacorrupt:[
      m({stage:'detect', msg:'Replication monitor: primary/replica checksum mismatch on orders_db · 14 tables diverged'}),
      m({stage:'detect', msg:'Cross-checked WAL segments · last consistent point: 06:14:22 UTC'}),
      m({stage:'triage', msg:'severity=P1 · data integrity compromised · blast_radius=ALL services · revenue=CRITICAL ($41k/min)'}),
      m({stage:'triage', msg:'Halted all write traffic to orders_db as precaution'}),
      m({stage:'rca',    hyp:[{id:'H1',summary:'Split-brain during AZ network partition at 06:12 UTC',conf:.82,evidence:['signal:repl_lag','aws:az_event','wal:divergence']},{id:'H2',summary:'Corrupted WAL from disk controller firmware bug',conf:.14,evidence:['signal:disk_errors','vendor:advisory']},{id:'H3',summary:'Application-level dual-write race condition',conf:.04,evidence:['log:concurrent_update']}], msg:'3 ranked hypotheses · top: split-brain during partition (0.82)'}),
      m({stage:'rca',    msg:'⚠ Confidence below 0.90 threshold · multiple plausible root causes · data loss risk HIGH'}),
      m({stage:'plan',   msg:'Plan: rebuild replica from primary snapshot · DESTRUCTIVE=YES · data_loss_risk=HIGH'}),
      m({stage:'plan',   msg:'⚠ Risk assessment: automated rebuild may propagate corrupted data if primary is not clean'}),
      m({stage:'gate',   tool:{name:'comms.update',args:{channel:'slack',to:'@dba-oncall',payload:'URGENT: split-brain on orders_db · manual DBA review required'},status:'sent'}, msg:'Requesting emergency human gate approval'}),
      m({stage:'gate',   gate:'✗ BLOCKED — Automated remediation rejected by policy: data integrity risk exceeds autonomous threshold'}),
      m({stage:'remediate', tool:{name:'remediator.execute',args:{runbook:'rb-pg-failover',target:'orders_db'},status:'FAILED'}, msg:'❌ Automated failover FAILED — replication lag 847s exceeds safe threshold (60s)'}),
      m({stage:'remediate', msg:'❌ Fallback: point-in-time recovery attempted → ABORTED — WAL integrity cannot be verified automatically'}),
      m({stage:'remediate', msg:'⚠ All 3 automated remediation paths exhausted · MANUAL INTERVENTION REQUIRED'}),
      m({stage:'validate',  tool:{name:'validator.check_slo',args:{service:'orders_db',window:'30s'},status:'DEGRADED'}, msg:'❌ SLO still degraded · write path offline · reads serving stale data'}),
      m({stage:'validate',  msg:'Validator confirms: incident CANNOT be auto-resolved · escalating to on-call engineer'}),
      m({stage:'close', tool:{name:'comms.escalate',args:{oncall:'Rahul Verma',email:'rahul.verma@genpact.com',phone:'+919890900090',method:'email+phone'},status:'notified'}, msg:'📞 ESCALATED to on-call DBA: Rahul Verma'}),
      m({stage:'close', msg:'📧 Email sent to rahul.verma@genpact.com with full RCA packet + WAL diff report'}),
      m({stage:'close', msg:'📱 Phone call initiated to +91 98909 00090 · bridge: https://meet.genpact.com/inc-205199'}),
      m({stage:'close', msg:'🚨 Status: AWAITING MANUAL INTERVENTION · Agent monitoring continues · auto-retry disabled'}),
    ],
  };
  return all[key];
}

/* ====== DEMO: SCENARIO LIST IN SIDEBAR ====== */
const scenarioList = $('scenarioList');
const demoFeed = $('demoFeed');
if(!demoFeed) return; // not on demo page

if(scenarioList){
  SCENARIOS.forEach((sc,idx)=>{
    const btn = el('button', `scenario-card ${idx===0?'active':''}`);
    btn.dataset.scenario = sc.key;
    btn.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span style="font-size:16px">${sc.icon}</span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="pill ${sc.cls}" style="font-size:9.5px;padding:1px 6px">${sc.sev}</span>
            <span class="font-mono text-[9.5px] text-[color:var(--tx-3)]">${sc.inc}</span>
          </div>
          <div class="font-semibold text-[12.5px] leading-tight mt-1">${sc.title}</div>
        </div>
        <span class="scenario-play" title="Simulate">▶</span>
      </div>
    `;
    /* Card click = select only, play button = run */
    btn.addEventListener('click',(e)=>{
      /* If the play button was clicked, run the scenario */
      if(e.target.closest('.scenario-play')){
        runScenario(sc.key);
        return;
      }
      /* Otherwise just select/highlight */
      current = sc.key;
      document.querySelectorAll('.scenario-card').forEach(c=>c.classList.toggle('active',c.dataset.scenario===sc.key));
      /* Update header info without running */
      if(incSev){incSev.textContent=sc.sev;incSev.className=`pill ${sc.cls}`;}
      if(incId) incId.textContent=sc.inc;
      if(incTitle) incTitle.textContent=sc.title;
      if(incDesc) incDesc.textContent=sc.desc;
      if(incImpact) incImpact.textContent=sc.impact;
      if(incAgents) incAgents.textContent=sc.agents;
      if(consoleTitle) consoleTitle.textContent=`apex://incident/${sc.inc}`;
    });
    scenarioList.appendChild(btn);
  });
}

/* ====== DEMO: STATE ====== */
let demoTimers = [];

/* ====== PREMIUM IDLE ORCHESTRATOR ====== */
(function initIdleOrchestrator(){
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const stage = document.getElementById('idleOrchestrator');
  const edgesG = document.getElementById('idleEdges');
  const nodesG = document.getElementById('idleNodes');
  const particlesG = document.getElementById('idleParticles');
  const pulsesG = document.getElementById('idlePulses');
  const chatterEl = document.getElementById('idleChatter');
  const clockEl = document.getElementById('idleClock');
  if(!stage || !edgesG || !nodesG) return;

  /* Hub center */
  const HUB = {x:360, y:200};

  /* 7 specialist agents arranged in a precise circle around hub */
  const RADIUS = 138;
  const agentDefs = [
    {id:'mon',   label:'Monitoring',   icon:'🔍', color:'#FBBF24', sub:'signal correlation'},
    {id:'tri',   label:'Triage',       icon:'📋', color:'#F06292', sub:'severity scoring'},
    {id:'rca',   label:'RCA',          icon:'🧬', color:'#C4B5FD', sub:'causal inference'},
    {id:'heal',  label:'Self Heal',    icon:'🔧', color:'#4ADE80', sub:'auto-remediation'},
    {id:'val',   label:'Validator',    icon:'✅', color:'#E879A8', sub:'SLO gate'},
    {id:'notify',label:'Smart Notify', icon:'📢', color:'#22D3EE', sub:'multi-channel'},
    {id:'learn', label:'Learning',     icon:'📚', color:'#A78BFA', sub:'continuous eval'},
  ];

  /* Distribute around circle starting from top */
  const N = agentDefs.length;
  const agents = agentDefs.map((a,i)=>{
    const angle = -Math.PI/2 + (i / N) * Math.PI * 2;
    return {
      ...a,
      baseAngle: angle,
      x: HUB.x + Math.cos(angle)*RADIUS,
      y: HUB.y + Math.sin(angle)*RADIUS,
      r: 26,
    };
  });

  /* ===== EDGES: each agent ↔ hub (curved bezier) ===== */
  const edgeEls = agents.map((ag,i)=>{
    /* Control point pulled slightly outward for arc feel */
    const mx = (ag.x + HUB.x)/2;
    const my = (ag.y + HUB.y)/2;
    const nx = -(ag.y - HUB.y);
    const ny = (ag.x - HUB.x);
    const len = Math.hypot(nx,ny) || 1;
    const curve = 16;
    const cx = mx + (nx/len)*curve;
    const cy = my + (ny/len)*curve;
    const d = `M${HUB.x} ${HUB.y} Q${cx} ${cy} ${ag.x} ${ag.y}`;

    const base = document.createElementNS(SVG_NS,'path');
    base.setAttribute('d', d);
    base.setAttribute('fill','none');
    base.setAttribute('stroke','rgba(151,117,250,.12)');
    base.setAttribute('stroke-width','1');
    base.setAttribute('stroke-dasharray','3 5');
    edgesG.appendChild(base);

    /* Glow highlight path (for active state) */
    const glow = document.createElementNS(SVG_NS,'path');
    glow.setAttribute('d', d);
    glow.setAttribute('fill','none');
    glow.setAttribute('stroke', ag.color);
    glow.setAttribute('stroke-width','1.8');
    glow.setAttribute('stroke-opacity','0');
    glow.setAttribute('filter','url(#igGlowSoft)');
    edgesG.appendChild(glow);

    return { d, base, glow, agent: ag };
  });

  /* ===== NODES: glassmorphic cards ===== */
  agents.forEach((ag,i)=>{
    const g = document.createElementNS(SVG_NS,'g');
    g.setAttribute('class','idle-node-card');
    g.dataset.id = ag.id;

    /* Outer glow ring (subtle) */
    const outer = document.createElementNS(SVG_NS,'circle');
    outer.setAttribute('cx',ag.x); outer.setAttribute('cy',ag.y);
    outer.setAttribute('r', ag.r+10);
    outer.setAttribute('fill','none');
    outer.setAttribute('stroke', ag.color);
    outer.setAttribute('stroke-opacity','.08');
    outer.setAttribute('stroke-width','1');
    g.appendChild(outer);

    /* Main node body — glassmorphic */
    const body = document.createElementNS(SVG_NS,'circle');
    body.setAttribute('cx',ag.x); body.setAttribute('cy',ag.y);
    body.setAttribute('r', ag.r);
    body.setAttribute('fill','url(#igNodeBg)');
    body.setAttribute('stroke', ag.color);
    body.setAttribute('stroke-opacity','.35');
    body.setAttribute('stroke-width','1.2');
    g.appendChild(body);

    /* Inner accent ring */
    const inner = document.createElementNS(SVG_NS,'circle');
    inner.setAttribute('cx',ag.x); inner.setAttribute('cy',ag.y);
    inner.setAttribute('r', ag.r-6);
    inner.setAttribute('fill','none');
    inner.setAttribute('stroke', ag.color);
    inner.setAttribute('stroke-opacity','.15');
    inner.setAttribute('stroke-width','.6');
    g.appendChild(inner);

    /* Icon */
    const icon = document.createElementNS(SVG_NS,'text');
    icon.setAttribute('x',ag.x); icon.setAttribute('y',ag.y+1);
    icon.setAttribute('text-anchor','middle');
    icon.setAttribute('dominant-baseline','middle');
    icon.setAttribute('font-size','16');
    icon.textContent = ag.icon;
    g.appendChild(icon);

    /* Status pip (top-right) */
    const pip = document.createElementNS(SVG_NS,'circle');
    const pipAng = -Math.PI/4;
    pip.setAttribute('cx', ag.x + Math.cos(pipAng)*ag.r);
    pip.setAttribute('cy', ag.y + Math.sin(pipAng)*ag.r);
    pip.setAttribute('r', 3);
    pip.setAttribute('fill','#4ADE80');
    pip.setAttribute('filter','url(#igGlowSoft)');
    g.appendChild(pip);

    /* Label */
    const lbl = document.createElementNS(SVG_NS,'text');
    lbl.setAttribute('x',ag.x);
    lbl.setAttribute('y',ag.y + ag.r + 16);
    lbl.setAttribute('text-anchor','middle');
    lbl.setAttribute('font-family','Inter');
    lbl.setAttribute('font-size','11.5');
    lbl.setAttribute('font-weight','600');
    lbl.setAttribute('fill','#fff');
    lbl.textContent = ag.label;
    g.appendChild(lbl);

    /* Sub */
    const sub = document.createElementNS(SVG_NS,'text');
    sub.setAttribute('x',ag.x);
    sub.setAttribute('y',ag.y + ag.r + 29);
    sub.setAttribute('text-anchor','middle');
    sub.setAttribute('font-family','JetBrains Mono');
    sub.setAttribute('font-size','8.5');
    sub.setAttribute('fill', ag.color);
    sub.setAttribute('opacity','.55');
    sub.textContent = ag.sub.toUpperCase();
    sub.setAttribute('letter-spacing','.05em');
    g.appendChild(sub);

    nodesG.appendChild(g);
    ag.el = g; ag.bodyEl = body; ag.iconEl = icon;
  });

  /* ===== ACTIVATION: cycle through agents, highlight + send beam ===== */
  function highlightAgent(ag, dur=1500){
    ag.el.classList.add('thinking');
    ag.bodyEl.setAttribute('stroke-opacity','1');
    ag.bodyEl.setAttribute('stroke-width','2');
    /* Find edge */
    const edge = edgeEls.find(e=>e.agent.id===ag.id);
    if(edge){
      edge.glow.setAttribute('stroke-opacity','.8');
      setTimeout(()=>edge.glow.setAttribute('stroke-opacity','0'), dur);
    }
    setTimeout(()=>{
      ag.el.classList.remove('thinking');
      ag.bodyEl.setAttribute('stroke-opacity','.35');
      ag.bodyEl.setAttribute('stroke-width','1.2');
    }, dur);
  }

  /* ===== DATA SPARKS along bezier curves ===== */
  function spawnSpark(edge, reverse=false){
    const path = document.createElementNS(SVG_NS,'path');
    path.setAttribute('d', edge.d);
    path.setAttribute('fill','none');
    path.setAttribute('stroke','none');
    const totalLen = (()=>{
      const tmp = document.createElementNS(SVG_NS,'path');
      tmp.setAttribute('d', edge.d);
      edgesG.appendChild(tmp);
      const L = tmp.getTotalLength();
      tmp.remove();
      return L;
    })();

    const trail = document.createElementNS(SVG_NS,'path');
    trail.setAttribute('d', edge.d);
    trail.setAttribute('fill','none');
    trail.setAttribute('stroke', edge.agent.color);
    trail.setAttribute('stroke-width','1.6');
    trail.setAttribute('stroke-linecap','round');
    trail.setAttribute('filter','url(#igGlowStrong)');
    const segLen = 14;
    trail.setAttribute('stroke-dasharray', `${segLen} ${totalLen}`);
    trail.setAttribute('stroke-dashoffset', reverse? -totalLen : totalLen);
    particlesG.appendChild(trail);

    const dur = 1100 + Math.random()*500;
    const start = performance.now();
    function tick(now){
      const t = Math.min((now-start)/dur, 1);
      const eased = t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
      const offset = reverse
        ? -totalLen + eased*(totalLen + segLen)
        : totalLen - eased*(totalLen + segLen);
      trail.setAttribute('stroke-dashoffset', offset);
      trail.setAttribute('opacity', t<.15? t/.15 : t>.85? (1-t)/.15 : 1);
      if(t<1 && document.getElementById('idleOrchestrator')) requestAnimationFrame(tick);
      else trail.remove();
    }
    requestAnimationFrame(tick);
  }

  /* ===== PULSE WAVES from hub ===== */
  function spawnPulse(){
    const ring = document.createElementNS(SVG_NS,'circle');
    ring.setAttribute('cx', HUB.x);
    ring.setAttribute('cy', HUB.y);
    ring.setAttribute('class','idle-pulse-ring');
    pulsesG.appendChild(ring);
    setTimeout(()=>ring.remove(), 3100);
  }

  /* ===== CHATTER STREAM ===== */
  const chatMessages = [
    {agent:'mon',   msg:'scanning · 2.4k events/s · all SLOs nominal'},
    {agent:'mon',   msg:'p99 latency stable · 38ms across regions'},
    {agent:'tri',   msg:'no severity triggers · queue empty'},
    {agent:'rca',   msg:'context window warm · 847 runbooks indexed'},
    {agent:'rca',   msg:'graph memory ready · 12k edges loaded'},
    {agent:'heal',  msg:'runbook cache primed · k8s + cloud APIs reachable'},
    {agent:'heal',  msg:'circuit breakers armed · dry-run validators online'},
    {agent:'val',   msg:'SLO gate calibrated · canary thresholds set'},
    {agent:'val',   msg:'confidence model loaded · v47 prompts active'},
    {agent:'notify',msg:'slack · pagerduty · email channels healthy'},
    {agent:'notify',msg:'on-call rotation synced · DBA: Rahul Verma'},
    {agent:'learn', msg:'eval pipeline running · 98.7% pass rate'},
    {agent:'learn', msg:'postmortem #2,847 indexed · embeddings refreshed'},
    {agent:'mon',   msg:'datadog stream · github webhook · argocd events ✓'},
    {agent:'tri',   msg:'blast-radius models pre-warmed · 142 OPA rules loaded'},
  ];
  const agentTagStyle = {
    mon:    {bg:'rgba(251,191,36,.14)',  fg:'#FCD34D', stroke:'rgba(251,191,36,.3)'},
    tri:    {bg:'rgba(240,98,146,.14)',  fg:'#F8A4C0', stroke:'rgba(240,98,146,.3)'},
    rca:    {bg:'rgba(151,117,250,.14)', fg:'#C4B5FD', stroke:'rgba(151,117,250,.3)'},
    heal:   {bg:'rgba(74,222,128,.14)',  fg:'#86EFAC', stroke:'rgba(74,222,128,.3)'},
    val:    {bg:'rgba(232,121,168,.14)', fg:'#E8A4D4', stroke:'rgba(232,121,168,.3)'},
    notify: {bg:'rgba(34,211,238,.14)',  fg:'#67E8F9', stroke:'rgba(34,211,238,.3)'},
    learn:  {bg:'rgba(167,139,250,.14)', fg:'#C4B5FD', stroke:'rgba(167,139,250,.3)'},
  };
  const agentNameMap = {mon:'monitoring',tri:'triage',rca:'rca',heal:'self-heal',val:'validator',notify:'notify',learn:'learning'};

  function pushChat(){
    if(!chatterEl) return;
    const msg = chatMessages[Math.floor(Math.random()*chatMessages.length)];
    const st = agentTagStyle[msg.agent];
    const line = document.createElement('div');
    line.className = 'idle-chat-line';
    line.innerHTML = `
      <span class="idle-chat-tag" style="background:${st.bg};color:${st.fg};border:1px solid ${st.stroke}">● ${agentNameMap[msg.agent]}</span>
      <span class="idle-chat-arrow">›</span>
      <span class="idle-chat-msg">${msg.msg}</span>
    `;
    chatterEl.appendChild(line);
    /* Keep only last 3 */
    while(chatterEl.children.length > 3) chatterEl.firstChild.remove();
    /* Highlight the agent that "spoke" */
    const ag = agents.find(a=>a.id===msg.agent);
    if(ag) {
      highlightAgent(ag, 1200);
      const edge = edgeEls.find(e=>e.agent.id===msg.agent);
      if(edge) spawnSpark(edge, true); /* agent → hub */
    }
  }

  /* ===== ORBIT MOTION ===== */
  let t0 = performance.now();
  function tick(now){
    if(!document.getElementById('idleOrchestrator')) return;
    const elapsed = (now-t0)/1000;
    /* Subtle drift around each agent's base position */
    agents.forEach((ag,i)=>{
      const dx = Math.sin(elapsed*0.35 + i*0.9)*3.5;
      const dy = Math.cos(elapsed*0.28 + i*1.2)*3;
      ag.el.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ===== INTERVALS ===== */
  const intervals = [];
  /* Pulse waves every 2.6s */
  intervals.push(setInterval(()=>{
    if(!document.getElementById('idleOrchestrator')) return;
    spawnPulse();
  }, 2600));

  /* Spontaneous sparks (hub → random agent) */
  intervals.push(setInterval(()=>{
    if(!document.getElementById('idleOrchestrator')) return;
    const edge = edgeEls[Math.floor(Math.random()*edgeEls.length)];
    spawnSpark(edge, false);
  }, 700));

  /* Chatter every 1.8s */
  intervals.push(setInterval(()=>{
    if(!document.getElementById('idleOrchestrator')) { intervals.forEach(clearInterval); return; }
    pushChat();
  }, 1800));

  /* Live clock + metric jitter */
  function updateClock(){
    if(!document.getElementById('idleOrchestrator')) return;
    const d = new Date();
    const pad = n => String(n).padStart(2,'0');
    if(clockEl) clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  updateClock();
  intervals.push(setInterval(updateClock, 1000));

  /* Subtle metric jitter */
  intervals.push(setInterval(()=>{
    if(!document.getElementById('idleOrchestrator')) return;
    const lat = document.getElementById('idleLat');
    const qps = document.getElementById('idleQps');
    if(lat) lat.textContent = (10 + Math.floor(Math.random()*6));
    if(qps) qps.textContent = (2.2 + Math.random()*.6).toFixed(1) + 'k';
  }, 1400));

  /* Initial chat priming */
  pushChat();
  setTimeout(pushChat, 400);
  setTimeout(pushChat, 900);
  spawnPulse();
})();


let speed = 1;
let current = 'latency';
let toolCount = 0;

const pipelineEl=$('pipeline'), pipeProgress=$('pipeProgress'),
      stepCountEl=$('stepCount'), hypList=$('hypList'), hypMeta=$('hypMeta'),
      toolList=$('toolList'), toolMeta=$('toolMeta'), gateInfo=$('gateInfo'),
      incSev=$('incSev'), incId=$('incId'), incTitle=$('incTitle'),
      incDesc=$('incDesc'), incMTTR=$('incMTTR'), incAuto=$('incAuto'),
      incImpact=$('incImpact'), incAgents=$('incAgents'),
      consoleTitle=$('consoleTitle');

function clearTimers(){demoTimers.forEach(clearTimeout);demoTimers=[];}

/* ====== VERTICAL PIPELINE ====== */
function renderPipeline(stageStatus){
  if(!pipelineEl) return;
  pipelineEl.innerHTML='';
  STAGES.forEach(stg=>{
    const st = stageStatus[stg.key]||'pending';
    const step = el('div',`pipe-step-v ${st}`);
    const nodeIcon = st==='done'?'✓':st==='failed'?'✗':st==='active'?'▶':stg.icon;
    step.innerHTML = `
      <div class="pipe-node">${nodeIcon}</div>
      <div class="pipe-body">
        <div class="pipe-title">${stg.label} <span class="atag atag-${stg.agent}" style="font-size:9px;padding:1px 5px;vertical-align:1px">${labelFor(stg.agent)}</span></div>
        <div class="pipe-meta">${stg.desc}${st==='active'?' · running…':''}${st==='done'?' · done':''}${st==='failed'?' · <span style=\"color:#F06292\">failed</span>':''}</div>
      </div>
    `;
    pipelineEl.appendChild(step);
  });
}

/* ====== FEED ====== */
function emitFeed(agent,text,time){
  const row=el('div','feed-row');
  row.style.cssText='opacity:0;transform:translateY(-4px);transition:opacity .3s,transform .3s';
  row.innerHTML=`<span class="feed-time">t+${time}</span><span class="atag atag-${agent}">${labelFor(agent)}</span><span class="feed-msg">${text}</span>`;
  demoFeed.appendChild(row);
  requestAnimationFrame(()=>{row.style.opacity='1';row.style.transform='none'});
  demoFeed.scrollTop=demoFeed.scrollHeight;
}

function renderHyp(hyps){
  if(!hypList) return;
  hypList.innerHTML='';
  hypMeta.textContent=`${hyps.length} ranked`;
  hyps.forEach(h=>{
    const c=el('div','card');
    c.style.padding='12px';
    c.innerHTML=`
      <div class="flex items-center justify-between mb-1">
        <span class="font-mono text-[11px] text-[color:var(--tx-3)]">${h.id}</span>
        <span class="font-display text-base font-bold">${h.conf.toFixed(2)}</span>
      </div>
      <div class="text-[12.5px] leading-snug">${h.summary}</div>
      <div class="confidence-bar mt-2"><div class="confidence-fill" style="width:${Math.round(h.conf*100)}%"></div></div>
      <div class="mt-2 flex flex-wrap gap-1">${h.evidence.map(e=>`<span class="pill" style="font-size:9.5px;padding:1px 6px">${e}</span>`).join('')}</div>
    `;
    hypList.appendChild(c);
  });
}

function renderTool(tool){
  if(!toolList) return;
  if(toolCount===0) toolList.innerHTML='';
  toolCount++;
  toolMeta.textContent=`${toolCount}`;
  const c=el('div','card');
  c.style.cssText='padding:10px;background:rgba(139,92,246,.04);border-color:rgba(139,92,246,.2)';
  const args=Object.entries(tool.args).map(([k,v])=>`<span class="tok-key">${k}</span>=<span class="tok-str">"${v}"</span>`).join(', ');
  const stCls=tool.status==='green'||tool.status==='applied'||tool.status==='indexed'||tool.status==='created'?'pill-green':tool.status==='FAILED'||tool.status==='DEGRADED'?'pill-p1':tool.status==='running'||tool.status==='sent'?'pill-purple':'pill-p2';
  c.innerHTML=`
    <div class="flex items-center justify-between mb-1">
      <span class="font-mono text-[12px]">${tool.name}()</span>
      <span class="pill ${stCls}" style="font-size:9.5px">${tool.status}</span>
    </div>
    <div class="font-mono text-[11px] text-[color:var(--tx-2)]">${args}</div>
  `;
  toolList.prepend(c);
}

/* ====== AGENT ENGAGEMENT ====== */
const agentEngEl=$('agentEngagement');
let engagedAgents={};

function renderEngagement(){
  if(!agentEngEl) return;
  agentEngEl.innerHTML='';
  let hasAny=false;
  AGENTS.forEach(a=>{
    const st=engagedAgents[a.key];
    if(!st) return;
    hasAny=true;
    const row=el('div',`engage-row ${st}`);
    row.innerHTML=`
      <span class="engage-status ${st}"></span>
      <span class="atag atag-${a.key}" style="font-size:9.5px;padding:1px 6px">${a.name}</span>
      <span class="text-[11px] text-[color:var(--tx-2)]">${st==='active'?'processing…':st==='failed'?'<span style="color:#F06292">failed</span>':'completed'}</span>
      ${st==='done'?'<span class="engage-time">✓</span>':st==='failed'?'<span class="engage-time" style="color:#F06292">✗</span>':''}
    `;
    agentEngEl.appendChild(row);
  });
  if(!hasAny) agentEngEl.innerHTML='<div class="text-[12px] text-[color:var(--tx-3)] italic">Agents will appear as they engage…</div>';
}

/* ====== RUN SCENARIO ====== */
function runScenario(key){
  const sc=SCENARIOS.find(s=>s.key===key);
  const steps=stepsFor(key);
  if(!sc||!steps) return;
  current=key;

  document.querySelectorAll('.scenario-card').forEach(c=>c.classList.toggle('active',c.dataset.scenario===key));

  clearTimers(); toolCount=0;
  engagedAgents={}; renderEngagement();
  demoFeed.innerHTML='';
  demoFeed.style.padding='16px';
  if(consoleTitle) consoleTitle.textContent=`apex://incident/${sc.inc}`;
  if(stepCountEl) stepCountEl.textContent='0 events';
  if(hypList){hypList.innerHTML='<div class="text-[12px] text-[color:var(--tx-3)]">Hypotheses stream here as RCA agent runs…</div>';hypMeta.textContent='awaiting';}
  if(toolList){toolList.innerHTML='<div class="text-[12px] text-[color:var(--tx-3)]">Claude tool-use invocations will appear here.</div>';toolMeta.textContent='0';}
  if(gateInfo) gateInfo.textContent='Awaiting decision…';

  if(incSev){incSev.textContent=sc.sev;incSev.className=`pill ${sc.cls}`;}
  if(incId) incId.textContent=sc.inc;
  if(incTitle) incTitle.textContent=sc.title;
  if(incDesc) incDesc.textContent=sc.desc;
  if(incImpact) incImpact.textContent=sc.impact;
  if(incAgents) incAgents.textContent=sc.agents;
  if(incMTTR) incMTTR.textContent='—';
  if(incAuto){incAuto.textContent='…';incAuto.className='font-display text-lg font-bold mt-1';}

  const ss={}; STAGES.forEach(s=>ss[s.key]='pending');
  const failedSet = new Set();
  renderPipeline(ss);
  if(pipeProgress) pipeProgress.textContent='0 / 8';

  const interval = 900/speed;
  let elapsed=0;
  steps.forEach((step,i)=>{
    const t=setTimeout(()=>{
      /* Detect failures in this step */
      const isFail = (step.msg && /FAILED|BLOCKED|ABORTED|❌|✗|MANUAL INTERVENTION|DEGRADED/.test(step.msg))
        || (step.tool && (step.tool.status==='FAILED'||step.tool.status==='DEGRADED'))
        || (step.gate && /BLOCKED|✗/.test(step.gate));
      if(isFail) failedSet.add(step.stage);

      const idx=STAGES.findIndex(s=>s.key===step.stage);
      STAGES.forEach((s,si)=>{
        if(failedSet.has(s.key)){ ss[s.key]='failed'; }
        else if(si<idx){ ss[s.key]='done'; }
        else if(si===idx){ ss[s.key]=failedSet.has(s.key)?'failed':'active'; }
      });
      renderPipeline(ss);
      STAGES.forEach((s,si)=>{
        if(si<idx) engagedAgents[s.agent] = failedSet.has(s.key)?'failed':'done';
        else if(si===idx) engagedAgents[s.agent] = failedSet.has(s.key)?'failed':'active';
      });
      renderEngagement();
      if(pipeProgress) pipeProgress.textContent=`${idx+1} / ${STAGES.length}`;

      elapsed+=0.8;
      const stage=STAGES.find(s=>s.key===step.stage);

      if(step.msg) emitFeed(stage.agent,step.msg,elapsed.toFixed(1)+'s');
      if(step.hyp) renderHyp(step.hyp);
      if(step.tool) renderTool(step.tool);
      if(step.gate && gateInfo){
        const gateBlocked = /BLOCKED|✗/.test(step.gate);
        gateInfo.innerHTML=`<span style="color:${gateBlocked?'#F06292':'#22C55E'}">●</span> ${step.gate}`;
        emitFeed('comms',step.gate,elapsed.toFixed(1)+'s');
      }
      if(stepCountEl) stepCountEl.textContent=`${i+1} events`;

      if(i===steps.length-1){
        STAGES.forEach(s=>{ss[s.key]='done'; engagedAgents[s.agent]='done';});
        if(sc.escalated){
          ss['remediate']='failed'; ss['validate']='failed'; ss['close']='failed';
          renderPipeline(ss);
          engagedAgents['remediate']='failed';
          engagedAgents['validator']='failed';
          renderEngagement();
          if(pipeProgress) pipeProgress.textContent=`ESCALATED · manual intervention`;
          if(incMTTR) incMTTR.textContent='—';
          if(incAuto){incAuto.textContent='Manual';incAuto.style.color='#FF4F59';incAuto.className='font-display text-lg font-bold mt-1';}
          if(gateInfo) gateInfo.innerHTML='<div style="background:rgba(240,98,146,.08);border:1px solid rgba(240,98,146,.25);border-radius:8px;padding:10px 12px"><div style="color:#F8A4C0;font-weight:600;font-size:13px;margin-bottom:6px">🚨 MANUAL INTERVENTION REQUIRED</div><div style="font-size:12px;color:var(--tx-2);line-height:1.6">On-call DBA: <strong style="color:#fff">Rahul Verma</strong><br>📧 rahul.verma@genpact.com<br>📱 +91 98909 00090<br>🔗 Bridge: meet.genpact.com/inc-205199<br><br><span style="color:var(--tx-3);font-size:11px">Agents monitoring · auto-retry disabled</span></div></div>';
        } else {
          renderPipeline(ss); renderEngagement();
          if(pipeProgress) pipeProgress.textContent=`${STAGES.length} / ${STAGES.length} · resolved`;
          if(incMTTR) incMTTR.textContent=mttrFor(sc.key);
          if(incAuto){
            const isAuto=!steps.some(s=>s.gate&&/Approved by @/.test(s.gate||''));
            incAuto.textContent=isAuto?'Auto':'Approval';
            incAuto.style.color=isAuto?'#22C55E':'#F59E0B';
          }
        }
      }
    },interval*(i+1));
    demoTimers.push(t);
  });
}

function mttrFor(k){return{latency:'2m 41s',db:'1m 12s',k8s:'3m 04s',auth:'4m 18s',kafka:'2m 56s',cdn:'2m 22s',cert:'1m 08s',dns:'1m 47s',storage:'2m 14s',datacorrupt:'—'}[k]||'—';}

const replay=$('demoReplay');
if(replay) replay.addEventListener('click',()=>runScenario(current));
const speedBtn=$('speedToggle');
if(speedBtn) speedBtn.addEventListener('click',()=>{
  speed=speed===1?2:speed===2?4:1;
  speedBtn.textContent=`▶ ${speed}× speed`;
  runScenario(current);
});

// Don't auto-start — user clicks a scenario play button to begin

})();
