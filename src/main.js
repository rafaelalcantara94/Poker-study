import { supabase } from './supabase.js'
import './style.css'

const app = document.querySelector('#app')
let user = null
let db = { studies: [], hands: [], results: [], goals: [], tournaments: [] }
let currentPage = 'dashboard'
let hhStatsCache = []
let hhStatsFilteredCache = []
let hhStatsFilters = { game: 'holdem', start: '', end: '', position: 'all', stack: 'all', players: 'all' }
let hhReplayContext = null
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
  app.innerHTML = `<main class="auth"><div class="authbox"><div class="brand">Poker <b>Study</b><small>V8.3.6 • TRACKER</small></div>
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
  app.innerHTML=`<div class="app"><aside class="sidebar"><div class="brand">Poker <b>Study</b><small>V8.3.6 • TRACKER</small></div><nav class="nav">
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
function detectGameType(h){
  const text=`${h?.tournamentName||''} ${h?.raw||''}`.toLowerCase(),n=(h?.heroCards||[]).length
  if(/omaha/.test(text)||n>=4){if(/5\s*card|plo\s*5|omaha\s*5/.test(text)||n>=5)return 'plo5';return 'omaha'}
  if(/hold.?em/.test(text)||n===2)return 'holdem'
  return 'other'
}



// --- V7.4 All-in EV engine -------------------------------------------------
const HH_RANKS='23456789TJQKA',HH_SUITS='cdhs'
function hhCardCode(c){
  c=String(c||'').trim();if(c.length<2)return null
  const r=HH_RANKS.indexOf(c[0].toUpperCase())+2,s=HH_SUITS.indexOf(c[1].toLowerCase());
  return r>=2&&s>=0?{r,s,key:c[0].toUpperCase()+c[1].toLowerCase()}:null
}
function hhDeck(excluded=[]){
  const dead=new Set(excluded.map(x=>hhCardCode(x)?.key).filter(Boolean)),d=[]
  for(const r of HH_RANKS)for(const su of HH_SUITS){const k=r+su;if(!dead.has(k))d.push(k)}
  return d
}
function hhCmpVec(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const x=a[i]||0,y=b[i]||0;if(x!==y)return x-y}return 0}
function hhEval5(cards){
  const cs=cards.map(hhCardCode);if(cs.some(x=>!x))return [0]
  const ranks=cs.map(x=>x.r).sort((a,b)=>b-a),counts={};for(const r of ranks)counts[r]=(counts[r]||0)+1
  const groups=Object.entries(counts).map(([r,c])=>({r:+r,c})).sort((a,b)=>b.c-a.c||b.r-a.r)
  const flush=cs.every(x=>x.s===cs[0].s),uniq=[...new Set(ranks)].sort((a,b)=>b-a);if(uniq[0]===14)uniq.push(1)
  let straight=0;for(let i=0;i<=uniq.length-5;i++)if(uniq[i]-uniq[i+4]===4){straight=uniq[i];break}
  if(flush&&straight)return [8,straight]
  if(groups[0].c===4)return [7,groups[0].r,groups.find(x=>x.c===1).r]
  if(groups[0].c===3&&groups[1]?.c>=2)return [6,groups[0].r,groups[1].r]
  if(flush)return [5,...ranks]
  if(straight)return [4,straight]
  if(groups[0].c===3)return [3,groups[0].r,...groups.filter(x=>x.c===1).map(x=>x.r).sort((a,b)=>b-a)]
  const pairs=groups.filter(x=>x.c===2).map(x=>x.r).sort((a,b)=>b-a)
  if(pairs.length>=2)return [2,pairs[0],pairs[1],groups.find(x=>x.c===1)?.r||0]
  if(pairs.length===1)return [1,pairs[0],...groups.filter(x=>x.c===1).map(x=>x.r).sort((a,b)=>b-a)]
  return [0,...ranks]
}
function hhStraightHigh(ranks){
  const u=[...new Set(ranks)].sort((a,b)=>b-a);if(u.includes(14))u.push(1)
  for(let i=0;i<=u.length-5;i++)if(u[i]-u[i+4]===4)return u[i]
  return 0
}
function hhEval7(cards){
  const cs=cards.map(hhCardCode).filter(Boolean),rc={},sc=[[],[],[],[]]
  for(const c of cs){rc[c.r]=(rc[c.r]||0)+1;sc[c.s].push(c.r)}
  const ranks=Object.keys(rc).map(Number).sort((a,b)=>b-a)
  for(const sr of sc)if(sr.length>=5){const sh=hhStraightHigh(sr);if(sh)return [8,sh]}
  const quads=ranks.filter(r=>rc[r]===4);if(quads.length){const q=quads[0],k=ranks.find(r=>r!==q)||0;return [7,q,k]}
  const trips=ranks.filter(r=>rc[r]>=3),pairs=ranks.filter(r=>rc[r]>=2)
  if(trips.length){const t=trips[0],p=pairs.find(r=>r!==t);if(p)return [6,t,p]}
  for(const sr of sc)if(sr.length>=5)return [5,...[...sr].sort((a,b)=>b-a).slice(0,5)]
  const sh=hhStraightHigh(ranks);if(sh)return [4,sh]
  if(trips.length){const t=trips[0],ks=ranks.filter(r=>r!==t).slice(0,2);return [3,t,...ks]}
  if(pairs.length>=2){const p1=pairs[0],p2=pairs[1],k=ranks.find(r=>r!==p1&&r!==p2)||0;return [2,p1,p2,k]}
  if(pairs.length===1){const p=pairs[0],ks=ranks.filter(r=>r!==p).slice(0,3);return [1,p,...ks]}
  return [0,...ranks.slice(0,5)]
}
function hhEquityOnBoard(players,board){
  const vals=players.map(p=>hhEval7([...p.cards,...board])),best=vals.reduce((a,v)=>!a||hhCmpVec(v,a)>0?v:a,null)
  const winners=[];vals.forEach((v,i)=>{if(hhCmpVec(v,best)===0)winners.push(i)})
  return winners.includes(0)?1/winners.length:0
}
function hhHashSeed(str){let h=2166136261>>>0;for(const ch of String(str)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function hhPrng(seed){let x=seed||123456789;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}}
function hhEquity(players,board,seed=''){
  const known=[...board,...players.flatMap(p=>p.cards)],deck=hhDeck(known),missing=5-board.length
  if(missing<0)return null
  if(missing===0)return {equity:hhEquityOnBoard(players,board),method:'exact',samples:1}
  let sum=0,samples=0
  if(missing===1){for(const a of deck){sum+=hhEquityOnBoard(players,[...board,a]);samples++};return {equity:sum/samples,method:'exact',samples}}
  if(missing===2){for(let i=0;i<deck.length-1;i++)for(let j=i+1;j<deck.length;j++){sum+=hhEquityOnBoard(players,[...board,deck[i],deck[j]]);samples++};return {equity:sum/samples,method:'exact',samples}}
  // Pre-flop: deterministic Monte Carlo. Stable between reloads; exact post-flop.
  const target=900,rng=hhPrng(hhHashSeed(seed+'|'+known.sort().join(',')))
  for(let n=0;n<target;n++){
    const pool=[...deck],run=[]
    for(let k=0;k<missing;k++){const i=Math.floor(rng()*pool.length);run.push(pool[i]);pool[i]=pool[pool.length-1];pool.pop()}
    sum+=hhEquityOnBoard(players,[...board,...run]);samples++
  }
  return {equity:sum/samples,method:'sampled',samples}
}
function hhContributionState(h){
  const contrib={},folded=new Set(),streetNow={};for(const s of h.seats)contrib[s.name]=0
  const add=(p,a)=>{contrib[p]=(contrib[p]||0)+(a||0)}
  for(const x of h.forcedActions||[]){if(x.type==='ante')add(x.player,x.amount);else if(['sb','bb'].includes(x.type)){add(x.player,x.amount);streetNow[x.player]=(streetNow[x.player]||0)+(x.amount||0)}}
  let street='preflop'
  for(const x of h.steps||[]){
    if(x.kind==='street'){if(x.street!==street){street=x.street;for(const k of Object.keys(streetNow))streetNow[k]=0}continue}
    if(x.type==='fold'){folded.add(x.player);continue}
    if(['call','bet'].includes(x.type)){add(x.player,x.amount);streetNow[x.player]=(streetNow[x.player]||0)+(x.amount||0)}
    else if(x.type==='raise'){const cur=streetNow[x.player]||0,target=x.to||cur+(x.amount||0),inc=Math.max(0,target-cur);add(x.player,inc);streetNow[x.player]=target}
    else if(x.type==='return'){add(x.player,-(x.amount||0));streetNow[x.player]=Math.max(0,(streetNow[x.player]||0)-(x.amount||0))}
  }
  return {contrib,folded}
}
function hhAllInEvFacts(h,netBb){
  const hero=h.hero,allinIndex=(h.steps||[]).findIndex(x=>x.kind==='action'&&x.player===hero&&/all-?in/i.test(x.text||''))
  const base={allin:false,allinContested:false,allinEvAvailable:false,allinEvBb:netBb,evDeltaBb:0,allinEquity:null,allinMethod:'none',allinStreet:'',allinPotBb:0}
  if(allinIndex<0||!h.bb||detectGameType(h)!=='holdem'||(h.heroCards||[]).length!==2)return base
  let board=[];for(let i=0;i<=allinIndex;i++){const x=h.steps[i];if(x.kind==='street')board=[...(x.board||[])]}
  const showCards={};for(const x of h.steps||[])if(x.kind==='action'&&x.type==='show'&&(x.cards||[]).length===2)showCards[x.player]=x.cards
  showCards[hero]=(h.heroCards||[]).slice(0,2)
  const {contrib,folded}=hhContributionState(h),levels=[...new Set(Object.values(contrib).filter(v=>v>0))].sort((a,b)=>a-b)
  let prev=0,expected=0,eligiblePot=0,weightedEq=0,methods=[],samples=0;const eqCache=new Map()
  for(const level of levels){
    const contributors=Object.keys(contrib).filter(p=>contrib[p]>=level),pot=(level-prev)*contributors.length;prev=level
    if(!(contrib[hero]>=level)||pot<=0)continue
    const eligible=contributors.filter(p=>!folded.has(p));if(!eligible.includes(hero)||eligible.length<2)continue
    if(eligible.some(p=>!(showCards[p]||[]).length||showCards[p].length!==2))return {...base,allin:true,allinContested:true,allinStreet:(h.steps[allinIndex]?.street||'preflop')}
    const players=[hero,...eligible.filter(p=>p!==hero)].map(p=>({name:p,cards:showCards[p]})),cacheKey=players.map(p=>p.name).sort().join('|');let eq=eqCache.get(cacheKey);if(!eq){eq=hhEquity(players,board,h.handId+'|'+cacheKey);eqCache.set(cacheKey,eq)}
    if(!eq)return {...base,allin:true,allinContested:false,allinStreet:(h.steps[allinIndex]?.street||'preflop')}
    expected+=pot*eq.equity;eligiblePot+=pot;weightedEq+=pot*eq.equity;methods.push(eq.method);samples+=eq.samples
  }
  if(!eligiblePot)return {...base,allin:true,allinContested:false,allinStreet:(h.steps[allinIndex]?.street||'preflop')}
  let collected=0;for(const x of h.steps||[])if(x.kind==='action'&&x.player===hero&&x.type==='collect')collected+=x.amount||0
  const adjusted=netBb+(expected-collected)/h.bb
  return {allin:true,allinContested:true,allinEvAvailable:true,allinEvBb:adjusted,evDeltaBb:adjusted-netBb,allinEquity:weightedEq/eligiblePot,allinMethod:methods.includes('sampled')?'sampled':'exact',allinStreet:(h.steps[allinIndex]?.street||'preflop'),allinPotBb:eligiblePot/h.bb,allinSamples:samples}
}

// --- V8.0.1 Preflop State Engine -------------------------------------------
// Reconstrói o estado da árvore antes da primeira decisão voluntária do Hero.
// O objetivo é fazer as oportunidades nascerem do estado do pote, e não apenas
// da existência genérica de uma ação de raise na Hand History.
function hhPreflopState(h){
  const hero=h.hero
  const pre=(h.steps||[]).filter(x=>x.kind==='action'&&x.street==='preflop')
  const decisionTypes=['fold','call','raise','check']
  const heroFirstIndex=pre.findIndex(x=>x.player===hero&&decisionTypes.includes(x.type))
  const heroFirst=heroFirstIndex>=0?pre[heroFirstIndex]:null
  const beforeHero=heroFirstIndex>=0?pre.slice(0,heroFirstIndex):pre
  const voluntary=beforeHero.filter(x=>['call','raise'].includes(x.type))
  const raises=beforeHero.filter(x=>x.type==='raise')
  const calls=beforeHero.filter(x=>x.type==='call')
  const incomingRaise=raises.length?raises[raises.length-1]:null
  const incomingAllIn=!!incomingRaise&&/all-?in/i.test(incomingRaise.text||'')
  let state='NO_DECISION'
  if(heroFirst){
    if(raises.length===0&&calls.length===0)state='UNOPENED'
    else if(raises.length===0&&calls.length>0)state='LIMPED'
    else if(raises.length===1)state=calls.some(x=>beforeHero.indexOf(x)>beforeHero.indexOf(raises[0]))?'FACING_OPEN_CALLERS':'FACING_OPEN'
    else if(raises.length===2)state='FACING_3BET'
    else if(raises.length===3)state='FACING_4BET'
    else if(raises.length>=4)state='FACING_5BET_PLUS'
  }
  if(incomingAllIn&&state.startsWith('FACING_'))state+='_SHOVE'
  return {pre,heroFirstIndex,heroFirst,beforeHero,voluntary,raises,calls,incomingRaise,incomingAllIn,state}
}

function heroHandFacts(h){
  const hero=h.hero;if(!hero)return null
  const acts=h.steps.filter(x=>x.kind==='action'),pre=acts.filter(x=>x.street==='preflop')
  const heroPre=pre.filter(x=>x.player===hero),pos=h.positionMap[hero]||''
  const vpip=heroPre.some(x=>['call','bet','raise'].includes(x.type)),pfr=heroPre.some(x=>x.type==='raise')

  const pf=hhPreflopState(h)
  const {heroFirstIndex,heroFirst,beforeHero,state}=pf
  const rfiOpp=!!heroFirst&&pos!=='BB'&&state==='UNOPENED'
  const rfi=rfiOpp&&heroFirst.type==='raise'
  const limpOpp=!!heroFirst&&state==='UNOPENED'&&['UTG','UTG+1','MP1','MP2','MP','HJ','CO','BTN','SB'].includes(pos)
  const limp=limpOpp&&heroFirst.type==='call'

  // Uma oportunidade de 3Bet exige exatamente um open válido antes da primeira
  // decisão do Hero. Limp-only = não; pote unopened = não; ação já em 3Bet = não;
  // open shove = não (não existe decisão normal de 3Bet a ser medida aqui).
  const threeBetOpp=!!heroFirst&&['FACING_OPEN','FACING_OPEN_CALLERS'].includes(state)&&!pf.incomingAllIn
  const threeBet=threeBetOpp&&heroFirst.type==='raise'
  const threeBetOutcome=threeBetOpp?(heroFirst.type==='raise'?(v76IsAllInAction(heroFirst)?'raise_ai':'raise_nai'):heroFirst.type):''
  const squeezeOpp=threeBetOpp&&state==='FACING_OPEN_CALLERS'
  const squeeze=squeezeOpp&&heroFirst.type==='raise'

  // Resposta do Hero depois de ELE ter sido o open raiser. Para existir uma
  // oportunidade válida de 4Bet, a 3Bet enfrentada precisa ser não-all-in.
  let heroInitialRaiser=false,faced3bet=false,foldTo3bet=false,call3bet=false,fourBet=false,fourBetOpp=false,fourBetOutcome=''
  const firstRaiseIndex=pre.findIndex(x=>x.type==='raise')
  if(firstRaiseIndex>=0&&pre[firstRaiseIndex].player===hero){
    heroInitialRaiser=true
    const secondRaiseIndex=pre.findIndex((x,i)=>i>firstRaiseIndex&&x.type==='raise'&&x.player!==hero)
    if(secondRaiseIndex>=0){
      const incoming3bet=pre[secondRaiseIndex]
      const decision=pre.find((x,i)=>i>secondRaiseIndex&&x.player===hero&&['fold','call','raise'].includes(x.type))
      if(decision){
        // V8.3.4 — F2 3Bet mede resposta APÓS RFI/open em pote unopened.
        // ISO raise sobre limper(s) -> reraise é outro spot e não entra em F2 3Bet nAI.
        // Mantemos a oportunidade de 4Bet independente aqui para não alterar silenciosamente
        // a família 4Bet nesta correção específica.
        const facedAfterRFI=!!rfi
        faced3bet=facedAfterRFI
        foldTo3bet=facedAfterRFI&&decision.type==='fold'
        call3bet=facedAfterRFI&&decision.type==='call'
        fourBetOpp=!/all-?in/i.test(incoming3bet.text||'')
        fourBet=fourBetOpp&&decision.type==='raise'
        fourBetOutcome=fourBetOpp?(decision.type==='raise'?(v76IsAllInAction(decision)?'raise_ai':'raise_nai'):decision.type):''
      }
    }
  }

  const stealOpp=rfiOpp&&['CO','BTN','SB'].includes(pos)
  const steal=stealOpp&&rfi

  let bbVsStealOpp=false,foldBbVsSteal=false,bbStealOpener='',bbStealResponse=''
  if(pos==='BB'){
    const ri=pre.findIndex(x=>x.type==='raise')
    if(ri>=0){
      const opener=pre[ri],opPos=h.positionMap[opener.player]||''
      const beforeOpen=pre.slice(0,ri)
      const cleanOpen=!beforeOpen.some(x=>['call','raise'].includes(x.type))
      const hi=pre.findIndex((x,i)=>i>ri&&x.player===hero&&['fold','call','raise'].includes(x.type))
      const between=hi>ri?pre.slice(ri+1,hi):[]
      const cleanToHero=!between.some(x=>['call','raise'].includes(x.type))
      if(cleanOpen&&cleanToHero&&['CO','BTN','SB'].includes(opPos)&&hi>ri&&!/all-?in/i.test(opener.text||'')){
        bbVsStealOpp=true
        bbStealOpener=opPos
        bbStealResponse=pre[hi].type
        foldBbVsSteal=pre[hi].type==='fold'
      }
    }
  }

  const lastPfr=[...pre].reverse().find(x=>x.type==='raise')?.player||''
  const heroFoldPre=pre.some(x=>x.player===hero&&x.type==='fold')
  const hasStreet=st=>h.steps.some(x=>x.kind==='street'&&x.street===st)
  const sawFlop=hasStreet('flop')&&!heroFoldPre

  const streetFirstHero=(street)=>{
    const a=acts.filter(x=>x.street===street),i=a.findIndex(x=>x.player===hero)
    return {a,i,first:i>=0?a[i]:null,before:i>=0?a.slice(0,i):a}
  }

  const flopInfo=streetFirstHero('flop')
  let cbetOpp=false,cbet=false
  if(sawFlop&&lastPfr===hero&&flopInfo.i>=0){
    const facedLead=flopInfo.before.some(x=>x.player!==hero&&['bet','raise'].includes(x.type))
    if(!facedLead){cbetOpp=true;cbet=flopInfo.first.type==='bet'}
  }

  let cbetTurnOpp=false,cbetTurn=false,cbetRiverOpp=false,cbetRiver=false
  const turnInfo=streetFirstHero('turn')
  if(cbet&&hasStreet('turn')&&turnInfo.i>=0){
    const facedLead=turnInfo.before.some(x=>x.player!==hero&&['bet','raise'].includes(x.type))
    if(!facedLead){cbetTurnOpp=true;cbetTurn=turnInfo.first.type==='bet'}
  }
  const riverInfo=streetFirstHero('river')
  if(cbetTurn&&hasStreet('river')&&riverInfo.i>=0){
    const facedLead=riverInfo.before.some(x=>x.player!==hero&&['bet','raise'].includes(x.type))
    if(!facedLead){cbetRiverOpp=true;cbetRiver=riverInfo.first.type==='bet'}
  }

  let facedCbetFlop=false,foldVsCbetFlop=false
  if(sawFlop&&lastPfr&&lastPfr!==hero){
    const flop=acts.filter(x=>x.street==='flop')
    const bi=flop.findIndex(x=>x.player===lastPfr&&x.type==='bet')
    if(bi>=0){
      const beforeBet=flop.slice(0,bi)
      const weirdLead=beforeBet.some(x=>x.player!==lastPfr&&['bet','raise'].includes(x.type))
      const hi=flop.findIndex((x,i)=>i>bi&&x.player===hero&&['fold','call','raise'].includes(x.type))
      if(!weirdLead&&hi>bi){
        facedCbetFlop=true
        foldVsCbetFlop=flop[hi].type==='fold'
      }
    }
  }

  const xrByStreet={flop:{opp:0,hit:0},turn:{opp:0,hit:0},river:{opp:0,hit:0}}
  for(const st of ['flop','turn','river']){
    const a=acts.filter(x=>x.street===st)
    for(let i=0;i<a.length;i++){
      if(a[i].player!==hero||a[i].type!=='check')continue
      let betSeen=false,response=null
      for(let j=i+1;j<a.length;j++){
        const y=a[j]
        if(y.player===hero){response=y;break}
        if(['bet','raise'].includes(y.type))betSeen=true
      }
      if(betSeen){
        xrByStreet[st].opp++
        if(response?.type==='raise')xrByStreet[st].hit++
      }
    }
  }
  const xrOppCount=xrByStreet.flop.opp+xrByStreet.turn.opp+xrByStreet.river.opp
  const xrCount=xrByStreet.flop.hit+xrByStreet.turn.hit+xrByStreet.river.hit

  const wentShowdown=acts.some(x=>x.player===hero&&x.type==='show')
  const won=acts.some(x=>x.player===hero&&x.type==='collect')

  let invested=0,returned=0,collected=0,street='preflop',streetContrib=0
  for(const x of h.forcedActions){
    if(x.player!==hero)continue
    if(x.type==='ante')invested+=x.amount||0
    else if(['sb','bb'].includes(x.type)){const a=x.amount||0;invested+=a;streetContrib+=a}
  }
  for(const x of acts){
    if(x.street!==street){street=x.street;streetContrib=0}
    if(x.player!==hero)continue
    if(['call','bet'].includes(x.type)){const a=x.amount||0;invested+=a;streetContrib+=a}
    else if(x.type==='raise'){
      const target=x.to||((x.amount||0)+streetContrib),add=Math.max(0,target-streetContrib)
      invested+=add;streetContrib=target
    }else if(x.type==='return')returned+=x.amount||0
    else if(x.type==='collect')collected+=x.amount||0
  }
  const netBb=h.bb?(collected+returned-invested)/h.bb:0
  const allinEv=hhAllInEvFacts(h,netBb)
  const stack=h.bb?((h.seats.find(x=>x.name===hero)?.stack||0)/h.bb):0
  const auditActions=acts.map(x=>({street:x.street,player:x.player,type:x.type,amount:x.amount||0,to:x.to||0,text:x.text||''}))
  const advanced=v76AdvancedFacts(h,{position:pos,threeBetOpp,threeBet,faced3bet,fourBetOpp,fourBet,sawFlop})
  const threeBetOpener=pf.raises?.[0]||null
  const threeBetOpenerPos=threeBetOpener?(h.positionMap[threeBetOpener.player]||''):''
  const heroStartChips=h.seats.find(x=>x.name===hero)?.stack||0
  const openerStartChips=threeBetOpener?h.seats.find(x=>x.name===threeBetOpener.player)?.stack||0:0
  const threeBetEffectiveBb=h.bb&&threeBetOpener?Math.min(heroStartChips,openerStartChips||heroStartChips)/h.bb:stack
  const threeBetOpenBb=h.bb&&threeBetOpener?Number((threeBetOpener.to||threeBetOpener.amount||0)/h.bb)||0:0
  const openerIndex=threeBetOpener?pf.beforeHero.indexOf(threeBetOpener):-1
  const threeBetCallerCount=openerIndex>=0?pf.beforeHero.slice(openerIndex+1).filter(x=>x.type==='call').length:0
  return {
    handId:h.handId,date:h.dateTime.slice(0,10).replace(/\//g,'-'),time:h.dateTime,game:detectGameType(h),
    position:pos,preflopState:pf.state,stack,players:h.seats.length,heroCards:(h.heroCards||[]).slice(0,2),board:h.board||[],bb:h.bb||0,
    threeBetOpenerPos,threeBetEffectiveBb,threeBetOpenBb,threeBetCallerCount,threeBetOutcome,fourBetOutcome,
    vpip,pfr,rfiOpp,rfi,limpOpp,limp,threeBetOpp,threeBet,squeezeOpp,squeeze,
    faced3bet,foldTo3bet,call3bet,fourBetOpp,fourBet,stealOpp,steal,bbVsStealOpp,foldBbVsSteal,bbStealOpener,bbStealResponse,
    cbetOpp,cbet,cbetTurnOpp,cbetTurn,cbetRiverOpp,cbetRiver,facedCbetFlop,foldVsCbetFlop,
    xrOppCount,xrCount,xrFlopOpp:xrByStreet.flop.opp,xrFlop:xrByStreet.flop.hit,
    xrTurnOpp:xrByStreet.turn.opp,xrTurn:xrByStreet.turn.hit,
    xrRiverOpp:xrByStreet.river.opp,xrRiver:xrByStreet.river.hit,
    sawFlop,wentShowdown,won,netBb,...allinEv,...advanced,auditActions
  }
}



// --- V7.6 Advanced LeakFinder facts ---------------------------------------
function v76IsAllInAction(x){return !!x&&/all-?in/i.test(x.text||'')}
function v76StreetActs(h,st){return (h.steps||[]).filter(x=>x.kind==='action'&&x.street===st)}
function v76DecisionAfter(a,start,player){for(let i=start+1;i<a.length;i++){const x=a[i];if(x.player===player&&['fold','call','raise','bet','check'].includes(x.type))return {x,i}}return null}
function v76PostflopRank(pos){return ({SB:0,BB:1,UTG:2,'UTG+1':3,MP1:4,MP2:5,MP:5,HJ:6,CO:7,BTN:8})[pos]??4}
function v76AdvancedFacts(h,basic){
  const hero=h.hero,acts=(h.steps||[]).filter(x=>x.kind==='action'),pre=acts.filter(x=>x.street==='preflop'),pos=basic.position
  const raises=pre.filter(x=>x.type==='raise'),heroRaises=pre.filter(x=>x.player===hero&&x.type==='raise')
  const firstRaise=raises[0]||null,secondRaise=raises[1]||null,thirdRaise=raises[2]||null,fourthRaise=raises[3]||null
  // V8.0.1: uma oportunidade nAI só existe se a agressão que chega ao Hero NÃO for all-in.
  // Ex.: open shove não é oportunidade de 3Bet nAI; open -> 3Bet shove não é oportunidade de 4Bet.
  const threeBetNAIOpp=(basic.threeBetOpp&&firstRaise&&!v76IsAllInAction(firstRaise))?1:0
  const threeBetNAI=(threeBetNAIOpp&&basic.threeBet&&heroRaises[0]&&!v76IsAllInAction(heroRaises[0]))?1:0
  let faced3betNAI=0,fold3betNAI=0
  if(basic.faced3bet&&secondRaise&&!v76IsAllInAction(secondRaise)){
    faced3betNAI=1
    const d=v76DecisionAfter(pre,pre.indexOf(secondRaise),hero)
    fold3betNAI=d?.x.type==='fold'?1:0
  }
  // 4Bet: o denominador exige que a 3Bet enfrentada permita uma decisão real de 4Bet.
  // Se a 3Bet já foi all-in, a mão não entra no denominador (nem como 'oportunidade perdida').
  const fourBetTotalOpp=(basic.fourBetOpp&&secondRaise&&!v76IsAllInAction(secondRaise))?1:0
  const fourBetTotal=(fourBetTotalOpp&&basic.fourBet)?1:0
  const fourBetNAI=(fourBetTotalOpp&&basic.fourBet&&thirdRaise&&thirdRaise.player===hero&&!v76IsAllInAction(thirdRaise))?1:0
  let fourBetNAIFoldOpp=0,fourBetNAIFold=0
  if(fourBetNAI){
    const nextRaise=pre.find((x,i)=>i>pre.indexOf(thirdRaise)&&x.type==='raise'&&x.player!==hero)
    if(nextRaise){const d=v76DecisionAfter(pre,pre.indexOf(nextRaise),hero);if(d){fourBetNAIFoldOpp=1;fourBetNAIFold=d.x.type==='fold'?1:0}}
  }
  // BvB — auditado V7.7. Só existe oportunidade quando toda a mesa folda até o SB.
  const isBlind=['SB','BB'].includes(pos)&&h.seats.length>=2
  const posOf=n=>h.positionMap[n]||''
  const sbName=h.seats.find(x=>posOf(x.name)==='SB')?.name||''
  const bbName=h.seats.find(x=>posOf(x.name)==='BB')?.name||''
  const nonBlindActionBefore=index=>pre.slice(0,index).some(x=>!['SB','BB'].includes(posOf(x.player))&&x.type!=='fold')
  let sbWalkOpp=0,sbWalk=0,sbLimpOpp=0,sbLimpRaiseOpp=0,sbLF=0,sbLR=0,sbLC=0,bbIsoNAIOpp=0,bbIsoNAI=0,bbIsoNAIFoldOpp=0,bbIsoNAIFold=0
  if(isBlind&&sbName&&bbName){
    const sbIndex=pre.findIndex(x=>x.player===sbName&&['fold','call','raise'].includes(x.type))
    const sbAction=sbIndex>=0?pre[sbIndex]:null
    const foldedToSb=!!sbAction&&!nonBlindActionBefore(sbIndex)
    if(pos==='SB'&&hero===sbName&&foldedToSb){
      sbWalkOpp=1
      sbWalk=sbAction.type==='fold'?1:0
      if(sbAction.type==='call'){
        sbLimpOpp=1
        const bbRaiseIndex=pre.findIndex((x,i)=>i>sbIndex&&x.player===bbName&&x.type==='raise')
        if(bbRaiseIndex>=0){
          const d=v76DecisionAfter(pre,bbRaiseIndex,hero)
          if(d){sbLimpRaiseOpp=1;sbLF=d.x.type==='fold'?1:0;sbLR=d.x.type==='raise'?1:0;sbLC=d.x.type==='call'?1:0}
        }
      }
    } else if(pos==='BB'&&hero===bbName&&foldedToSb&&sbAction?.type==='call'){
      bbIsoNAIOpp=1
      const d=v76DecisionAfter(pre,sbIndex,hero)
      if(d?.x.type==='raise'&&!v76IsAllInAction(d.x)){
        bbIsoNAI=1
        const lr=pre.find((x,i)=>i>d.i&&x.player===sbName&&x.type==='raise')
        if(lr){const hd=v76DecisionAfter(pre,pre.indexOf(lr),hero);if(hd){bbIsoNAIFoldOpp=1;bbIsoNAIFold=hd.x.type==='fold'?1:0}}
      }
    }
  }
  // Single-raised-pot topology and key postflop lines.
  const srp=raises.length===1&&basic.sawFlop
  const pfr=firstRaise?.player||'',pfrPos=h.positionMap[pfr]||''
  const flop=v76StreetActs(h,'flop'),turn=v76StreetActs(h,'turn'),river=v76StreetActs(h,'river')
  const activeAtFlop=new Set(h.seats.map(x=>x.name));for(const x of pre){if(x.type==='fold')activeAtFlop.delete(x.player)}
  const opponents=[...activeAtFlop].filter(x=>x!==hero),headsUp=opponents.length===1,opp=opponents[0]||'',oppPos=h.positionMap[opp]||''
  const heroIP=headsUp&&v76PostflopRank(pos)>v76PostflopRank(oppPos)
  const heroOOP=headsUp&&v76PostflopRank(pos)<v76PostflopRank(oppPos)
  const ipVsBB=srp&&headsUp&&pfr===hero&&oppPos==='BB'&&heroIP
  const bbVsIP=srp&&headsUp&&pos==='BB'&&pfr===opp&&heroOOP
  const oopSrp=srp&&headsUp&&pfr===hero&&heroOOP
  const multiway=srp&&opponents.length>=2
  const heroRank=v76PostflopRank(pos),oppRanks=opponents.map(n=>v76PostflopRank(h.positionMap[n]||''))
  const mwSandwich=multiway&&oppRanks.some(r=>r<heroRank)&&oppRanks.some(r=>r>heroRank)
  const heroIndex=(a)=>a.findIndex(x=>x.player===hero)
  const firstHero=(a)=>{const i=heroIndex(a);return i>=0?a[i]:null}
  const firstOppBetBeforeHero=(a)=>{const hi=heroIndex(a);return a.find((x,i)=>i>=0&&(hi<0||i<hi)&&x.player!==hero&&['bet','raise'].includes(x.type))||null}
  const heroRespAfter=(a,action)=>{const i=a.indexOf(action);return action?v76DecisionAfter(a,i,hero)?.x:null}
  let srpIpCbetOpp=0,srpIpCbet=0,srpIpBarrelTOpp=0,srpIpBarrelT=0,srpIpBarrelROpp=0,srpIpBarrelR=0,srpIpFoldXROpp=0,srpIpFoldXR=0,srpIpDelayOpp=0,srpIpDelay=0,srpIpDelayBarrelOpp=0,srpIpDelayBarrel=0,srpIpFProbeTOpp=0,srpIpFProbeT=0,srpIpRaiseProbeTOpp=0,srpIpRaiseProbeT=0,srpIpFProbeROpp=0,srpIpFProbeR=0,srpIpFDonkOpp=0,srpIpFDonk=0,srpIpBxBOpp=0,srpIpBxB=0
  if(ipVsBB){
    const hf=firstHero(flop),lead=firstOppBetBeforeHero(flop)
    if(hf&&!lead){srpIpCbetOpp=1;srpIpCbet=hf.type==='bet'?1:0}
    if(srpIpCbet){
      const xr=flop.find((x,i)=>i>flop.indexOf(hf)&&x.player===opp&&x.type==='raise');if(xr){const r=heroRespAfter(flop,xr);if(r){srpIpFoldXROpp=1;srpIpFoldXR=r.type==='fold'?1:0}}
      const ht=firstHero(turn),leadT=firstOppBetBeforeHero(turn);if(ht&&!leadT){srpIpBarrelTOpp=1;srpIpBarrelT=ht.type==='bet'?1:0}
      if(srpIpBarrelT){const hr=firstHero(river),leadR=firstOppBetBeforeHero(river);if(hr&&!leadR){srpIpBarrelROpp=1;srpIpBarrelR=hr.type==='bet'?1:0}}
    }
    if(hf?.type==='check'){
      const ht=firstHero(turn),leadT=firstOppBetBeforeHero(turn);if(ht&&!leadT){srpIpDelayOpp=1;srpIpDelay=ht.type==='bet'?1:0}
      const probe=turn.find(x=>x.player===opp&&x.type==='bet');if(probe){const r=heroRespAfter(turn,probe);if(r){srpIpFProbeTOpp=1;srpIpFProbeT=r.type==='fold'?1:0;srpIpRaiseProbeTOpp=1;srpIpRaiseProbeT=r.type==='raise'?1:0}}
    }
    if(srpIpDelay){const hr=firstHero(river),leadR=firstOppBetBeforeHero(river);if(hr&&!leadR){srpIpDelayBarrelOpp=1;srpIpDelayBarrel=hr.type==='bet'?1:0}}
    const probeR=river.find(x=>x.player===opp&&x.type==='bet');if(probeR){const r=heroRespAfter(river,probeR);if(r){srpIpFProbeROpp=1;srpIpFProbeR=r.type==='fold'?1:0}}
    const donk=flop.find((x,i)=>x.player===opp&&x.type==='bet'&&(heroIndex(flop)<0||i<heroIndex(flop)));if(donk){const r=heroRespAfter(flop,donk);if(r){srpIpFDonkOpp=1;srpIpFDonk=r.type==='fold'?1:0}}
    if(srpIpCbet&&turn.length){const ht=firstHero(turn);if(ht?.type==='check'){const hr=firstHero(river);if(hr){srpIpBxBOpp=1;srpIpBxB=hr.type==='bet'?1:0}}}
  }
  let bbFcbOpp=0,bbFcb=0,bbXRopp=0,bbXR=0,bbProbeTOpp=0,bbProbeT=0,bbProbeBarrelROpp=0,bbProbeBarrelR=0,bbProbeROpp=0,bbProbeR=0,bbDonkFOpp=0,bbDonkF=0,bbDonkTOpp=0,bbDonkT=0
  if(bbVsIP){
    const hf=firstHero(flop)
    const cbet=flop.find(x=>x.player===opp&&x.type==='bet')
    let flopCbetResponse=null
    if(cbet){const r=heroRespAfter(flop,cbet);if(r){flopCbetResponse=r;bbFcbOpp=1;bbFcb=r.type==='fold'?1:0}}
    const hc=flop.find(x=>x.player===hero&&x.type==='check')
    if(hc){const bet=flop.find((x,i)=>i>flop.indexOf(hc)&&x.player===opp&&x.type==='bet');if(bet){const r=heroRespAfter(flop,bet);if(r){bbXRopp=1;bbXR=r.type==='raise'?1:0}}}
    // Probe turn: flop obrigatoriamente check/check; não confundir com donk turn.
    const flopHeroCheck=hf?.type==='check'
    const flopVillainAfterCheck=flopHeroCheck?flop.find((x,i)=>i>flop.indexOf(hf)&&x.player===opp&&['bet','check'].includes(x.type)):null
    const flopCheckedThrough=flopHeroCheck&&flopVillainAfterCheck?.type==='check'
    if(flopCheckedThrough){
      const ht=firstHero(turn);if(ht){bbProbeTOpp=1;bbProbeT=ht.type==='bet'?1:0}
      if(bbProbeT){const hr=firstHero(river);if(hr){bbProbeBarrelROpp=1;bbProbeBarrelR=hr.type==='bet'?1:0}}
      // Probe river: flop e turn precisam terminar sem aposta do agressor; turn check/check.
      const htRiverProbe=firstHero(turn),villT=htRiverProbe?.type==='check'?turn.find((x,i)=>i>turn.indexOf(htRiverProbe)&&x.player===opp&&['bet','check'].includes(x.type)):null
      if(htRiverProbe?.type==='check'&&villT?.type==='check'){const hr=firstHero(river);if(hr){bbProbeROpp=1;bbProbeR=hr.type==='bet'?1:0}}
    }
    // Donk flop: lead do BB antes do agressor pré-flop.
    if(hf){bbDonkFOpp=1;bbDonkF=hf.type==='bet'?1:0}
    // Donk turn: Hero apenas pode donkar turn após pagar a CBet flop; check-through gera probe, não donk.
    if(flopCbetResponse?.type==='call'){
      const ht=firstHero(turn);if(ht){bbDonkTOpp=1;bbDonkT=ht.type==='bet'?1:0}
    }
  }
  // Generic OOP SRP and multiway sandwich signals (core subset).
  let oopCbetOpp=0,oopCbet=0,oopDelayOpp=0,oopDelay=0,oopXFOpp=0,oopXF=0
  if(oopSrp){const hf=firstHero(flop);if(hf){oopCbetOpp=1;oopCbet=hf.type==='bet'?1:0;if(hf.type==='check'){const bet=flop.find((x,i)=>i>flop.indexOf(hf)&&x.player!==hero&&x.type==='bet');if(bet){const r=heroRespAfter(flop,bet);if(r){oopXFOpp=1;oopXF=r.type==='fold'?1:0}} const ht=firstHero(turn);if(ht){oopDelayOpp=1;oopDelay=ht.type==='bet'?1:0}}}}
  let mwCbetOpp=0,mwCbet=0,mwDelayOpp=0,mwDelay=0
  if(mwSandwich&&pfr===hero){const hf=firstHero(flop);if(hf){mwCbetOpp=1;mwCbet=hf.type==='bet'?1:0;if(hf.type==='check'){const ht=firstHero(turn);if(ht){mwDelayOpp=1;mwDelay=ht.type==='bet'?1:0}}}}
  return {threeBetNAIOpp,threeBetNAI,faced3betNAI,fold3betNAI,fourBetTotalOpp,fourBetTotal,fourBetNAI,fourBetNAIFoldOpp,fourBetNAIFold,
    sbWalkOpp,sbWalk,sbLimpOpp,sbLimpRaiseOpp,sbLF,sbLR,sbLC,bbIsoNAIOpp,bbIsoNAI,bbIsoNAIFoldOpp,bbIsoNAIFold,
    srpIpCbetOpp,srpIpCbet,srpIpBarrelTOpp,srpIpBarrelT,srpIpBarrelROpp,srpIpBarrelR,srpIpFoldXROpp,srpIpFoldXR,srpIpDelayOpp,srpIpDelay,srpIpDelayBarrelOpp,srpIpDelayBarrel,srpIpFProbeTOpp,srpIpFProbeT,srpIpRaiseProbeTOpp,srpIpRaiseProbeT,srpIpFProbeROpp,srpIpFProbeR,srpIpFDonkOpp,srpIpFDonk,srpIpBxBOpp,srpIpBxB,
    bbFcbOpp,bbFcb,bbXRopp,bbXR,bbProbeTOpp,bbProbeT,bbProbeBarrelROpp,bbProbeBarrelR,bbProbeROpp,bbProbeR,bbDonkFOpp,bbDonkF,bbDonkTOpp,bbDonkT,
    oopCbetOpp,oopCbet,oopDelayOpp,oopDelay,oopXFOpp,oopXF,mwCbetOpp,mwCbet,mwDelayOpp,mwDelay,
    srp,ipVsBB,bbVsIP,oopSrp,multiway,mwSandwich,pfrPos,oppPos}
}

function aggregateHhStats(facts){
  const n=facts.length,bool=k=>facts.filter(x=>x[k]).length,num=k=>facts.reduce((a,x)=>a+(+x[k]||0),0),rate=(a,b)=>b?100*a/b:0
  const counts={
    vpip:bool('vpip'),pfr:bool('pfr'),
    rfi:bool('rfi'),rfiOpp:bool('rfiOpp'),limp:bool('limp'),limpOpp:bool('limpOpp'),
    threeBet:num('threeBet'),threeBetOpp:num('threeBetOpp'),squeeze:bool('squeeze'),squeezeOpp:bool('squeezeOpp'),
    fold3:bool('foldTo3bet'),call3:bool('call3bet'),faced3bet:bool('faced3bet'),fourBet:bool('fourBet'),fourBetOpp:bool('fourBetOpp'),
    steal:bool('steal'),stealOpp:bool('stealOpp'),foldBbSteal:bool('foldBbVsSteal'),bbStealOpp:bool('bbVsStealOpp'),
    cbet:bool('cbet'),cbetOpp:bool('cbetOpp'),cbetT:bool('cbetTurn'),cbetTOpp:bool('cbetTurnOpp'),
    cbetR:bool('cbetRiver'),cbetROpp:bool('cbetRiverOpp'),foldCbetF:bool('foldVsCbetFlop'),facedCbetF:bool('facedCbetFlop'),
    xr:num('xrCount'),xrOpp:num('xrOppCount'),xrF:num('xrFlop'),xrFOpp:num('xrFlopOpp'),
    xrT:num('xrTurn'),xrTOpp:num('xrTurnOpp'),xrR:num('xrRiver'),xrROpp:num('xrRiverOpp'),
    sawFlop:bool('sawFlop'),wtsd:bool('wentShowdown'),
    wsd:facts.filter(x=>x.wentShowdown&&x.won).length,wwsf:facts.filter(x=>x.sawFlop&&x.won).length
  }
  const bb=facts.reduce((a,x)=>a+x.netBb,0),evBb=facts.reduce((a,x)=>a+(Number.isFinite(x.allinEvBb)?x.allinEvBb:x.netBb),0)
  const allins=facts.filter(x=>x.allinContested),allinAvail=allins.filter(x=>x.allinEvAvailable),allinExact=allinAvail.filter(x=>x.allinMethod==='exact').length,allinSampled=allinAvail.filter(x=>x.allinMethod==='sampled').length
  return {
    hands:n,counts,
    vpip:rate(counts.vpip,n),pfr:rate(counts.pfr,n),rfi:rate(counts.rfi,counts.rfiOpp),limp:rate(counts.limp,counts.limpOpp),
    threeBet:rate(counts.threeBet,counts.threeBetOpp),squeeze:rate(counts.squeeze,counts.squeezeOpp),
    fold3:rate(counts.fold3,counts.faced3bet),call3:rate(counts.call3,counts.faced3bet),fourBet:rate(counts.fourBet,counts.fourBetOpp),
    steal:rate(counts.steal,counts.stealOpp),foldBbSteal:rate(counts.foldBbSteal,counts.bbStealOpp),
    cbet:rate(counts.cbet,counts.cbetOpp),cbetT:rate(counts.cbetT,counts.cbetTOpp),cbetR:rate(counts.cbetR,counts.cbetROpp),
    foldCbetF:rate(counts.foldCbetF,counts.facedCbetF),
    xr:rate(counts.xr,counts.xrOpp),xrF:rate(counts.xrF,counts.xrFOpp),xrT:rate(counts.xrT,counts.xrTOpp),xrR:rate(counts.xrR,counts.xrROpp),
    wtsd:rate(counts.wtsd,counts.sawFlop),wsd:rate(counts.wsd,counts.wtsd),wwsf:rate(counts.wwsf,counts.sawFlop),
    bb100:n?bb/n*100:0,totalBb:bb,evbb100:n?evBb/n*100:0,totalEvBb:evBb,allinCount:allins.length,allinAvailable:allinAvail.length,allinExact,allinSampled
  }
}



// --- V7.6 LeakFinder benchmark engine --------------------------------------
// Benchmarks transcritos da referência H2N fornecida pelo usuário.
// Só classificamos stats/contextos explicitamente suportados pela referência.
const V75_BENCHMARKS={
  overall:{
    vpip:{min:29,max:32,label:'VPIP'},
    pfr:{min:20,max:24,label:'PFR'},
    threeBet:{min:10,max:11,label:'3Bet'},
    wwsf:{min:46,max:null,label:'WWSF'}
  },
  rfi:{
    UTG:{min:18,max:20,label:'RFI EP/UTG'},
    HJ:{min:28,max:30,label:'RFI HJ'},
    CO:{min:37,max:39,label:'RFI CO'},
    BTN:{min:50,max:55,label:'RFI BTN'},
    SB:{min:40,max:50,label:'RFI SB'}
  },
  threeBet:{
    UTG:{min:6,max:7,label:'3Bet total EP/UTG'},
    HJ:{min:8,max:9,label:'3Bet total HJ'},
    CO:{min:9,max:10,label:'3Bet total CO'},
    BTN:{min:10,max:11,label:'3Bet total BTN'},
    SB:{min:10,max:15,label:'3Bet total SB'},
    BB:{min:10,max:15,label:'3Bet total BB'}
  }
}
const V75_MIN_SAMPLE={overall:500,rate:100}
function v75RangeText(b){if(!b)return '';if(b.max==null)return `${b.min}%+`;if(b.min==null)return `até ${b.max}%`;return `${b.min}–${b.max}%`}
function v75Benchmark(scope,key,pos='all'){
  if(scope==='overall')return V75_BENCHMARKS.overall[key]||null
  const group=V75_BENCHMARKS[scope]||{};return group[pos]||null
}
function v75Classify(value,den,b,kind='rate'){
  if(!b)return {state:'neutral',label:'Sem benchmark',range:''}
  const minSample=kind==='overall'?V75_MIN_SAMPLE.overall:V75_MIN_SAMPLE.rate
  if(!den||den<minSample)return {state:'sample',label:'Amostra insuficiente',range:v75RangeText(b)}
  if(b.min!=null&&value<b.min)return {state:'tight',label:'Too Tight',range:v75RangeText(b)}
  if(b.max!=null&&value>b.max)return {state:'aggro',label:'Aggro',range:v75RangeText(b)}
  return {state:'great',label:'Great',range:v75RangeText(b)}
}
function v75BenchBadge(info){if(!info||info.state==='neutral')return '';return `<span class="v75-bench-label ${info.state}" title="Faixa de referência: ${info.range}"><i></i>${info.label}<em>${info.range}</em></span>`}
function statCard(label,value,sub=''){return `<div class="stat-card"><small>${label}</small><strong>${value}</strong>${sub?`<span>${sub}</span>`:''}</div>`}
function auditStatCard(label,value,sub,metric,pos='all'){return `<button class="stat-card stat-card-button" data-audit-metric="${metric}" data-audit-pos="${pos}"><small>${label}</small><strong>${value}</strong>${sub?`<span>${sub}</span>`:''}<em>Ver mãos →</em></button>`}
function hhGameLabel(k){return ({holdem:"NL Hold'em",omaha:'PLO / Omaha',plo5:'PLO5 / Omaha 5',other:'Outros',all:'Todas'})[k]||k}
function hhstats(){return `<div class="panel"><div class="hhstats-head"><div><h2>HH Stats <span class="pill good">TRACKER CORE</span></h2><p class="muted">Motor V8.1: oportunidades pré-flop auditadas + triagem estratégica beta para revisão de 3Bet.</p></div><div class="toolbar"><input id="hhStatsFiles" type="file" accept=".txt,text/plain" multiple hidden><input id="hhStatsFolder" type="file" accept=".txt,text/plain" webkitdirectory directory multiple hidden><button class="btn" id="pickHhStatsFiles">📄 Selecionar vários arquivos</button><button class="btn" id="pickHhStatsFolder">📁 Importar pasta inteira</button><button class="btn secondary" id="clearHhStats">Limpar</button></div></div><div id="hhStatsStatus" class="muted">As HH já salvas serão recalculadas automaticamente; não é necessário reimportar.</div></div><div class="panel hhstats-filter-panel"><div class="hhstats-filters hhstats-filters-v2"><label>Modalidade<select id="hhGameFilter"><option value="holdem">NL Hold'em</option><option value="omaha">PLO / Omaha</option><option value="plo5">PLO5 / Omaha 5</option><option value="other">Outros</option><option value="all">Todas as modalidades</option></select></label><label>Posição<select id="hhPositionFilter"><option value="all">Todas</option><option>UTG</option><option>UTG+1</option><option>MP1</option><option>MP2</option><option>MP</option><option>HJ</option><option>CO</option><option>BTN</option><option>SB</option><option>BB</option></select></label><label>Stack do Hero<select id="hhStackFilter"><option value="all">Todos</option><option value="0-10">≤ 10bb</option><option value="10-15">10–15bb</option><option value="15-25">15–25bb</option><option value="25-40">25–40bb</option><option value="40+">40bb+</option></select></label><label>Jogadores<select id="hhPlayersFilter"><option value="all">Todos</option><option value="2">2-max</option><option value="3">3-max</option><option value="4">4-max</option><option value="5">5-max</option><option value="6">6-max</option><option value="7">7-max</option><option value="8">8-max</option><option value="9">9-max</option></select></label><label>Data inicial<input id="hhDateStart" type="date"></label><label>Data final<input id="hhDateEnd" type="date"></label><button class="btn secondary" id="clearHhFilters">Limpar filtros</button></div><div id="hhFilterSummary" class="muted"></div></div><div id="hhStatsView"><div class="panel"><p class="muted">Carregando banco local de mãos...</p></div></div>`}
function hhRateSub(a,b,label='oportunidades'){return `${a.toLocaleString('pt-BR')} / ${b.toLocaleString('pt-BR')} ${label}`}
function hhPctDisplay(v,den){return den?`${v.toFixed(1)}%`:'—'}

function trackerCell(label,value,sample,metric,pos='all',tone='',benchInfo=null){
  const clickable=metric?`data-audit-metric="${metric}" data-audit-pos="${pos}"`:''
  const bench=benchInfo||{state:'neutral',label:'',range:''}
  const tip=bench.state!=='neutral'?`title="${bench.label} · referência ${bench.range}"`:''
  return `<button class="v7-stat-row ${tone} bench-${bench.state}" ${clickable} ${tip}><span>${label}</span><b>${bench.state!=='neutral'?'<i></i>':''}${value}</b><small>${sample}${bench.state!=='neutral'?`<em>${bench.label} · ${bench.range}</em>`:''}</small></button>`
}
function trackerPosRows(facts,metric,valueKey,oppKey,hitKey,positions=['UTG','HJ','CO','BTN','SB','BB']){
  return positions.map(pos=>{
    const a=facts.filter(x=>x.position===pos);if(!a.length)return ''
    const z=aggregateHhStats(a),c=z.counts
    const map={rfi:['rfi','rfiOpp'],threeBet:['threeBet','threeBetOpp'],call3:['call3','faced3bet'],fold3:['fold3','faced3bet'],squeeze:['squeeze','squeezeOpp'],fourBet:['fourBet','fourBetOpp'],steal:['steal','stealOpp'],foldBbSteal:['foldBbSteal','bbStealOpp'],cbet:['cbet','cbetOpp'],cbetT:['cbetT','cbetTOpp'],cbetR:['cbetR','cbetROpp'],foldCbetF:['foldCbetF','facedCbetF'],xrF:['xrF','xrFOpp'],xrT:['xrT','xrTOpp'],xrR:['xrR','xrROpp']}
    const [numK,denK]=map[valueKey]||[];const den=denK?c[denK]:a.length;const valNum=den?z[valueKey]:0;const val=den?`${valNum.toFixed(1)}%`:'—'
    let bench=null
    if(valueKey==='rfi')bench=v75Classify(valNum,den,v75Benchmark('rfi','',pos))
    if(valueKey==='threeBet')bench=v75Classify(valNum,den,v75Benchmark('threeBet','',pos))
    return trackerCell(pos,val,den?den.toLocaleString('pt-BR'):'—',metric,pos,'',bench)
  }).join('')
}
function trackerPanel(title,body,wide='',metric=''){
  const inferred=metric||({'RFI (OPEN RAISE)':'rfi','3BET':'3bet','CALL 3BET':'call3','FOLD TO 3BET':'fold3','SQUEEZE':'squeeze','STEAL (CO/BTN/SB)':'steal','FOLD BB VS STEAL':'foldbbsteal','4BET APÓS OPEN':'4bet','C-BET FLOP (SRP)':'cbet','C-BET TURN (BARREL)':'cbett','C-BET RIVER (BARREL)':'cbetr','FOLD VS C-BET FLOP':'foldcbetf','CHECK-RAISE':'xr'})[title]||''
  return `<section class="v7-panel ${wide}"><header><b>${title}</b>${inferred?`<button class="v72-more" data-audit-metric="${inferred}" data-audit-pos="all">Ver mais →</button>`:'<span></span>'}</header><div class="v7-panel-body">${body}</div></section>`
}
function v71BbVsSteal(facts){
  const rows=['CO','BTN','SB'].map(op=>{
    const a=facts.filter(x=>x.position==='BB'&&x.bbVsStealOpp&&x.bbStealOpener===op),n=a.length
    const cnt=t=>a.filter(x=>x.bbStealResponse===t).length
    const cell=(lab,t)=>{const k=cnt(t),v=n?(k/n*100).toFixed(1)+'%':'—';return `<button class="v71-spot-cell" data-v71-bb-opener="${op}" data-v71-response="${t}"><small>${lab}</small><b>${v}</b><span>${k.toLocaleString('pt-BR')} / ${n.toLocaleString('pt-BR')}</span></button>`}
    return `<div class="v71-bb-group"><header>BB vs ${op}</header><div>${cell('FOLD','fold')}${cell('CALL','call')}${cell('3BET','raise')}</div></div>`
  }).join('')
  return `<section class="v71-bb-panel"><header><b>BB VS STEAL — DEFESA POR POSIÇÃO DO OPENER</b><span>Células usam apenas oportunidades reais</span></header><div class="v71-bb-grid">${rows}</div></section>`
}
function v71SideRail(){return `<aside class="v71-side">
  <section><h4>LEGENDA DE DESEMPENHO</h4><div class="v71-legend"><p><i class="aggro"></i><b>Aggro</b><small>acima da faixa de referência</small></p><p><i class="great"></i><b>Great</b><small>dentro da faixa de referência</small></p><p><i class="tight"></i><b>Too Tight</b><small>abaixo da faixa de referência</small></p><p><i class="sample"></i><b>Amostra insuficiente</b><small>sem classificação</small></p></div><div class="v71-calibration">V8.1: benchmarks validados + triagem estratégica beta para 3Bet. Cinza significa amostra insuficiente.</div></section>
  <section><h4>AÇÕES RÁPIDAS</h4><div class="v71-actions"><button data-v71-action="pdf">▤ Relatório completo (PDF)</button><button data-v71-action="csv">▧ Exportar para CSV</button><button data-v71-action="evolution">⌁ Gráfico de evolução</button><button data-v71-action="compare">◫ Comparar períodos</button><button data-v71-action="notes">▱ Notas e marcações</button></div></section>
  <section class="v71-tip"><h4>ⓘ DICA</h4><p>Clique em qualquer estatística para ver o detalhamento e abrir as mãos no Replayer.</p><strong>♠</strong></section>
</aside>`}

// --- V7.6 benchmark library + compact advanced panels ----------------------
const V76_BENCH={
  threeBetNAI:{UTG:[5,6],MP:[5.5,6.5],HJ:[6,7],CO:[6.5,7.5],BTN:[7,8],SB:[8,null],BB:[7,null]},
  fold3betNAI:{UTG:[45,50],MP:[45,50],HJ:[45,50],CO:[45,50],BTN:[45,55],SB:[50,60]},
  fourBetNAI:{ALL:[6,7]},fourBetTotal:{ALL:[18,20]},
  srpIp:{cbet:[80,90],barrelT:[55,65],barrelR:[50,60],foldXR:[35,40],delay:[55,null],delayBarrel:[50,null],fProbeT:[null,40],raiseProbeT:[10,null],fProbeR:[50,60],fDonk:[null,25],bxb:[40,null]},
  bbIp:{foldCbet:[40,45],xr:[18,null],probeT:[40,null],probeBarrelR:[65,null],probeR:[50,null],donkF:[2,4],donkT:[10,15]},
  oop:{cbet:[35,45],delay:[50,null],xr:[15,null],xf:[30,40]},
  mw:{cbet:[35,45],delay:[40,50]},
  bvb:{sbWalk:[null,15],sbLF:[40,50],sbLR:[10,15],sbLC:[40,50],bbIso:[40,null],bbIsoFold:[55,65]},
  result:{bb100:[6,null],redline:[-6,null]}
}
function v76StrategicDirection(label=''){const x=String(label).toUpperCase();return (/^(F2|FOLD)|X\/F|SB WALK|SB L\/F|ISO NAI\/F/.test(x))?'inverse':'normal'}
function v76BenchObj(a,label='',direction=null){if(!a)return null;return {min:a[0],max:a[1],label,direction:direction||v76StrategicDirection(label)}}
function v76Class(value,den,b,minSample=30){
  if(!b)return {state:'neutral',label:'',range:''}
  if(den<minSample)return {state:'sample',label:'Amostra insuficiente',range:v75RangeText(b)}
  const inverse=b.direction==='inverse'
  if(b.min!=null&&value<b.min)return {state:inverse?'aggro':'tight',label:inverse?'Aggro':'Too Tight',range:v75RangeText(b)}
  if(b.max!=null&&value>b.max)return {state:inverse?'tight':'aggro',label:inverse?'Too Tight':'Aggro',range:v75RangeText(b)}
  return {state:'great',label:'Great',range:v75RangeText(b)}
}
function v76Sum(f,k){return f.reduce((a,x)=>a+(+x[k]||0),0)}
function v76Rate(f,hit,opp){const d=v76Sum(f,opp),n=v76Sum(f,hit);return {n,d,v:d?100*n/d:0}}

function v77AdvMetric(hit,opp,label,street='all'){return `adv|${hit}|${opp}|${street}|${encodeURIComponent(label)}`}
function v76Row(label,r,bench=null,metric='',pos='all'){
  const b=v76Class(r.v,r.d,bench,20)
  return trackerCell(label,r.d?r.v.toFixed(1)+'%':'—',r.d?r.d.toLocaleString('pt-BR'):'—',metric,pos,'',b)
}
function v76PositionGroup(pos){if(pos==='UTG'||pos==='UTG+1')return 'UTG';if(['MP1','MP2','MP'].includes(pos))return 'MP';return pos}
function v76RowsByPos(f,hit,opp,benchGroup,positions=['UTG','MP','HJ','CO','BTN','SB','BB']){
  return positions.map(p=>{const a=f.filter(x=>v76PositionGroup(x.position)===p),r=v76Rate(a,hit,opp),b=v76BenchObj(benchGroup?.[p],`${hit} ${p}`);return v76Row(p,r,b,v77AdvMetric(hit,opp,`${hit} ${p}`,'preflop'),p)}).join('')
}
function v76Redline100(f){const n=f.length||1,bb=f.filter(x=>!x.wentShowdown).reduce((a,x)=>a+(+x.netBb||0),0);return bb/n*100}

function v78LeakPriority(value,den,b,importance=1,minSample=20){
  const cls=v76Class(value,den,b,minSample)
  if(!b||!den)return {...cls,score:0,distance:0}
  let distance=0
  if(b.min!=null&&value<b.min)distance=b.min-value
  else if(b.max!=null&&value>b.max)distance=value-b.max
  const width=(b.min!=null&&b.max!=null)?Math.max(1,b.max-b.min):Math.max(5,Math.abs((b.min??b.max??10))*0.25)
  const sampleFactor=Math.min(1,Math.log10(Math.max(10,den)+1)/3)
  return {...cls,score:(distance/width)*(0.55+0.45*sampleFactor)*importance,distance}
}
function v78LeakEntries(f){
  const out=[],push=(group,statLabel,value,den,bench,metric,pos='all',importance=1,minSample=20)=>{if(!bench)return;const c=v78LeakPriority(value,den,bench,importance,minSample);out.push({group,statLabel,value,den,bench,metric,pos,diagnosis:c.label,...c})}
  const s=aggregateHhStats(f),c=s.counts
  push('Geral','VPIP',s.vpip,s.hands,v75Benchmark('overall','vpip'),'vpip','all',1.15,500)
  push('Geral','PFR',s.pfr,s.hands,v75Benchmark('overall','pfr'),'pfr','all',1.15,500)
  push('Geral','3Bet',s.threeBet,c.threeBetOpp,v75Benchmark('overall','threeBet'),'3bet','all',1.1,100)
  push('Geral','WWSF',s.wwsf,c.sawFlop,v75Benchmark('overall','wwsf'),'wwsf','all',1.0,500)
  for(const pos of ['UTG','HJ','CO','BTN','SB']){const a=f.filter(x=>x.position===pos),z=aggregateHhStats(a);push('RFI',`RFI ${pos}`,z.rfi,z.counts.rfiOpp,v75Benchmark('rfi','',pos),'rfi',pos,1.2,100)}
  for(const pos of ['UTG','HJ','CO','BTN','SB','BB']){const a=f.filter(x=>x.position===pos),z=aggregateHhStats(a);push('3Bet total',`3Bet ${pos}`,z.threeBet,z.counts.threeBetOpp,v75Benchmark('threeBet','',pos),'3bet',pos,1.15,100)}
  for(const pos of ['UTG','MP','HJ','CO','BTN','SB','BB']){const a=f.filter(x=>v76PositionGroup(x.position)===pos),r=v76Rate(a,'threeBetNAI','threeBetNAIOpp');push('3Bet nAI',`3Bet nAI ${pos}`,r.v,r.d,v76BenchObj(V76_BENCH.threeBetNAI[pos],`3Bet nAI ${pos}`),v77AdvMetric('threeBetNAI','threeBetNAIOpp',`3Bet nAI ${pos}`,'preflop'),pos,1.1,20)}
  for(const pos of ['UTG','MP','HJ','CO','BTN','SB']){const a=f.filter(x=>v76PositionGroup(x.position)===pos),r=v76Rate(a,'fold3betNAI','faced3betNAI');push('Fold 3Bet nAI',`F2 3Bet nAI ${pos}`,r.v,r.d,v76BenchObj(V76_BENCH.fold3betNAI[pos],`F2 3Bet nAI ${pos}`,'inverse'),v77AdvMetric('fold3betNAI','faced3betNAI',`F2 3Bet nAI ${pos}`,'preflop'),pos,1.05,20)}
  let r=v76Rate(f,'fourBetNAI','fourBetTotalOpp');push('4Bet','4Bet nAI',r.v,r.d,v76BenchObj(V76_BENCH.fourBetNAI.ALL,'4Bet nAI'),v77AdvMetric('fourBetNAI','fourBetTotalOpp','4Bet nAI','preflop'),'all',1.05,20)
  r=v76Rate(f,'fourBetTotal','fourBetTotalOpp');push('4Bet','4Bet total',r.v,r.d,v76BenchObj(V76_BENCH.fourBetTotal.ALL,'4Bet total'),v77AdvMetric('fourBetTotal','fourBetTotalOpp','4Bet total','preflop'),'all',1.0,20)
  const adv=[
    ['SRP IP vs BB','CBet Flop SRP','srpIpCbet','srpIpCbetOpp',V76_BENCH.srpIp.cbet,'flop'],['SRP IP vs BB','Barrel Turn','srpIpBarrelT','srpIpBarrelTOpp',V76_BENCH.srpIp.barrelT,'turn'],['SRP IP vs BB','Barrel River','srpIpBarrelR','srpIpBarrelROpp',V76_BENCH.srpIp.barrelR,'river'],['SRP IP vs BB','F2 XR','srpIpFoldXR','srpIpFoldXROpp',V76_BENCH.srpIp.foldXR,'flop'],['SRP IP vs BB','Delay CBet','srpIpDelay','srpIpDelayOpp',V76_BENCH.srpIp.delay,'turn'],['SRP IP vs BB','F2 Probe Turn','srpIpFProbeT','srpIpFProbeTOpp',V76_BENCH.srpIp.fProbeT,'turn'],['SRP IP vs BB','Raise Probe Turn','srpIpRaiseProbeT','srpIpRaiseProbeTOpp',V76_BENCH.srpIp.raiseProbeT,'turn'],['SRP IP vs BB','F2 Probe River','srpIpFProbeR','srpIpFProbeROpp',V76_BENCH.srpIp.fProbeR,'river'],['SRP IP vs BB','F2 Donk Bet','srpIpFDonk','srpIpFDonkOpp',V76_BENCH.srpIp.fDonk,'flop'],['SRP IP vs BB','Bet/Check/Bet','srpIpBxB','srpIpBxBOpp',V76_BENCH.srpIp.bxb,'river'],
    ['BB vs IP','F2 CBet Flop','bbFcb','bbFcbOpp',V76_BENCH.bbIp.foldCbet,'flop'],['BB vs IP','XR SRP','bbXR','bbXRopp',V76_BENCH.bbIp.xr,'flop'],['BB vs IP','Probe Turn','bbProbeT','bbProbeTOpp',V76_BENCH.bbIp.probeT,'turn'],['BB vs IP','Probe Turn + Barrel River','bbProbeBarrelR','bbProbeBarrelROpp',V76_BENCH.bbIp.probeBarrelR,'river'],['BB vs IP','Probe River','bbProbeR','bbProbeROpp',V76_BENCH.bbIp.probeR,'river'],['BB vs IP','Donk Bet Flop','bbDonkF','bbDonkFOpp',V76_BENCH.bbIp.donkF,'flop'],['BB vs IP','Donk Bet Turn','bbDonkT','bbDonkTOpp',V76_BENCH.bbIp.donkT,'turn'],
    ['OOP','CBet Flop OOP','oopCbet','oopCbetOpp',V76_BENCH.oop.cbet,'flop'],['OOP','Delay CBet OOP','oopDelay','oopDelayOpp',V76_BENCH.oop.delay,'turn'],['OOP','X/F SRP','oopXF','oopXFOpp',V76_BENCH.oop.xf,'flop'],
    ['OOP MW Sandwich','CBet Flop MW','mwCbet','mwCbetOpp',V76_BENCH.mw.cbet,'flop'],['OOP MW Sandwich','Delay CBet MW','mwDelay','mwDelayOpp',V76_BENCH.mw.delay,'turn']
  ]
  for(const [group,label,hit,opp,bm,street] of adv){const rr=v76Rate(f,hit,opp);push(group,label,rr.v,rr.d,v76BenchObj(bm,label),v77AdvMetric(hit,opp,label,street),'all',1.0,20)}
  const sb=f.filter(x=>x.position==='SB'),bb=f.filter(x=>x.position==='BB'),sbDen=v76Sum(sb,'sbLimpRaiseOpp')
  const bvb=[['SB Walk',v76Rate(sb,'sbWalk','sbWalkOpp'),V76_BENCH.bvb.sbWalk,'sbWalk','sbWalkOpp'],['SB L/F',{n:v76Sum(sb,'sbLF'),d:sbDen,v:sbDen?100*v76Sum(sb,'sbLF')/sbDen:0},V76_BENCH.bvb.sbLF,'sbLF','sbLimpRaiseOpp'],['SB L/R',{n:v76Sum(sb,'sbLR'),d:sbDen,v:sbDen?100*v76Sum(sb,'sbLR')/sbDen:0},V76_BENCH.bvb.sbLR,'sbLR','sbLimpRaiseOpp'],['SB L/C',{n:v76Sum(sb,'sbLC'),d:sbDen,v:sbDen?100*v76Sum(sb,'sbLC')/sbDen:0},V76_BENCH.bvb.sbLC,'sbLC','sbLimpRaiseOpp'],['BB ISO nAI',v76Rate(bb,'bbIsoNAI','bbIsoNAIOpp'),V76_BENCH.bvb.bbIso,'bbIsoNAI','bbIsoNAIOpp'],['BB ISO nAI/F',v76Rate(bb,'bbIsoNAIFold','bbIsoNAIFoldOpp'),V76_BENCH.bvb.bbIsoFold,'bbIsoNAIFold','bbIsoNAIFoldOpp']]
  for(const [label,rr,bm,hit,opp] of bvb)push('Blind War',label,rr.v,rr.d,v76BenchObj(bm,label),v77AdvMetric(hit,opp,label,'preflop'),'all',1.1,20)
  const red=v76Redline100(f);push('Resultado','BB/100',s.bb100,f.length,v76BenchObj(V76_BENCH.result.bb100,'BB/100'),'bb100','all',0.75,500);push('Resultado','Red Line /100',red,f.length,v76BenchObj(V76_BENCH.result.redline,'Red Line /100'),'bb100','all',0.75,500)
  return out
}
function v78LeakSummaryHtml(f){
  const entries=v78LeakEntries(f),leaks=entries.filter(x=>['tight','aggro'].includes(x.state)).sort((a,b)=>b.score-a.score),great=entries.filter(x=>x.state==='great').length,sample=entries.filter(x=>x.state==='sample').length
  const top=leaks.slice(0,8)
  const severity=x=>x.score>=2?'critical':x.score>=.75?'important':'attention'
  const sevLabel=x=>x.score>=2?'CRÍTICO':x.score>=.75?'IMPORTANTE':'ATENÇÃO'
  const dir=x=>x.bench.min!=null&&x.value<x.bench.min?'abaixo':'acima'
  // O conjunto de revisão depende da direção NUMÉRICA do desvio, não do rótulo estratégico.
  // Frequência abaixo da faixa = revisar oportunidades em que a ação NÃO aconteceu.
  // Frequência acima da faixa = revisar as mãos em que a ação aconteceu demais.
  const reviewTarget=x=>(x.bench.min!=null&&x.value<x.bench.min)?'misses':'hits'
  const rows=top.map((x,i)=>`<button class="v78-leak-row ${severity(x)}" data-leak-metric="${x.metric}" data-leak-pos="${x.pos}" data-leak-target="${reviewTarget(x)}"><span class="rank">${i+1}</span><span class="main"><b>${x.statLabel}</b><small><strong class="v781-diagnosis ${x.state}">${x.diagnosis}</strong> · ${x.group} · ${x.den.toLocaleString('pt-BR')} oportunidades</small></span><span class="value"><b>${x.value.toFixed(1)}%</b><small>ref. ${v75RangeText(x.bench)}</small></span><span class="delta">${x.distance.toFixed(1)} p.p. ${dir(x)}</span><em>${sevLabel(x)}</em></button>`).join('')
  return `<section class="v78-leaks"><header><div><h3>🧠 Resumo automático de leaks</h3><p>Prioriza desvios pelo tamanho da diferença, amostra e importância do spot. É uma fila de revisão — não um veredito estratégico.</p></div><div class="v78-leak-counts"><span><b>${leaks.length}</b> desvios</span><span class="great"><b>${great}</b> dentro</span><span class="sample"><b>${sample}</b> pouca amostra</span></div></header>${top.length?`<div class="v78-leak-list">${rows}</div>`:`<div class="v78-no-leaks">Nenhum desvio com amostra suficiente neste filtro. 🎯</div>`}<footer>Clique em um leak: frequência baixa revisa oportunidades perdidas; frequência alta revisa as ações executadas em excesso. Depois, envie o conjunto certo ao Replayer.</footer></section>`
}
function v831ReviewTarget(x){
  if(x?.bench?.min!=null&&x.value<x.bench.min)return 'misses'
  if(x?.bench?.max!=null&&x.value>x.bench.max)return 'hits'
  return 'hits'
}
function v831AuditLabel(x){
  const target=v831ReviewTarget(x)
  if(x.state==='sample')return 'pouca amostra · auditar'
  if(x.state==='great')return 'dentro · auditar ações'
  return target==='misses'?'revisar sem a ação':'revisar ações executadas'
}
function v831StrategicAuditHtml(f){
  const allowed=new Set(['RFI','3Bet nAI','Fold 3Bet nAI','4Bet','Blind War'])
  const entries=v78LeakEntries(f).filter(x=>allowed.has(x.group))
  const order=['RFI','3Bet nAI','Fold 3Bet nAI','4Bet','Blind War']
  const groups=order.map(group=>{
    const a=entries.filter(x=>x.group===group)
    if(!a.length)return ''
    const rows=a.map(x=>{
      const cls=x.state||'neutral',target=v831ReviewTarget(x),pct=x.den?x.value.toFixed(1)+'%':'—'
      return `<button class="v831-audit-row bench-${cls}" data-strategy-metric="${x.metric}" data-strategy-pos="${x.pos}" data-strategy-target="${target}"><span><b>${x.statLabel}</b><small>${v831AuditLabel(x)}</small></span><strong>${pct}</strong><em>${x.den.toLocaleString('pt-BR')} opp · ref ${v75RangeText(x.bench)}</em></button>`
    }).join('')
    return `<div class="v831-audit-group"><header>${group}</header><div>${rows}</div></div>`
  }).join('')
  return `<section class="v831-strategy-audit"><header><div><h3>🧪 Auditoria estratégica</h3><p>Abra qualquer família pré-flop já suportada pelo motor, mesmo quando ela não aparece no Top 8 de leaks.</p></div><span>V8.3.6 · acesso direto</span></header><div class="v831-audit-grid">${groups}</div><footer>O alvo é escolhido pela direção do desvio: frequência baixa revisa decisões sem a ação; frequência alta revisa ações executadas. Stats dentro da faixa continuam disponíveis para auditoria manual.</footer></section>`
}

function v76AdvancedHtml(f){
  const srpIp=[['CBET FLOP SRP','srpIpCbet','srpIpCbetOpp','cbet'],['CBET FLOP + BARREL TURN','srpIpBarrelT','srpIpBarrelTOpp','barrelT'],['CBET F + BARREL T + R','srpIpBarrelR','srpIpBarrelROpp','barrelR'],['F2 TO XR','srpIpFoldXR','srpIpFoldXROpp','foldXR'],['DELAY CBET','srpIpDelay','srpIpDelayOpp','delay'],['DELAY CBET + BARREL','srpIpDelayBarrel','srpIpDelayBarrelOpp','delayBarrel'],['F2 PROBE TURN','srpIpFProbeT','srpIpFProbeTOpp','fProbeT'],['RAISE PROBE TURN','srpIpRaiseProbeT','srpIpRaiseProbeTOpp','raiseProbeT'],['F2 PROBE RIVER','srpIpFProbeR','srpIpFProbeROpp','fProbeR'],['F2 DONK BET','srpIpFDonk','srpIpFDonkOpp','fDonk'],['BET/CHECK/BET','srpIpBxB','srpIpBxBOpp','bxb']].map(([l,h,o,b])=>v76Row(l,v76Rate(f,h,o),v76BenchObj(V76_BENCH.srpIp[b],l),v77AdvMetric(h,o,l,['barrelR','fProbeR','bxb'].includes(b)?'river':['barrelT','delay','delayBarrel','fProbeT','raiseProbeT'].includes(b)?'turn':'flop'))).join('')
  const bbIp=[['F2 TO CBET FLOP','bbFcb','bbFcbOpp','foldCbet'],['XR SRP','bbXR','bbXRopp','xr'],['PROBE TURN','bbProbeT','bbProbeTOpp','probeT'],['PROBE TURN + BARREL RIVER','bbProbeBarrelR','bbProbeBarrelROpp','probeBarrelR'],['PROBE RIVER','bbProbeR','bbProbeROpp','probeR'],['DONK BET FLOP','bbDonkF','bbDonkFOpp','donkF'],['DONK BET TURN','bbDonkT','bbDonkTOpp','donkT']].map(([l,h,o,b])=>v76Row(l,v76Rate(f,h,o),v76BenchObj(V76_BENCH.bbIp[b],l),v77AdvMetric(h,o,l,['probeR','probeBarrelR'].includes(b)?'river':['probeT','donkT'].includes(b)?'turn':'flop'))).join('')
  const oop=[['CBET FLOP','oopCbet','oopCbetOpp','cbet'],['DELAY CBET','oopDelay','oopDelayOpp','delay'],['X/F SRP','oopXF','oopXFOpp','xf']].map(([l,h,o,b])=>v76Row(l,v76Rate(f,h,o),v76BenchObj(V76_BENCH.oop[b],l),v77AdvMetric(h,o,l,b==='delay'?'turn':'flop'))).join('')
  const mw=[['CBET FLOP','mwCbet','mwCbetOpp','cbet'],['DELAY CBET','mwDelay','mwDelayOpp','delay']].map(([l,h,o,b])=>v76Row(l,v76Rate(f,h,o),v76BenchObj(V76_BENCH.mw[b],l),v77AdvMetric(h,o,l,b==='delay'?'turn':'flop'))).join('')
  const sb=f.filter(x=>x.position==='SB'),bb=f.filter(x=>x.position==='BB'),sbRespDen=v76Sum(sb,'sbLimpRaiseOpp')
  const bvb=v76Row('SB WALK',v76Rate(sb,'sbWalk','sbWalkOpp'),v76BenchObj(V76_BENCH.bvb.sbWalk,'SB Walk'),v77AdvMetric('sbWalk','sbWalkOpp','SB WALK','preflop'))+
    v76Row('SB L/F',{n:v76Sum(sb,'sbLF'),d:sbRespDen,v:sbRespDen?100*v76Sum(sb,'sbLF')/sbRespDen:0},v76BenchObj(V76_BENCH.bvb.sbLF,'SB L/F'),v77AdvMetric('sbLF','sbLimpRaiseOpp','SB L/F','preflop'))+
    v76Row('SB L/R',{n:v76Sum(sb,'sbLR'),d:sbRespDen,v:sbRespDen?100*v76Sum(sb,'sbLR')/sbRespDen:0},v76BenchObj(V76_BENCH.bvb.sbLR,'SB L/R'),v77AdvMetric('sbLR','sbLimpRaiseOpp','SB L/R','preflop'))+
    v76Row('SB L/C',{n:v76Sum(sb,'sbLC'),d:sbRespDen,v:sbRespDen?100*v76Sum(sb,'sbLC')/sbRespDen:0},v76BenchObj(V76_BENCH.bvb.sbLC,'SB L/C'),v77AdvMetric('sbLC','sbLimpRaiseOpp','SB L/C','preflop'))+
    v76Row('BB ISO nAI',v76Rate(bb,'bbIsoNAI','bbIsoNAIOpp'),v76BenchObj(V76_BENCH.bvb.bbIso,'BB ISO nAI'),v77AdvMetric('bbIsoNAI','bbIsoNAIOpp','BB ISO nAI','preflop'))+
    v76Row('BB ISO nAI / F',v76Rate(bb,'bbIsoNAIFold','bbIsoNAIFoldOpp'),v76BenchObj(V76_BENCH.bvb.bbIsoFold,'BB ISO nAI / F'),v77AdvMetric('bbIsoNAIFold','bbIsoNAIFoldOpp','BB ISO nAI / F','preflop'))
  const f4nai=v76Rate(f,'fourBetNAI','fourBetTotalOpp'),f4tot=v76Rate(f,'fourBetTotal','fourBetTotalOpp')
  const red=v76Redline100(f),s=aggregateHhStats(f)
  const result=trackerCell('BB/100',(s.bb100>=0?'+':'')+s.bb100.toFixed(1),f.length.toLocaleString('pt-BR'),'bb100','all','',v76Class(s.bb100,f.length,v76BenchObj(V76_BENCH.result.bb100,'BB/100'),500))+trackerCell('RED LINE /100',(red>=0?'+':'')+red.toFixed(1),f.length.toLocaleString('pt-BR'),'','','',v76Class(red,f.length,v76BenchObj(V76_BENCH.result.redline,'Red Line'),500))
  return `<section class="v76-section"><div class="v76-title"><b>PÓS-FLOP / BLIND WAR — BENCHMARKS</b><span>Somente stats com referência validada</span></div><div class="v7-grid v76-grid">
    ${trackerPanel('3BET nAI',v76RowsByPos(f,'threeBetNAI','threeBetNAIOpp',V76_BENCH.threeBetNAI))}
    ${trackerPanel('F2 3BET nAI',v76RowsByPos(f,'fold3betNAI','faced3betNAI',V76_BENCH.fold3betNAI,['UTG','MP','HJ','CO','BTN','SB']))}
    ${trackerPanel('4BET',v76Row('4BET nAI',f4nai,v76BenchObj(V76_BENCH.fourBetNAI.ALL,'4Bet nAI'),v77AdvMetric('fourBetNAI','fourBetTotalOpp','4BET nAI','preflop'))+v76Row('4BET TOTAL',f4tot,v76BenchObj(V76_BENCH.fourBetTotal.ALL,'4Bet total'),v77AdvMetric('fourBetTotal','fourBetTotalOpp','4BET TOTAL','preflop')))}
    ${trackerPanel('SRP — IP vs BIG BLIND',srpIp,'v7-wide')}
    ${trackerPanel('SRP — BIG BLIND vs IP',bbIp,'v7-wide')}
    ${trackerPanel('OOP',oop)}
    ${trackerPanel('OOP MW SANDWICH',mw)}
    ${trackerPanel('BvB — BLIND WAR',bvb,'v7-wide')}
  </div><div class="v76-note"><b>Auditoria V7.7:</b> Blind War agora só nasce quando a ação realmente folda até o SB; SB L/F, L/R e L/C usam apenas limps que enfrentaram raise; Probe Turn/River e Donk Turn foram separados para não misturar linhas; OOP MW Sandwich exige adversários dos dois lados da posição relativa do Hero.</div></section>`
}


function v77PerformancePanel(f){
  const s=aggregateHhStats(f),red=v76Redline100(f)
  return trackerPanel('RESULTADO / PERFORMANCE',
    trackerCell('BB/100',(s.bb100>=0?'+':'')+s.bb100.toFixed(1),f.length.toLocaleString('pt-BR'),'bb100','all','',v76Class(s.bb100,f.length,v76BenchObj(V76_BENCH.result.bb100,'BB/100'),500))+
    trackerCell('RED LINE /100',(red>=0?'+':'')+red.toFixed(1),f.length.toLocaleString('pt-BR'),'','','',v76Class(red,f.length,v76BenchObj(V76_BENCH.result.redline,'Red Line'),500)))
}
function v77PreflopPanels(f){
  const s=aggregateHhStats(f),c=s.counts,b3=v75Classify(s.threeBet,c.threeBetOpp,v75Benchmark('overall','threeBet'))
  return `<section class="v76-section"><div class="v76-title"><b>PRÉ-FLOP — BENCHMARKS</b><span>Análise clássica + LeakFinder avançado, unificados</span></div><div class="v7-grid v76-grid">
    ${trackerPanel('RFI (OPEN RAISE)',trackerPosRows(f,'rfi','rfi',null,null,['UTG','HJ','CO','BTN','SB']))}
    ${trackerPanel('3BET TOTAL',trackerPosRows(f,'3bet','threeBet',null,null,['UTG','HJ','CO','BTN','SB','BB'])+trackerCell('TOTAL',hhPctDisplay(s.threeBet,c.threeBetOpp),c.threeBetOpp.toLocaleString('pt-BR'),'3bet','all','total',b3))}
    ${trackerPanel('3BET nAI',v76RowsByPos(f,'threeBetNAI','threeBetNAIOpp',V76_BENCH.threeBetNAI))}
    ${trackerPanel('F2 3BET nAI',v76RowsByPos(f,'fold3betNAI','faced3betNAI',V76_BENCH.fold3betNAI,['UTG','MP','HJ','CO','BTN','SB']))}
    ${(()=>{const f4nai=v76Rate(f,'fourBetNAI','fourBetTotalOpp'),f4tot=v76Rate(f,'fourBetTotal','fourBetTotalOpp');return trackerPanel('4BET',v76Row('4BET nAI',f4nai,v76BenchObj(V76_BENCH.fourBetNAI.ALL,'4Bet nAI'),v77AdvMetric('fourBetNAI','fourBetTotalOpp','4BET nAI','preflop'))+v76Row('4BET TOTAL',f4tot,v76BenchObj(V76_BENCH.fourBetTotal.ALL,'4Bet total'),v77AdvMetric('fourBetTotal','fourBetTotalOpp','4BET TOTAL','preflop')))})()}
    ${v77PerformancePanel(f)}
  </div></section>`
}
function hhStatsViewHtml(facts,totalFacts=hhStatsCache){
  const gameCounts=totalFacts.reduce((m,x)=>(m[x.game]=(m[x.game]||0)+1,m),{})
  if(!facts.length)return `<div class="panel"><h2>Nenhuma mão neste filtro</h2><p class="muted">Existem ${totalFacts.length.toLocaleString('pt-BR')} mãos importadas, mas nenhuma corresponde aos filtros selecionados.</p></div>`
  const s=aggregateHhStats(facts),c=s.counts
  const breakdown=['holdem','omaha','plo5','other'].filter(k=>gameCounts[k]).map(k=>`${hhGameLabel(k)}: ${gameCounts[k].toLocaleString('pt-BR')}`).join(' · ')
  const top=(label,val,sub,metric='',tone='',benchInfo=null)=>{const b=benchInfo||{state:'neutral'};return `<button class="v7-kpi ${tone} bench-${b.state}" ${metric?`data-audit-metric="${metric}" data-audit-pos="all"`:''} ${b.state!=='neutral'?`title="${b.label} · referência ${b.range}"`:''}><small>${label}</small><strong>${val}</strong><span>${sub}</span>${v75BenchBadge(b)}</button>`}
  const bVPIP=v75Classify(s.vpip,s.hands,v75Benchmark('overall','vpip'),'overall'),bPFR=v75Classify(s.pfr,s.hands,v75Benchmark('overall','pfr'),'overall'),b3=v75Classify(s.threeBet,c.threeBetOpp,v75Benchmark('overall','threeBet')),bWWSF=v75Classify(s.wwsf,c.sawFlop,v75Benchmark('overall','wwsf'))
  const red=v76Redline100(facts),bBB=v76Class(s.bb100,facts.length,v76BenchObj(V76_BENCH.result.bb100,'BB/100'),500),bRed=v76Class(red,facts.length,v76BenchObj(V76_BENCH.result.redline,'Red Line'),500)
  return `<div class="v7-dashboard">
    <div class="v7-resultbar"><b>${facts.length.toLocaleString('pt-BR')} mãos encontradas</b><span>${breakdown}</span><em>Painel V8.3.6: Universo completo + Hand Class Filter</em></div>
    <div class="v7-kpis v77-kpis">${top('MÃOS',s.hands.toLocaleString('pt-BR'),'filtro atual')}${top('VPIP',s.vpip.toFixed(1)+'%',hhRateSub(c.vpip,s.hands,'mãos'),'vpip','',bVPIP)}${top('PFR',s.pfr.toFixed(1)+'%',hhRateSub(c.pfr,s.hands,'mãos'),'pfr','',bPFR)}${top('3BET',hhPctDisplay(s.threeBet,c.threeBetOpp),hhRateSub(c.threeBet,c.threeBetOpp),'3bet','',b3)}${top('WWSF',s.wwsf.toFixed(1)+'%',hhRateSub(c.wwsf,c.sawFlop,'flops vistos'),'wwsf','',bWWSF)}${top('BB/100',(s.bb100>=0?'+':'')+s.bb100.toFixed(1),'resultado real','bb100',s.bb100>=0?'orange':'negative',bBB)}${top('RED LINE /100',(red>=0?'+':'')+red.toFixed(1),'non-showdown bb/100','','',bRed)}</div>
    <div class="v7-help">ⓘ Análise unificada: amarelo/vermelho/verde = benchmark validado; cinza = benchmark existe, mas a amostra é insuficiente. Stats ainda sem benchmark ficam ocultas até serem mapeadas.</div>
    ${v78LeakSummaryHtml(facts)}
    ${v831StrategicAuditHtml(facts)}
    <div class="v71-layout"><main class="v71-main">
      ${v77PreflopPanels(facts)}
      ${v76AdvancedHtml(facts)}
      <div class="v7-footnote">ⓘ V8.3.6 mantém o universo estatisticamente válido completo nas auditorias estratégicas e usa Prioridade + Classe de mão apenas como filtros de revisão. Nada é descartado só porque a heurística não priorizou o combo.</div>
    </main>${v71SideRail()}</div>
  </div>`
}

function hhStackMatch(stack,bucket){
  if(bucket==='all')return true
  if(bucket==='0-10')return stack<=10
  if(bucket==='10-15')return stack>10&&stack<=15
  if(bucket==='15-25')return stack>15&&stack<=25
  if(bucket==='25-40')return stack>25&&stack<=40
  if(bucket==='40+')return stack>40
  return true
}
function applyHhStatsFilters(){
  let a=[...hhStatsCache]
  if(hhStatsFilters.game!=='all')a=a.filter(x=>x.game===hhStatsFilters.game)
  if(hhStatsFilters.position!=='all')a=a.filter(x=>x.position===hhStatsFilters.position)
  if(hhStatsFilters.stack!=='all')a=a.filter(x=>hhStackMatch(x.stack,hhStatsFilters.stack))
  if(hhStatsFilters.players!=='all')a=a.filter(x=>x.players===+hhStatsFilters.players)
  if(hhStatsFilters.start)a=a.filter(x=>x.date>=hhStatsFilters.start)
  if(hhStatsFilters.end)a=a.filter(x=>x.date<=hhStatsFilters.end)
  hhStatsFilteredCache=a
  const el=document.getElementById('hhStatsView');if(el){el.innerHTML=hhStatsViewHtml(a,hhStatsCache);bindHhAudit()}
  const sum=document.getElementById('hhFilterSummary');if(sum){
    const d=hhStatsFilters.start||hhStatsFilters.end?`${hhStatsFilters.start||'início'} até ${hhStatsFilters.end||'hoje'}`:'todas as datas'
    const pos=hhStatsFilters.position==='all'?'todas posições':hhStatsFilters.position
    const stk=hhStatsFilters.stack==='all'?'todos stacks':`${hhStatsFilters.stack}bb`
    const ply=hhStatsFilters.players==='all'?'todas mesas':`${hhStatsFilters.players}-max`
    sum.textContent=`Exibindo ${a.length.toLocaleString('pt-BR')} de ${hhStatsCache.length.toLocaleString('pt-BR')} mãos · ${hhGameLabel(hhStatsFilters.game)} · ${pos} · ${stk} · ${ply} · ${d}.`
  }
}
function bindHhStatsFilters(){
  const g=document.getElementById('hhGameFilter'),pos=document.getElementById('hhPositionFilter'),stk=document.getElementById('hhStackFilter'),ply=document.getElementById('hhPlayersFilter'),a=document.getElementById('hhDateStart'),b=document.getElementById('hhDateEnd'),clear=document.getElementById('clearHhFilters')
  if(!g)return
  g.value=hhStatsFilters.game;pos.value=hhStatsFilters.position;stk.value=hhStatsFilters.stack;ply.value=hhStatsFilters.players;a.value=hhStatsFilters.start;b.value=hhStatsFilters.end
  g.onchange=()=>{hhStatsFilters.game=g.value;applyHhStatsFilters()}
  pos.onchange=()=>{hhStatsFilters.position=pos.value;applyHhStatsFilters()}
  stk.onchange=()=>{hhStatsFilters.stack=stk.value;applyHhStatsFilters()}
  ply.onchange=()=>{hhStatsFilters.players=ply.value;applyHhStatsFilters()}
  a.onchange=()=>{hhStatsFilters.start=a.value;if(hhStatsFilters.end&&a.value>hhStatsFilters.end){hhStatsFilters.end=a.value;b.value=a.value}applyHhStatsFilters()}
  b.onchange=()=>{hhStatsFilters.end=b.value;if(hhStatsFilters.start&&b.value<hhStatsFilters.start){hhStatsFilters.start=b.value;a.value=b.value}applyHhStatsFilters()}
  clear.onclick=()=>{hhStatsFilters={game:'holdem',start:'',end:'',position:'all',stack:'all',players:'all'};bindHhStatsFilters();applyHhStatsFilters()}
  applyHhStatsFilters()
}
async function hhHandsByIds(ids){
  const wanted=new Set(ids),out=[]
  if(!wanted.size)return out
  const imports=await hhStatsImports()
  for(const rec of imports){for(const h of (rec.hands||[])){if(wanted.has(h.handId)){out.push(h);wanted.delete(h.handId);if(!wanted.size)return out}}}
  return out
}
async function openHhFactsInReplayer(facts,label,opts={}){
  const ids=[...new Set((facts||[]).map(x=>x.handId).filter(Boolean))]
  if(!ids.length)return alert('Nenhuma mão encontrada para abrir no Replayer.')
  const btn=document.getElementById('auditOpenReplay');if(btn){btn.disabled=true;btn.textContent='Carregando mãos...'}
  try{
    const hands=await hhHandsByIds(ids)
    if(!hands.length)return alert('Não consegui localizar essas mãos no banco local.')
    replayState={hands,selected:hands[0],step:firstReplayActionIndex(hands[0]),sourceName:label||'Sessão do Stats HH',rawText:'',speed:1,playing:false,showOpponentCards:false,equilabOpen:false,rangeByHand:{},rangeColor:'blue'}
    const metaByHand={}
    for(const f of (facts||[]))if(f?.handId)metaByHand[f.handId]={tier:f.__strategicTier||'',tierLabel:f.__strategicTierLabel||'',score:f.__strategicScore||0,reason:f.__strategicReason||''}
    const priorityFacts=Array.isArray(opts.priorityFacts)?opts.priorityFacts:[]
    for(const f of priorityFacts)if(f?.handId)metaByHand[f.handId]={tier:f.__strategicTier||'',tierLabel:f.__strategicTierLabel||'',score:f.__strategicScore||0,reason:f.__strategicReason||''}
    const prioritizedIds=[...new Set(priorityFacts.map(x=>x?.handId).filter(Boolean))]
    const summary=prioritizedIds.length?`${hands.length.toLocaleString('pt-BR')} no universo · ${prioritizedIds.length.toLocaleString('pt-BR')} priorizadas · ${v82TierSummary(priorityFacts)}`:(Object.keys(metaByHand).length?v82TierSummary(facts):'')
    hhReplayContext={label:label||'Sessão do Stats HH',count:hands.length,metaByHand,summary,handClassFilter:'all',priorityFilter:'all',prioritizedIds}
    modal.classList.remove('show');route('replayer')
  }finally{if(btn){btn.disabled=false;btn.textContent='🎬 Abrir no Replayer'}}
}
function auditActionText(a){const v=a.to?` to ${a.to.toLocaleString('pt-BR')}`:a.amount?` ${a.amount.toLocaleString('pt-BR')}`:'';return `${a.player}: ${String(a.type).toUpperCase()}${v}`}

function v80HoleShape(cards=[]){
  const c=(cards||[]).slice(0,2).map(x=>String(x||''));if(c.length<2)return null
  const rv='23456789TJQKA',r1=c[0][0]?.toUpperCase(),r2=c[1][0]?.toUpperCase(),i1=rv.indexOf(r1),i2=rv.indexOf(r2)
  if(i1<0||i2<0)return null
  const hi=i1>=i2?r1:r2,lo=i1>=i2?r2:r1,pair=r1===r2,suited=c[0].slice(1).toLowerCase()===c[1].slice(1).toLowerCase()
  return {hi,lo,pair,suited,hiI:Math.max(i1,i2),loI:Math.min(i1,i2),gap:Math.max(i1,i2)-Math.min(i1,i2)-1,label:pair?hi+lo:hi+lo+(suited?'s':'o')}
}

const V835_HAND_CLASSES=[
  ['all','Todas'],
  ['pairs','Pares'],
  ['broadways','Broadways'],
  ['ahigh','A-high'],
  ['axs','Ax suited'],
  ['suited_connectors','Conectores suited'],
  ['suited_gappers','Gappers suited'],
  ['trash','Trash / Outras']
]
function v835HandClass(cards=[]){
  const h=v80HoleShape(cards)
  if(!h)return 'trash'
  const ranks='23456789TJQKA',idx=r=>ranks.indexOf(r)
  if(h.pair)return 'pairs'
  const hi=idx(h.hi),lo=idx(h.lo)
  // Broadways: duas cartas T+ (inclui AT/KT/QJ etc.).
  if(hi>=idx('T')&&lo>=idx('T'))return 'broadways'
  // Ax suited fica separado de A-high para estudar blockers/combo classes.
  if(h.hi==='A'&&h.suited)return 'axs'
  // A-high = Ax offsuit que não caiu em broadway.
  if(h.hi==='A')return 'ahigh'
  if(h.suited&&h.gap===0)return 'suited_connectors'
  if(h.suited&&h.gap>=1&&h.gap<=2)return 'suited_gappers'
  return 'trash'
}
function v835HandClassLabel(key){
  return (V835_HAND_CLASSES.find(x=>x[0]===key)||['','Trash / Outras'])[1]
}
function v835ClassCounts(hands=[]){
  const c={all:hands.length,pairs:0,broadways:0,ahigh:0,axs:0,suited_connectors:0,suited_gappers:0,trash:0}
  for(const h of hands)c[v835HandClass(h.heroCards)]=(c[v835HandClass(h.heroCards)]||0)+1
  return c
}
function v836HandsForPriority(){
  const all=replayState.hands||[]
  if(!hhReplayContext||hhReplayContext.priorityFilter!=='prioritized')return all
  const ids=new Set(hhReplayContext.prioritizedIds||[])
  return all.filter(h=>ids.has(h.handId))
}
function v835HandsForClass(){
  const all=v836HandsForPriority()
  const key=hhReplayContext?.handClassFilter||'all'
  return key==='all'?all:all.filter(h=>v835HandClass(h.heroCards)===key)
}
function v835HandClassBar(){
  if(!hhReplayContext)return ''
  const priorityBase=v836HandsForPriority(),counts=v835ClassCounts(priorityBase),active=hhReplayContext.handClassFilter||'all'
  const prioritized=(hhReplayContext.prioritizedIds||[]).length,total=(replayState.hands||[]).length,pActive=hhReplayContext.priorityFilter||'all'
  const priorityBar=prioritized?`<div class="v836-priority-row"><div><b>🎯 Escopo da revisão</b><span>O universo completo fica disponível; a heurística só prioriza.</span></div><div class="v836-priority-chips"><button type="button" class="v836-priority-chip ${pActive==='all'?'active':''}" data-priority-filter="all">Todas oportunidades <b>${total.toLocaleString('pt-BR')}</b></button><button type="button" class="v836-priority-chip ${pActive==='prioritized'?'active':''}" data-priority-filter="prioritized">Só priorizadas <b>${prioritized.toLocaleString('pt-BR')}</b></button></div></div>`:''
  return `<div class="v835-handclass">${priorityBar}<div class="v835-handclass-head"><b>🃏 Classe de mão</b><span>Filtre a sessão sem alterar o universo estatístico do leak.</span></div><div class="v835-handclass-chips">${V835_HAND_CLASSES.map(([key,label])=>`<button type="button" class="v835-class-chip ${active===key?'active':''}" data-hand-class="${key}"><span>${label}</span><b>${(counts[key]||0).toLocaleString('pt-BR')}</b></button>`).join('')}</div></div>`
}
function v835RenderReplayList(){
  const input=document.getElementById('replaySearch')
  const q=(input?.value||'').trim().toLowerCase()
  const base=v835HandsForClass()
  replayState.viewHands=base
  const filtered=q?base.filter(h=>[h.handId,h.heroCards.join(' '),h.dateTime,h.positionMap[h.hero],h.tournamentName].some(v=>String(v||'').toLowerCase().includes(q))):base
  const list=document.getElementById('replayHandList')
  if(list)list.innerHTML=replayHandListHtml(filtered,replayState.selected)
  const summary=document.getElementById('replayFilteredSummary')
  if(summary){
    const active=hhReplayContext?.handClassFilter||'all'
    summary.textContent=active==='all'?`${base.length.toLocaleString('pt-BR')} mãos detectadas`:`${base.length.toLocaleString('pt-BR')} ${v835HandClassLabel(active).toLowerCase()} · ${replayState.hands.length.toLocaleString('pt-BR')} total`
  }
  document.querySelectorAll('[data-replay-hand]').forEach(b=>b.onclick=()=>selectReplayHand(b.dataset.replayHand))
}
function v835BindHandClassFilter(){
  if(!hhReplayContext)return
  const refresh=()=>{
    const visible=v835HandsForClass()
    replayState.viewHands=visible
    if(visible.length&&!visible.some(h=>h.handId===replayState.selected?.handId)){
      replayState.selected=visible[0]
      replayState.step=firstReplayActionIndex(visible[0])
      const stage=document.getElementById('replayStage')
      if(stage){stage.innerHTML=replayStageHtml(visible[0]);bindReplayStage()}
    }
    const bar=document.querySelector('.v835-handclass')
    if(bar){bar.outerHTML=v835HandClassBar();v835BindHandClassFilter()}
    v835RenderReplayList()
  }
  document.querySelectorAll('[data-hand-class]').forEach(b=>b.onclick=()=>{hhReplayContext.handClassFilter=b.dataset.handClass||'all';refresh()})
  document.querySelectorAll('[data-priority-filter]').forEach(b=>b.onclick=()=>{hhReplayContext.priorityFilter=b.dataset.priorityFilter||'all';hhReplayContext.handClassFilter='all';refresh()})
}

function v81ThreeBetCandidateInfo(x){
  // Strategic Range Engine V8.3 BETA — filtro CONTEXTUAL para revisão humana.
  // Não é solver/GTO. A função só tenta retirar mãos que, apesar de pertencerem
  // ao denominador estatístico, quase nunca são úteis numa fila de revisão de 3Bet.
  const h=v80HoleShape(x.heroCards);if(!h)return {keep:false,reason:'cartas não identificadas',score:0}
  const hero=String(x.position||''),op=String(x.threeBetOpenerPos||x.pfrPos||'')
  const eff=Number(x.threeBetEffectiveBb||x.stack||0),openBb=Number(x.threeBetOpenBb||0),callers=Number(x.threeBetCallerCount||0)
  const metric=String(x.__strategicMetric||'')
  const nAI=metric==='threeBetNAI'
  const rank='23456789TJQKA',idx=r=>rank.indexOf(r),hi=idx(h.hi),lo=idx(h.lo)
  const pairAt=r=>h.pair&&hi>=idx(r)
  const suited=(a,b)=>h.suited&&h.hi===a&&h.lo===b
  const offsuit=(a,b)=>!h.suited&&!h.pair&&h.hi===a&&h.lo===b
  const axSuited=h.suited&&h.hi==='A'
  const context=`vs ${op||'?'} · ${openBb?openBb.toFixed(1)+'bb open · ':''}${eff?eff.toFixed(0)+'bb eff':''}${callers?` · ${callers} caller${callers>1?'s':''}`:''}`
  if(!op)return {keep:false,score:0,reason:'opener não identificado'}
  // 3Bet não-all-in em stacks muito curtos costuma deixar de ser a pergunta certa.
  if(nAI&&eff>0&&eff<17)return {keep:false,score:0,reason:`${context} · stack curto para triagem nAI`}

  // Quanto maior o open ou quanto mais jogadores já entraram, mais conservadora a fila.
  const bigOpen=openBb>=3.5,hugeOpen=openBb>=4.5,squeeze=callers>0
  let keep=false,score=0,tag=''
  const add=(ok,sc,t)=>{if(ok&&sc>score){keep=true;score=sc;tag=t}}

  // Premiums permanecem candidatos em qualquer árvore válida.
  add(pairAt('Q'),100,'QQ+')
  add(h.hi==='A'&&h.lo==='K',99,'AK')
  add(pairAt('J')&&!hugeOpen,94,'JJ+')
  add((suited('A','Q')||offsuit('A','Q'))&&!hugeOpen,92,'AQ')

  // Contextos por posição do opener / Hero. Faixas propositalmente conservadoras.
  const early=['UTG','UTG+1'].includes(op)
  const middle=['MP','MP1','MP2','HJ'].includes(op)
  const late=['CO','BTN','SB'].includes(op)

  if(early){
    add(pairAt('T')&&!bigOpen&&eff<=60,84,'TT vs early em stack moderado')
    add(suited('A','J')&&!bigOpen,82,'AJs vs early')
    add(suited('K','Q')&&!bigOpen,80,'KQs vs early')
  }else if(middle){
    add(pairAt('T'),88,'TT+ vs posição intermediária')
    add(pairAt('9')&&!bigOpen&&eff<=60,82,'99 vs posição intermediária')
    add(suited('A','J'),86,'AJs+ vs posição intermediária')
    add(suited('K','Q'),84,'KQs vs posição intermediária')
    add(axSuited&&['5','4'].includes(h.lo)&&!bigOpen&&eff>=25&&eff<=80,72,'A5s/A4s blocker')
  }else if(late){
    if(hero==='BTN'&&op==='CO'){
      add(pairAt('8'),88,'88+ BTN vs CO')
      add(h.hi==='A'&&lo>=idx('J'),90,'AJ+ BTN vs CO')
      add(axSuited&&['5','4'].includes(h.lo),82,'A5s/A4s BTN vs CO')
      add(h.suited&&h.hi==='K'&&lo>=idx('T'),80,'KTs+ BTN vs CO')
      add(h.suited&&h.hi==='Q'&&lo>=idx('T'),76,'QTs+ BTN vs CO')
      add(suited('J','T'),74,'JTs BTN vs CO')
    }else if(['SB','BB'].includes(hero)&&['CO','BTN'].includes(op)){
      add(pairAt('7'),86,'77+ blind vs late')
      add(h.hi==='A'&&lo>=idx('T'),88,'AT+ blind vs late')
      add(axSuited,80,'Axs blocker blind vs late')
      add(h.suited&&h.hi==='K'&&lo>=idx('9'),77,'K9s+ blind vs late')
      add(h.suited&&h.hi==='Q'&&lo>=idx('9'),74,'Q9s+ blind vs late')
      add(h.suited&&h.hi==='J'&&lo>=idx('9'),72,'J9s+ blind vs late')
      add(h.suited&&h.gap<=0&&hi>=idx('8')&&eff>=25,68,'suited connector blind vs late')
    }else{
      add(pairAt('9'),84,'99+ vs late')
      add(h.hi==='A'&&lo>=idx('J'),86,'AJ+ vs late')
      add(suited('K','Q'),80,'KQs vs late')
      add(axSuited&&['5','4'].includes(h.lo),76,'A5s/A4s blocker')
    }
  }

  // Squeeze e sizings muito grandes: retire candidatos marginais da fila.
  if(keep&&squeeze&&score<82)return {keep:false,score:0,reason:`${context} · candidato marginal removido em squeeze`}
  if(keep&&bigOpen&&score<86)return {keep:false,score:0,reason:`${context} · candidato marginal removido vs open grande`}
  if(keep&&hugeOpen&&score<94)return {keep:false,score:0,reason:`${context} · apenas topo da faixa vs open muito grande`}
  // Em stacks >100bb, evitamos transformar suited connectors/gappers em "3Bet perdida".
  if(keep&&eff>100&&score<76)return {keep:false,score:0,reason:`${context} · mão especulativa deep removida da triagem`}
  return keep?{keep:true,score,reason:`${tag} · ${context}`}:{keep:false,score:0,reason:`${context} · fold/call normal fora da triagem contextual`}
}
function v82CandidateTier(info){
  const sc=Number(info?.score||0)
  if(sc>=88)return {key:'strong',label:'Forte candidato',rank:3}
  if(sc>=78)return {key:'mix',label:'Candidato / mix',rank:2}
  return {key:'fringe',label:'Fronteira',rank:1}
}
function v82TierSummary(rows=[]){
  const c={strong:0,mix:0,fringe:0}
  for(const x of rows){const t=x.__strategicTier||'fringe';if(t in c)c[t]++}
  return `Forte ${c.strong} · Mix ${c.mix} · Fronteira ${c.fringe}`
}

function v83PreflopStrength(x){
  const h=v80HoleShape(x.heroCards);if(!h)return 0
  const rv='23456789TJQKA',idx=r=>rv.indexOf(r),hi=idx(h.hi),lo=idx(h.lo)
  let sc=0
  if(h.pair) sc=50+hi*4
  else {
    sc=hi*4+lo*1.5+(h.suited?7:0)
    if(h.hi==='A')sc+=10
    if(h.hi==='K'&&lo>=idx('T'))sc+=7
    if(h.gap<=0&&h.suited)sc+=5
  }
  return Math.max(0,Math.min(100,sc))
}
function v83StrategicInfo(x,metric,reviewTarget='misses'){
  // V8.3: extensão do motor de prioridade. Continua sendo heurística de triagem,
  // não chart/solver. A missão é ordenar a revisão e retirar ações incompatíveis.
  if(metric==='3bet'||metric==='threeBetNAI')return v81ThreeBetCandidateInfo(x)
  const h=v80HoleShape(x.heroCards);if(!h)return {keep:false,score:0,reason:'cartas não identificadas'}
  const strength=v83PreflopStrength(x),pos=String(x.position||''),eff=Number(x.stack||0)
  const rank='23456789TJQKA',idx=r=>rank.indexOf(r),hi=idx(h.hi),lo=idx(h.lo)
  const pairAt=r=>h.pair&&hi>=idx(r)
  const ax=h.hi==='A',broad=hi>=idx('Q')&&lo>=idx('T')
  let keep=true,score=70,reason='candidato contextual'
  if(metric==='rfi'){
    const floor={UTG:78,HJ:64,CO:52,BTN:43,SB:48}[pos]??58
    if(reviewTarget==='hits'){
      // RFI acima da faixa: prioriza opens mais fracos/marginais, não premiums óbvios.
      keep=strength<floor+24
      score=Math.max(62,Math.min(98,96-(strength-floor)*1.15))
      reason=`RFI ${pos} executado · revisar parte mais fraca da faixa · força ${Math.round(strength)}`
    }else{
      keep=strength>=floor
      score=Math.min(98,55+(strength-floor)*1.7)
      reason=`RFI ${pos} não executado · força relativa ${Math.round(strength)}`
    }
  } else if(metric==='fourBetNAI'||metric==='fourBetTotal'||metric==='4bet'){
    const o=String(x.fourBetOutcome||'')
    if(reviewTarget==='misses'){
      if(metric==='fourBetNAI'&&o==='raise_ai')return {keep:false,score:0,reason:'4Bet AI separado da fila nAI'}
      if(!['fold','call'].includes(o))return {keep:false,score:0,reason:'ação incompatível com oportunidade sem 4Bet'}
      keep=pairAt('T')||(ax&&lo>=idx('Q'))||(h.suited&&h.hi==='A'&&['5','4'].includes(h.lo))
      score=pairAt('Q')||h.label==='AKs'||h.label==='AKo'?97:pairAt('J')||h.label==='AQs'||h.label==='AQo'?90:82
      reason=`4Bet não executada · ${o||'decisão'} · ${eff?eff.toFixed(0)+'bb':''}`
    }else{
      // 4Bet acima da faixa: prioriza as execuções marginais/possivelmente excessivas.
      keep=true
      const premium=pairAt('Q')||h.label==='AKs'||h.label==='AKo'
      const strong=pairAt('J')||h.label==='AQs'||h.label==='AQo'
      const naturalBluff=h.suited&&h.hi==='A'&&['5','4'].includes(h.lo)
      score=premium?58:strong?70:naturalBluff?80:Math.min(98,88+(60-strength)*.18)
      reason=`4Bet executada · revisar possível excesso · ${h.label} · ${eff?eff.toFixed(0)+'bb':''}`
    }
  } else if(metric==='fold3'||metric==='fold3betNAI'){
    // V8.3.4 — separa UNIVERSO AUDITÁVEL de PRIORIDADE ESTRATÉGICA.
    // Se a mão pertence objetivamente ao spot RFI -> 3Bet nAI -> decisão do Hero,
    // ela permanece na auditoria. Forte/Mix/Fronteira apenas ORDENA a revisão;
    // não elimina folds triviais e não finge determinar a ação GTO correta.
    if(reviewTarget==='hits'){
      const suited=h.suited, pair=h.pair
      const late=['CO','BTN','SB'].includes(pos)
      const is=(a,b)=>h.hi===a&&h.lo===b
      const axs=suited&&h.hi==='A'
      const kxs=suited&&h.hi==='K'
      const qxs=suited&&h.hi==='Q'
      const connector=suited&&hi-lo===1
      let tag=`${h.label} · fold válido para auditoria`,sc=62
      const add=(ok,val,t)=>{if(ok&&val>sc){sc=val;tag=t}}

      // Forte: folds que merecem conferência imediata.
      add(pairAt('J'),97,'JJ+ foldado vs 3Bet')
      add(is('A','K'),97,'AK foldado vs 3Bet')
      add(suited&&is('A','Q'),94,'AQs foldado vs 3Bet')
      add(pairAt('T'),92,'TT foldado vs 3Bet')

      // Mix: região naturalmente próxima de continuação.
      add(!suited&&!pair&&is('A','Q'),88,'AQo · região de defesa')
      add(suited&&is('A','J'),88,'AJs · região de defesa')
      add(suited&&is('K','Q'),87,'KQs · região de defesa')
      add(pairAt('9'),86,'99+ · região de defesa')
      add(axs&&lo>=idx('5'),84,'Axs médio/alto · blocker e jogabilidade')

      // Late positions recebem uma fronteira mais larga, mas continuam apenas prioridade.
      if(late){
        add(pairAt('7'),82,'77+ late position')
        add(suited&&is('A','T'),83,'ATs late position')
        add(suited&&is('K','J'),82,'KJs late position')
        add(suited&&is('Q','J'),81,'QJs late position')
        add(suited&&is('J','T'),80,'JTs late position')
        add(axs&&['5','4','3','2'].includes(h.lo),81,'Axs baixo · blocker')
        add(!suited&&!pair&&is('A','J'),78,'AJo · fronteira contextual')
        add(!suited&&!pair&&is('K','Q'),78,'KQo · fronteira contextual')
        if(pos==='BTN'||pos==='SB'){
          add(pairAt('6'),78,'66+ BTN/SB · fronteira')
          add(suited&&is('K','T'),78,'KTs BTN/SB · fronteira')
          add(suited&&is('Q','T'),77,'QTs BTN/SB · fronteira')
          add(connector&&hi>=idx('9'),76,`${h.label} suited connector · fronteira`)
          add(kxs&&lo>=idx('9'),76,`${h.label} suited · fronteira`)
          add(qxs&&lo>=idx('9'),75,`${h.label} suited · fronteira`)
        }
      }
      keep=true; score=sc
      reason=`${tag} · RFI -> fold vs 3Bet nAI · ${pos}${eff?' · '+eff.toFixed(0)+'bb':''}`
    }else{
      keep=true;score=Math.min(92,62+Math.abs(60-strength)*.25)
      reason=`Continuou vs 3Bet após RFI · revisar defesa · ${eff?eff.toFixed(0)+'bb':''}`
    }
  } else if(metric==='sbWalk'){
    keep=reviewTarget==='hits'?(strength>=38):true
    score=Math.min(95,55+strength*.4);reason='Blind War · SB foldou com ação limpa'
  } else if(metric==='bbIsoNAI'){
    keep=strength>=42;score=Math.min(95,52+strength*.45);reason='Blind War · BB vs limp do SB'
  } else return {keep:true,score:70,reason:'candidato de revisão'}
  return keep?{keep:true,score,reason}:{keep:false,score:0,reason:'fora da triagem estratégica conservadora'}
}
function v83MetricKind(metric){
  if(metric==='rfi'||metric==='3bet'||metric==='4bet'||metric==='fold3')return metric
  if(!metric.startsWith('adv|'))return ''
  const hit=metric.split('|')[1]
  if(hit==='threeBetNAI')return 'threeBetNAI'
  if(hit==='fourBetNAI')return 'fourBetNAI'
  if(hit==='fourBetTotal')return 'fourBetTotal'
  if(hit==='fold3betNAI')return 'fold3betNAI'
  if(hit==='sbWalk')return 'sbWalk'
  if(hit==='bbIsoNAI')return 'bbIsoNAI'
  return ''
}

function v80StrategicCandidate(x,metric){
  if(metric==='3bet'||metric==='threeBetNAI')return v81ThreeBetCandidateInfo(x).keep
  return true
}

function hhAuditModal(metric,pos,reviewTarget='hits',strategicMode=false){
  const all=pos==='all'?[...hhStatsFilteredCache]:hhStatsFilteredCache.filter(x=>x.position===pos)
  const labelPos=pos==='all'?'Filtro atual':pos
  let rows=[],hits=[],title='',den=0,num=0,streetMode='all',advancedHitKey=''
  const boolMetric=(oppKey,hitKey,label,street='all')=>{
    rows=all.filter(x=>x[oppKey]);hits=rows.filter(x=>x[hitKey]);den=rows.length;num=hits.length;title=`${labelPos} · ${label} — ${num}/${den} oportunidades`;streetMode=street
  }
  if(metric==='vpip'){rows=[...all];hits=rows.filter(x=>x.vpip);den=rows.length;num=hits.length;title=`${labelPos} · VPIP — ${num}/${den} mãos`;streetMode='preflop'}
  if(metric==='pfr'){rows=[...all];hits=rows.filter(x=>x.pfr);den=rows.length;num=hits.length;title=`${labelPos} · PFR — ${num}/${den} mãos`;streetMode='preflop'}
  if(metric==='wwsf'){rows=all.filter(x=>x.sawFlop);hits=rows.filter(x=>x.won);den=rows.length;num=hits.length;title=`${labelPos} · WWSF — ${num}/${den} flops vistos`;streetMode='postflop'}
  if(metric==='rfi')boolMetric('rfiOpp','rfi','RFI','preflop')
  if(metric==='limp')boolMetric('limpOpp','limp','Limp','preflop')
  if(metric==='3bet')boolMetric('threeBetOpp','threeBet','3Bet','preflop')
  if(metric==='squeeze')boolMetric('squeezeOpp','squeeze','Squeeze','preflop')
  if(metric==='call3')boolMetric('faced3bet','call3bet','Call 3Bet','preflop')
  if(metric==='fold3')boolMetric('faced3bet','foldTo3bet','Fold to 3Bet','preflop')
  if(metric==='4bet')boolMetric('fourBetOpp','fourBet','4Bet após open','preflop')
  if(metric==='steal')boolMetric('stealOpp','steal','Steal CO/BTN/SB','preflop')
  if(metric==='foldbbsteal')boolMetric('bbVsStealOpp','foldBbVsSteal','Fold BB vs Steal','preflop')
  if(metric==='cbet')boolMetric('cbetOpp','cbet','C-Bet Flop','flop')
  if(metric==='cbett')boolMetric('cbetTurnOpp','cbetTurn','C-Bet Turn','turn')
  if(metric==='cbetr')boolMetric('cbetRiverOpp','cbetRiver','C-Bet River','river')
  if(metric==='foldcbetf')boolMetric('facedCbetFlop','foldVsCbetFlop','Fold vs C-Bet Flop','flop')
  if(metric==='xrf'){
    rows=all.filter(x=>x.xrFlopOpp>0);hits=rows.filter(x=>x.xrFlop>0);den=rows.reduce((a,x)=>a+x.xrFlopOpp,0);num=rows.reduce((a,x)=>a+x.xrFlop,0);title=`${labelPos} · XR Flop — ${num}/${den} oportunidades`;streetMode='flop'
  }
  if(metric==='xrt'){
    rows=all.filter(x=>x.xrTurnOpp>0);hits=rows.filter(x=>x.xrTurn>0);den=rows.reduce((a,x)=>a+x.xrTurnOpp,0);num=rows.reduce((a,x)=>a+x.xrTurn,0);title=`${labelPos} · XR Turn — ${num}/${den} oportunidades`;streetMode='turn'
  }
  if(metric==='xrr'){
    rows=all.filter(x=>x.xrRiverOpp>0);hits=rows.filter(x=>x.xrRiver>0);den=rows.reduce((a,x)=>a+x.xrRiverOpp,0);num=rows.reduce((a,x)=>a+x.xrRiver,0);title=`${labelPos} · XR River — ${num}/${den} oportunidades`;streetMode='river'
  }
  if(metric==='xr'){
    rows=all.filter(x=>x.xrOppCount>0);hits=rows.filter(x=>x.xrCount>0);den=rows.reduce((a,x)=>a+x.xrOppCount,0);num=rows.reduce((a,x)=>a+x.xrCount,0);title=`${labelPos} · Check-Raise — ${num}/${den} oportunidades`;streetMode='postflop'
  }
  if(metric==='bb100'){rows=[...all].sort((a,b)=>Math.abs(b.netBb)-Math.abs(a.netBb));hits=rows;title=`${labelPos} · bb/100 — auditoria de resultado (${all.length.toLocaleString('pt-BR')} mãos)`}
  if(metric.startsWith('adv|')){
    const p=metric.split('|'),hitKey=p[1],oppKey=p[2],st=p[3]||'all',lab=decodeURIComponent(p[4]||hitKey)
    advancedHitKey=hitKey;rows=all.filter(x=>(+x[oppKey]||0)>0);hits=rows.filter(x=>(+x[hitKey]||0)>0);den=rows.reduce((a,x)=>a+(+x[oppKey]||0),0);num=rows.reduce((a,x)=>a+(+x[hitKey]||0),0);title=`${labelPos} · ${lab} — ${num}/${den} oportunidades`;streetMode=st
  }
  const cards=x=>(x.heroCards||[]).slice(0,2).join(' ')||'—'
  const replayName=title.split(' — ')[0]
  if(reviewTarget==='misses'&&metric!=='bb100')title += ' · alvo: oportunidades sem a ação'
  else if(reviewTarget==='hits'&&metric!=='bb100')title += ' · alvo: ações executadas'
  const hitFor=(x)=>{
    if(metric==='vpip')return x.vpip;if(metric==='pfr')return x.pfr;if(metric==='wwsf')return x.sawFlop&&x.won;
    if(metric==='rfi')return x.rfi;if(metric==='limp')return x.limp;if(metric==='3bet')return x.threeBet;if(metric==='squeeze')return x.squeeze
    if(metric==='call3')return x.call3bet;if(metric==='fold3')return x.foldTo3bet;if(metric==='4bet')return x.fourBet;if(metric==='steal')return x.steal
    if(metric==='foldbbsteal')return x.foldBbVsSteal;if(metric==='cbet')return x.cbet;if(metric==='cbett')return x.cbetTurn
    if(metric==='cbetr')return x.cbetRiver;if(metric==='foldcbetf')return x.foldVsCbetFlop
    if(metric==='xrf')return x.xrFlop>0;if(metric==='xrt')return x.xrTurn>0;if(metric==='xrr')return x.xrRiver>0;if(metric==='xr')return x.xrCount>0
    if(advancedHitKey)return (+x[advancedHitKey]||0)>0
    return null
  }
  // Quando a auditoria nasce do Resumo de Leaks, escolhemos o subconjunto que EXPLICA o desvio.
  // 'misses' = oportunidades em que a ação-alvo não ocorreu; 'hits' = ações executadas.
  const isAdvanced=metric.startsWith('adv|')
  const missFor=x=>{
    if(metric==='bb100')return false
    if(isAdvanced){const p=metric.split('|'),hitKey=p[1],oppKey=p[2];return (+x[oppKey]||0)>(+x[hitKey]||0)}
    if(metric==='xrf')return (+x.xrFlopOpp||0)>(+x.xrFlop||0)
    if(metric==='xrt')return (+x.xrTurnOpp||0)>(+x.xrTurn||0)
    if(metric==='xrr')return (+x.xrRiverOpp||0)>(+x.xrRiver||0)
    if(metric==='xr')return (+x.xrOppCount||0)>(+x.xrCount||0)
    return !hitFor(x)
  }
  let reviewRows=metric==='bb100'?rows:(reviewTarget==='misses'?rows.filter(missFor):hits)
  const opportunityRows=[...reviewRows]
  const strategicMetric=v83MetricKind(metric)
  const strategicEligible=!!strategicMetric && strategicMode
  const outcomeCounts={fold:0,call:0,raise_ai:0,raise_nai:0,other:0}
  if(strategicEligible){
    for(const x of reviewRows){
      const outcome=strategicMetric.includes('fourBet')||strategicMetric==='4bet'?String(x.fourBetOutcome||''):String(x.threeBetOutcome||'')
      if(outcome in outcomeCounts)outcomeCounts[outcome]++;else outcomeCounts.other++
      x.__strategicMetric=strategicMetric
    }
    if(reviewTarget==='misses'&&['3bet','threeBetNAI'].includes(strategicMetric))reviewRows=reviewRows.filter(x=>['fold','call'].includes(String(x.threeBetOutcome||'')))
    if(reviewTarget==='misses'&&['fourBetNAI','fourBetTotal','4bet'].includes(strategicMetric))reviewRows=reviewRows.filter(x=>['fold','call'].includes(String(x.fourBetOutcome||'')))
  }
  const passiveRows=[...reviewRows]
  const strategicRows=strategicEligible?reviewRows.filter(x=>v83StrategicInfo(x,strategicMetric,reviewTarget).keep):reviewRows
  if(strategicEligible){
    for(const x of strategicRows){
      const info=v83StrategicInfo(x,strategicMetric,reviewTarget),tier=v82CandidateTier(info)
      x.__strategicScore=info.score||0;x.__strategicReason=info.reason||'';x.__strategicTier=tier.key;x.__strategicTierLabel=tier.label;x.__strategicTierRank=tier.rank
    }
    reviewRows=strategicRows.sort((a,b)=>(b.__strategicTierRank||0)-(a.__strategicTierRank||0)||(b.__strategicScore||0)-(a.__strategicScore||0)||String(a.date||'').localeCompare(String(b.date||'')))
  }
  const reviewCount=reviewRows.length
  const reviewWord=reviewTarget==='misses'?'oportunidades sem a ação':'mãos com a ação'
  const replayUniverseRows=strategicEligible?passiveRows:reviewRows
  const replayLabel=metric==='bb100'?`${labelPos} · amostra de bb/100`:`${replayName} · ${strategicEligible?'universo auditável + prioridades':reviewTarget==='misses'?'oportunidades sem a ação':'ações executadas'}`
  const outcomeSummary=strategicEligible?`${opportunityRows.length.toLocaleString('pt-BR')} mãos na fila bruta · ${passiveRows.length.toLocaleString('pt-BR')} no universo auditável · ${reviewCount.toLocaleString('pt-BR')} priorizadas · ${v82TierSummary(reviewRows)}`:''
  const replayBar=replayUniverseRows.length?`<div class="audit-replay-bar ${reviewTarget==='misses'?'misses':''}"><div><b>${strategicEligible?`${replayUniverseRows.length.toLocaleString('pt-BR')} oportunidades válidas · ${reviewCount.toLocaleString('pt-BR')} priorizadas`:`${reviewCount.toLocaleString('pt-BR')} ${reviewWord}`}</b><span>${metric==='bb100'?'Abrir esta amostra no Replayer.':strategicEligible?`${outcomeSummary}. Strategic Priority Engine V8.3.6 preserva TODAS as decisões válidas e usa Forte/Mix/Fronteira apenas para ordenar/filtrar a revisão. NÃO substitui solver/GTO.`:reviewTarget==='misses'?'Este leak está abaixo da frequência de referência: revise decisões válidas em que a ação não ocorreu. Mãos em que a ação anterior já era all-in são excluídas quando incompatíveis com a stat.':'Este leak está acima da frequência de referência: revise onde a ação foi executada.'}</span></div><button class="btn" id="auditOpenReplay">🎬 Abrir no Replayer</button></div>`:`<div class="audit-replay-bar empty"><span>Nenhuma mão encontrada para este alvo de revisão.</span></div>`
  const displayRows=(reviewTarget==='misses'&&metric!=='bb100')?reviewRows:rows
  const shown=displayRows.slice(0,100)
  const relevantActions=(x)=>{
    const aa=x.auditActions||[]
    if(streetMode==='preflop')return aa.filter(a=>a.street==='preflop')
    if(streetMode==='flop')return aa.filter(a=>['preflop','flop'].includes(a.street))
    if(streetMode==='turn')return aa.filter(a=>['preflop','flop','turn'].includes(a.street))
    if(streetMode==='river'||streetMode==='postflop')return aa
    return aa
  }
  const html=`${replayBar}<div class="audit-modal-note">${metric==='bb100'?'As 100 mãos de maior impacto absoluto aparecem primeiro.':reviewTarget==='misses'?'Mostrando oportunidades estatisticamente válidas em que a ação-alvo NÃO aconteceu. Isso não significa que a ação seria obrigatória pela teoria/GTO. Quando o Strategic Priority Engine estiver ativo, ações incompatíveis são separadas e a lista é ordenada por prioridade contextual. Ainda é uma fila conservadora de candidatos, não uma afirmação GTO.':'Cada linha abaixo pertence ao denominador da estatística. O selo verde indica quando entrou no numerador.'}</div><div class="audit-hand-list">${shown.map(x=>{const hit=hitFor(x),relevant=relevantActions(x);return `<details class="audit-hand"><summary><b>#${esc(x.handId)}</b><span>${esc(x.date)} · ${cards(x)} · ${x.stack.toFixed(1)}bb${strategicEligible?` · ${esc(x.__strategicTierLabel||v82CandidateTier(v83StrategicInfo(x,strategicMetric,reviewTarget)).label)} · ${esc(x.__strategicReason||v83StrategicInfo(x,strategicMetric,reviewTarget).reason||'candidato')}`:''}</span>${hit===null?`<strong class="${x.netBb>=0?'good':'bad'}">${x.netBb>=0?'+':''}${x.netBb.toFixed(2)}bb</strong>`:`<strong class="${hit?'good':reviewTarget==='misses'?'warn':''}">${hit?'✓ ação executada':reviewTarget==='misses'?(strategicEligible?`◎ ${esc(x.__strategicTierLabel||'candidato')}`:'○ oportunidade sem a ação'):'só oportunidade'}</strong>`}</summary><div class="audit-actions">${relevant.map(a=>`<code>${esc(a.street)} · ${esc(auditActionText(a))}</code>`).join('')}</div></details>`}).join('')}</div>${displayRows.length>shown.length?`<p class="muted">Mostrando 100 de ${displayRows.length.toLocaleString('pt-BR')} mãos para manter a auditoria rápida.</p>`:''}`
  openModal(title,html)
  const open=document.getElementById('auditOpenReplay');if(open)open.onclick=()=>openHhFactsInReplayer(replayUniverseRows,replayLabel,{priorityFacts:strategicEligible?reviewRows:[]})
}

function hhEvolutionSeries(facts){
  const a=[...(facts||[])].sort((x,y)=>String(x.date||'').localeCompare(String(y.date||''))||String(x.handId||'').localeCompare(String(y.handId||'')))
  let total=0,show=0,non=0,allin=0
  return a.map((x,i)=>{const v=Number(x.netBb)||0,ev=Number.isFinite(x.allinEvBb)?x.allinEvBb:v;total+=v;allin+=ev;if(x.wentShowdown)show+=v;else non+=v;return {i:i+1,date:x.date||'',total,show,non,allin}})
}
function hhEvolutionSvg(facts){
  const pts=hhEvolutionSeries(facts);if(!pts.length)return '<p class="muted">Sem mãos neste filtro.</p>'
  const W=1100,H=430,P=48
  let mn=0,mx=0
  for(const p of pts){if(p.total<mn)mn=p.total;if(p.show<mn)mn=p.show;if(p.non<mn)mn=p.non;if(p.allin<mn)mn=p.allin;if(p.total>mx)mx=p.total;if(p.show>mx)mx=p.show;if(p.non>mx)mx=p.non;if(p.allin>mx)mx=p.allin}
  const span=(mx-mn)||1
  const x=i=>P+(i/Math.max(1,pts.length-1))*(W-P*2),y=v=>H-P-((v-mn)/span)*(H-P*2)
  const maxDraw=1800,step=Math.max(1,Math.ceil(pts.length/maxDraw)),draw=[]
  for(let i=0;i<pts.length;i+=step)draw.push({p:pts[i],i})
  if(draw.at(-1)?.i!==pts.length-1)draw.push({p:pts.at(-1),i:pts.length-1})
  const path=k=>draw.map((o,j)=>`${j?'L':'M'}${x(o.i).toFixed(1)},${y(o.p[k]).toFixed(1)}`).join(' ')
  const grid=[0,.25,.5,.75,1].map(t=>{const v=mx-(mx-mn)*t,yy=P+(H-P*2)*t;return `<line x1="${P}" x2="${W-P}" y1="${yy}" y2="${yy}"/><text x="8" y="${yy+4}">${v.toFixed(0)}bb</text>`}).join('')
  return `<div class="v72-chart-legend"><span class="green">● Total</span><span class="red">● Non-showdown</span><span class="blue">● Showdown</span><span class="yellow">● All-in EV</span></div><svg class="v72-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico acumulado em big blinds"><g class="v72-grid">${grid}</g><path class="line green" d="${path('total')}"/><path class="line red" d="${path('non')}"/><path class="line blue" d="${path('show')}"/><path class="line yellow" d="${path('allin')}"/></svg><div class="v72-chart-summary"><b>${pts.length.toLocaleString('pt-BR')} mãos</b><span>Total: ${(pts.at(-1).total>=0?'+':'')+pts.at(-1).total.toFixed(1)}bb</span><span>Showdown: ${(pts.at(-1).show>=0?'+':'')+pts.at(-1).show.toFixed(1)}bb</span><span>Non-showdown: ${(pts.at(-1).non>=0?'+':'')+pts.at(-1).non.toFixed(1)}bb</span><span>All-in EV: ${(pts.at(-1).allin>=0?'+':'')+pts.at(-1).allin.toFixed(1)}bb</span></div>`
}
function hhEvolutionModal(){openModal('Gráfico de evolução — big blinds',`<div class="audit-modal-note">Linhas calculadas mão a mão usando o BB de cada Hand History. Verde = resultado total; vermelha = potes sem showdown; azul = potes com showdown; amarela = All-in EV. O motor usa cálculo exato no flop/turn/river e simulação determinística no pré-flop quando todas as cartas do showdown são conhecidas.</div>${hhEvolutionSvg(hhStatsFilteredCache)}`)}
function hhFactsDateRange(facts){
  const ds=facts.map(x=>x.date).filter(Boolean).sort();return {start:ds[0]||'',end:ds.at(-1)||''}
}
function hhFilterLabel(){
  const f=hhStatsFilters,parts=[hhGameLabel(f.game)];if(f.position!=='all')parts.push(f.position);if(f.stack!=='all')parts.push(`${f.stack}bb`);if(f.players!=='all')parts.push(`${f.players}-max`);if(f.start||f.end)parts.push(`${f.start||'início'} → ${f.end||'fim'}`);return parts.join(' · ')
}
function hhCompareStatsHtml(A,B,labelA='Período A',labelB='Período B'){
  if(!A.length||!B.length)return '<div class="audit-modal-note">Um dos períodos não possui mãos com os filtros atuais.</div>'
  const sa=aggregateHhStats(A),sb=aggregateHhStats(B)
  const row=(lab,x,y,fmt=v=>v.toFixed(1)+'%')=>{const d=y-x;return `<tr><td>${lab}</td><td>${fmt(x)}</td><td>${fmt(y)}</td><td class="${d>=0?'good':'bad'}">${d>=0?'+':''}${fmt(d)}</td></tr>`}
  return `<div class="v73-compare-head"><div><small>${labelA}</small><b>${A.length.toLocaleString('pt-BR')} mãos</b></div><div><small>${labelB}</small><b>${B.length.toLocaleString('pt-BR')} mãos</b></div></div><table class="table"><thead><tr><th>Stat</th><th>${labelA}</th><th>${labelB}</th><th>Δ</th></tr></thead><tbody>${row('VPIP',sa.vpip,sb.vpip)}${row('PFR',sa.pfr,sb.pfr)}${row('RFI',sa.rfi,sb.rfi)}${row('3Bet',sa.threeBet,sb.threeBet)}${row('Fold to 3Bet',sa.fold3,sb.fold3)}${row('C-Bet F',sa.cbet,sb.cbet)}${row('C-Bet T',sa.cbetT,sb.cbetT)}${row('XR F',sa.xrF,sb.xrF)}${row('WTSD',sa.wtsd,sb.wtsd)}${row('W$SD',sa.wsd,sb.wsd)}${row('bb/100',sa.bb100,sb.bb100,v=>(v>=0?'+':'')+v.toFixed(1))}${row('EVbb/100',sa.evbb100,sb.evbb100,v=>(v>=0?'+':'')+v.toFixed(1))}</tbody></table>`
}
function hhCompareModal(){
  const all=[...hhStatsFilteredCache].sort((x,y)=>String(x.date||'').localeCompare(String(y.date||'')));if(all.length<2)return alert('Amostra insuficiente para comparar períodos.')
  const r=hhFactsDateRange(all),start=r.start,end=r.end
  let mid='';if(start&&end){const a=new Date(start+'T12:00:00'),b=new Date(end+'T12:00:00');mid=new Date((a.getTime()+b.getTime())/2).toISOString().slice(0,10)}
  openModal('Comparar períodos',`<div class="audit-modal-note">Escolha dois intervalos. Os demais filtros do Tracker (modalidade, posição, stack e tamanho da mesa) continuam valendo.</div><div class="v73-period-grid"><label>Período A · início<input id="cmpA1" type="date" value="${start}"></label><label>Período A · fim<input id="cmpA2" type="date" value="${mid||end}"></label><label>Período B · início<input id="cmpB1" type="date" value="${mid||start}"></label><label>Período B · fim<input id="cmpB2" type="date" value="${end}"></label><button class="btn" id="runHhCompare">Comparar</button></div><div id="hhCompareResult">${hhCompareStatsHtml(all.slice(0,Math.floor(all.length/2)),all.slice(Math.floor(all.length/2)),'1ª metade','2ª metade')}</div>`)
  setTimeout(()=>{const btn=document.querySelector('#runHhCompare');if(btn)btn.onclick=()=>{const a1=cmpA1.value,a2=cmpA2.value,b1=cmpB1.value,b2=cmpB2.value;const A=all.filter(x=>(!a1||x.date>=a1)&&(!a2||x.date<=a2)),B=all.filter(x=>(!b1||x.date>=b1)&&(!b2||x.date<=b2));hhCompareResult.innerHTML=hhCompareStatsHtml(A,B,'Período A','Período B')}},0)
}
function hhReportModal(){
  const f=hhStatsFilteredCache,s=aggregateHhStats(f),range=hhFactsDateRange(f),fmt=v=>v.toFixed(1)+'%'
  const positions=['UTG','HJ','CO','BTN','SB','BB'].map(pos=>{const a=f.filter(x=>x.position===pos);if(!a.length)return '';const z=aggregateHhStats(a);return `<tr><td>${pos}</td><td>${a.length.toLocaleString('pt-BR')}</td><td>${fmt(z.rfi)}</td><td>${fmt(z.threeBet)}</td><td>${fmt(z.cbet)}</td><td>${fmt(z.xrF)}</td><td class="${z.bb100>=0?'good':'bad'}">${z.bb100>=0?'+':''}${z.bb100.toFixed(1)}</td></tr>`}).join('')
  openModal('Relatório do Tracker',`<div class="v73-report"><div class="v73-report-toolbar"><div><b>${f.length.toLocaleString('pt-BR')} mãos</b><span>${esc(hhFilterLabel())}</span><small>${range.start||'—'} → ${range.end||'—'}</small></div><button class="btn" id="printTrackerReport">🖨️ Imprimir / Salvar PDF</button></div><div class="cards v73-report-kpis">${statCard('VPIP',fmt(s.vpip))}${statCard('PFR',fmt(s.pfr))}${statCard('RFI',fmt(s.rfi))}${statCard('3Bet',fmt(s.threeBet))}${statCard('C-Bet Flop',fmt(s.cbet))}${statCard('XR Flop',fmt(s.xrF))}${statCard('WTSD',fmt(s.wtsd))}${statCard('W$SD',fmt(s.wsd))}${statCard('bb/100',(s.bb100>=0?'+':'')+s.bb100.toFixed(1))}${statCard('EVbb/100',(s.evbb100>=0?'+':'')+s.evbb100.toFixed(1),`${s.allinAvailable}/${s.allinCount} all-ins`)}</div><h3>Gráfico acumulado</h3>${hhEvolutionSvg(f)}<h3>Resumo por posição</h3><table class="table"><thead><tr><th>Pos.</th><th>Mãos</th><th>RFI</th><th>3Bet</th><th>CBet F</th><th>XR F</th><th>bb/100</th></tr></thead><tbody>${positions}</tbody></table><div class="audit-modal-note">All-in EV: ${s.allinAvailable.toLocaleString('pt-BR')} de ${s.allinCount.toLocaleString('pt-BR')} all-ins calculados (${s.allinExact.toLocaleString('pt-BR')} exatos pós-flop; ${s.allinSampled.toLocaleString('pt-BR')} simulados pré-flop). All-ins sem cartas adversárias conhecidas não são ajustados.</div></div>`)
  setTimeout(()=>{const b=document.querySelector('#printTrackerReport');if(b)b.onclick=()=>window.print()},0)
}
function hhNotesModal(){
  const key='poker-study-tracker-notes-v1',saved=localStorage.getItem(key)||''
  openModal('Notas e marcações do Tracker',`<div class="audit-modal-note">Bloco de notas local para registrar hipóteses de leaks, ajustes e pontos para revisar. Fica salvo neste navegador.</div><textarea id="trackerNotesText" class="v73-notes" placeholder="Ex.: revisar defesa de BB vs BTN 15–25bb...">${esc(saved)}</textarea><div class="toolbar"><button class="btn" id="saveTrackerNotes">Salvar notas</button><span id="trackerNotesStatus" class="muted"></span></div>`)
  setTimeout(()=>{const b=document.querySelector('#saveTrackerNotes');if(b)b.onclick=()=>{localStorage.setItem(key,trackerNotesText.value);trackerNotesStatus.textContent='Salvo neste navegador.'}},0)
}
function hhExportCsv(){
  const rows=[['hand_id','date','game','position','players','stack_bb','net_bb','allin_ev_bb','ev_delta_bb','allin','allin_ev_available','allin_equity','allin_method','showdown','vpip','pfr','rfi','three_bet','cbet_flop','xr_flop']]
  for(const x of hhStatsFilteredCache)rows.push([x.handId,x.date,x.game,x.position,x.players,x.stack.toFixed(2),x.netBb.toFixed(4),(Number.isFinite(x.allinEvBb)?x.allinEvBb:x.netBb).toFixed(4),(x.evDeltaBb||0).toFixed(4),x.allin?1:0,x.allinEvAvailable?1:0,x.allinEquity==null?'':x.allinEquity.toFixed(6),x.allinMethod||'',x.wentShowdown?1:0,x.vpip?1:0,x.pfr?1:0,x.rfi?1:0,x.threeBet?1:0,x.cbet?1:0,x.xrFlop>0?1:0])
  const q=v=>'"'+String(v??'').replaceAll('"','""')+'"',csv=rows.map(r=>r.map(q).join(',')).join('\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`poker-study-stats-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function bindV72Actions(){
  document.querySelectorAll('[data-v71-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.v71Action;if(a==='evolution')return hhEvolutionModal();if(a==='compare')return hhCompareModal();if(a==='csv')return hhExportCsv();if(a==='pdf')return hhReportModal();if(a==='notes')return hhNotesModal()})
}
function bindHhAudit(){
  // LeakFinder V8.0.2: rota totalmente separada dos botões comuns de auditoria.
  // Isso impede que o alvo "misses" seja sobrescrito pelo padrão "hits".
  document.querySelectorAll('[data-leak-metric]').forEach(b=>b.onclick=(ev)=>{
    ev.preventDefault();ev.stopPropagation();
    const metric=b.dataset.leakMetric;
    const pos=b.dataset.leakPos||'all';
    const target=b.dataset.leakTarget==='misses'?'misses':'hits';
    hhAuditModal(metric,pos,target,true)
  })
  document.querySelectorAll('[data-strategy-metric]').forEach(b=>b.onclick=(ev)=>{ev.preventDefault();ev.stopPropagation();hhAuditModal(b.dataset.strategyMetric,b.dataset.strategyPos||'all',b.dataset.strategyTarget||'hits',true)})
  // Botões comuns continuam auditando ações executadas por padrão, sem triagem estratégica automática.
  document.querySelectorAll('[data-audit-metric]').forEach(b=>b.onclick=()=>hhAuditModal(b.dataset.auditMetric,b.dataset.auditPos,b.dataset.reviewTarget||'hits',false))
  bindV72Actions()
}
async function refreshHhStats(){const imports=await hhStatsImports();const byId=new Map();for(const r of imports)for(const h of (r.hands||[])){const f=heroHandFacts(h);if(f)byId.set(f.handId,f)}hhStatsCache=[...byId.values()];bindHhStatsFilters()}
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
  const visible=hhReplayContext?v835HandsForClass():hs
  replayState.viewHands=visible
  return `${hhReplayContext?`<div class="notice replay-study-context"><div><b>🎯 Sessão enviada pelo Stats HH</b><span>${esc(hhReplayContext.label)} · ${hhReplayContext.count.toLocaleString('pt-BR')} mãos${hhReplayContext.summary?` · ${esc(hhReplayContext.summary)}`:''}</span></div><button class="btn small secondary" id="backToHhStats">← Voltar ao Stats HH</button></div>${v835HandClassBar()}`:''}<div class="replay-layout"><div class="panel replay-list-panel"><div class="replay-summary"><b id="replayFilteredSummary">${visible.length} mãos detectadas</b><span class="muted">${esc(replayState.sourceName||'Hand History')}</span></div><input id="replaySearch" placeholder="Buscar cartas, mão, horário..."><div id="replayHandList" class="replay-hand-list">${replayHandListHtml(visible,h)}</div></div><div id="replayStage">${replayStageHtml(h)}</div></div>`
}
function replayHandListHtml(list,selected){
  return list.map(h=>{const pos=h.positionMap[h.hero]||'',stack=h.bb?Math.round((h.seats.find(x=>x.name===h.hero)?.stack||0)/h.bb):0,cards=(h.heroCards||[]).map(cardHtml).join('')||'<span class="card-back">?</span><span class="card-back">?</span>',meta=hhReplayContext?.metaByHand?.[h.handId]||null,tier=meta?.tier?`<em class="strategic-tier ${esc(meta.tier)}">${esc(meta.tierLabel||meta.tier)}</em>`:'',hc=hhReplayContext?`<em class="v835-row-class">${esc(v835HandClassLabel(v835HandClass(h.heroCards)))}</em>`:'';return `<button class="replay-hand-row ${h.handId===selected?.handId?'active':''}" data-replay-hand="${esc(h.handId)}"><span class="sidebar-hole-cards">${cards}</span><span class="sidebar-hand-info"><b>${esc(h.heroCards.join(' ')||'-- --')} ${tier}</b><span>${esc(pos)} · ${stack||'?'}bb ${hc}</span><small>${esc(h.dateTime.slice(11))} · ${esc(h.handId)}</small></span></button>`}).join('')
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
  const hs=(replayState.viewHands&&replayState.viewHands.length?replayState.viewHands:replayState.hands)||[];if(!hs.length||!replayState.selected)return null
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
    const bindStatsReturn=()=>{const b=document.getElementById('backToHhStats');if(b)b.onclick=()=>{hhReplayContext=null;route('hhstats')}}
    const loadText=(text,name='Hand History',refreshSaved=true)=>{hhReplayContext=null;const hands=parseGgHistory(text);if(!hands.length)return alert('Não consegui reconhecer nenhuma mão GG neste texto.');replayState={hands,selected:hands[0],step:0,sourceName:name,rawText:String(text||''),speed:1,playing:false,showOpponentCards:false,equilabOpen:false,rangeByHand:{},rangeColor:'blue'};replayWorkspace.innerHTML=replayWorkspaceHtml();bindStatsReturn();v835BindHandClassFilter();v835RenderReplayList();if(document.getElementById('replaySearch'))replaySearch.oninput=v835RenderReplayList;bindReplayStage();if(refreshSaved)renderSavedReplays(loadText)}
    readHhFile.onclick=()=>{const f=hhFile.files[0];if(!f)return alert('Selecione o arquivo .txt.');const rd=new FileReader();rd.onload=()=>loadText(rd.result,f.name);rd.readAsText(f)}
    parseHhPaste.onclick=()=>loadText(hhPaste.value,'Texto colado')
    renderSavedReplays(loadText)
    bindStatsReturn()
    if(replayState.hands.length){v835BindHandClassFilter();v835RenderReplayList();if(document.getElementById('replaySearch'))replaySearch.oninput=v835RenderReplayList;bindReplayStage()}
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
