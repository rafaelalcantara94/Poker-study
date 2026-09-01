import { supabase } from './supabase.js'
import './style.css'

const app = document.querySelector('#app')
let user = null
let db = { studies: [], hands: [], results: [], goals: [], tournaments: [] }
let currentPage = 'dashboard'
let hhStatsCache = []
let recoveryMode = false
let filters = { days: 30, site: 'all', format: 'all', start:'', end:'', minBuyin:'', maxBuyin:'', excludeSat:false }

const esc = (s='') => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))
const num = v => Number(String(v ?? '').replace(/[^0-9,.-]/g,'').replace(/,(?=\d{1,2}$)/,'.').replace(/,/g,'')) || 0
const money = n => Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD'})
const pct = (a,b) => b ? ((a/b)*100).toFixed(1)+'%' : '0.0%'
const today = () => new Date().toISOString().slice(0,10)
const tagList = s => String(s||'').split(',').map(x=>x.trim()).filter(Boolean)
const uid = () => crypto.randomUUID()

function loginView(){
  app.innerHTML = `<main class="auth"><div class="authbox"><div class="brand">Poker <b>Study</b><small>V6.0.1 • HH STATS</small></div>
  <h1>Entrar</h1><p class="muted">Estudos, mãos e resultados sincronizados na nuvem.</p>
  <input id="email" type="email" placeholder="E-mail"><input id="password" type="password" placeholder="Senha">
  <button class="btn" id="signin">Entrar</button><button class="btn secondary" id="signup">Criar conta</button>
  <button class="auth-link" id="forgot" type="button">Esqueci minha senha</button><p id="msg" class="muted"></p></div></main>`
  signin.onclick=async()=>{msg.textContent='Entrando...';const {error}=await supabase.auth.signInWithPassword({email:email.value.trim(),password:password.value});msg.textContent=error?error.message:''}
  signup.onclick=async()=>{if(!email.value.trim()||!password.value)return msg.textContent='Preencha e-mail e senha.';const {error}=await supabase.auth.signUp({email:email.value.trim(),password:password.value});msg.textContent=error?error.message:'Conta criada. Verifique seu e-mail se necessário.'}
  forgot.onclick=()=>forgotPasswordView(email.value.trim())
}
function forgotPasswordView(prefill=''){
  app.innerHTML=`<main class="auth"><div class="authbox"><div class="brand">Poker <b>Study</b><small>V5.7.1 • RECUPERAÇÃO</small></div><h1>Recuperar senha</h1><p class="muted">Digite seu e-mail para receber um link de recuperação.</p><input id="resetEmail" type="email" value="${esc(prefill)}" placeholder="E-mail"><button class="btn" id="sendReset">Enviar link</button><button class="btn secondary" id="backLogin">Voltar</button><p id="resetMsg" class="muted"></p></div></main>`
  backLogin.onclick=loginView
  sendReset.onclick=async()=>{const e=resetEmail.value.trim();if(!e)return resetMsg.textContent='Digite seu e-mail.';sendReset.disabled=true;resetMsg.textContent='Enviando...';const {error}=await supabase.auth.resetPasswordForEmail(e,{redirectTo:window.location.origin});sendReset.disabled=false;resetMsg.textContent=error?error.message:'Pronto! Verifique seu e-mail.'}
}
function newPasswordView(){
  app.innerHTML=`<main class="auth"><div class="authbox"><div class="brand">Poker <b>Study</b><small>V5.7.1 • NOVA SENHA</small></div><h1>Criar nova senha</h1><input id="newPassword" type="password" placeholder="Nova senha"><input id="confirmPassword" type="password" placeholder="Confirmar nova senha"><button class="btn" id="savePassword">Salvar nova senha</button><p id="passwordMsg" class="muted"></p></div></main>`
  savePassword.onclick=async()=>{const a=newPassword.value,b=confirmPassword.value;if(a.length<6)return passwordMsg.textContent='Use pelo menos 6 caracteres.';if(a!==b)return passwordMsg.textContent='As senhas não são iguais.';const {error}=await supabase.auth.updateUser({password:a});if(error)return passwordMsg.textContent=error.message;passwordMsg.textContent='Senha alterada. Abrindo...';history.replaceState({},document.title,window.location.pathname);setTimeout(async()=>{const {data}=await supabase.auth.getSession();user=data.session?.user||null;if(user){await load();shell()}else loginView()},600)}
}

async function load(){
  for(const t of ['studies','hands','results','goals','tournaments']){
    const orderCol = t==='tournaments' ? 'played_at' : 'date'
    const {data,error}=await supabase.from(t).select('*').order(orderCol,{ascending:false})
    db[t]=error?[]:(data||[])
    if(error) console.error(t,error)
  }
  for(const h of db.hands){h.image_url='';if(h.image_path){const {data}=await supabase.storage.from('hand-images').createSignedUrl(h.image_path,3600);h.image_url=data?.signedUrl||''}}
}

function shell(){
  app.innerHTML=`<div class="app"><aside class="sidebar"><div class="brand">Poker <b>Study</b><small>V6.0.1 • HH STATS</small></div><nav class="nav">
  ${[['dashboard','📊 Dashboard'],['analytics','📉 Analytics'],['studies','📚 Estudos'],['hands','🖐️ Mãos'],['replayer','🎬 Replayer'],['hhstats','📊 Stats HH'],['results','💰 Resultados'],['importer','↥ SharkScope / CSV'],['leaks','🧠 Central de Leaks'],['plan','🗓️ Plano de Estudos'],['evolution','🚀 Evolução'],['goals','🎯 Metas'],['reports','📈 Relatórios']].map(([p,l])=>`<button data-p="${p}">${l}</button>`).join('')}
  </nav><button class="btn logout" id="logout">Sair</button></aside><main class="content"><header><div class="header-title"><h1 id="title"></h1><div class="muted" id="subtitle"></div></div><span class="user">${esc(user.email)}</span></header><section id="page"></section></main></div>
  <div id="modal" class="modal"><div class="modal-box"><div class="modal-head"><h2 id="modalTitle"></h2><button class="btn secondary" id="closeModal">Fechar</button></div><div id="modalBody"></div></div></div>`
  document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>route(b.dataset.p))
  logout.onclick=async()=>supabase.auth.signOut()
  closeModal.onclick=()=>modal.classList.remove('show')
  route(currentPage)
}
function route(p){
  currentPage=p
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.p===p))
  const meta={dashboard:['Dashboard','Visão geral de performance e estudo'],analytics:['Analytics','Profit acumulado, filtros por site e formato'],studies:['Estudos','Aulas, cursos, progresso e tags'],hands:['Banco de mãos','Imagens, revisão, confiança e prioridade'],replayer:['Replayer GG','Importe Hand History e reveja a mão ação por ação'],hhstats:['Stats HH','Tracker técnico baseado nas suas Hand Histories'],results:['Resultados','Sessões manuais e métricas'],importer:['SharkScope / CSV','Importe torneios individuais com mapeamento de colunas'],leaks:['Central de Leaks','Spots recorrentes, confiança e prioridade de revisão'],plan:['Plano de Estudos','Fila automática do que estudar agora'],evolution:['Evolução','Cruze estudo, revisão e performance ao longo do tempo'],goals:['Metas','Objetivos de volume e estudo'],reports:['Relatórios','Leitura consolidada dos dados']}[p]
  title.textContent=meta[0];subtitle.textContent=meta[1]
  page.innerHTML=({dashboard,analytics,studies,hands,replayer,hhstats,results,importer,leaks,plan,evolution,goals,reports})[p]()
  bindPage(p)
}

function allPerformanceRows(){
  const imported=db.tournaments.map(t=>({date:String(t.played_at).slice(0,10),site:t.site||'',format:t.format||'',games:1,entries:1+(+t.reentries||0),reentries:+t.reentries||0,buyins:+t.buyin||0,prizes:+t.prize||0,profit:+t.profit||0,itm:(+t.prize||0)>0?1:0,hours:(+t.duration_seconds||0)/3600,prize:+t.prize||0,name:t.tournament_name||'',source:'import'}))
  const manual=db.results.map(r=>({date:r.date,site:r.site||'',format:r.format||'',games:+r.tournaments||0,entries:+r.tournaments||0,reentries:0,buyins:+r.buyins||0,prizes:+r.prizes||0,profit:+r.profit||0,itm:+r.itm||0,hours:+r.hours||0,prize:+r.prizes||0,name:'Sessão manual',source:'manual'}))
  return [...manual,...imported]
}
function filteredRows(){
  let rows=allPerformanceRows()
  if(filters.start||filters.end){if(filters.start)rows=rows.filter(x=>x.date>=filters.start);if(filters.end)rows=rows.filter(x=>x.date<=filters.end)}
  else if(filters.days){const dates=rows.map(x=>x.date).filter(Boolean).sort();const anchor=dates.at(-1)||today();const d=new Date(anchor+'T12:00:00');d.setDate(d.getDate()-filters.days+1);const cut=d.toISOString().slice(0,10);rows=rows.filter(x=>x.date>=cut&&x.date<=anchor)}
  if(filters.site!=='all') rows=rows.filter(x=>x.site===filters.site)
  if(filters.format!=='all') rows=rows.filter(x=>x.format===filters.format)
  if(filters.excludeSat) rows=rows.filter(x=>!String(x.format).toLowerCase().includes('satellite'))
  if(filters.minBuyin!=='')rows=rows.filter(x=>x.buyins/Math.max(1,x.games)>=+filters.minBuyin)
  if(filters.maxBuyin!=='')rows=rows.filter(x=>x.buyins/Math.max(1,x.games)<=+filters.maxBuyin)
  return rows
}
function filterBar(){
  const sites=[...new Set(allPerformanceRows().map(x=>x.site).filter(Boolean))].sort(),formats=[...new Set(allPerformanceRows().map(x=>x.format).filter(Boolean))].sort()
  return `<div class="toolbar filters"><select id="periodSelect"><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="0">Tudo</option></select><select id="siteFilter"><option value="all">Todos os sites</option>${sites.map(x=>`<option>${esc(x)}</option>`).join('')}</select><select id="formatFilter"><option value="all">Todos os formatos</option>${formats.map(x=>`<option>${esc(x)}</option>`).join('')}</select><input id="startFilter" type="date" title="Data inicial" value="${filters.start}"><input id="endFilter" type="date" title="Data final" value="${filters.end}"><input id="minBuyin" type="number" step=".01" placeholder="Buy-in mín." value="${filters.minBuyin}"><input id="maxBuyin" type="number" step=".01" placeholder="Buy-in máx." value="${filters.maxBuyin}"><label class="check"><input id="excludeSat" type="checkbox" ${filters.excludeSat?'checked':''}> Excluir satélites</label></div>`
}
function metrics(rows){
  const g=rows.reduce((a,x)=>a+x.games,0),bi=rows.reduce((a,x)=>a+x.buyins,0),p=rows.reduce((a,x)=>a+x.profit,0),itm=rows.reduce((a,x)=>a+x.itm,0),hrs=rows.reduce((a,x)=>a+x.hours,0)
  return {g,bi,p,itm,hrs,abi:g?bi/g:0,roi:bi?p/bi*100:0}
}
function dailyAggregate(rows){
  const m={};for(const x of rows){if(!m[x.date])m[x.date]={date:x.date,profit:0,buyins:0,games:0};m[x.date].profit+=x.profit;m[x.date].buyins+=x.buyins;m[x.date].games+=x.games}
  return Object.values(m).sort((a,b)=>a.date.localeCompare(b.date))
}
function cumulativeSvg(rows){
  const d=dailyAggregate(rows);if(!d.length)return '<p class="muted">Sem dados para o gráfico.</p>'
  let c=0;const vals=d.map(x=>({date:x.date,v:(c+=x.profit)})),min=Math.min(0,...vals.map(x=>x.v)),max=Math.max(0,...vals.map(x=>x.v)),range=Math.max(1,max-min),w=900,h=300,L=70,R=20,T=20,B=42
  const X=i=>L+(w-L-R)*(i/Math.max(1,vals.length-1)),Y=v=>T+(h-T-B)*(1-(v-min)/range),pts=vals.map((x,i)=>`${X(i)},${Y(x.v)}`).join(' '),ticks=[0,.25,.5,.75,1].map(q=>min+range*q)
  return `<div class="chart-wrap"><svg class="line-chart" viewBox="0 0 ${w} ${h}">${ticks.map(v=>`<line x1="${L}" x2="${w-R}" y1="${Y(v)}" y2="${Y(v)}" class="grid-line"/><text x="${L-8}" y="${Y(v)+4}" text-anchor="end" class="chart-label">${money(v)}</text>`).join('')}<polyline points="${pts}" fill="none" class="profit-line"/>${vals.map((x,i)=>`<circle class="chart-dot" cx="${X(i)}" cy="${Y(x.v)}" r="5"><title>${x.date} · ${money(x.v)}</title></circle>`).join('')}<text x="${L}" y="${h-10}" class="chart-label">${vals[0].date}</text><text x="${w-R}" y="${h-10}" text-anchor="end" class="chart-label">${vals.at(-1).date}</text></svg><p class="muted">Passe o mouse sobre os pontos para ver data e profit acumulado.</p></div>`
}
function dashboard(){
  const rows=filteredRows(),m=metrics(rows),studyH=db.studies.filter(x=>x.status==='done').reduce((a,x)=>a+(+x.duration||0),0)/60
  return `${filterBar()}<div class="cards">${[['Torneios',m.g],['ABI',money(m.abi)],['Profit',money(m.p)],['ROI',m.roi.toFixed(1)+'%'],['ITM',pct(m.itm,m.g)],['Estudo',studyH.toFixed(1)+'h']].map((x,i)=>`<div class="card"><small>${x[0]}</small><strong class="${i===2?(m.p>=0?'good':'bad'):''}">${x[1]}</strong></div>`).join('')}</div><div class="grid2"><div class="panel"><h2>Profit acumulado</h2>${cumulativeSvg(rows)}</div><div class="panel"><h2>Fila de revisão</h2>${db.hands.filter(x=>x.status!=='done').sort((a,b)=>(b.priority==='high')-(a.priority==='high')).slice(0,6).map(h=>`<div class="item"><b>${esc(h.topic||'Geral')}</b> · ${esc(h.spot||'')} ${h.priority==='high'?'<span class="pill warn">alta</span>':''}<br><span class="muted">${esc(h.question||'')}</span></div>`).join('')||'<p class="muted">Nenhuma mão pendente.</p>'}</div></div>`
}
function barSvg(items,label='Profit'){
  if(!items.length)return '<p class="muted">Sem dados.</p>'
  const max=Math.max(1,...items.map(x=>Math.abs(x.value)))
  return `<div class="bar-list">${items.map(x=>`<div class="bar-row"><span>${esc(x.label)}</span><div class="bar-track"><i style="width:${Math.max(2,Math.abs(x.value)/max*100)}%"></i></div><b class="${x.value>=0?'good':'bad'}">${money(x.value)}</b></div>`).join('')}</div>`
}
function analytics(){
  const rows=filteredRows(),m=metrics(rows),entries=rows.reduce((a,x)=>a+(x.entries||x.games),0),reentries=rows.reduce((a,x)=>a+(x.reentries||0),0)
  const bySite={},byFormat={};for(const x of rows){for(const [obj,k] of [[bySite,x.site||'Sem site'],[byFormat,x.format||'Sem formato']]){if(!obj[k])obj[k]={g:0,b:0,p:0};obj[k].g+=x.games;obj[k].b+=x.buyins;obj[k].p+=x.profit}}
  const block=(obj)=>Object.entries(obj).sort((a,b)=>b[1].g-a[1].g).map(([k,v])=>`<div class="item metric-row"><b>${esc(k)}</b><span>${v.g} MTTs</span><span class="${v.p>=0?'good':'bad'}">${money(v.p)}</span><span>${pct(v.p,v.b)} ROI</span></div>`).join('')||'<p class="muted">Sem dados.</p>'
  const daily=dailyAggregate(rows),best=daily.length?[...daily].sort((a,b)=>b.profit-a.profit)[0]:null,worst=daily.length?[...daily].sort((a,b)=>a.profit-b.profit)[0]:null
  const imported=rows.filter(x=>x.source==='import'),bigPrize=imported.length?[...imported].sort((a,b)=>b.prizes-a.prizes)[0]:null,bigProfit=imported.length?[...imported].sort((a,b)=>b.profit-a.profit)[0]:null
  const weeks={};daily.forEach(d=>{const dt=new Date(d.date+'T12:00:00'),day=(dt.getDay()+6)%7;dt.setDate(dt.getDate()-day);const k=dt.toISOString().slice(0,10);weeks[k]=(weeks[k]||0)+d.profit})
  const weekItems=Object.entries(weeks).sort().slice(-10).map(([k,v])=>({label:'Sem. '+k.slice(5),value:v}))
  const fmtItems=Object.entries(byFormat).map(([k,v])=>({label:k,value:v.p})).sort((a,b)=>b.value-a.value)
  const buckets={'$0–10':0,'$10–25':0,'$25–50':0,'$50–100':0,'$100+':0};rows.forEach(x=>{const bi=x.buyins/Math.max(1,x.entries||x.games);const k=bi<=10?'$0–10':bi<=25?'$10–25':bi<=50?'$25–50':bi<=100?'$50–100':'$100+';buckets[k]+=x.games})
  const heat=daily.slice(-35),maxGames=Math.max(1,...heat.map(x=>x.games))
  return `${filterBar()}<div class="cards"><div class="card"><small>Volume</small><strong>${m.g}</strong></div><div class="card"><small>Inscrições</small><strong>${entries}</strong><span class="muted">${reentries} reentries</span></div><div class="card"><small>Profit</small><strong class="${m.p>=0?'good':'bad'}">${money(m.p)}</strong></div><div class="card"><small>ROI</small><strong>${m.roi.toFixed(1)}%</strong></div><div class="card"><small>ABI</small><strong>${money(m.abi)}</strong></div><div class="card"><small>ITM</small><strong>${pct(m.itm,m.g)}</strong></div></div>
  <div class="panel"><h2>Curva acumulada</h2>${cumulativeSvg(rows)}</div>
  <div class="grid3"><div class="panel"><h2>Melhor dia</h2><strong class="good stat-big">${best?money(best.profit):'-'}</strong><p class="muted">${best?best.date+' · '+best.games+' MTTs':''}</p></div><div class="panel"><h2>Pior dia</h2><strong class="bad stat-big">${worst?money(worst.profit):'-'}</strong><p class="muted">${worst?worst.date+' · '+worst.games+' MTTs':''}</p></div><div class="panel"><h2>Maior prêmio</h2><strong class="stat-big">${bigPrize?money(bigPrize.prizes):'-'}</strong><p class="muted">${bigPrize?esc(bigPrize.name)+' · profit '+money(bigPrize.profit):''}</p></div></div>
  <div class="grid2"><div class="panel"><h2>Profit por formato</h2>${barSvg(fmtItems)}</div><div class="panel"><h2>Profit semanal</h2>${barSvg(weekItems)}</div></div>
  <div class="grid2"><div class="panel"><h2>Distribuição por buy-in</h2>${Object.entries(buckets).map(([k,v])=>`<div class="item metric-row"><b>${k}</b><span>${v} MTTs</span><span>${pct(v,m.g)} do volume</span><span></span></div>`).join('')}</div><div class="panel"><h2>Calendário recente</h2><div class="heatmap">${heat.map(x=>`<div class="heat" style="opacity:${.25+.75*x.games/maxGames}" title="${x.date}: ${x.games} MTTs · ${money(x.profit)}"><b>${x.date.slice(8)}</b><small>${x.games}</small></div>`).join('')}</div><p class="muted">Últimos ${heat.length} dias jogados. Passe o mouse para ver o resultado.</p></div></div>
  <div class="grid2"><div class="panel"><h2>Por site</h2>${block(bySite)}</div><div class="panel"><h2>Por formato</h2>${block(byFormat)}</div></div>`
}
function studies(){return `<div class="toolbar"><button class="btn" id="newStudy">+ Nova aula</button></div><div class="panel">${db.studies.length?`<table><tr><th>Curso / Aula</th><th>Tema</th><th>Professor</th><th>Duração</th><th>Data</th><th>Status</th><th></th></tr>${db.studies.map(x=>`<tr><td><b>${esc(x.course||'')}</b>${x.course?'<br>':''}${esc(x.title)}</td><td>${esc(x.topic||'Geral')}<br>${tagList(x.tags).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</td><td>${esc(x.teacher||'')}</td><td>${x.duration||0} min</td><td>${x.date}</td><td><span class="pill ${x.status==='done'?'good':'warn'}">${x.status==='done'?'Assistida':'Pendente'}</span></td><td><button class="btn small secondary" data-toggle-study="${x.id}">Alternar</button></td></tr>`).join('')}</table>`:'<p class="muted">Nenhuma aula.</p>'}</div>`}
function hands(){
  const formats=[...new Set(db.hands.map(x=>x.format).filter(Boolean))],topics=[...new Set(db.hands.map(x=>x.topic).filter(Boolean))],positions=[...new Set(db.hands.map(x=>x.hero_position).filter(Boolean))]
  return `<div class="toolbar hand-filters"><button class="btn" id="newHand">+ Nova mão</button><select id="handStatus"><option value="all">Todas</option><option value="pending">Pendentes</option><option value="done">Estudadas</option><option value="favorite">Favoritas</option></select><select id="handPriority"><option value="all">Todas prioridades</option><option value="high">Alta</option><option value="normal">Normal</option><option value="low">Baixa</option></select><select id="handFormat"><option value="all">Todos formatos</option>${formats.map(x=>`<option>${esc(x)}</option>`).join('')}</select><select id="handTopic"><option value="all">Todos temas</option>${topics.map(x=>`<option>${esc(x)}</option>`).join('')}</select><select id="handPosition"><option value="all">Todas posições</option>${positions.map(x=>`<option>${esc(x)}</option>`).join('')}</select><input id="handSearch" placeholder="Buscar spot, tag, street..."></div><div id="handCount" class="muted">${db.hands.length} mãos</div><div id="handList">${handCards(db.hands)}</div>`
}
function handCards(list){return `<div class="hand-grid">${list.length?list.map(h=>`<article class="hand-card">${h.image_url?`<img src="${h.image_url}" alt="Imagem da mão">`:`<div class="no-image">Sem imagem</div>`}<div class="hand-body"><h3>${h.favorite?'★ ':''}${esc(h.tournament||'Mão sem torneio')}</h3><div class="muted">${h.date} · ${esc(h.site||'')} · ${esc(h.format||'')}</div><p><b>${esc(h.spot||'Spot')}</b> · ${esc(h.topic||'Geral')} ${h.priority==='high'?'<span class="pill warn">alta</span>':''}</p><p>${esc(h.question||'')}</p><div>${tagList(h.tags).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="toolbar" style="margin-top:10px"><button class="btn small secondary" data-view-hand="${h.id}">Ver detalhes</button><button class="btn small secondary" data-edit-hand="${h.id}">Editar</button><button class="btn small" data-toggle-hand="${h.id}">${h.status==='done'?'Reabrir':'Marcar estudada'}</button><button class="btn small secondary" data-fav-hand="${h.id}">${h.favorite?'★':'☆'}</button><button class="btn small danger" data-delete-hand="${h.id}">Apagar</button></div></div></article>`).join(''):'<p class="muted">Nenhuma mão encontrada.</p>'}</div>`}


async function hhStatsImports(){const d=await replayDb();return new Promise((resolve,reject)=>{const tx=d.transaction(HH_STATS_STORE,'readonly'),r=tx.objectStore(HH_STATS_STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
async function saveHhStatsImport(rec){const d=await replayDb();return new Promise((resolve,reject)=>{const tx=d.transaction(HH_STATS_STORE,'readwrite');tx.objectStore(HH_STATS_STORE).put(rec);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function clearHhStatsImports(){const d=await replayDb();return new Promise((resolve,reject)=>{const tx=d.transaction(HH_STATS_STORE,'readwrite');tx.objectStore(HH_STATS_STORE).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
function heroHandFacts(h){
  const hero=h.hero;if(!hero)return null;const acts=h.steps.filter(x=>x.kind==='action'),pre=acts.filter(x=>x.street==='preflop'),flop=acts.filter(x=>x.street==='flop');
  const heroPre=pre.filter(x=>x.player===hero),vpip=heroPre.some(x=>['call','bet','raise'].includes(x.type)),pfr=heroPre.some(x=>x.type==='raise');
  let raisesBefore=0,threeBet=false,heroOpenIndex=-1,faced3bet=false,foldTo3bet=false;
  pre.forEach((x,i)=>{if(x.type==='raise'){if(x.player===hero&&raisesBefore>=1)threeBet=true;if(x.player===hero&&heroOpenIndex<0)heroOpenIndex=i;raisesBefore++}if(heroOpenIndex>=0&&i>heroOpenIndex&&x.player!==hero&&x.type==='raise')faced3bet=true;if(faced3bet&&x.player===hero&&x.type==='fold')foldTo3bet=true});
  const lastPfr=[...pre].reverse().find(x=>x.type==='raise')?.player||'';const sawFlop=h.steps.some(x=>x.kind==='street'&&x.street==='flop');
  let cbetOpp=sawFlop&&lastPfr===hero,cbet=false;if(cbetOpp){const firstAgg=flop.find(x=>['bet','raise'].includes(x.type));cbet=firstAgg?.player===hero&&firstAgg?.type==='bet'}
  let xrOpp=false,xr=false;for(const st of ['flop','turn','river']){const a=acts.filter(x=>x.street===st);const ci=a.findIndex(x=>x.player===hero&&x.type==='check');if(ci>=0&&a.slice(ci+1).some(x=>x.player!==hero&&x.type==='bet')){xrOpp=true;if(a.slice(ci+1).some(x=>x.player===hero&&x.type==='raise'))xr=true}}
  const wentShowdown=acts.some(x=>x.player===hero&&x.type==='show'),won=acts.some(x=>x.player===hero&&x.type==='collect');
  let invested=0,returned=0,collected=0;for(const x of [...h.forcedActions,...acts]){if(x.player!==hero)continue;if(['ante','sb','bb','call','bet'].includes(x.type))invested+=x.amount||0;else if(x.type==='raise')invested+=x.to||x.amount||0;else if(x.type==='return')returned+=x.amount||0;else if(x.type==='collect')collected+=x.amount||0}
  const netBb=h.bb?(collected+returned-invested)/h.bb:0;const pos=h.positionMap[hero]||'';const stack=h.bb?((h.seats.find(x=>x.name===hero)?.stack||0)/h.bb):0;
  return {handId:h.handId,date:h.dateTime.slice(0,10),position:pos,stack,players:h.seats.length,vpip,pfr,threeBet,faced3bet,foldTo3bet,cbetOpp,cbet,xrOpp,xr,sawFlop,wentShowdown,won,netBb}
}
function aggregateHhStats(facts){const n=facts.length,sum=k=>facts.filter(x=>x[k]).length,rate=(a,b)=>b?100*a/b:0;const bb=facts.reduce((a,x)=>a+x.netBb,0);return {hands:n,vpip:rate(sum('vpip'),n),pfr:rate(sum('pfr'),n),threeBet:rate(sum('threeBet'),n),fold3:rate(sum('foldTo3bet'),sum('faced3bet')),cbet:rate(sum('cbet'),sum('cbetOpp')),xr:rate(sum('xr'),sum('xrOpp')),wtsd:rate(sum('wentShowdown'),sum('sawFlop')),wsd:rate(facts.filter(x=>x.wentShowdown&&x.won).length,sum('wentShowdown')),wwsf:rate(facts.filter(x=>x.sawFlop&&x.won).length,sum('sawFlop')),bb100:n?bb/n*100:0,totalBb:bb}}
function statCard(label,value,sub=''){return `<div class="stat-card"><small>${label}</small><strong>${value}</strong>${sub?`<span>${sub}</span>`:''}</div>`}
function hhstats(){return `<div class="panel"><div class="hhstats-head"><div><h2>HH Stats <span class="pill warn">BETA</span></h2><p class="muted">Importe vários arquivos GG .txt de uma vez ou selecione a pasta inteira de Hand Histories. Os dados ficam neste navegador e são deduplicados pelo Hand ID.</p></div><div class="toolbar"><input id="hhStatsFiles" type="file" accept=".txt,text/plain" multiple hidden><input id="hhStatsFolder" type="file" accept=".txt,text/plain" webkitdirectory directory multiple hidden><button class="btn" id="pickHhStatsFiles">📄 Selecionar vários arquivos</button><button class="btn" id="pickHhStatsFolder">📁 Importar pasta inteira</button><button class="btn secondary" id="clearHhStats">Limpar</button></div></div><div id="hhStatsStatus" class="muted">Você pode usar Ctrl+A na seleção de arquivos ou escolher diretamente a pasta da GG.</div></div><div id="hhStatsView"><div class="panel"><p class="muted">Carregando banco local de mãos...</p></div></div>`}
function hhStatsViewHtml(facts){const s=aggregateHhStats(facts);if(!facts.length)return `<div class="panel"><p class="muted">Nenhuma HH importada para o tracker ainda.</p></div>`;const positions=['UTG','UTG+1','MP1','MP2','MP','HJ','CO','BTN','SB','BB'];const rows=positions.map(pos=>{const a=facts.filter(x=>x.position===pos);if(!a.length)return '';const z=aggregateHhStats(a);return `<tr><td><b>${pos}</b></td><td>${a.length}</td><td>${z.vpip.toFixed(1)}%</td><td>${z.pfr.toFixed(1)}%</td><td>${z.threeBet.toFixed(1)}%</td><td>${z.cbet.toFixed(1)}%</td><td>${z.xr.toFixed(1)}%</td><td class="${z.bb100>=0?'good':'bad'}">${z.bb100>=0?'+':''}${z.bb100.toFixed(1)}</td></tr>`}).join('');return `<div class="stats-grid">${statCard('Mãos',s.hands.toLocaleString('pt-BR'))}${statCard('VPIP',s.vpip.toFixed(1)+'%')}${statCard('PFR',s.pfr.toFixed(1)+'%')}${statCard('3Bet',s.threeBet.toFixed(1)+'%')}${statCard('Fold to 3Bet',s.fold3.toFixed(1)+'%')}${statCard('C-Bet Flop',s.cbet.toFixed(1)+'%')}${statCard('Check-Raise',s.xr.toFixed(1)+'%')}${statCard('WTSD',s.wtsd.toFixed(1)+'%')}${statCard('W$SD',s.wsd.toFixed(1)+'%')}${statCard('WWSF',s.wwsf.toFixed(1)+'%')}${statCard('Chip bb/100',(s.bb100>=0?'+':'')+s.bb100.toFixed(1),'não é All-in EV')}</div><div class="panel"><h2>Por posição</h2><div class="table-scroll"><table><thead><tr><th>Posição</th><th>Mãos</th><th>VPIP</th><th>PFR</th><th>3Bet</th><th>CBet F</th><th>XR</th><th>bb/100</th></tr></thead><tbody>${rows}</tbody></table></div></div><div class="notice"><b>Sobre EV:</b> esta primeira versão mostra chip bb/100 calculado pelas fichas ganhas/perdidas nas HH. All-in Adjusted EV/EVbb/100 exige cálculo de equidade nos all-ins e será um módulo separado para não exibir uma estatística falsa.</div>`}
async function refreshHhStats(){const imports=await hhStatsImports();const byId=new Map();for(const r of imports)for(const h of (r.hands||[])){const f=heroHandFacts(h);if(f)byId.set(f.handId,f)}hhStatsCache=[...byId.values()];const el=document.getElementById('hhStatsView');if(el)el.innerHTML=hhStatsViewHtml(hhStatsCache)}
const REPLAY_DB='poker-study-replayer',REPLAY_STORE='tournaments',HH_STATS_STORE='hhStatsImports'
function replayDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(REPLAY_DB,2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(REPLAY_STORE))r.result.createObjectStore(REPLAY_STORE,{keyPath:'id'});if(!r.result.objectStoreNames.contains(HH_STATS_STORE))r.result.createObjectStore(HH_STATS_STORE,{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function savedReplayList(){const d=await replayDb();return new Promise((resolve,reject)=>{const tx=d.transaction(REPLAY_STORE,'readonly'),r=tx.objectStore(REPLAY_STORE).getAll();r.onsuccess=()=>resolve((r.result||[]).sort((a,b)=>(b.savedAt||'').localeCompare(a.savedAt||'')));r.onerror=()=>reject(r.error)})}
async function saveReplayTournament(rec){const d=await replayDb();return new Promise((resolve,reject)=>{const tx=d.transaction(REPLAY_STORE,'readwrite');tx.objectStore(REPLAY_STORE).put(rec);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function deleteReplayTournament(id){const d=await replayDb();return new Promise((resolve,reject)=>{const tx=d.transaction(REPLAY_STORE,'readwrite');tx.objectStore(REPLAY_STORE).delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
let replayState={hands:[],selected:null,step:0,sourceName:'',rawText:'',speed:1,playing:false,showOpponentCards:false,equilabOpen:false,rangeByHand:{},rangeColor:'blue'}
function replayer(){
  return `<div class="panel"><h2>Replayer GGNetwork <span class="pill warn">VISUAL</span></h2><div class="notice"><b>Hand History da GG.</b> Faça upload do .txt inteiro do torneio ou cole uma única mão. O arquivo é processado no navegador. Você também pode salvar torneios neste dispositivo para reabrir sem importar novamente.</div><div class="toolbar" style="margin-top:14px"><input id="hhFile" type="file" accept=".txt,text/plain"><button class="btn secondary" id="readHhFile">Ler arquivo</button></div><div id="savedReplayBox" class="saved-replays"><span class="muted">Carregando torneios salvos...</span></div><details style="margin-top:12px"><summary>Ou colar Hand History</summary><textarea id="hhPaste" class="hh-paste" placeholder="Poker Hand #TM..." style="margin-top:10px"></textarea><button class="btn secondary" id="parseHhPaste" style="margin-top:8px">Interpretar texto</button></details></div><div id="replayWorkspace">${replayState.hands.length?replayWorkspaceHtml():'<div class="panel"><p class="muted">Nenhuma Hand History carregada ainda.</p></div>'}</div>`
}
function parseGgHistory(text){
  const blocks=String(text||'').replace(/\r/g,'').split(/(?=^Poker Hand #)/m).map(x=>x.trim()).filter(x=>x.startsWith('Poker Hand #'))
  return blocks.map(parseGgHand).filter(Boolean)
}
function parseGgHand(block){
  const lines=block.split('\n').map(x=>x.trim()).filter(Boolean),head=lines[0]||''
  const hm=head.match(/^Poker Hand #([^:]+): Tournament #([^,]+),\s*(.*?)\s+-\s+Level([^\(]+)\((.+)\)\s+-\s+(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})$/)
  if(!hm)return null
  const [,handId,tournamentId,tournamentName,level,blindText,dateTime]=hm
  const tableLine=lines.find(x=>x.startsWith("Table '"))||'',tm=tableLine.match(/Table '([^']+)' .*Seat #(\d+) is the button/),table=tm?.[1]||'',buttonSeat=+(tm?.[2]||0)
  const seats=[],seatByName={}
  for(const line of lines){const m=line.match(/^Seat (\d+): (.+) \(([\d,]+) in chips\)$/);if(m){const x={seat:+m[1],name:m[2],stack:+m[3].replace(/,/g,''),cards:null};seats.push(x);seatByName[x.name]=x}}
  let hero='',heroCards=[]
  for(const line of lines){const m=line.match(/^Dealt to (.+?) \[([^\]]+)\]$/);if(m){hero=m[1];heroCards=m[2].split(/\s+/);if(seatByName[hero])seatByName[hero].cards=heroCards}}
  const bbm=lines.find(x=>/posts big blind/.test(x))?.match(/posts big blind ([\d,]+)/),bb=bbm?+bbm[1].replace(/,/g,''):0
  const sbm=lines.find(x=>/posts small blind/.test(x))?.match(/posts small blind ([\d,]+)/),sb=sbm?+sbm[1].replace(/,/g,''):0
  const am=lines.find(x=>/posts the ante/.test(x))?.match(/posts the ante ([\d,]+)/),ante=am?+am[1].replace(/,/g,''):0
  let street='preflop',board=[],steps=[],forcedActions=[]
  const streetActions={preflop:[],flop:[],turn:[],river:[]}
  for(const line of lines){
    if(line==='*** HOLE CARDS ***'){steps.push({kind:'street',street:'preflop',label:'Pré-flop',board:[]});continue}
    let m=line.match(/^\*\*\* FLOP \*\*\* \[([^\]]+)\]/);if(m){street='flop';board=m[1].split(/\s+/);steps.push({kind:'street',street,label:'Flop',board:[...board]});continue}
    m=line.match(/^\*\*\* TURN \*\*\* \[[^\]]+\] \[([^\]]+)\]/);if(m){street='turn';board=[...board,m[1]];steps.push({kind:'street',street,label:'Turn',board:[...board]});continue}
    m=line.match(/^\*\*\* RIVER \*\*\* \[[^\]]+\] \[([^\]]+)\]/);if(m){street='river';board=[...board,m[1]];steps.push({kind:'street',street,label:'River',board:[...board]});continue}
    if(/^\*\*\*/.test(line)||/^Seat \d+:/.test(line)||/^Dealt to /.test(line)||line.startsWith("Table '")||line.startsWith('Poker Hand #')||line.startsWith('Total pot ')||line.startsWith('Board '))continue
    const a=parseGgAction(line,street)
    if(a){
      if(['ante','sb','bb'].includes(a.type)) forcedActions.push(a)
      else {steps.push(a);if(streetActions[street])streetActions[street].push(line)}
    }
  }
  // Keep street transitions as visual replay events so the board can be dealt
  // street by street (especially when players are all-in pre-flop). They are
  // replayed, but are not counted as player actions in the UI.
  const resultLine=lines.find(x=>x.startsWith('Total pot '))||'',potm=resultLine.match(/Total pot ([\d,]+)/),finalPot=potm?+potm[1].replace(/,/g,''):0
  const positionMap=derivePositions(seats,buttonSeat)
  return {handId,tournamentId,tournamentName,level:level.trim(),blindText,dateTime,table,buttonSeat,seats,hero,heroCards,bb,sb,ante,forcedActions,steps,streetActions,finalPot,positionMap,raw:block}
}
function parseGgAction(line,street){
  let m=line.match(/^(.+?): posts the ante ([\d,]+)/);if(m)return {kind:'action',type:'ante',player:m[1],amount:+m[2].replace(/,/g,''),street,text:line}
  m=line.match(/^(.+?): posts small blind ([\d,]+)/);if(m)return {kind:'action',type:'sb',player:m[1],amount:+m[2].replace(/,/g,''),street,text:line}
  m=line.match(/^(.+?): posts big blind ([\d,]+)/);if(m)return {kind:'action',type:'bb',player:m[1],amount:+m[2].replace(/,/g,''),street,text:line}
  m=line.match(/^(.+?): folds/);if(m)return {kind:'action',type:'fold',player:m[1],street,text:line}
  m=line.match(/^(.+?): checks/);if(m)return {kind:'action',type:'check',player:m[1],street,text:line}
  m=line.match(/^(.+?): calls ([\d,]+)/);if(m)return {kind:'action',type:'call',player:m[1],amount:+m[2].replace(/,/g,''),street,text:line}
  m=line.match(/^(.+?): bets ([\d,]+)/);if(m)return {kind:'action',type:'bet',player:m[1],amount:+m[2].replace(/,/g,''),street,text:line}
  m=line.match(/^(.+?): raises ([\d,]+) to ([\d,]+)/);if(m)return {kind:'action',type:'raise',player:m[1],amount:+m[2].replace(/,/g,''),to:+m[3].replace(/,/g,''),street,text:line}
  m=line.match(/^Uncalled bet \(([\d,]+)\) returned to (.+)$/);if(m)return {kind:'action',type:'return',player:m[2],amount:+m[1].replace(/,/g,''),street,text:line}
  m=line.match(/^(.+?): shows \[([^\]]+)\]/);if(m)return {kind:'action',type:'show',player:m[1],cards:m[2].split(/\s+/),street,text:line}
  m=line.match(/^(.+?) collected ([\d,]+) from pot/);if(m)return {kind:'action',type:'collect',player:m[1],amount:+m[2].replace(/,/g,''),street,text:line}
  return null
}
function derivePositions(seats,buttonSeat){
  const ordered=[...seats].sort((a,b)=>a.seat-b.seat),bi=ordered.findIndex(x=>x.seat===buttonSeat);if(bi<0)return {}
  const clockwise=[...ordered.slice(bi),...ordered.slice(0,bi)],n=clockwise.length,map={};
  const labels=n===2?['BTN/SB','BB']:n===3?['BTN','SB','BB']:n===4?['BTN','SB','BB','CO']:n===5?['BTN','SB','BB','HJ','CO']:n===6?['BTN','SB','BB','UTG','HJ','CO']:n===7?['BTN','SB','BB','UTG','UTG+1','HJ','CO']:n===8?['BTN','SB','BB','UTG','UTG+1','MP','HJ','CO']:['BTN','SB','BB','UTG','UTG+1','MP1','MP2','HJ','CO']
  clockwise.forEach((x,i)=>map[x.name]=labels[i]||`Seat ${x.seat}`);return map
}
function replayWorkspaceHtml(){
  const hs=replayState.hands,h=replayState.selected||hs[0];replayState.selected=h
  return `<div class="replay-layout"><div class="panel replay-list-panel"><div class="replay-summary"><b>${hs.length} mãos detectadas</b><span class="muted">${esc(replayState.sourceName||'Hand History')}</span></div><input id="replaySearch" placeholder="Buscar cartas, mão, horário..."><div id="replayHandList" class="replay-hand-list">${replayHandListHtml(hs,h)}</div></div><div id="replayStage">${replayStageHtml(h)}</div></div>`
}
function replayHandListHtml(list,selected){
  return list.map(h=>{const pos=h.positionMap[h.hero]||'',stack=h.bb?Math.round((h.seats.find(x=>x.name===h.hero)?.stack||0)/h.bb):0,cards=(h.heroCards||[]).map(cardHtml).join('')||'<span class="card-back">?</span><span class="card-back">?</span>';return `<button class="replay-hand-row ${h.handId===selected?.handId?'active':''}" data-replay-hand="${esc(h.handId)}"><span class="sidebar-hole-cards">${cards}</span><span class="sidebar-hand-info"><b>${esc(h.heroCards.join(' ')||'-- --')}</b><span>${esc(pos)} · ${stack||'?'}bb</span><small>${esc(h.dateTime.slice(11))} · ${esc(h.handId)}</small></span></button>`}).join('')
}
function replayPlayerCoords(h,p){
  // V5.9.1: final replay geometry — seats frozen, bets clamped to a safe inner felt orbit.
  // Every seat uses ONE vertical axis: cards first, info directly below.
  // Bets live on a separate inner orbit, so chips never sit behind a player.
  const ordered=[...h.seats].sort((a,b)=>a.seat-b.seat)
  const heroIndex=Math.max(0,ordered.findIndex(x=>x.name===h.hero))
  const idx=Math.max(0,ordered.findIndex(x=>x.name===p.name))
  const rel=(idx-heroIndex+ordered.length)%ordered.length,n=ordered.length
  const slots8=[
    {left:50,top:76,infoLeft:50,infoTop:89,betLeft:50,betTop:66},
    {left:27,top:72,infoLeft:27,infoTop:85,betLeft:40,betTop:63},
    {left:10,top:48,infoLeft:10,infoTop:61,betLeft:33,betTop:54},
    {left:27,top:17,infoLeft:27,infoTop:30,betLeft:40,betTop:43},
    {left:50,top:11,infoLeft:50,infoTop:24,betLeft:50,betTop:40},
    {left:73,top:17,infoLeft:73,infoTop:30,betLeft:60,betTop:43},
    {left:90,top:48,infoLeft:90,infoTop:61,betLeft:67,betTop:54},
    {left:73,top:72,infoLeft:73,infoTop:85,betLeft:60,betTop:63}
  ]
  const slots9=[
    // 9-max keeps its dedicated outer seat ring. Bets are deliberately much
    // farther inward so even the top/diagonal stacks stay fully on the felt.
    {left:50,top:79,infoLeft:50,infoTop:91,betLeft:50,betTop:65},
    {left:28,top:76,infoLeft:28,infoTop:88,betLeft:41,betTop:63},
    {left:9,top:60,infoLeft:9,infoTop:72,betLeft:35,betTop:57},
    {left:8,top:36,infoLeft:8,infoTop:48,betLeft:35,betTop:49},
    {left:28,top:15,infoLeft:28,infoTop:27,betLeft:41,betTop:43},
    {left:50,top:9,infoLeft:50,infoTop:21,betLeft:50,betTop:40},
    {left:72,top:15,infoLeft:72,infoTop:27,betLeft:59,betTop:43},
    {left:92,top:36,infoLeft:92,infoTop:48,betLeft:65,betTop:49},
    {left:91,top:60,infoLeft:91,infoTop:72,betLeft:65,betTop:57}
  ]
  if(n===8)return {...slots8[rel],rel}
  if(n===9)return {...slots9[rel],rel}
  const angle=(90+(360/n)*rel)*Math.PI/180,dx=Math.cos(angle),dy=Math.sin(angle)
  const cardLeft=50+43*dx,cardTop=50+38*dy
  return {left:cardLeft,top:cardTop,infoLeft:cardLeft,infoTop:cardTop+13,betLeft:50+25*dx,betTop:50+18*dy,rel}
}
function replayBetCoords(pos){return {left:pos.betLeft,top:pos.betTop}}
function replayInfoCoords(pos){return {left:pos.infoLeft,top:pos.infoTop}}
function adjacentReplayHand(direction){
  const hs=replayState.hands||[];if(!hs.length||!replayState.selected)return null
  const i=hs.findIndex(x=>x.handId===replayState.selected.handId);if(i<0)return null
  const ni=i+direction;if(ni<0||ni>=hs.length)return null
  return hs[ni]
}
function replayTimelineHtml(h){
  const groups=['preflop','flop','turn','river','showdown']
  const labels={preflop:'PRÉ-FLOP',flop:'FLOP',turn:'TURN',river:'RIVER',showdown:'SHOWDOWN'}
  return `<div class="replay-timeline">${groups.map(group=>{const acts=h.steps.map((x,i)=>({x,i,group:['show','collect'].includes(x.type)?'showdown':x.street})).filter(o=>o.x.kind==='action'&&o.group===group);if(!acts.length)return '';return `<section><b>${labels[group]}</b><div>${acts.map(({x,i})=>{const pos=h.positionMap[x.player]||'',lab=replayActionLabel(x,h);return `<button class="timeline-action ${i===replayState.step?'current':''} type-${x.type}" data-replay-step="${i}"><small>${esc(pos)}</small><strong>${esc(lab)}</strong></button>`}).join('')}</div></section>`}).join('')}</div>`
}
function replayActionProgress(h,stepIndex){
  const actionIndexes=h.steps.map((x,i)=>x.kind==='action'?i:-1).filter(i=>i>=0)
  const total=actionIndexes.length
  const current=h.steps[stepIndex]
  if(current?.kind==='street')return {small:(current.label||current.street||'Street').toUpperCase(),text:current.street==='preflop'?'Início da mão':`*** ${(current.label||current.street).toUpperCase()} ***`}
  const n=actionIndexes.filter(i=>i<=stepIndex).length
  return {small:`Ação ${Math.max(1,n)} de ${total}`,text:current?replayActionText(current,h):'Início da mão'}
}
function firstReplayActionIndex(h){const i=h.steps.findIndex(x=>x.kind==='action');return i>=0?i:0}
function replayStageHtml(h){
  if(!h)return '<div class="panel">Selecione uma mão.</div>'
  const st=computeReplayState(h,replayState.step),step=h.steps[replayState.step],max=Math.max(0,h.steps.length-1),heroSeat=h.seats.find(x=>x.name===h.hero),heroPos=h.positionMap[h.hero]||'',heroBb=h.bb&&heroSeat?heroSeat.stack/h.bb:0,progress=replayActionProgress(h,replayState.step)
  const currentPlayer=step?.kind==='action'?step.player:''
  const seats=h.seats.map(p=>{
    const coords=replayPlayerCoords(h,p),{left,top}=coords,ps=st.players[p.name]||{},known=knownOpponentCards(h,p.name),cards=p.name===h.hero?h.heroCards:(replayState.showOpponentCards?known:(ps.cards||[])),pos=h.positionMap[p.name]||`Seat ${p.seat}`,stackBb=h.bb?ps.stack/h.bb:0,bet=st.streetContrib[p.name]||0
    const bp=replayBetCoords(coords),ip=replayInfoCoords(coords),action=currentPlayer===p.name?replayActionLabel(step,h):''
    const classes=`${ps.folded?'folded':''} ${p.name===h.hero?'hero':''} ${currentPlayer===p.name?'acting':''}`
    return `<div class="seat-cards ${classes}" style="left:${left}%;top:${top}%"><div class="mini-cards">${cards.length?cards.map(cardHtml).join(''):'<span class="card-back">?</span><span class="card-back">?</span>'}</div></div><div class="seat-info ${classes}" style="left:${ip.left}%;top:${ip.top}%"><b>${esc(pos)}${p.name===h.hero?' · HERO':''}</b><span>${stackBb.toFixed(1)}bb (${fmtFullChips(ps.stack)})</span></div>${bet>0?`<div class="table-bet" style="left:${bp.left}%;top:${bp.top}%"><span class="chip-stack"><i></i><i></i><i></i></span><b>${fmtChips(bet)}</b><small>${h.bb?(bet/h.bb).toFixed(1)+'bb':''}</small></div>`:''}`
  }).join('')
  const potBb=h.bb?st.pot/h.bb:0
  return `<div class="panel replay-stage-panel icm-replayer"><div class="replay-head"><div><h2>${esc(h.heroCards.join(' '))} · ${esc(heroPos)} · ${heroBb.toFixed(1)}bb</h2><div class="muted">${esc(h.tournamentName)} · ${esc(h.blindText)} · ${esc(h.dateTime)}</div></div><div class="replay-head-actions"><button class="btn secondary" id="saveReplayTournament">💾 Salvar torneio</button><button class="btn secondary" id="toggleOpponentCards">${replayState.showOpponentCards?'🙈 Esconder mãos':'👁 Mostrar mãos conhecidas'}</button><button class="btn secondary" id="toggleEquilab">▦ Equilab</button><button class="btn" id="saveReplayHand">Salvar mão</button></div></div><div class="replay-main ${replayState.equilabOpen?'with-equilab':''}"><div class="replay-table-column"><div class="poker-table-wrap players-${h.seats.length}"><div class="poker-scene players-${h.seats.length}"><div class="poker-table"><div class="table-felt-mark">POKER STUDY</div><div class="table-center"><div class="pot-display"><span>POT</span><b>${fmtChips(st.pot)}</b><small>${potBb.toFixed(1)}bb</small></div><div class="board-cards">${st.board.length?st.board.map(cardHtml).join(''):'<span class="board-placeholder"></span>'.repeat(5)}</div></div></div>${seats}</div></div><div class="replay-controlbar"><div class="current-action"><small>${esc(progress.small)}</small><strong>${esc(progress.text)}</strong></div><div class="replay-controls"><button class="btn secondary" id="replayFirst" title="Mão anterior">⏮</button><button class="btn secondary" id="replayPrev">◀ Anterior</button><button class="btn" id="replayPlay">${replayState.playing?'⏸ Pausar':'▶ Play'}</button><button class="btn secondary" id="replayNext">Próxima ▶</button><button class="btn secondary" id="replayLast" title="Próxima mão">⏭</button><label class="speed-control">Velocidade <select id="replaySpeed">${[1,1.5,2,3].map(v=>`<option value="${v}" ${replayState.speed===v?'selected':''}>${String(v).replace('.',',')}x</option>`).join('')}</select></label><input id="replayRange" type="range" min="0" max="${max}" value="${Math.min(replayState.step,max)}"></div></div>${replayTimelineHtml(h)}<details class="raw-actions"><summary>Ações da mão</summary>${h.steps.map((x,i)=>`<div class="raw-action ${i===replayState.step?'current':''}">${x.kind==='street'?esc('*** '+(x.label||x.street).toUpperCase()+' ***'):esc(replayActionText(x,h))}</div>`).join('')}</details></div>${replayState.equilabOpen?equilabHtml(h,st):''}</div></div>`
}
function knownOpponentCards(h,name){
  if(name===h.hero)return h.heroCards||[]
  for(let i=h.steps.length-1;i>=0;i--){const x=h.steps[i];if(x.kind==='action'&&x.type==='show'&&x.player===name)return x.cards||[]}
  return []
}
const RANGE_RANKS=['A','K','Q','J','T','9','8','7','6','5','4','3','2']
const RANGE_COLORS={blue:'Azul',green:'Verde',yellow:'Amarelo',red:'Vermelho',purple:'Roxo'}
function rangeKeyForCell(r,c){if(r===c)return RANGE_RANKS[r]+RANGE_RANKS[c];return r<c?RANGE_RANKS[r]+RANGE_RANKS[c]+'s':RANGE_RANKS[c]+RANGE_RANKS[r]+'o'}
function rangeSelections(h){if(!replayState.rangeByHand[h.handId])replayState.rangeByHand[h.handId]={};return replayState.rangeByHand[h.handId]}
function rangeCellCombos(key,dead=[]){
  const rank1=key[0],rank2=key[1],suited=key.endsWith('s'),offsuit=key.endsWith('o'),suits=['c','d','h','s'],deadSet=new Set(dead)
  let combos=[]
  if(rank1===rank2){for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)combos.push([rank1+suits[i],rank2+suits[j]])}
  else if(suited){for(const su of suits)combos.push([rank1+su,rank2+su])}
  else if(offsuit){for(const s1 of suits)for(const s2 of suits)if(s1!==s2)combos.push([rank1+s1,rank2+s2])}
  return combos.filter(c=>!c.some(x=>deadSet.has(x))).length
}
function equilabStats(h,st){
  const sel=rangeSelections(h),dead=[...(h.heroCards||[]),...(st.board||[])],byColor={},grossByColor={};let total=0,gross=0
  Object.entries(sel).forEach(([key,color])=>{const n=rangeCellCombos(key,dead),g=rangeCellCombos(key,[]);byColor[color]=(byColor[color]||0)+n;grossByColor[color]=(grossByColor[color]||0)+g;total+=n;gross+=g})
  return {dead,total,gross,byColor,grossByColor,pct:total/1326*100}
}
function equilabHtml(h,st){
  const sel=rangeSelections(h),stats=equilabStats(h,st)
  const grid=RANGE_RANKS.map((_,r)=>RANGE_RANKS.map((_,c)=>{const key=rangeKeyForCell(r,c),color=sel[key]||'',avail=rangeCellCombos(key,stats.dead);return `<button class="range-cell ${color?'range-'+color:''}" data-range-cell="${key}" title="${key} · ${avail} combos disponíveis">${key}</button>`}).join('')).join('')
  const palette=Object.entries(RANGE_COLORS).map(([k,v])=>`<button class="range-color range-${k} ${replayState.rangeColor===k?'active':''}" data-range-color="${k}" title="${v}"></button>`).join('')
  const colorStats=Object.entries(RANGE_COLORS).map(([k,v])=>`<div class="range-stat"><span class="range-dot range-${k}"></span><span>${v}</span><b>${stats.byColor[k]||0}</b><small>combos</small></div>`).join('')
  return `<aside class="equilab-panel"><div class="equilab-title"><div><h3>Equilab</h3><small>Range Lab integrado ao Replayer</small></div><button class="icon-btn" id="closeEquilab">×</button></div><div class="range-toolbar"><span>Cor:</span>${palette}<button class="btn small secondary" id="rangeErase">Borracha</button><button class="btn small danger" id="rangeClear">Limpar</button></div><div class="range-grid">${grid}</div><div class="range-summary"><div><small>Range selecionado</small><strong>${stats.pct.toFixed(1)}%</strong></div><div><small>Combos disponíveis</small><strong>${stats.total}</strong><span>${stats.gross!==stats.total?` (${stats.gross} brutos)`:''}</span></div></div><div class="range-stats">${colorStats}</div><div class="dead-cards"><small>Cartas conhecidas descontadas</small><div>${stats.dead.length?stats.dead.map(cardHtml).join(''):'<span class="muted">Nenhuma</span>'}</div></div><p class="muted range-help">Clique nas células para pintar. Clique novamente com a mesma cor para remover. Os blockers do Hero e do board são descontados da contagem.</p></aside>`
}
function bindEquilab(h,rerender){
  const close=document.getElementById('closeEquilab');if(close)close.onclick=()=>{replayState.equilabOpen=false;rerender()}
  document.querySelectorAll('[data-range-color]').forEach(b=>b.onclick=()=>{replayState.rangeColor=b.dataset.rangeColor;rerender()})
  document.querySelectorAll('[data-range-cell]').forEach(b=>b.onclick=()=>{const sel=rangeSelections(h),k=b.dataset.rangeCell,c=replayState.rangeColor;if(c==='erase'||sel[k]===c)delete sel[k];else sel[k]=c;rerender()})
  const er=document.getElementById('rangeErase');if(er)er.onclick=()=>{replayState.rangeColor='erase';rerender()}
  const clear=document.getElementById('rangeClear');if(clear)clear.onclick=()=>{if(confirm('Limpar todo o range desta mão?')){replayState.rangeByHand[h.handId]={};rerender()}}
}
function computeReplayState(h,idx){
  const players={};h.seats.forEach(x=>players[x.name]={stack:x.stack,folded:false,cards:null});let pot=0,board=[],streetLabel='Pré-flop',street='preflop',streetContrib={}
  ;(h.forcedActions||[]).forEach(x=>{const p=players[x.player];if(!p)return;const a=Math.max(0,x.amount||0);p.stack=Math.max(0,p.stack-a);pot+=a;if(x.type==='sb'||x.type==='bb')streetContrib[x.player]=(streetContrib[x.player]||0)+a})
  for(let i=0;i<=idx&&i<h.steps.length;i++){
    const x=h.steps[i];if(x.kind==='street'){if(x.street!==street)streetContrib={};street=x.street;streetLabel=x.label;board=[...(x.board||[])];continue}
    const p=players[x.player];if(!p)continue
    const commit=(a,countsForBet=true)=>{a=Math.max(0,a||0);p.stack=Math.max(0,p.stack-a);pot+=a;if(countsForBet)streetContrib[x.player]=(streetContrib[x.player]||0)+a}
    if(x.type==='ante')commit(x.amount,false)
    else if(['sb','bb','call','bet'].includes(x.type))commit(x.amount,true)
    else if(x.type==='raise'){const a=Math.max(0,x.to-(streetContrib[x.player]||0));commit(a,true)}
    else if(x.type==='return'){p.stack+=x.amount;pot=Math.max(0,pot-x.amount);streetContrib[x.player]=Math.max(0,(streetContrib[x.player]||0)-x.amount)}
    else if(x.type==='fold')p.folded=true
    else if(x.type==='show')p.cards=x.cards
    else if(x.type==='collect'){/* o pot permanece visível no replay até o resumo */}
  }
  return {players,pot,board,streetLabel,street,streetContrib}
}
function replayActionLabel(x,h){
  if(!x||x.kind!=='action')return ''
  const bb=h.bb||1,amt=n=>`${fmtChips(n)} · ${(n/bb).toFixed(1)}bb`
  if(x.type==='fold')return 'FOLD'
  if(x.type==='check')return 'CHECK'
  if(x.type==='call')return `CALL ${amt(x.amount)}`
  if(x.type==='bet')return `BET ${amt(x.amount)}`
  if(x.type==='raise')return `RAISE TO ${amt(x.to)}`
  if(x.type==='sb')return `SB ${amt(x.amount)}`
  if(x.type==='bb')return `BB ${amt(x.amount)}`
  if(x.type==='ante')return `ANTE ${amt(x.amount)}`
  if(x.type==='return')return `RETURN ${amt(x.amount)}`
  if(x.type==='show')return 'SHOW'
  if(x.type==='collect')return `WIN ${amt(x.amount)}`
  return x.type.toUpperCase()
}
function replayActionText(x,h){
  if(!x||x.kind!=='action')return ''
  const pos=h.positionMap[x.player]||x.player,label=replayActionLabel(x,h)
  return `${pos}: ${label}`
}
function fmtChips(n){n=+n||0;return n>=1e6?(n/1e6).toFixed(n>=1e7?1:2)+'M':n>=1e3?(n/1e3).toFixed(n>=1e5?0:1)+'k':Math.round(n).toLocaleString('pt-BR')}
function fmtFullChips(n){return Math.max(0,Math.round(+n||0)).toLocaleString('pt-BR')}
function cardHtml(c){const m=String(c).match(/^([2-9TJQKA])([cdhs])$/);if(!m)return `<span class="playing-card">${esc(c)}</span>`;const suit={c:'♣',d:'♦',h:'♥',s:'♠'}[m[2]];return `<span class="playing-card suit-${m[2]}"><span class="card-rank">${m[1]}</span><span class="card-suit">${suit}</span></span>`}
let replayTimer=null
function stopReplay(){if(replayTimer){clearInterval(replayTimer);replayTimer=null}replayState.playing=false}
function selectReplayHand(id){const h=replayState.hands.find(x=>x.handId===id);if(!h)return;stopReplay();replayState.selected=h;replayState.step=firstReplayActionIndex(h);document.getElementById('replayStage').innerHTML=replayStageHtml(h);document.querySelectorAll('[data-replay-hand]').forEach(b=>b.classList.toggle('active',b.dataset.replayHand===id));bindReplayStage()}
function bindReplayStage(){
  const h=replayState.selected;if(!h)return
  const rerender=()=>{const el=document.getElementById('replayStage');if(!el)return;el.innerHTML=replayStageHtml(h);bindReplayStage()};document.querySelectorAll('[data-replay-step]').forEach(b=>b.onclick=()=>{stopReplay();replayState.step=+b.dataset.replayStep;rerender()})
  replayFirst.onclick=()=>{const prev=adjacentReplayHand(-1);if(prev)selectReplayHand(prev.handId)};replayLast.onclick=()=>{const next=adjacentReplayHand(1);if(next)selectReplayHand(next.handId)};replayPrev.onclick=()=>{stopReplay();replayState.step=Math.max(0,replayState.step-1);rerender()};replayNext.onclick=()=>{stopReplay();replayState.step=Math.min(h.steps.length-1,replayState.step+1);rerender()};replayRange.oninput=()=>{stopReplay();replayState.step=+replayRange.value;rerender()};saveReplayHand.onclick=()=>replaySaveModal(h)
  const saveTournamentBtn=document.getElementById('saveReplayTournament');if(saveTournamentBtn)saveTournamentBtn.onclick=async()=>{if(!replayState.rawText)return alert('Importe um arquivo .txt antes de salvar.');const id=(h.tournamentId||h.tournamentName||replayState.sourceName).replace(/[^a-zA-Z0-9_-]/g,'_');await saveReplayTournament({id,name:replayState.sourceName||h.tournamentName||'Torneio GG',text:replayState.rawText,handsCount:replayState.hands.length,savedAt:new Date().toISOString()});saveTournamentBtn.textContent='✓ Torneio salvo';setTimeout(()=>{if(document.getElementById('saveReplayTournament'))document.getElementById('saveReplayTournament').textContent='💾 Salvar torneio'},1400)}
  toggleOpponentCards.onclick=()=>{replayState.showOpponentCards=!replayState.showOpponentCards;rerender()};toggleEquilab.onclick=()=>{replayState.equilabOpen=!replayState.equilabOpen;rerender()}
  replaySpeed.onchange=()=>{replayState.speed=+replaySpeed.value||1;if(replayState.playing){stopReplay();startReplay(h,rerender)}}
  replayPlay.onclick=()=>{if(replayState.playing){stopReplay();rerender()}else startReplay(h,rerender)}
  bindEquilab(h,rerender)
}
function startReplay(h,rerender){
  stopReplay();if(replayState.step>=h.steps.length-1)replayState.step=0;replayState.playing=true;rerender()
  const tick=Math.max(220,900/(replayState.speed||1));replayTimer=setInterval(()=>{if(replayState.step>=h.steps.length-1){stopReplay();rerender();return}replayState.step++;rerender()},tick)
}
function replaySaveModal(h){
  const hero=h.seats.find(x=>x.name===h.hero),stackBb=h.bb&&hero?hero.stack/h.bb:0,stackBucket=stackBb<=10?'≤10bb':stackBb<=15?'11–15bb':stackBb<=20?'16–20bb':stackBb<=30?'21–30bb':stackBb<=40?'31–40bb':stackBb<=60?'41–60bb':'61bb+',fmt=/bounty/i.test(h.tournamentName)?'PKO':'MTT Regular',date=h.dateTime.slice(0,10).replaceAll('/','-')
  openModal('Salvar mão do Replayer',`<div class="notice"><b>${esc(h.heroCards.join(' '))}</b> · ${esc(h.positionMap[h.hero]||'')} · ${stackBb.toFixed(1)}bb<br>${esc(h.tournamentName)}</div><div class="form" style="margin-top:14px"><div class="field"><label>Tema</label><select id="rp_topic">${opt(HAND_TOPICS,'Outro')}</select></div><div class="field"><label>Prioridade</label><select id="rp_priority">${opt(['normal','high','low'],'normal')}</select></div><div class="field span2"><label>Dúvida / decisão para revisar</label><textarea id="rp_question" placeholder="Ex.: Tenho call no turn?"></textarea></div></div><br><button class="btn" id="rp_save">Salvar no Banco de Mãos</button><p id="rp_msg" class="muted"></p>`)
  rp_save.onclick=async()=>{if(!rp_question.value.trim())return rp_msg.textContent='Escreva a dúvida que quer revisar.';rp_save.disabled=true;rp_msg.textContent='Salvando...';const row={user_id:user.id,date,site:'GGNetwork',tournament:h.tournamentName,format:fmt,spot:'Outro',topic:rp_topic.value,blinds:h.blindText,effective_stack:stackBucket,hero_position:h.positionMap[h.hero]||'',villain_position:'',priority:rp_priority.value,confidence:0,preflop:h.streetActions.preflop.join('\n'),flop:h.streetActions.flop.join('\n'),turn:h.streetActions.turn.join('\n'),river:h.streetActions.river.join('\n'),question:rp_question.value,notes:`Importada do Replayer · Hand #${h.handId}`,tags:`Replayer, ${fmt}`,status:'pending',image_path:null};const {error}=await supabase.from('hands').insert(row);if(error){rp_save.disabled=false;return rp_msg.textContent=error.message}modal.classList.remove('show');await load();route('hands')}
}
function results(){return `<div class="toolbar"><button class="btn" id="newResult">+ Novo resultado</button></div><div class="panel">${db.results.length?`<table><tr><th>Data</th><th>Site</th><th>Formato</th><th>MTTs</th><th>ABI</th><th>Buy-ins</th><th>Prêmios</th><th>Profit</th><th>ROI</th><th>Horas</th></tr>${db.results.map(x=>`<tr><td>${x.date}</td><td>${esc(x.site||'')}</td><td>${esc(x.format||'')}</td><td>${x.tournaments}</td><td>${money(x.abi)}</td><td>${money(x.buyins)}</td><td>${money(x.prizes)}</td><td class="${x.profit>=0?'good':'bad'}"><b>${money(x.profit)}</b></td><td>${pct(x.profit,x.buyins)}</td><td>${x.hours||0}</td></tr>`).join('')}</table>`:'<p class="muted">Nenhum resultado manual.</p>'}</div>`}

let csvState=null
function importer(){
  return `<div class="panel"><h2>Importar CSV do SharkScope</h2><div class="notice"><b>Reconhecimento automático do SharkScope em português.</b> O Poker Study identifica as colunas, moedas e reentradas. Valores em moeda estrangeira são convertidos para USD antes de entrar no Analytics.</div><div class="toolbar" style="margin-top:14px"><input id="csvFile" type="file" accept=".csv,text/csv" style="max-width:420px"><button class="btn" id="readCsv">Ler CSV</button></div><div id="csvMapper"></div></div><div class="panel"><h2>Torneios importados</h2><p class="muted">${db.tournaments.length} torneios individuais salvos. Duplicados são ignorados automaticamente.</p>${db.tournaments.length?`<table><tr><th>Data</th><th>Site</th><th>Torneio</th><th>Formato</th><th>Buy-in total</th><th>Prêmio</th><th>Profit</th></tr>${db.tournaments.slice(0,30).map(t=>`<tr><td>${String(t.played_at).slice(0,10)}</td><td>${esc(t.site||'')}</td><td>${esc(t.tournament_name||'')}</td><td>${esc(t.format||'')}</td><td>${money(t.buyin)}</td><td>${money(t.prize)}</td><td class="${t.profit>=0?'good':'bad'}">${money(t.profit)}</td></tr>`).join('')}</table>`:''}</div>`
}
function parseCsv(text){
  const rows=[];let row=[],field='',q=false
  for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'){if(q&&n==='"'){field+='"';i++}else q=!q}else if(c===','&&!q){row.push(field);field=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(field);field='';if(row.some(x=>x.trim()!==''))rows.push(row);row=[]}else field+=c}
  if(field||row.length){row.push(field);rows.push(row)}
  return rows
}
const normHeader=s=>String(s||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
function sharkscopeColumns(headers){
  const map={};headers.forEach((h,i)=>map[normHeader(h)]=i)
  const get=(...names)=>{for(const n of names){const k=normHeader(n);if(map[k]!==undefined)return map[k]}return null}
  return {site:get('Rede'),gameId:get('ID do Jogo'),stake:get('Stake'),rake:get('Rake'),date:get('Data de Início (America/Sao_Paulo)','Data de Início'),entrants:get('Participantes'),result:get('Resultado (incluindo Rake)'),finish:get('Posição'),flags:get('Bandeiras'),currency:get('Moeda'),reentries:get('Reentradas/Recompras'),duration:get('Duração'),prize:get('Prêmio'),name:get('Nome'),totalReentries:get('Total de Reentradas')}
}
function parseLocalDate(v){const m=String(v||'').trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);if(!m)return new Date(v);return new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0))}
function inferFormat(flags,name){const x=`${flags||''} ${name||''}`.toLowerCase();if(x.includes('bounty')||x.includes('pko'))return 'PKO';if(x.includes('satellite'))return 'Satellite';return 'MTT'}
function mappingUi(headers,rows){
  const c=sharkscopeColumns(headers),required=['site','gameId','stake','rake','date','result','name'],ok=required.every(k=>c[k]!==null)
  if(!ok)return `<div class="notice" style="margin-top:14px"><b>Arquivo não reconhecido automaticamente.</b><br>Colunas encontradas: ${headers.map(esc).join(', ')}</div>`
  const sums={};let valid=0,entries=0,minDate='',maxDate='';for(const r of rows){const cur=String(r[c.currency]||'USD').trim()||'USD';if(!sums[cur])sums[cur]={profit:0,buyin:0,prize:0,count:0};const re=Math.max(0,parseInt(r[c.reentries])||0),bi=(num(r[c.stake])+num(r[c.rake]))*(1+re);sums[cur].profit+=num(r[c.result]);sums[cur].buyin+=bi;sums[cur].prize+=num(r[c.prize]);sums[cur].count++;entries+=1+re;const dt=String(r[c.date]||'').slice(0,10);if(dt){if(!minDate||dt<minDate)minDate=dt;if(!maxDate||dt>maxDate)maxDate=dt}valid++}
  csvState.audit={sums,entries,minDate,maxDate};const curText=Object.entries(sums).map(([k,v])=>`${k}: ${v.count} torneios · profit nativo ${v.profit.toFixed(2)}`).join(' | ')
  return `<div class="notice audit" style="margin-top:14px"><b>✓ SharkScope detectado</b><br>${valid} torneios · ${entries} inscrições do jogador · período do CSV: ${minDate} → ${maxDate}<br>${esc(curText)}<hr><b>Auditoria de moeda</b><br>Seu CSV mistura USD e CNY. O SharkScope converte moedas para mostrar o lucro em $. Informe abaixo o Profit total mostrado pelo SharkScope para este mesmo filtro; o Poker Study calibra a conversão do CNY automaticamente.</div><div class="toolbar fxbar"><label>Profit SharkScope (USD)<input id="targetProfit" type="number" step=".01" placeholder="Ex.: 4985"></label><label>CNY por US$ 1<input id="cnyRate" type="number" step=".0001" value="6.7227"></label><button class="btn secondary" id="calibrateFx">Calibrar</button></div><div id="auditResult" class="notice"></div><button class="btn" id="importCsv" style="margin-top:14px">Importar/atualizar ${valid} torneios</button><p id="importMsg" class="muted"></p>`
}
function auditFx(){if(!csvState?.audit)return;const a=csvState.audit.sums,rate=+(document.getElementById('cnyRate')?.value||6.7227),usd=a.USD||{profit:0,buyin:0,prize:0},cny=a.CNY||{profit:0,buyin:0,prize:0},profit=usd.profit+cny.profit/rate,buyin=usd.buyin+cny.buyin/rate,prize=usd.prize+cny.prize/rate;auditResult.innerHTML=`Convertido para USD → Buy-ins: <b>${money(buyin)}</b> · Prêmios: <b>${money(prize)}</b> · Profit: <b class="${profit>=0?'good':'bad'}">${money(profit)}</b> · ROI: <b>${pct(profit,buyin)}</b>`}
function calibrateFxRate(){const a=csvState.audit.sums,target=+targetProfit.value,usd=a.USD?.profit||0,cny=a.CNY?.profit||0;if(!target||!cny)return alert('Informe o Profit do SharkScope em USD.');const rate=cny/(target-usd);if(rate<=0||!isFinite(rate))return alert('Não foi possível calibrar a moeda.');cnyRate.value=rate.toFixed(4);auditFx()}
async function importCsvRows(){
  const c=sharkscopeColumns(csvState.headers);if(c.gameId===null||c.date===null||c.stake===null||c.rake===null||c.result===null)return importMsg.textContent='CSV do SharkScope não reconhecido.'
  importCsv.disabled=true;let added=0,skipped=0,failed=0,mismatch=0;const batch=[]
  for(const r of csvState.rows){
    const gameId=String(r[c.gameId]||'').trim(),rawDate=String(r[c.date]||'').trim();if(!gameId||!rawDate){skipped++;continue}
    const dt=parseLocalDate(rawDate);if(Number.isNaN(dt.getTime())){skipped++;continue}
    const reentries=Math.max(0,parseInt(r[c.reentries])||0),stake=num(r[c.stake]),rake=num(r[c.rake]),currency=c.currency!==null?String(r[c.currency]||'USD').trim():'USD',fx=currency==='CNY'?Math.max(.0001,+(document.getElementById('cnyRate')?.value||6.7227)):1,nativeBuyin=(stake+rake)*(1+reentries),buyin=+(nativeBuyin/fx).toFixed(2)
    const sharkProfitNative=num(r[c.result]),sharkProfit=+(sharkProfitNative/fx).toFixed(2);let nativePrize=c.prize!==null?num(r[c.prize]):nativeBuyin+sharkProfitNative,prize=+(nativePrize/fx).toFixed(2)
    if(Math.abs((prize-buyin)-sharkProfit)>.02)mismatch++
    const site=c.site!==null?String(r[c.site]||'').trim():'',name=c.name!==null?String(r[c.name]||'').trim():'',flags=c.flags!==null?String(r[c.flags]||'').trim():'',format=inferFormat(flags,name)
    const fingerprint=await sha256(`sharkscope|${site}|${gameId}`)
    batch.push({user_id:user.id,played_at:dt.toISOString(),site,tournament_name:name,format,buyin,prize,finish_position:c.finish!==null?parseInt(r[c.finish])||null:null,entrants:c.entrants!==null?parseInt(r[c.entrants])||null:null,source:'sharkscope_csv',fingerprint,external_id:gameId,rake:+(rake*(1+reentries)).toFixed(2),reentries,duration_seconds:c.duration!==null?parseInt(r[c.duration])||null:null,currency,flags,native_buyin:+nativeBuyin.toFixed(2),native_prize:+nativePrize.toFixed(2),native_profit:+sharkProfitNative.toFixed(2),fx_rate:fx})
  }
  const errors=[]
  importMsg.textContent=`Importando ${batch.length} torneios...`
  for(let i=0;i<batch.length;i+=100){
    const chunk=batch.slice(i,i+100)
    const {data,error}=await supabase.from('tournaments').upsert(chunk,{onConflict:'user_id,fingerprint',ignoreDuplicates:false}).select('id')
    if(error){
      console.error('Erro ao importar torneios:',error)
      failed+=chunk.length
      errors.push(error.message||error.details||String(error))
    }else added+=data?.length||0
    importMsg.textContent=`Importando... ${Math.min(i+chunk.length,batch.length)}/${batch.length} processados · ${added} novos${failed?` · ${failed} com erro`:''}`
  }
  skipped+=Math.max(0,batch.length-added-failed)
  importCsv.disabled=false
  if(errors.length){
    importMsg.innerHTML=`<b style=\"color:#ff7b7b\">A importação encontrou erro no Supabase.</b><br>${added} novos · ${skipped} ignorados · ${failed} com erro.<br><span class=\"muted\">Erro: ${esc([...new Set(errors)].join(' | '))}</span>`
    if(added>0)await load()
    return
  }
  importMsg.textContent=`Concluído: ${added} novos, ${skipped} duplicados/ignorados${mismatch?` · ${mismatch} linhas com divergência para revisar`:''}.`
  await load();setTimeout(()=>route('importer'),1800)
}
async function sha256(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}

function leakData(){const m={};for(const h of db.hands){for(const k of [h.topic,...tagList(h.tags)].filter(Boolean)){if(!m[k])m[k]={hands:0,pending:0,studies:0,confidence:0};m[k].hands++;m[k].confidence+=+h.confidence||0;if(h.status!=='done')m[k].pending++}}for(const s of db.studies){for(const k of [s.topic,...tagList(s.tags)].filter(Boolean)){if(!m[k])m[k]={hands:0,pending:0,studies:0,confidence:0};if(s.status==='done')m[k].studies++}}return Object.entries(m).map(([topic,v])=>({topic,...v,score:v.pending*3+v.hands-Math.min(v.studies,5)-(v.confidence/Math.max(1,v.hands))/2})).sort((a,b)=>b.score-a.score)}
function leaks(){const a=leakData(),pending=db.hands.filter(x=>x.status!=='done').length,avg=db.hands.length?db.hands.reduce((n,h)=>n+(+h.confidence||0),0)/db.hands.length:0;return `<div class="cards"><div class="card"><small>Mãos marcadas</small><strong>${db.hands.length}</strong></div><div class="card"><small>Pendentes</small><strong>${pending}</strong></div><div class="card"><small>Confiança média</small><strong>${avg.toFixed(1)}/5</strong></div><div class="card"><small>Temas detectados</small><strong>${a.length}</strong></div></div><div class="panel"><h2>Ranking de prioridade</h2><p class="muted">A pontuação sobe com recorrência, mãos pendentes e baixa confiança; aulas concluídas reduzem a prioridade.</p>${a.length?a.map((x,i)=>{const av=x.hands?x.confidence/x.hands:0;return `<div class="leak-row"><div><span class="rank">#${i+1}</span><b>${esc(x.topic)}</b><div class="muted">${x.hands} mãos · ${x.pending} pendentes · ${x.studies} aulas · confiança ${av.toFixed(1)}/5</div></div><div><b>${x.score.toFixed(1)} pts</b><div class="progress"><i style="width:${Math.min(100,Math.max(5,x.score*8))}%"></i></div></div></div>`}).join(''):'<p class="muted">Cadastre temas e tags nas mãos para gerar o ranking.</p>'}</div>`}

function plan(){
  const leaks=leakData().slice(0,6),pending=db.hands.filter(x=>x.status!=='done'),doneStudies=db.studies.filter(x=>x.status==='done')
  const tasks=[]
  leaks.forEach((l,i)=>tasks.push({kind:i<2?'FOCO PRINCIPAL':'REVISÃO',title:l.topic,why:`${l.pending} mãos pendentes · ${l.hands} marcações · ${l.studies} aulas concluídas`,mins:i<2?60:35,score:l.score}))
  if(pending.length)tasks.push({kind:'FILA DE MÃOS',title:`Revisar ${Math.min(10,pending.length)} mãos pendentes`,why:'Transforme dúvidas marcadas em decisões documentadas.',mins:45,score:99})
  if(!tasks.length)tasks.push({kind:'COMEÇAR',title:'Marque mãos e temas durante as sessões',why:'O plano fica automático assim que houver material de revisão.',mins:20,score:1})
  const weekMinutes=tasks.slice(0,5).reduce((a,x)=>a+x.mins,0)
  return `<div class="cards"><div class="card"><small>Plano sugerido</small><strong>${tasks.slice(0,5).length} blocos</strong></div><div class="card"><small>Carga sugerida</small><strong>${Math.floor(weekMinutes/60)}h ${weekMinutes%60}m</strong></div><div class="card"><small>Mãos aguardando</small><strong>${pending.length}</strong></div><div class="card"><small>Aulas concluídas</small><strong>${doneStudies.length}</strong></div></div><div class="panel"><h2>Próximos blocos de estudo</h2><p class="muted">Gerado automaticamente a partir das suas mãos, tags, confiança e aulas concluídas.</p>${tasks.slice(0,5).map((t,i)=>`<div class="study-task"><span class="task-num">${i+1}</span><div><small>${t.kind}</small><h3>${esc(t.title)}</h3><div class="muted">${esc(t.why)}</div></div><strong>${t.mins} min</strong></div>`).join('')}</div><div class="grid2"><div class="panel"><h2>Regra da semana</h2><div class="notice">Priorize os 2 temas no topo da Central de Leaks. Depois de revisar as mãos, marque-as como estudadas e registre a aula relacionada com a mesma tag. A prioridade se recalcula sozinha.</div></div><div class="panel"><h2>Rotina sugerida</h2><p><b>Antes da sessão:</b> 15 min de revisão.</p><p><b>Pós-sessão:</b> marcar mãos e dúvidas.</p><p><b>Bloco técnico:</b> 2–3 sessões semanais focadas nos leaks #1 e #2.</p></div></div>`
}
function evolution(){
  const perf=allPerformanceRows(),studies=db.studies.filter(x=>x.status==='done'&&x.date),hands=db.hands.filter(x=>x.date)
  const weeks={};const weekKey=d=>{const x=new Date(d+'T12:00:00'),day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);return x.toISOString().slice(0,10)}
  perf.forEach(x=>{const k=weekKey(x.date);weeks[k]??={profit:0,buyins:0,games:0,study:0,reviewed:0};weeks[k].profit+=x.profit;weeks[k].buyins+=x.buyins;weeks[k].games+=x.games})
  studies.forEach(x=>{const k=weekKey(x.date);weeks[k]??={profit:0,buyins:0,games:0,study:0,reviewed:0};weeks[k].study+=(+x.duration||0)/60})
  hands.filter(x=>x.status==='done').forEach(x=>{const d=String(x.reviewed_at||x.date).slice(0,10),k=weekKey(d);weeks[k]??={profit:0,buyins:0,games:0,study:0,reviewed:0};weeks[k].reviewed++})
  const arr=Object.entries(weeks).sort().slice(-10),studied=arr.filter(([,v])=>v.study>0),notStudied=arr.filter(([,v])=>v.study===0&&v.games>0)
  const avg=a=>a.length?a.reduce((n,[,v])=>n+(v.buyins?v.profit/v.buyins*100:0),0)/a.length:0
  const top=leakData().slice(0,3)
  return `<div class="cards"><div class="card"><small>Horas estudadas</small><strong>${studies.reduce((a,x)=>a+(+x.duration||0),0)/60? (studies.reduce((a,x)=>a+(+x.duration||0),0)/60).toFixed(1):'0.0'}h</strong></div><div class="card"><small>Mãos revisadas</small><strong>${db.hands.filter(x=>x.status==='done').length}</strong></div><div class="card"><small>ROI em semanas com estudo</small><strong>${avg(studied).toFixed(1)}%</strong></div><div class="card"><small>ROI sem estudo registrado</small><strong>${avg(notStudied).toFixed(1)}%</strong></div></div><div class="panel"><h2>Estudo × performance por semana</h2><div class="evo-table"><div class="evo-head">Semana<span>MTTs</span><span>Estudo</span><span>Revisões</span><span>Profit</span><span>ROI</span></div>${arr.map(([k,v])=>`<div class="evo-row"><b>${k}</b><span>${v.games}</span><span>${v.study.toFixed(1)}h</span><span>${v.reviewed}</span><span class="${v.profit>=0?'good':'bad'}">${money(v.profit)}</span><span>${v.buyins?(v.profit/v.buyins*100).toFixed(1):'0.0'}%</span></div>`).join('')}</div><p class="muted">Correlação não prova causa. Use esta visão para observar tendências ao longo de várias semanas.</p></div><div class="grid2"><div class="panel"><h2>Temas para acompanhar</h2>${top.map(x=>`<div class="item"><b>${esc(x.topic)}</b><br><span class="muted">${x.hands} mãos · ${x.pending} pendentes · ${x.studies} aulas</span></div>`).join('')||'<p class="muted">Ainda sem temas suficientes.</p>'}</div><div class="panel"><h2>Como medir evolução</h2><div class="notice">Use a mesma tag nas mãos e nas aulas (ex.: ICM, BvB, 3bet pot). Conforme o histórico cresce, a Central de Leaks mostra se as pendências caem e esta página mostra o contexto de performance da mesma época.</div></div></div>`
}

function goals(){return `<div class="toolbar"><button class="btn" id="newGoal">+ Nova meta</button></div><div class="grid3">${db.goals.length?db.goals.map(g=>`<div class="card"><small>${esc(g.metric||'META')}</small><strong>${esc(g.title)}</strong><p class="muted">${g.current_value||0} / ${g.target_value||0} ${esc(g.unit||'')}</p><div class="progress"><i style="width:${Math.min(100,(+g.current_value||0)/(+g.target_value||1)*100)}%"></i></div><div class="toolbar" style="margin-top:10px"><button class="btn small secondary" data-progress-goal="${g.id}">Atualizar</button></div></div>`).join(''):'<div class="panel"><p class="muted">Nenhuma meta.</p></div>'}</div>`}
function reports(){const rows=allPerformanceRows(),m=metrics(rows),l=leakData()[0];return `<div class="cards"><div class="card"><small>Volume total</small><strong>${m.g}</strong></div><div class="card"><small>Profit total</small><strong class="${m.p>=0?'good':'bad'}">${money(m.p)}</strong></div><div class="card"><small>ROI total</small><strong>${m.roi.toFixed(1)}%</strong></div><div class="card"><small>Importados</small><strong>${db.tournaments.length}</strong></div><div class="card"><small>Mãos estudadas</small><strong>${db.hands.filter(x=>x.status==='done').length}</strong></div><div class="card"><small>Leak #1</small><strong>${esc(l?.topic||'—')}</strong></div></div><div class="grid2"><div class="panel"><h2>Curva completa</h2>${cumulativeSvg(rows)}</div><div class="panel"><h2>Diagnóstico</h2>${diagnostic().map(x=>`<div class="notice" style="margin-bottom:8px">${x}</div>`).join('')}</div></div>`}
function diagnostic(){const o=[],pending=db.hands.filter(x=>x.status!=='done').length,total=metrics(allPerformanceRows()).g;if(total<100)o.push('A amostra ainda é pequena; evite conclusões fortes sobre ROI.');if(pending>5)o.push(`Você tem ${pending} mãos pendentes. Crie uma sessão específica de revisão.`);const l=leakData()[0];if(l?.pending)o.push(`Tema com maior prioridade: ${esc(l.topic)} (${l.pending} pendentes).`);if(db.tournaments.length)o.push(`${db.tournaments.length} torneios individuais importados já alimentam os gráficos.`);if(!o.length)o.push('Nenhum alerta forte no momento.');return o}

function bindFilters(){
  if(document.getElementById('periodSelect')){periodSelect.value=String(filters.days);siteFilter.value=filters.site;formatFilter.value=filters.format;excludeSat.checked=filters.excludeSat;const change=()=>{filters={days:+periodSelect.value,site:siteFilter.value,format:formatFilter.value,start:startFilter.value,end:endFilter.value,minBuyin:minBuyin.value,maxBuyin:maxBuyin.value,excludeSat:excludeSat.checked};route(currentPage)};[periodSelect,siteFilter,formatFilter,startFilter,endFilter,minBuyin,maxBuyin,excludeSat].forEach(x=>x.onchange=change)}
}
function bindHandCards(){
  document.querySelectorAll('[data-toggle-hand]').forEach(b=>b.onclick=()=>toggleHand(b.dataset.toggleHand))
  document.querySelectorAll('[data-view-hand]').forEach(b=>b.onclick=()=>viewHand(b.dataset.viewHand))
  document.querySelectorAll('[data-edit-hand]').forEach(b=>b.onclick=()=>handModal(b.dataset.editHand))
  document.querySelectorAll('[data-delete-hand]').forEach(b=>b.onclick=()=>deleteHand(b.dataset.deleteHand))
  document.querySelectorAll('[data-fav-hand]').forEach(b=>b.onclick=()=>favoriteHand(b.dataset.favHand))
}
async function renderSavedReplays(loadText){
  const box=document.getElementById('savedReplayBox');if(!box)return
  try{const list=await savedReplayList();if(!list.length){box.innerHTML='<span class="muted">Nenhum torneio salvo neste dispositivo.</span>';return}
    box.innerHTML=`<div class="saved-replay-title"><b>Torneios salvos neste dispositivo</b><small>${list.length} salvo${list.length===1?'':'s'}</small></div>${list.map(x=>`<div class="saved-replay-row"><button class="saved-replay-open" data-saved-open="${esc(x.id)}"><b>${esc(x.name)}</b><small>${x.handsCount||'?'} mãos · ${new Date(x.savedAt).toLocaleDateString('pt-BR')}</small></button><button class="btn small danger" data-saved-delete="${esc(x.id)}">Apagar</button></div>`).join('')}`
    document.querySelectorAll('[data-saved-open]').forEach(b=>b.onclick=()=>{const x=list.find(r=>r.id===b.dataset.savedOpen);if(x)loadText(x.text,x.name,false)})
    document.querySelectorAll('[data-saved-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Apagar este torneio salvo deste dispositivo?'))return;await deleteReplayTournament(b.dataset.savedDelete);renderSavedReplays(loadText)})
  }catch(e){box.innerHTML='<span class="muted">Não foi possível acessar o armazenamento local deste navegador.</span>'}
}
function bindPage(p){
  if(p==='dashboard'||p==='analytics')bindFilters()
  if(p==='studies'){newStudy.onclick=studyModal;document.querySelectorAll('[data-toggle-study]').forEach(b=>b.onclick=()=>toggleStudy(b.dataset.toggleStudy))}
  if(p==='hands'){newHand.onclick=handModal;bindHandCards();const filterHands=()=>{let a=db.hands;if(handStatus.value==='pending')a=a.filter(x=>x.status!=='done');if(handStatus.value==='done')a=a.filter(x=>x.status==='done');if(handStatus.value==='favorite')a=a.filter(x=>x.favorite);if(handPriority.value!=='all')a=a.filter(x=>x.priority===handPriority.value);if(handFormat.value!=='all')a=a.filter(x=>x.format===handFormat.value);if(handTopic.value!=='all')a=a.filter(x=>x.topic===handTopic.value);if(handPosition.value!=='all')a=a.filter(x=>x.hero_position===handPosition.value);const q=handSearch.value.trim().toLowerCase();if(q)a=a.filter(x=>[x.spot,x.topic,x.tags,x.preflop,x.flop,x.turn,x.river,x.question,x.hero_position,x.villain_position,x.effective_stack].some(v=>String(v||'').toLowerCase().includes(q)));handCount.textContent=`${a.length} de ${db.hands.length} mãos`;handList.innerHTML=handCards(a);bindHandCards()};[handStatus,handPriority,handFormat,handTopic,handPosition].forEach(x=>x.onchange=filterHands);handSearch.oninput=filterHands}
  if(p==='replayer'){
    const loadText=(text,name='Hand History',refreshSaved=true)=>{const hands=parseGgHistory(text);if(!hands.length)return alert('Não consegui reconhecer nenhuma mão GG neste texto.');replayState={hands,selected:hands[0],step:0,sourceName:name,rawText:String(text||''),speed:1,playing:false,showOpponentCards:false,equilabOpen:false,rangeByHand:{},rangeColor:'blue'};replayWorkspace.innerHTML=replayWorkspaceHtml();document.querySelectorAll('[data-replay-hand]').forEach(b=>b.onclick=()=>selectReplayHand(b.dataset.replayHand));replaySearch.oninput=()=>{const q=replaySearch.value.trim().toLowerCase(),a=replayState.hands.filter(h=>[h.handId,h.heroCards.join(' '),h.dateTime,h.positionMap[h.hero],h.tournamentName].some(v=>String(v||'').toLowerCase().includes(q)));replayHandList.innerHTML=replayHandListHtml(a,replayState.selected);document.querySelectorAll('[data-replay-hand]').forEach(b=>b.onclick=()=>selectReplayHand(b.dataset.replayHand))};bindReplayStage();if(refreshSaved)renderSavedReplays(loadText)}
    readHhFile.onclick=()=>{const f=hhFile.files[0];if(!f)return alert('Selecione o arquivo .txt.');const rd=new FileReader();rd.onload=()=>loadText(rd.result,f.name);rd.readAsText(f)}
    parseHhPaste.onclick=()=>loadText(hhPaste.value,'Texto colado')
    renderSavedReplays(loadText)
    if(replayState.hands.length){document.querySelectorAll('[data-replay-hand]').forEach(b=>b.onclick=()=>selectReplayHand(b.dataset.replayHand));replaySearch.oninput=()=>{const q=replaySearch.value.trim().toLowerCase(),a=replayState.hands.filter(h=>[h.handId,h.heroCards.join(' '),h.dateTime,h.positionMap[h.hero],h.tournamentName].some(v=>String(v||'').toLowerCase().includes(q)));replayHandList.innerHTML=replayHandListHtml(a,replayState.selected);document.querySelectorAll('[data-replay-hand]').forEach(b=>b.onclick=()=>selectReplayHand(b.dataset.replayHand))};bindReplayStage()}
  }
  if(p==='hhstats'){
    refreshHhStats()
    const setBusy=busy=>{pickHhStatsFiles.disabled=busy;pickHhStatsFolder.disabled=busy;clearHhStats.disabled=busy}
    const importFiles=async(files,source='arquivos')=>{
      const fs=[...files].filter(f=>/\.txt$/i.test(f.name)||String(f.type||'').includes('text/plain'))
      if(!fs.length)return alert('Não encontrei arquivos .txt nessa seleção.')
      setBusy(true);let total=0,valid=0,ignored=0
      try{
        for(let i=0;i<fs.length;i++){
          const f=fs[i],displayName=f.webkitRelativePath||f.name
          hhStatsStatus.textContent=`Importando ${source}: ${i+1} de ${fs.length} arquivos... ${total.toLocaleString('pt-BR')} mãos lidas.`
          const text=await f.text(),hands=parseGgHistory(text)
          if(!hands.length){ignored++;continue}
          valid++;total+=hands.length
          await saveHhStatsImport({id:displayName+'|'+(hands[0]?.tournamentId||'')+'|'+f.size,name:displayName,importedAt:new Date().toISOString(),hands})
          if(i%8===0)await new Promise(r=>setTimeout(r,0))
        }
        await refreshHhStats()
        hhStatsStatus.textContent=`Concluído: ${valid} arquivo${valid===1?'':'s'} importado${valid===1?'':'s'}, ${total.toLocaleString('pt-BR')} mãos lidas${ignored?` e ${ignored} arquivo${ignored===1?'':'s'} ignorado${ignored===1?'':'s'}`:''}. Duplicatas por Hand ID continuam sendo descartadas nas estatísticas.`
      }catch(e){console.error(e);hhStatsStatus.textContent='Ocorreu um erro durante a importação. Tente novamente.'}
      finally{setBusy(false);hhStatsFiles.value='';hhStatsFolder.value=''}
    }
    pickHhStatsFiles.onclick=()=>hhStatsFiles.click()
    pickHhStatsFolder.onclick=()=>hhStatsFolder.click()
    hhStatsFiles.onchange=()=>{if(hhStatsFiles.files.length)importFiles(hhStatsFiles.files,'arquivos selecionados')}
    hhStatsFolder.onchange=()=>{if(hhStatsFolder.files.length)importFiles(hhStatsFolder.files,'pasta selecionada')}
    clearHhStats.onclick=async()=>{if(!confirm('Limpar todas as HH salvas no tracker deste navegador?'))return;await clearHhStatsImports();hhStatsStatus.textContent='Banco local limpo.';await refreshHhStats()}
  }
  if(p==='results')newResult.onclick=resultModal
  if(p==='goals'){newGoal.onclick=goalModal;document.querySelectorAll('[data-progress-goal]').forEach(b=>b.onclick=()=>goalProgress(b.dataset.progressGoal))}
  if(p==='importer'){readCsv.onclick=()=>{const f=csvFile.files[0];if(!f)return alert('Selecione um CSV.');const rd=new FileReader();rd.onload=()=>{const rows=parseCsv(rd.result);if(rows.length<2)return csvMapper.innerHTML='<p class="bad">CSV vazio ou inválido.</p>';csvState={headers:rows[0].map(x=>x.trim()),rows:rows.slice(1)};csvMapper.innerHTML=mappingUi(csvState.headers,csvState.rows);const b=document.getElementById('importCsv');if(b)b.onclick=importCsvRows};rd.readAsText(f)}}
}
function openModal(t,h){modalTitle.textContent=t;modalBody.innerHTML=h;modal.classList.add('show')}
async function toggleStudy(id){const x=db.studies.find(x=>x.id===id);await supabase.from('studies').update({status:x.status==='done'?'pending':'done'}).eq('id',id);await load();route('studies')}
async function toggleHand(id){const x=db.hands.find(x=>x.id===id),done=x.status!=='done';await supabase.from('hands').update({status:done?'done':'pending',reviewed_at:done?new Date().toISOString():null}).eq('id',id);await load();route('hands')}
async function favoriteHand(id){const x=db.hands.find(x=>x.id===id);await supabase.from('hands').update({favorite:!x.favorite}).eq('id',id);await load();route('hands')}
async function insert(t,row){const {error}=await supabase.from(t).insert({...row,user_id:user.id});if(error)return alert(error.message);await load();route(t==='studies'?'studies':t==='hands'?'hands':t==='results'?'results':'goals')}

function studyModal(){openModal('Nova aula',`<div class="form"><div class="field"><label>Curso</label><input id="s_course"></div><div class="field"><label>Aula</label><input id="s_title"></div><div class="field"><label>Professor</label><input id="s_teacher"></div><div class="field"><label>Tema</label><input id="s_topic"></div><div class="field"><label>Data</label><input id="s_date" type="date" value="${today()}"></div><div class="field"><label>Duração (min)</label><input id="s_duration" type="number" value="60"></div><div class="field"><label>Status</label><select id="s_status"><option value="done">Assistida</option><option value="pending">Pendente</option></select></div><div class="field"><label>Tags</label><input id="s_tags"></div><div class="field span2"><label>Anotações</label><textarea id="s_notes"></textarea></div></div><br><button class="btn" id="saveStudy">Salvar</button>`);saveStudy.onclick=()=>{if(!s_title.value.trim())return alert('Digite o nome da aula.');insert('studies',{course:s_course.value,title:s_title.value,teacher:s_teacher.value,topic:s_topic.value||'Geral',date:s_date.value,duration:+s_duration.value||0,status:s_status.value,tags:s_tags.value,notes:s_notes.value});modal.classList.remove('show')}}
const HAND_TAGS=['ICM','PKO','BvB','3bet pot','4bet pot','SRP','IP','OOP','C-bet','Check-raise','River','Value bet','Bluff','Overbet']
const HAND_TOPICS=['Pré-flop','C-bet','3bet pot','4bet pot','Blind vs Blind','ICM','PKO','Turn','River','Outro']
const HAND_SPOTS=['Open raise','Vs open','3bet','Vs 3bet','4bet','C-bet','Vs C-bet','Check-raise','Probe','Delayed c-bet','River bet','River call','All-in','Outro']
const POSITIONS=['UTG','UTG+1','HJ','CO','BTN','SB','BB']
const STACKS=['≤10bb','11–15bb','16–20bb','21–30bb','31–40bb','41–60bb','61bb+']
const STREET_TAGS=['Pré-flop','Flop','Turn','River']
function opt(arr,val=''){return arr.map(x=>`<option value="${esc(x)}" ${String(x)===String(val)?'selected':''}>${esc(x)}</option>`).join('')}
function tagPicker(selected=[]){return HAND_TAGS.map(t=>`<button type="button" class="tag-choice ${selected.includes(t)?'on':''}" data-tag-choice="${esc(t)}">${esc(t)}</button>`).join('')}
function handModal(id=null){
  const h=id?db.hands.find(x=>x.id===id):null
  const existingTags=tagList(h?.tags), knownTags=existingTags.filter(x=>HAND_TAGS.includes(x)), customTags=existingTags.filter(x=>!HAND_TAGS.includes(x)).join(', ')
  const title=h?'Editar mão':'Nova mão'
  openModal(title,`<div class="mode-switch"><button class="btn small" id="simpleMode">Registro rápido</button><button class="btn small secondary" id="advancedMode">Completo</button><span class="muted">Comece pelo rápido; abra o completo só quando precisar.</span></div>
  <div class="form quick-hand-form">
    <div class="field"><label>Data</label><input id="h_date" type="date" value="${esc(h?.date||today())}"></div>
    <div class="field"><label>Formato</label><select id="h_format">${opt(['PKO','MTT Regular','Satélite','Outro'],h?.format||'PKO')}</select></div>
    <div class="field"><label>Street principal</label><select id="h_street"><option value="">Selecione</option>${opt(STREET_TAGS,existingTags.find(x=>STREET_TAGS.includes(x))||'')}</select></div>
    <div class="field"><label>Spot</label><select id="h_spot"><option value="">Selecione</option>${opt(HAND_SPOTS,h?.spot||'')}</select></div>
    <div class="field"><label>Tema</label><select id="h_topic"><option value="">Selecione</option>${opt(HAND_TOPICS,h?.topic||'')}</select></div>
    <div class="field"><label>Stack efetivo</label><select id="h_stack"><option value="">Selecione</option>${opt(STACKS,h?.effective_stack||'')}</select></div>
    <div class="field"><label>Hero</label><select id="h_hero"><option value="">Selecione</option>${opt(POSITIONS,h?.hero_position||'')}</select></div>
    <div class="field"><label>Vilão</label><select id="h_villain"><option value="">Selecione</option>${opt(POSITIONS,h?.villain_position||'')}</select></div>
    <div class="field"><label>Prioridade</label><select id="h_priority">${opt(['normal','high','low'],h?.priority||'normal')}</select></div>
    <div class="field"><label>Imagem da mão</label><input id="h_image" type="file" accept="image/*"></div>
    <div class="field span2"><label>Tags rápidas</label><div id="tagPicker" class="tag-picker">${tagPicker(knownTags)}</div></div>
    <div class="field span2"><label>Dúvida / decisão que quer revisar</label><textarea id="h_question" placeholder="Ex.: Tenho raise no river?">${esc(h?.question||'')}</textarea></div>
  </div>
  <div id="advancedFields" class="advanced-hand-fields">
    <div class="notice">Campos opcionais. Use quando quiser documentar a mão em mais detalhes.</div><br>
    <div class="form">
      <div class="field"><label>Site</label><input id="h_site" value="${esc(h?.site||'')}"></div>
      <div class="field"><label>Torneio</label><input id="h_tournament" value="${esc(h?.tournament||'')}"></div>
      <div class="field"><label>Blinds</label><input id="h_blinds" value="${esc(h?.blinds||'')}"></div>
      <div class="field"><label>Confiança na decisão (0–5)</label><select id="h_confidence">${opt(['0','1','2','3','4','5'],String(h?.confidence??0))}</select></div>
      <div class="field span2"><label>Pré-flop</label><textarea id="h_preflop">${esc(h?.preflop||'')}</textarea></div>
      <div class="field span2"><label>Flop</label><textarea id="h_flop">${esc(h?.flop||'')}</textarea></div>
      <div class="field span2"><label>Turn</label><textarea id="h_turn">${esc(h?.turn||'')}</textarea></div>
      <div class="field span2"><label>River</label><textarea id="h_river">${esc(h?.river||'')}</textarea></div>
      <div class="field span2"><label>Análise / solução</label><textarea id="h_notes">${esc(h?.notes||'')}</textarea></div>
      <div class="field span2"><label>Tags extras (opcional)</label><input id="h_custom_tags" value="${esc(customTags)}" placeholder="Digite somente tags que não estão acima"></div>
      ${h?.image_path?`<div class="field span2"><label class="check"><input id="h_remove_image" type="checkbox"> Remover imagem atual</label></div>`:''}
    </div>
  </div><br><button class="btn" id="saveHand">${h?'Salvar alterações':'Salvar mão'}</button><p id="uploadMsg" class="muted"></p>`)
  const adv=document.getElementById('advancedFields'), simpleBtn=document.getElementById('simpleMode'), advancedBtn=document.getElementById('advancedMode')
  const setMode=advanced=>{adv.classList.toggle('show',advanced);simpleBtn.classList.toggle('secondary',advanced);advancedBtn.classList.toggle('secondary',!advanced)}
  setMode(false);simpleBtn.onclick=()=>setMode(false);advancedBtn.onclick=()=>setMode(true)
  document.querySelectorAll('[data-tag-choice]').forEach(b=>b.onclick=()=>b.classList.toggle('on'))
  saveHand.onclick=async()=>{
    if(!h_question.value.trim())return alert('Digite a dúvida da mão.')
    saveHand.disabled=true;uploadMsg.textContent=h?'Salvando alterações...':'Salvando...'
    let image_path=h?.image_path||null
    const remove=document.getElementById('h_remove_image')?.checked
    if(remove&&image_path){await supabase.storage.from('hand-images').remove([image_path]);image_path=null}
    const f=h_image.files[0]
    if(f){if(image_path)await supabase.storage.from('hand-images').remove([image_path]);const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,'_');image_path=`${user.id}/${uid()}-${safe}`;const {error}=await supabase.storage.from('hand-images').upload(image_path,f);if(error){saveHand.disabled=false;return uploadMsg.textContent='Erro no upload: '+error.message}}
    const selectedTags=[...document.querySelectorAll('[data-tag-choice].on')].map(b=>b.dataset.tagChoice)
    if(h_street.value&&!selectedTags.includes(h_street.value))selectedTags.push(h_street.value)
    const custom=tagList(document.getElementById('h_custom_tags')?.value||'');const tags=[...new Set([...selectedTags,...custom])].join(', ')
    const row={date:h_date.value,site:document.getElementById('h_site')?.value||h?.site||'',tournament:document.getElementById('h_tournament')?.value||h?.tournament||'',format:h_format.value,spot:h_spot.value,topic:h_topic.value||'Geral',blinds:document.getElementById('h_blinds')?.value||h?.blinds||'',effective_stack:h_stack.value,hero_position:h_hero.value,villain_position:h_villain.value,priority:h_priority.value,confidence:+(document.getElementById('h_confidence')?.value??h?.confidence??0),preflop:document.getElementById('h_preflop')?.value||h?.preflop||'',flop:document.getElementById('h_flop')?.value||h?.flop||'',turn:document.getElementById('h_turn')?.value||h?.turn||'',river:document.getElementById('h_river')?.value||h?.river||'',question:h_question.value,notes:document.getElementById('h_notes')?.value||h?.notes||'',tags,status:h?.status||'pending',image_path}
    const q=h?supabase.from('hands').update(row).eq('id',h.id):supabase.from('hands').insert({...row,user_id:user.id})
    const {error}=await q;if(error){saveHand.disabled=false;return uploadMsg.textContent=error.message}
    modal.classList.remove('show');await load();route('hands')
  }
}
async function deleteHand(id){
  const h=db.hands.find(x=>x.id===id);if(!h)return
  if(!confirm(`Apagar esta mão?\n\n${h.question||h.spot||'Mão sem título'}\n\nEssa ação não pode ser desfeita.`))return
  if(h.image_path)await supabase.storage.from('hand-images').remove([h.image_path])
  const {error}=await supabase.from('hands').delete().eq('id',id);if(error)return alert('Erro ao apagar: '+error.message)
  modal.classList.remove('show');await load();route('hands')
}
function viewHand(id){const h=db.hands.find(x=>x.id===id);openModal('Detalhes da mão',`${h.image_url?`<img src="${h.image_url}" class="hand-detail-img">`:''}<div class="grid2"><div class="panel"><b>${esc(h.tournament||'')}</b><p class="muted">${h.date} · ${esc(h.site||'')} · ${esc(h.format||'')}</p><p>${esc(h.spot||'')} · ${esc(h.blinds||'')} · ${esc(h.effective_stack||'')}</p><p>Hero: ${esc(h.hero_position||'')} · Vilão: ${esc(h.villain_position||'')}</p></div><div class="panel"><b>${esc(h.topic||'Geral')}</b><p>Prioridade: ${esc(h.priority||'normal')} · Confiança: ${h.confidence||0}/5</p><div>${tagList(h.tags).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><p><b>Dúvida:</b><br>${esc(h.question||'')}</p></div></div><div class="panel"><p><b>Pré-flop</b><br>${esc(h.preflop||'-')}</p><p><b>Flop</b><br>${esc(h.flop||'-')}</p><p><b>Turn</b><br>${esc(h.turn||'-')}</p><p><b>River</b><br>${esc(h.river||'-')}</p><p><b>Análise / solução</b><br>${esc(h.notes||'-')}</p></div><div class="toolbar" style="margin-top:14px"><button class="btn" id="modalEditHand">Editar mão</button><button class="btn danger" id="modalDeleteHand">Apagar mão</button></div>`);modalEditHand.onclick=()=>handModal(id);modalDeleteHand.onclick=()=>deleteHand(id)}
function resultModal(){openModal('Novo resultado',`<div class="form form3"><div class="field"><label>Data</label><input id="r_date" type="date" value="${today()}"></div><div class="field"><label>Site</label><input id="r_site"></div><div class="field"><label>Formato</label><select id="r_format"><option>PKO</option><option>MTT Regular</option><option>Satélite</option><option>Outro</option></select></div><div class="field"><label>Torneios</label><input id="r_tournaments" type="number" value="0"></div><div class="field"><label>Buy-ins ($)</label><input id="r_buyins" type="number" step=".01" value="0"></div><div class="field"><label>Prêmios ($)</label><input id="r_prizes" type="number" step=".01" value="0"></div><div class="field"><label>ITM</label><input id="r_itm" type="number" value="0"></div><div class="field"><label>FT</label><input id="r_ft" type="number" value="0"></div><div class="field"><label>Vitórias</label><input id="r_wins" type="number" value="0"></div><div class="field"><label>Horas</label><input id="r_hours" type="number" step=".1" value="0"></div></div><br><button class="btn" id="saveResult">Salvar</button>`);saveResult.onclick=()=>{const t=+r_tournaments.value||0,bi=+r_buyins.value||0,pr=+r_prizes.value||0;if(!t)return alert('Informe o número de torneios.');insert('results',{date:r_date.value,site:r_site.value,format:r_format.value,tournaments:t,buyins:bi,prizes:pr,profit:pr-bi,abi:t?bi/t:0,itm:+r_itm.value||0,ft:+r_ft.value||0,wins:+r_wins.value||0,hours:+r_hours.value||0});modal.classList.remove('show')}}
function goalModal(){openModal('Nova meta',`<div class="form"><div class="field"><label>Título</label><input id="g_title"></div><div class="field"><label>Métrica</label><select id="g_metric"><option>Volume</option><option>Estudo</option><option>Mãos revisadas</option><option>Profit</option><option>ROI</option></select></div><div class="field"><label>Meta</label><input id="g_target" type="number" step=".1"></div><div class="field"><label>Unidade</label><input id="g_unit"></div><div class="field"><label>Prazo</label><input id="g_date" type="date" value="${today()}"></div></div><br><button class="btn" id="saveGoal">Salvar</button>`);saveGoal.onclick=()=>{if(!g_title.value.trim())return alert('Digite o título da meta.');insert('goals',{title:g_title.value,metric:g_metric.value,target_value:+g_target.value||0,current_value:0,unit:g_unit.value,date:g_date.value});modal.classList.remove('show')}}
async function goalProgress(id){const g=db.goals.find(x=>x.id===id),v=prompt(`Valor atual (${g.unit||''})`,g.current_value||0);if(v===null)return;await supabase.from('goals').update({current_value:+v||0}).eq('id',id);await load();route('goals')}

supabase.auth.onAuthStateChange(async(event,s)=>{if(event==='PASSWORD_RECOVERY'){recoveryMode=true;user=s?.user||null;newPasswordView();return}if(recoveryMode)return;user=s?.user||null;if(user){await load();shell()}else loginView()})
const {data:s}=await supabase.auth.getSession();user=s.session?.user||null
const recoveryInUrl=window.location.hash.includes('type=recovery')||window.location.search.includes('type=recovery')
if(recoveryInUrl){recoveryMode=true;newPasswordView()}else if(user){await load();shell()}else loginView()
