// ═══════════════════════════════════════════════════════════════
// VentureIQ — Main Application
// ═══════════════════════════════════════════════════════════════

// ── GLOBALS ──
Chart.defaults.font.family = "'DM Sans', sans-serif";
Chart.defaults.color = 'rgba(122,139,168,1)';
const C = {gold:'#d4a843',gold2:'#f0c96a',teal:'#00d4aa',teal2:'#00f5c8',blue:'#4f91ff',purple:'#9b6dff',red:'#ff4f6d',muted:'#7a8ba8',border:'rgba(30,50,80,0.5)'};
const PAL = [C.gold,C.teal,C.blue,C.purple,C.red,'#ff9f43','#a29bfe','#fd79a8','#55efc4','#74b9ff','#e17055','#00cec9'];
const gridOpts = ()=>({color:C.border,drawBorder:false});
const tickOpts = ()=>({color:C.muted,font:{size:10}});
const stageBadge = s=>({'Series A':'badge-blue','Series B':'badge-teal','Series C':'badge-gold','Series D':'badge-purple','Private Equity':'badge-red','Seed / Angel':'badge-gray','Pre-Series A':'badge-gray','Debt Funding':'badge-gray'}[s]||'badge-gray');
const riskBadge = r=>({'Low':'badge-low','Medium':'badge-medium','High':'badge-high','Critical':'badge-critical'}[r]||'badge-gray');
let _loaded = {};

function toast(msg, type='info'){
  const el = document.createElement('div');
  el.className = 'toast toast-'+type;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>el.remove(), 3000);
}

// ── NAV ──
function showSection(id){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(n=>n.classList.remove('active'));
  const sec = document.getElementById('section-'+id);
  if(sec) sec.classList.add('active');
  const link = document.querySelector(`.nav-link[data-section="${id}"]`);
  if(link) link.classList.add('active');
  document.querySelector('.nav-links')?.classList.remove('open');
  // Lazy load
  if(id==='dashboard' && !_loaded.dashboard){loadDashboard();_loaded.dashboard=true;}
  if(id==='risk' && !_loaded.risk){loadRisk();_loaded.risk=true;}
  if(id==='analysis' && !_loaded.analysis){loadAnalysis();_loaded.analysis=true;}
  if(id==='recommendations' && !_loaded.recs){loadRecommendations();_loaded.recs=true;}
  if(id==='network' && !_loaded.network){loadNetwork();_loaded.network=true;}
  if(id==='watchlist'){loadWatchlist();}
  if(id==='heatmap' && !_loaded.heatmap){loadHeatmap();_loaded.heatmap=true;}
}
function toggleMobileNav(){ document.querySelector('.nav-links').classList.toggle('open'); }

// ── ANIMATED COUNTER ──
function animateCount(el, target, suffix='', prefix='', duration=1500){
  const start = 0;
  const startTime = performance.now();
  function step(now){
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const val = Math.round(start + (target - start) * eased);
    el.textContent = prefix + val.toLocaleString() + suffix;
    if(progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── HERO ──
async function loadHero(){
  try{
    const d = await fetch('/api/hero_stats').then(r=>r.json());
    document.getElementById('hero-startups').textContent = d.total_startups.toLocaleString();
    document.getElementById('hero-stats').innerHTML = `
      <div class="hero-stat"><div class="hero-stat-value" id="hs-startups">0</div><div class="hero-stat-label">Startups</div></div>
      <div class="hero-stat"><div class="hero-stat-value" id="hs-funding">0</div><div class="hero-stat-label">₹ Crore Funded</div></div>
      <div class="hero-stat"><div class="hero-stat-value" id="hs-investors">0</div><div class="hero-stat-label">Investors</div></div>
      <div class="hero-stat"><div class="hero-stat-value" id="hs-deals">0</div><div class="hero-stat-label">Deals</div></div>
      <div class="hero-stat"><div class="hero-stat-value" id="hs-industries">0</div><div class="hero-stat-label">Industries</div></div>
    `;
    setTimeout(()=>{
      animateCount(document.getElementById('hs-startups'), d.total_startups);
      animateCount(document.getElementById('hs-funding'), d.total_funding_cr, '', '₹');
      animateCount(document.getElementById('hs-investors'), d.total_investors);
      animateCount(document.getElementById('hs-deals'), d.total_deals);
      animateCount(document.getElementById('hs-industries'), d.industries_covered);
    }, 300);
  }catch(e){console.error(e);}
}

// ── DASHBOARD ──
async function loadDashboard(){
  try{
    const kpis = await fetch('/api/kpis').then(r=>r.json());
    const trendIcon = kpis.yoy_growth >= 0 ? '↑' : '↓';
    const trendClass = kpis.yoy_growth >= 0 ? 'up' : 'down';
    document.getElementById('kpi-grid').innerHTML = `
      <div class="kpi-card gold"><div class="kpi-icon">🏢</div><div class="kpi-label">Startups</div><div class="kpi-value">${kpis.total_startups.toLocaleString()}</div><div class="kpi-sub">unique startups</div></div>
      <div class="kpi-card teal"><div class="kpi-icon">💰</div><div class="kpi-label">Total Funding</div><div class="kpi-value">₹${kpis.total_funding_cr.toLocaleString()}Cr</div><div class="kpi-trend ${trendClass}">${trendIcon} ${Math.abs(kpis.yoy_growth)}% YoY</div></div>
      <div class="kpi-card blue"><div class="kpi-icon">🤝</div><div class="kpi-label">Investors</div><div class="kpi-value">${kpis.total_investors.toLocaleString()}</div><div class="kpi-sub">unique investors</div></div>
      <div class="kpi-card purple"><div class="kpi-icon">📊</div><div class="kpi-label">Avg Deal</div><div class="kpi-value">₹${kpis.avg_funding_cr}Cr</div><div class="kpi-sub">per round</div></div>
      <div class="kpi-card red"><div class="kpi-icon">📈</div><div class="kpi-label">Median Deal</div><div class="kpi-value">₹${kpis.median_funding_cr}Cr</div><div class="kpi-sub">per round</div></div>
      <div class="kpi-card gold"><div class="kpi-icon">🔥</div><div class="kpi-label">Top Sector</div><div class="kpi-value" style="font-size:.9rem;padding-top:3px">${kpis.top_industry}</div><div class="kpi-sub">most funded</div></div>
      <div class="kpi-card teal"><div class="kpi-icon">📍</div><div class="kpi-label">Top City</div><div class="kpi-value" style="font-size:.9rem;padding-top:3px">${kpis.top_city}</div><div class="kpi-sub">startup hub</div></div>
      <div class="kpi-card blue"><div class="kpi-icon">🎯</div><div class="kpi-label">Total Deals</div><div class="kpi-value">${kpis.total_deals.toLocaleString()}</div><div class="kpi-sub">funded rounds</div></div>
    `;

    // Year chart
    const yr = await fetch('/api/funding_by_year').then(r=>r.json());
    new Chart(document.getElementById('chartYear'),{type:'bar',data:{labels:yr.years,datasets:[
      {label:'Funding (₹Cr)',data:yr.totals,backgroundColor:yr.totals.map((_,i)=>i===yr.totals.length-1?C.gold:'rgba(212,168,67,0.4)'),borderRadius:6,borderSkipped:false,order:2},
      {label:'Deals',data:yr.deals,type:'line',borderColor:C.teal,backgroundColor:'rgba(0,212,170,0.06)',fill:true,tension:.4,pointRadius:3,pointBackgroundColor:C.teal,yAxisID:'y2',order:1}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:10,font:{size:11}}}},scales:{x:{grid:gridOpts(),ticks:tickOpts()},y:{grid:gridOpts(),ticks:{...tickOpts(),callback:v=>'₹'+v+'Cr'}},y2:{position:'right',grid:{display:false},ticks:tickOpts()}}}});

    // Stage doughnut
    const st = await fetch('/api/stage_distribution').then(r=>r.json());
    new Chart(document.getElementById('chartStage'),{type:'doughnut',data:{labels:st.stages,datasets:[{data:st.counts,backgroundColor:PAL,borderColor:'rgba(6,10,18,0.8)',borderWidth:2,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{position:'bottom',labels:{boxWidth:8,padding:6,font:{size:10}}}}}});

    // Industry bar
    const ind = await fetch('/api/industry_breakdown').then(r=>r.json());
    new Chart(document.getElementById('chartIndustry'),{type:'bar',data:{labels:ind.industries,datasets:[{label:'₹ Crore',data:ind.amounts,backgroundColor:ind.industries.map((_,i)=>PAL[i%PAL.length]+'88'),borderColor:ind.industries.map((_,i)=>PAL[i%PAL.length]),borderWidth:1,borderRadius:4,borderSkipped:false}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:gridOpts(),ticks:{...tickOpts(),callback:v=>'₹'+v}},y:{grid:{display:false},ticks:{...tickOpts(),font:{size:9}}}}}});

    // City bar
    const city = await fetch('/api/top_cities').then(r=>r.json());
    new Chart(document.getElementById('chartCity'),{type:'bar',data:{labels:city.cities,datasets:[{label:'₹ Crore',data:city.amounts,backgroundColor:'rgba(79,145,255,0.25)',borderColor:C.blue,borderWidth:1,borderRadius:4,borderSkipped:false}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:gridOpts(),ticks:{...tickOpts(),callback:v=>'₹'+v}},y:{grid:{display:false},ticks:{...tickOpts(),font:{size:9}}}}}});

    // Funnel
    const funnel = await fetch('/api/funding_funnel').then(r=>r.json());
    const maxDeals = Math.max(...funnel.map(f=>f.deals));
    const funnelColors = [C.muted,C.blue,C.teal,C.gold,C.purple,C.red,'#ff9f43'];
    document.getElementById('funnel-container').innerHTML = funnel.map((f,i)=>{
      const pct = (f.deals / maxDeals * 100);
      return `<div class="funnel-bar" style="height:${pct}%;background:${funnelColors[i]||C.muted}55;border:1px solid ${funnelColors[i]||C.muted}"><div class="funnel-value">${f.deals}</div><div class="funnel-label">${f.stage.replace(' / ','/')}</div></div>`;
    }).join('');
  }catch(e){console.error('Dashboard error:', e); toast('Failed to load dashboard','error');}
}

// ── RISK LAB ──
async function loadRisk(){
  try{
    const scores = await fetch('/api/risk_scores').then(r=>r.json());
    const dist = await fetch('/api/risk_distribution').then(r=>r.json());

    // Overview cards
    const lowCount = dist.counts[dist.categories.indexOf('Low')]||0;
    const medCount = dist.counts[dist.categories.indexOf('Medium')]||0;
    const highCount = dist.counts[dist.categories.indexOf('High')]||0;
    const critCount = dist.counts[dist.categories.indexOf('Critical')]||0;
    document.getElementById('risk-overview').innerHTML = `
      <div class="risk-stat"><div class="risk-stat-value" style="color:${C.teal}">${lowCount}</div><div class="risk-stat-label">Low Risk</div></div>
      <div class="risk-stat"><div class="risk-stat-value" style="color:${C.gold}">${medCount}</div><div class="risk-stat-label">Medium Risk</div></div>
      <div class="risk-stat"><div class="risk-stat-value" style="color:${C.red}">${highCount}</div><div class="risk-stat-label">High Risk</div></div>
      <div class="risk-stat"><div class="risk-stat-value" style="color:#ff3333">${critCount}</div><div class="risk-stat-label">Critical</div></div>
    `;

    // Scatter: Risk vs Growth
    new Chart(document.getElementById('chartRiskScatter'),{type:'bubble',data:{datasets:[{label:'Startups',data:scores.slice(0,40).map(s=>({x:s.risk_score,y:s.growth_score,r:Math.max(3,Math.min(18,s.funding_cr/10)),label:s.name})),backgroundColor:scores.slice(0,40).map(s=>s.risk_category==='Low'?C.teal+'66':s.risk_category==='Medium'?C.gold+'66':C.red+'66'),borderColor:scores.slice(0,40).map(s=>s.risk_category==='Low'?C.teal:s.risk_category==='Medium'?C.gold:C.red),borderWidth:1}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>{const d=scores[ctx.dataIndex];return `${d.name}: Risk ${d.risk_score}, Growth ${d.growth_score}, ₹${d.funding_cr}Cr`;}}}},scales:{x:{title:{display:true,text:'Risk Score →',color:C.muted},grid:gridOpts(),ticks:tickOpts()},y:{title:{display:true,text:'Growth Score →',color:C.muted},grid:gridOpts(),ticks:tickOpts()}}}});

    // Risk distribution pie
    const distColors = {'Low':C.teal,'Medium':C.gold,'High':C.red,'Critical':'#ff3333'};
    new Chart(document.getElementById('chartRiskDist'),{type:'doughnut',data:{labels:dist.categories,datasets:[{data:dist.counts,backgroundColor:dist.categories.map(c=>distColors[c]||C.muted),borderColor:'rgba(6,10,18,0.8)',borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:'55%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}}}}});

    // Risk table
    document.getElementById('risk-table').innerHTML = `<div style="overflow-x:auto;margin-top:.8rem"><table class="data-table"><thead><tr><th>#</th><th>Startup</th><th>Industry</th><th>Investability</th><th>Growth</th><th>Risk</th><th>Category</th><th>Momentum</th><th>Funding</th></tr></thead><tbody>
      ${scores.slice(0,20).map((s,i)=>`<tr><td style="color:var(--muted);font-family:var(--font-mono)">${i+1}</td><td style="font-weight:600">${s.name}</td><td>${s.industry}</td>
        <td><span style="font-family:var(--font-mono);color:${C.gold2}">${s.investability}</span></td>
        <td><span style="font-family:var(--font-mono);color:${C.teal}">${s.growth_score}</span></td>
        <td><span style="font-family:var(--font-mono);color:${C.red}">${s.risk_score}</span></td>
        <td><span class="badge ${riskBadge(s.risk_category)}">${s.risk_category}</span></td>
        <td><span style="font-family:var(--font-mono)">${s.market_momentum}</span></td>
        <td class="amount-val">₹${s.funding_cr}Cr</td></tr>`).join('')}
    </tbody></table></div>`;
  }catch(e){console.error(e); toast('Failed to load risk data','error');}
}

// ── PORTFOLIO SIMULATOR ──
function addPortfolioRow(){
  const container = document.getElementById('portfolio-inputs');
  const idx = container.children.length;
  const row = document.createElement('div');
  row.className = 'portfolio-row';
  row.innerHTML = `<input class="p-input p-name" placeholder="Startup name" data-idx="${idx}"/><input class="p-input p-amount" type="number" placeholder="₹ Cr" data-idx="${idx}"/><button class="btn-icon" onclick="removePortfolioRow(this)">✕</button>`;
  container.appendChild(row);
}
function removePortfolioRow(btn){ const row = btn.parentElement; if(document.querySelectorAll('.portfolio-row').length > 1) row.remove(); }

async function simulatePortfolio(){
  const rows = document.querySelectorAll('.portfolio-row');
  const portfolio = [];
  rows.forEach(row=>{
    const name = row.querySelector('.p-name').value.trim();
    const amount = parseFloat(row.querySelector('.p-amount').value) || 0;
    if(name && amount > 0) portfolio.push({name, amount_cr: amount});
  });
  if(portfolio.length === 0){ toast('Add at least one startup with amount','error'); return; }

  try{
    const res = await fetch('/api/portfolio_simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({portfolio})}).then(r=>r.json());
    if(res.error){ toast(res.error,'error'); return; }

    let html = `<div class="portfolio-summary">
      <div class="ps-item"><div class="ps-value">₹${res.total_invested_cr}</div><div class="ps-label">Total Invested (Cr)</div></div>
      <div class="ps-item"><div class="ps-value" style="color:${C.teal2}">₹${res.total_projected_5yr.toFixed(1)}</div><div class="ps-label">Projected 5-Year (Cr)</div></div>
      <div class="ps-item"><div class="ps-value" style="color:${res.portfolio_roi>=0?C.teal:C.red}">${res.portfolio_roi}%</div><div class="ps-label">Portfolio ROI</div></div>
      <div class="ps-item"><div class="ps-value">${Object.keys(res.diversification.industries).length}</div><div class="ps-label">Industries</div></div>
    </div>`;

    // Diversification chart
    html += `<div class="charts-grid"><div class="chart-card span-6"><div class="chart-title">Industry Diversification</div><div class="chart-wrap"><canvas id="chartPortInd"></canvas></div></div>
      <div class="chart-card span-6"><div class="chart-title">5-Year Projections</div><div class="chart-wrap"><canvas id="chartPortProj"></canvas></div></div></div>`;

    html += `<div class="portfolio-result-grid">${res.startups.map(s=>`
      <div class="portfolio-card">
        <div style="font-weight:600;margin-bottom:8px">${s.name}</div>
        <div class="compare-metric"><span class="compare-metric-label">Invested</span><span class="compare-metric-val">₹${s.invested_cr}Cr</span></div>
        <div class="compare-metric"><span class="compare-metric-label">5-Year Value</span><span class="compare-metric-val" style="color:${C.teal}">₹${s.projected_5yr_cr.toFixed(1)}Cr</span></div>
        <div class="compare-metric"><span class="compare-metric-label">ROI</span><span class="compare-metric-val" style="color:${s.roi_pct>=0?C.teal:C.red}">${s.roi_pct}%</span></div>
        <div class="compare-metric"><span class="compare-metric-label">Risk</span><span class="badge ${riskBadge(s.risk_category)}">${s.risk_category}</span></div>
        <div class="compare-metric"><span class="compare-metric-label">Investability</span><span class="compare-metric-val" style="color:${C.gold2}">${s.investability}</span></div>
      </div>`).join('')}</div>`;

    document.getElementById('portfolio-results').innerHTML = html;

    // Industry pie
    setTimeout(()=>{
      const indLabels = Object.keys(res.diversification.industries);
      const indData = Object.values(res.diversification.industries);
      new Chart(document.getElementById('chartPortInd'),{type:'doughnut',data:{labels:indLabels,datasets:[{data:indData,backgroundColor:PAL.slice(0,indLabels.length),borderColor:'rgba(6,10,18,0.8)',borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:'55%',plugins:{legend:{position:'right',labels:{boxWidth:8,font:{size:10}}}}}});

      // Projection lines
      const projDatasets = res.startups.map((s,i)=>({label:s.name,data:s.yearly_projections,borderColor:PAL[i%PAL.length],backgroundColor:'transparent',tension:.4,pointRadius:3,pointBackgroundColor:PAL[i%PAL.length]}));
      new Chart(document.getElementById('chartPortProj'),{type:'line',data:{labels:['Year 1','Year 2','Year 3','Year 4','Year 5'],datasets:projDatasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:10,font:{size:10}}}},scales:{x:{grid:gridOpts(),ticks:tickOpts()},y:{grid:gridOpts(),ticks:{...tickOpts(),callback:v=>'₹'+v+'Cr'}}}}});
    }, 100);

    toast('Portfolio simulated!','success');
  }catch(e){console.error(e); toast('Simulation failed','error');}
}

// ── INVESTOR NETWORK ──
async function loadNetwork(){
  try{
    const data = await fetch('/api/investor_network').then(r=>r.json());
    const canvas = document.getElementById('networkCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 500;
    const W = canvas.width, H = canvas.height;

    // Position nodes in a circle
    const nodes = data.nodes.map((n,i)=>{
      const angle = (i / data.nodes.length) * Math.PI * 2;
      const radius = Math.min(W,H) * 0.38;
      return {...n, x: W/2 + Math.cos(angle)*radius, y: H/2 + Math.sin(angle)*radius, vx:0, vy:0};
    });
    const nodeMap = {};
    nodes.forEach(n=>nodeMap[n.id]=n);

    // Simple force simulation
    function simulate(){
      for(let iter=0;iter<80;iter++){
        // Repulsion
        for(let i=0;i<nodes.length;i++){
          for(let j=i+1;j<nodes.length;j++){
            let dx=nodes[j].x-nodes[i].x, dy=nodes[j].y-nodes[i].y;
            let dist=Math.sqrt(dx*dx+dy*dy)||1;
            let force=800/(dist*dist);
            nodes[i].x-=dx/dist*force; nodes[i].y-=dy/dist*force;
            nodes[j].x+=dx/dist*force; nodes[j].y+=dy/dist*force;
          }
        }
        // Attraction (edges)
        data.edges.forEach(e=>{
          const a=nodeMap[e.source], b=nodeMap[e.target];
          if(!a||!b) return;
          let dx=b.x-a.x, dy=b.y-a.y;
          let dist=Math.sqrt(dx*dx+dy*dy)||1;
          let force=(dist-150)*0.005;
          a.x+=dx/dist*force; a.y+=dy/dist*force;
          b.x-=dx/dist*force; b.y-=dy/dist*force;
        });
        // Center gravity
        nodes.forEach(n=>{
          n.x+=(W/2-n.x)*0.01; n.y+=(H/2-n.y)*0.01;
          n.x=Math.max(40,Math.min(W-40,n.x));
          n.y=Math.max(40,Math.min(H-40,n.y));
        });
      }
    }
    simulate();

    // Draw
    function draw(){
      ctx.clearRect(0,0,W,H);
      // Edges
      data.edges.forEach(e=>{
        const a=nodeMap[e.source], b=nodeMap[e.target];
        if(!a||!b) return;
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        ctx.strokeStyle=`rgba(212,168,67,${Math.min(0.4,e.shared*0.08)})`;
        ctx.lineWidth=Math.min(3,e.shared*0.8);ctx.stroke();
      });
      // Nodes
      nodes.forEach(n=>{
        const r=Math.max(6,Math.min(20,n.deals*1.5));
        ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);
        const grad=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,r);
        grad.addColorStop(0,'rgba(0,212,170,0.8)');grad.addColorStop(1,'rgba(0,212,170,0.2)');
        ctx.fillStyle=grad;ctx.fill();
        ctx.strokeStyle='rgba(0,212,170,0.4)';ctx.lineWidth=1;ctx.stroke();
        // Label
        ctx.fillStyle='rgba(232,237,245,0.8)';ctx.font='9px "DM Sans"';ctx.textAlign='center';
        const label = n.id.length > 18 ? n.id.substring(0,16)+'…' : n.id;
        ctx.fillText(label,n.x,n.y+r+12);
      });
    }
    draw();

    // Click interaction
    canvas.onclick = (e)=>{
      const rect=canvas.getBoundingClientRect();
      const mx=e.clientX-rect.left, my=e.clientY-rect.top;
      let clicked=null;
      nodes.forEach(n=>{
        const r=Math.max(6,Math.min(20,n.deals*1.5));
        const dist=Math.sqrt((mx-n.x)**2+(my-n.y)**2);
        if(dist<r+5) clicked=n;
      });
      if(clicked){
        const connections = data.edges.filter(e=>e.source===clicked.id||e.target===clicked.id);
        document.getElementById('network-info').innerHTML = `
          <div style="font-weight:600;font-size:15px;margin-bottom:8px">${clicked.id}</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:8px">${clicked.deals} deals · ${connections.length} co-investment links</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${connections.map(c=>{
            const partner = c.source===clicked.id?c.target:c.source;
            return `<span class="badge badge-teal">${partner} (${c.shared})</span>`;
          }).join('')}</div>`;
      }
    };

    document.getElementById('network-info').innerHTML = '<p style="color:var(--muted);font-size:12px">Click on any investor node to see their co-investment relationships</p>';
  }catch(e){console.error(e); toast('Network load failed','error');}
}

// ── ROI CALCULATOR ──
async function calculateROI(){
  const startup = document.getElementById('roi-startup').value.trim();
  const amount = parseFloat(document.getElementById('roi-amount').value) || 10;
  const years = parseInt(document.getElementById('roi-years').value) || 5;
  if(!startup){ toast('Enter a startup name','error'); return; }

  try{
    const res = await fetch('/api/roi_calculator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({startup, amount_cr:amount, years})}).then(r=>r.json());
    if(res.error){ toast(res.error,'error'); return; }

    const s = res.scenarios;
    let html = `<div style="margin-bottom:1rem;font-size:13px;color:var(--muted)">Industry: <strong style="color:var(--text)">${res.industry}</strong> · Growth Rate: <strong style="color:var(--text)">${res.industry_growth_rate}%</strong> · Investment: <strong style="color:var(--gold2)">₹${res.investment_cr}Cr</strong></div>`;

    html += `<div class="roi-scenarios">
      ${['bear','base','bull'].map(sc=>{
        const d=s[sc]; const label={bear:'🐻 Bear Case',base:'📊 Base Case',bull:'🐂 Bull Case'}[sc];
        return `<div class="roi-card ${sc}"><div class="roi-card-title">${label}</div>
          <div class="roi-big" style="color:${sc==='bear'?C.red:sc==='bull'?C.teal:C.gold}">₹${d.final_value.toFixed(1)}Cr</div>
          <div class="roi-metric"><span>ROI</span><span style="color:${d.roi_pct>=0?C.teal:C.red}">${d.roi_pct}%</span></div>
          <div class="roi-metric"><span>IRR</span><span>${d.irr}%</span></div>
          <div class="roi-metric"><span>Multiple</span><span>${(d.final_value/amount).toFixed(2)}x</span></div></div>`;
      }).join('')}
    </div>`;

    html += `<div class="charts-grid" style="margin-top:1rem"><div class="chart-card span-12"><div class="chart-title">Projected Growth — All Scenarios</div><div class="chart-wrap tall"><canvas id="chartROI"></canvas></div></div></div>`;

    document.getElementById('roi-results').innerHTML = html;

    setTimeout(()=>{
      const labels = Array.from({length:years},(_,i)=>`Year ${i+1}`);
      new Chart(document.getElementById('chartROI'),{type:'line',data:{labels,datasets:[
        {label:'Bull',data:s.bull.projections,borderColor:C.teal,backgroundColor:'rgba(0,212,170,0.06)',fill:true,tension:.4,pointRadius:4,pointBackgroundColor:C.teal},
        {label:'Base',data:s.base.projections,borderColor:C.gold,backgroundColor:'rgba(212,168,67,0.06)',fill:true,tension:.4,pointRadius:4,pointBackgroundColor:C.gold},
        {label:'Bear',data:s.bear.projections,borderColor:C.red,backgroundColor:'rgba(255,79,109,0.06)',fill:true,tension:.4,pointRadius:4,pointBackgroundColor:C.red},
      ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:10,font:{size:11}}}},scales:{x:{grid:gridOpts(),ticks:tickOpts()},y:{grid:gridOpts(),ticks:{...tickOpts(),callback:v=>'₹'+v+'Cr'}}}}});
    }, 100);

    toast('ROI calculated!','success');
  }catch(e){console.error(e); toast('Calculation failed','error');}
}

// ── ANALYSIS ──
async function loadAnalysis(){
  try{
    const mo = await fetch('/api/monthly_trend').then(r=>r.json());
    new Chart(document.getElementById('chartMonthly'),{type:'line',data:{labels:mo.months,datasets:[{label:'Funding (₹Cr)',data:mo.amounts,borderColor:C.teal,backgroundColor:'rgba(0,212,170,0.05)',fill:true,tension:.4,pointRadius:1.5,pointBackgroundColor:C.teal}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:gridOpts(),ticks:{...tickOpts(),maxTicksLimit:16}},y:{grid:gridOpts(),ticks:{...tickOpts(),callback:v=>'₹'+v+'Cr'}}}}});

    const inv = await fetch('/api/top_investors').then(r=>r.json());
    new Chart(document.getElementById('chartInvestors'),{type:'bar',data:{labels:inv.investors,datasets:[{label:'Deals',data:inv.counts,backgroundColor:'rgba(155,109,255,0.25)',borderColor:C.purple,borderWidth:1,borderRadius:4,borderSkipped:false}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:gridOpts(),ticks:tickOpts()},y:{grid:{display:false},ticks:{...tickOpts(),font:{size:9}}}}}});

    // YoY growth
    const yoy = await fetch('/api/yoy_growth').then(r=>r.json());
    new Chart(document.getElementById('chartYoY'),{type:'bar',data:{labels:yoy.years,datasets:[
      {label:'Funding Growth %',data:yoy.funding_growth,backgroundColor:yoy.funding_growth.map(v=>v>=0?'rgba(0,212,170,0.35)':'rgba(255,79,109,0.35)'),borderColor:yoy.funding_growth.map(v=>v>=0?C.teal:C.red),borderWidth:1,borderRadius:4,borderSkipped:false},
      {label:'Deal Growth %',data:yoy.deal_growth,type:'line',borderColor:C.gold,tension:.4,pointRadius:3,pointBackgroundColor:C.gold,fill:false}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:10,font:{size:10}}}},scales:{x:{grid:gridOpts(),ticks:tickOpts()},y:{grid:gridOpts(),ticks:{...tickOpts(),callback:v=>v+'%'}}}}});

    // Top startups table
    const top = await fetch('/api/top_startups').then(r=>r.json());
    document.getElementById('top-startups-table').innerHTML = `<table class="data-table"><thead><tr><th>#</th><th>Startup</th><th>Industry</th><th>City</th><th>Stage</th><th>Investability</th><th>Rounds</th><th>Funding</th></tr></thead><tbody>
      ${top.map((s,i)=>`<tr><td style="color:var(--muted);font-family:var(--font-mono)">${i+1}</td><td style="font-weight:600">${s.name}</td><td>${s.industry}</td><td style="color:var(--muted)">${s.city}</td><td><span class="badge ${stageBadge(s.stage)}">${s.stage}</span></td><td style="font-family:var(--font-mono);color:${C.gold2}">${s.investability}</td><td style="text-align:center;color:var(--muted)">${s.rounds}</td><td class="amount-val">₹${s.funding_cr.toLocaleString()}Cr</td></tr>`).join('')}
    </tbody></table>`;
  }catch(e){console.error(e); toast('Analysis load failed','error');}
}

// ── RECOMMENDATIONS ──
async function loadRecommendations(){
  try{
    const recs = await fetch('/api/recommendations').then(r=>r.json());
    const maxScore = recs[0]?.investability || 100;
    document.getElementById('rec-grid').innerHTML = recs.map(r=>`
      <div class="rec-card">
        <div class="rec-rank">${r.rank}</div>
        <div class="rec-name">${r.name}</div>
        <div class="rec-scores">
          <span class="rec-score-pill" style="background:rgba(212,168,67,0.12);color:${C.gold2}">Invest: ${r.investability}</span>
          <span class="rec-score-pill" style="background:rgba(0,212,170,0.12);color:${C.teal2}">Growth: ${r.growth_score}</span>
          <span class="rec-score-pill badge ${riskBadge(r.risk_category)}">Risk: ${r.risk_category}</span>
        </div>
        <div class="rec-bar"><div class="rec-bar-fill" style="width:${(r.investability/maxScore*100).toFixed(1)}%"></div></div>
        <div class="rec-meta">
          <div class="rec-meta-item">Industry <span>${r.industry}</span></div>
          <div class="rec-meta-item">· City <span>${r.city}</span></div>
          <div class="rec-meta-item">· Stage <span>${r.stage}</span></div>
          <div class="rec-meta-item">· Funding <span>₹${r.funding_cr}Cr</span></div>
        </div>
        <div class="rec-investors">👤 ${r.investors}</div>
      </div>`).join('');
  }catch(e){console.error(e); toast('Recommendations failed','error');}
}

// ── SEARCH ──
let searchTimer;
function doSearch(q){
  clearTimeout(searchTimer);
  document.getElementById('autocomplete-list').style.display='none';
  if(q.length<2){document.getElementById('search-results').innerHTML='<div class="empty-state"><div class="emoji">🚀</div><p>Type at least 2 characters</p></div>';return;}
  searchTimer=setTimeout(async()=>{
    const res = await fetch('/api/search?q='+encodeURIComponent(q)).then(r=>r.json());
    if(!res.length){document.getElementById('search-results').innerHTML='<div class="empty-state"><div class="emoji">😕</div><p>No startups found for "'+q+'"</p></div>';return;}
    document.getElementById('search-results').innerHTML=res.map(s=>`
      <div class="search-card" onclick="openProfile('${s.name.replace(/'/g,"\\'")}')">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="search-name">${s.name}</div>
          <span class="badge ${riskBadge(s.risk_category)}">${s.risk_category} Risk</span>
        </div>
        <div class="search-row"><span>${s.industry}</span><span style="font-family:var(--font-mono);color:${C.gold2}">₹${s.funding_cr}Cr</span></div>
        <div class="search-row">City: <span>${s.city}</span></div>
        <div class="search-row">Stage: <span>${s.stage}</span> &nbsp; Rounds: <span>${s.rounds}</span> &nbsp; Inv: <span style="color:${C.gold2}">${s.investability}</span></div>
        <div style="margin-top:6px;font-size:10px;color:var(--dim)">👤 ${s.investors}</div>
      </div>`).join('');
  },350);
}

// ── STARTUP PROFILE MODAL ──
async function openProfile(name){
  try{
    const p = await fetch('/api/startup_profile/'+encodeURIComponent(name)).then(r=>r.json());
    if(p.error){toast(p.error,'error');return;}
    const sc = p.scores||{};
    let html = `<button class="modal-close" onclick="closeProfile()">✕</button>
      <h2 style="font-family:var(--font-display);font-size:1.6rem;margin-bottom:4px">${p.name}</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1rem">
        <span class="badge badge-blue">${p.industry}</span>
        <span class="badge badge-teal">${p.city}</span>
        <span class="badge ${stageBadge(p.current_stage)}">${p.current_stage}</span>
        ${sc.risk_category?`<span class="badge ${riskBadge(sc.risk_category)}">${sc.risk_category} Risk</span>`:''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.6rem;margin-bottom:1rem">
        <div class="risk-stat" style="padding:10px"><div class="risk-stat-value" style="font-size:1.3rem;color:${C.gold2}">₹${p.total_funding_cr}Cr</div><div class="risk-stat-label">Total Funding</div></div>
        <div class="risk-stat" style="padding:10px"><div class="risk-stat-value" style="font-size:1.3rem">${p.rounds}</div><div class="risk-stat-label">Rounds</div></div>
        ${sc.investability?`<div class="risk-stat" style="padding:10px"><div class="risk-stat-value" style="font-size:1.3rem;color:${C.gold2}">${sc.investability}</div><div class="risk-stat-label">Investability</div></div>`:''}
        ${sc.growth_score?`<div class="risk-stat" style="padding:10px"><div class="risk-stat-value" style="font-size:1.3rem;color:${C.teal}">${sc.growth_score}</div><div class="risk-stat-label">Growth</div></div>`:''}
      </div>`;
    if(p.timeline.length){
      html += `<div style="font-weight:600;margin-bottom:8px">Funding Timeline</div><table class="data-table"><thead><tr><th>Date</th><th>Stage</th><th>Amount</th><th>Investors</th></tr></thead><tbody>
        ${p.timeline.map(t=>`<tr><td style="font-family:var(--font-mono);font-size:11px">${t.date}</td><td><span class="badge ${stageBadge(t.stage)}">${t.stage}</span></td><td class="amount-val">₹${t.amount_cr}Cr</td><td style="font-size:10px;color:var(--muted)">${t.investors}</td></tr>`).join('')}
      </tbody></table>`;
    }
    if(p.all_investors?.length){
      html += `<div style="margin-top:1rem;font-weight:600;margin-bottom:6px">All Investors</div><div style="display:flex;flex-wrap:wrap;gap:4px">${p.all_investors.map(i=>`<span class="badge badge-purple">${i}</span>`).join('')}</div>`;
    }
    document.getElementById('profile-modal-content').innerHTML = html;
    document.getElementById('profile-modal').classList.add('show');
  }catch(e){console.error(e);toast('Profile load failed','error');}
}
function closeProfile(){document.getElementById('profile-modal').classList.remove('show');}
document.getElementById('profile-modal').addEventListener('click',e=>{if(e.target===document.getElementById('profile-modal'))closeProfile();});

// ── COMPARE ──
let compareRadarChart;
async function doCompare(){
  const names=[document.getElementById('c1').value.trim(),document.getElementById('c2').value.trim(),document.getElementById('c3').value.trim(),document.getElementById('c4').value.trim()].filter(Boolean);
  if(names.length<2){toast('Enter at least 2 startups','error');return;}
  try{
    const res = await fetch('/api/compare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({startups:names})}).then(r=>r.json());
    if(!res.length){document.getElementById('compare-results').innerHTML='<div class="empty-state"><div class="emoji">😕</div><p>No matching startups found</p></div>';return;}
    const maxFund=Math.max(...res.map(r=>r.funding_cr));
    const colors=[C.gold,C.teal,C.blue,C.purple];
    document.getElementById('compare-results').innerHTML=`<div class="compare-cards">${res.map((s,i)=>`
      <div class="compare-card" style="border-color:${colors[i%4]}44">
        <div style="width:30px;height:3px;background:${colors[i%4]};border-radius:2px;margin:0 auto 10px"></div>
        <div class="compare-card-name">${s.name}</div>
        <div class="compare-metric"><span class="compare-metric-label">Industry</span><span class="compare-metric-val">${s.industry}</span></div>
        <div class="compare-metric"><span class="compare-metric-label">City</span><span class="compare-metric-val">${s.city}</span></div>
        <div class="compare-metric"><span class="compare-metric-label">Stage</span><span class="badge ${stageBadge(s.stage)}">${s.stage}</span></div>
        <div class="compare-metric"><span class="compare-metric-label">Rounds</span><span class="compare-metric-val">${s.rounds}</span></div>
        <div class="compare-metric"><span class="compare-metric-label">Funding</span><span class="compare-metric-val" style="color:${colors[i%4]}">₹${s.funding_cr}Cr</span></div>
        ${s.investability?`<div class="compare-metric"><span class="compare-metric-label">Investability</span><span class="compare-metric-val" style="color:${C.gold2}">${s.investability}</span></div>`:''}
        ${s.risk_category?`<div class="compare-metric"><span class="compare-metric-label">Risk</span><span class="badge ${riskBadge(s.risk_category)}">${s.risk_category}</span></div>`:''}
      </div>`).join('')}</div>`;

    // Radar chart
    if(res.some(s=>s.growth_score)){
      document.getElementById('compare-chart-card').style.display='block';
      if(compareRadarChart) compareRadarChart.destroy();
      compareRadarChart = new Chart(document.getElementById('chartCompareRadar'),{type:'radar',data:{labels:['Growth','Investability','Momentum','Funding','Rounds'],datasets:res.map((s,i)=>({label:s.name,data:[s.growth_score||0,s.investability||0,s.market_momentum||0,Math.min(100,s.funding_cr),s.rounds*10],borderColor:colors[i%4],backgroundColor:colors[i%4]+'22',pointBackgroundColor:colors[i%4],borderWidth:2}))},options:{responsive:true,maintainAspectRatio:false,scales:{r:{grid:{color:C.border},pointLabels:{color:C.muted,font:{size:11}},ticks:{display:false},suggestedMin:0}},plugins:{legend:{position:'top',labels:{boxWidth:10,font:{size:11}}}}}});
    }
    toast('Comparison ready!','success');
  }catch(e){console.error(e);toast('Compare failed','error');}
}

// ── WATCHLIST ──
async function loadWatchlist(){
  try{
    const res = await fetch('/api/watchlist').then(r=>r.json());
    if(!res.length){
      document.getElementById('watchlist-grid').innerHTML='<div class="watchlist-empty"><div class="emoji" style="font-size:2.5rem;margin-bottom:.8rem">📌</div><p style="font-size:13px;color:var(--muted)">Your watchlist is empty. Add startups to track them.</p></div>';
      return;
    }
    document.getElementById('watchlist-grid').innerHTML = res.map(s=>`
      <div class="watchlist-card">
        <button class="watchlist-remove" onclick="removeFromWatchlist('${s.name.replace(/'/g,"\\'")}')">✕</button>
        <div class="watchlist-card-name">${s.name}</div>
        <div class="watchlist-card-meta">Industry: <span>${s.industry}</span></div>
        <div class="watchlist-card-meta">City: <span>${s.city}</span> · Stage: <span>${s.stage}</span></div>
        <div class="watchlist-card-meta">Funding: <span style="color:${C.gold2}">₹${s.funding_cr}Cr</span></div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <span class="rec-score-pill" style="background:rgba(212,168,67,0.12);color:${C.gold2}">Invest: ${s.investability}</span>
          <span class="rec-score-pill badge ${riskBadge(s.risk_category)}">Risk: ${s.risk_category}</span>
        </div>
      </div>`).join('');
  }catch(e){console.error(e);}
}

async function addToWatchlist(){
  const name = document.getElementById('watchlist-add-input').value.trim();
  if(!name){toast('Enter a startup name','error');return;}
  try{
    await fetch('/api/watchlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
    document.getElementById('watchlist-add-input').value='';
    toast(`${name} added to watchlist`,'success');
    loadWatchlist();
  }catch(e){toast('Failed to add','error');}
}

async function removeFromWatchlist(name){
  try{
    await fetch('/api/watchlist',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
    toast(`${name} removed`,'info');
    loadWatchlist();
  }catch(e){toast('Failed to remove','error');}
}

// ── HEATMAP ──
async function loadHeatmap(){
  try{
    const hm = await fetch('/api/heatmap_data').then(r=>r.json());
    const maxVal = Math.max(...hm.data.flat());

    function heatColor(val){
      const ratio = maxVal > 0 ? val / maxVal : 0;
      if(ratio < 0.1) return 'rgba(17,24,39,0.8)';
      if(ratio < 0.3) return `rgba(0,212,170,${ratio*0.8})`;
      if(ratio < 0.6) return `rgba(212,168,67,${ratio*0.9})`;
      return `rgba(255,79,109,${Math.min(1,ratio)})`;
    }

    let tableHTML = '<table class="heatmap-table"><thead><tr><th>Industry</th>';
    hm.months.forEach(m=>tableHTML += `<th>${m}</th>`);
    tableHTML += '</tr></thead><tbody>';
    hm.industries.forEach((ind,i)=>{
      tableHTML += `<tr><td>${ind}</td>`;
      hm.data[i].forEach(val=>{
        tableHTML += `<td><span class="heatmap-cell" style="background:${heatColor(val)};color:${val>0?'#fff':'var(--dim)'}" title="₹${val}Cr">${val>0?'₹'+val:'–'}</span></td>`;
      });
      tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table>';
    tableHTML += '<div class="heatmap-legend"><span>Low</span><div class="heatmap-legend-gradient"></div><span>High</span></div>';

    document.getElementById('heatmap-container').innerHTML = tableHTML;

    // Industry growth chart
    const growth = await fetch('/api/industry_growth_rates').then(r=>r.json());
    const gLabels = Object.keys(growth).sort((a,b)=>growth[b]-growth[a]).slice(0,10);
    const gData = gLabels.map(l=>growth[l]);
    new Chart(document.getElementById('chartIndustryGrowth'),{type:'bar',data:{labels:gLabels,datasets:[{label:'Growth %',data:gData,backgroundColor:gData.map(v=>v>=0?'rgba(0,212,170,0.3)':'rgba(255,79,109,0.3)'),borderColor:gData.map(v=>v>=0?C.teal:C.red),borderWidth:1,borderRadius:4,borderSkipped:false}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:gridOpts(),ticks:{...tickOpts(),callback:v=>v+'%'}},y:{grid:{display:false},ticks:{...tickOpts(),font:{size:9}}}}}});

    // Quarterly chart
    const q = await fetch('/api/quarterly').then(r=>r.json());
    new Chart(document.getElementById('chartQuarterly'),{type:'bar',data:{labels:q.quarters,datasets:[
      {label:'Funding (₹Cr)',data:q.amounts,backgroundColor:'rgba(212,168,67,0.3)',borderColor:C.gold,borderWidth:1,borderRadius:4,borderSkipped:false,order:2},
      {label:'Deals',data:q.counts,type:'line',borderColor:C.teal,tension:.4,pointRadius:2,pointBackgroundColor:C.teal,yAxisID:'y2',order:1}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:10,font:{size:10}}}},scales:{x:{grid:gridOpts(),ticks:{...tickOpts(),maxTicksLimit:12}},y:{grid:gridOpts(),ticks:{...tickOpts(),callback:v=>'₹'+v}},y2:{position:'right',grid:{display:false},ticks:tickOpts()}}}});

    toast('Heatmap loaded!','success');
  }catch(e){console.error(e);toast('Heatmap failed','error');}
}

// ── PDF EXPORT ──
async function exportDashboardPDF(){
  toast('Generating PDF report...','info');
  const btn = document.getElementById('export-pdf-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Generating...';

  try{
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l','mm','a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // Title page
    pdf.setFillColor(6,10,18);
    pdf.rect(0,0,pageW,pageH,'F');
    pdf.setTextColor(232,237,245);
    pdf.setFontSize(32);
    pdf.text('VentureIQ', pageW/2, 50, {align:'center'});
    pdf.setFontSize(14);
    pdf.setTextColor(122,139,168);
    pdf.text('AI-Powered Startup Investment Intelligence Report', pageW/2, 62, {align:'center'});
    pdf.setFontSize(10);
    pdf.text('Generated: ' + new Date().toLocaleDateString('en-IN', {year:'numeric',month:'long',day:'numeric'}), pageW/2, 75, {align:'center'});

    // KPI Summary
    const kpis = await fetch('/api/kpis').then(r=>r.json());
    pdf.setFontSize(18);
    pdf.setTextColor(212,168,67);
    pdf.text('Key Metrics', 20, 100);
    pdf.setFontSize(11);
    pdf.setTextColor(232,237,245);
    const kpiLines = [
      `Total Startups: ${kpis.total_startups.toLocaleString()}`,
      `Total Funding: ₹${kpis.total_funding_cr.toLocaleString()} Crore`,
      `Total Investors: ${kpis.total_investors.toLocaleString()}`,
      `Average Deal Size: ₹${kpis.avg_funding_cr} Crore`,
      `Top Industry: ${kpis.top_industry}`,
      `Top City: ${kpis.top_city}`,
      `YoY Growth: ${kpis.yoy_growth}%`
    ];
    kpiLines.forEach((line,i)=>{
      pdf.text(line, 25, 112 + i*8);
    });

    // Top recommendations
    const recs = await fetch('/api/recommendations').then(r=>r.json());
    pdf.setFontSize(18);
    pdf.setTextColor(0,212,170);
    pdf.text('Top AI Investment Picks', 20, 172);
    pdf.setFontSize(9);
    pdf.setTextColor(232,237,245);
    recs.slice(0,8).forEach((r,i)=>{
      pdf.text(`${r.rank}. ${r.name} — Invest: ${r.investability} | Growth: ${r.growth_score} | Risk: ${r.risk_category} | ₹${r.funding_cr}Cr`, 25, 184+i*7);
    });

    pdf.save('VentureIQ_Report.pdf');
    toast('PDF downloaded!','success');
  }catch(e){
    console.error(e);
    toast('PDF export failed','error');
  }finally{
    btn.disabled = false;
    btn.textContent = '📄 Export PDF Report';
  }
}

// ── AUTOCOMPLETE (for search) ──
let acTimer;
document.getElementById('search-input')?.addEventListener('input', function(){
  const q = this.value.trim();
  clearTimeout(acTimer);
  if(q.length < 1){
    document.getElementById('autocomplete-list').style.display='none';
    return;
  }
  acTimer = setTimeout(async()=>{
    try{
      const matches = await fetch('/api/autocomplete?q='+encodeURIComponent(q)).then(r=>r.json());
      const list = document.getElementById('autocomplete-list');
      if(matches.length > 0){
        list.innerHTML = matches.map(m=>`<div class="autocomplete-item" onclick="selectAutocomplete('${m.replace(/'/g,"\\'")}')">${m}</div>`).join('');
        list.style.display = 'block';
      } else {
        list.style.display = 'none';
      }
    }catch(e){}
  }, 200);
});

function selectAutocomplete(name){
  document.getElementById('search-input').value = name;
  document.getElementById('autocomplete-list').style.display = 'none';
  doSearch(name);
}

// Hide autocomplete on click outside
document.addEventListener('click', e=>{
  if(!e.target.closest('.search-bar')){
    const list = document.getElementById('autocomplete-list');
    if(list) list.style.display = 'none';
  }
});

// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown',e=>{
  if(e.key==='/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();showSection('search');setTimeout(()=>document.getElementById('search-input').focus(),100);}
  if(e.key==='Escape') closeProfile();
});

// ── INIT ──
loadHero();
document.querySelector('.nav-link[data-section="hero"]').classList.add('active');

