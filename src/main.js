import { supabase } from './supabase.js'
import './style.css'

const app = document.querySelector('#app')
let user = null
let db = { studies: [], hands: [], results: [], goals: [], tournaments: [] }
let currentPage = 'dashboard'
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
  app.innerHTML = `<main class="auth"><div class="authbox"><div class="brand">Poker <b>Study</b><small>V5 • STUDY ENGINE</small></div>
  <h1>Entrar</h1><p class="muted">Estudos, mãos e resultados sincronizados na nuvem.</p>
  <input id="email" type="email" placeholder="E-mail"><input id="password" type="password" placeholder="Senha">
  <button class="btn" id="signin">Entrar</button><button class="btn secondary" id="signup">Criar conta</button>
  <button class="auth-link" id="forgot" type="button">Esqueci minha senha</button><p id="msg" class="muted"></p></div></main>`
  signin.onclick=async()=>{msg.textContent='Entrando...';const {error}=await supabase.auth.signInWithPassword({email:email.value.trim(),password:password.value});msg.textContent=error?error.message:''}
  signup.onclick=async()=>{if(!email.value.trim()||!password.value)return msg.textContent='Preencha e-mail e senha.';const {error}=await supabase.auth.signUp({email:email.value.trim(),password:password.value});msg.textContent=error?error.message:'Conta criada. Verifique seu e-mail se necessário.'}
  forgot.onclick=()=>forgotPasswordView(email.value.trim())
}
function forgotPasswordView(prefill=''){
  app.innerHTML=`<main class="auth"><div class="authbox"><div class="brand">Poker <b>Study</b><small>V5 • RECUPERAÇÃO</small></div><h1>Recuperar senha</h1><p class="muted">Digite seu e-mail para receber um link de recuperação.</p><input id="resetEmail" type="email" value="${esc(prefill)}" placeholder="E-mail"><button class="btn" id="sendReset">Enviar link</button><button class="btn secondary" id="backLogin">Voltar</button><p id="resetMsg" class="muted"></p></div></main>`
  backLogin.onclick=loginView
  sendReset.onclick=async()=>{const e=resetEmail.value.trim();if(!e)return resetMsg.textContent='Digite seu e-mail.';sendReset.disabled=true;resetMsg.textContent='Enviando...';const {error}=await supabase.auth.resetPasswordForEmail(e,{redirectTo:window.location.origin});sendReset.disabled=false;resetMsg.textContent=error?error.message:'Pronto! Verifique seu e-mail.'}
}
function newPasswordView(){
  app.innerHTML=`<main class="auth"><div class="authbox"><div class="brand">Poker <b>Study</b><small>V5 • NOVA SENHA</small></div><h1>Criar nova senha</h1><input id="newPassword" type="password" placeholder="Nova senha"><input id="confirmPassword" type="password" placeholder="Confirmar nova senha"><button class="btn" id="savePassword">Salvar nova senha</button><p id="passwordMsg" class="muted"></p></div></main>`
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
  app.innerHTML=`<div class="app"><aside class="sidebar"><div class="brand">Poker <b>Study</b><small>V5 • CLOUD</small></div><nav class="nav">
  ${[['dashboard','📊 Dashboard'],['analytics','📉 Analytics'],['studies','📚 Estudos'],['hands','🖐️ Mãos'],['results','💰 Resultados'],['importer','↥ SharkScope / CSV'],['leaks','🧠 Central de Leaks'],['plan','🗓️ Plano de Estudos'],['evolution','🚀 Evolução'],['goals','🎯 Metas'],['reports','📈 Relatórios']].map(([p,l])=>`<button data-p="${p}">${l}</button>`).join('')}
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
  const meta={dashboard:['Dashboard','Visão geral de performance e estudo'],analytics:['Analytics','Profit acumulado, filtros por site e formato'],studies:['Estudos','Aulas, cursos, progresso e tags'],hands:['Banco de mãos','Imagens, revisão, confiança e prioridade'],results:['Resultados','Sessões manuais e métricas'],importer:['SharkScope / CSV','Importe torneios individuais com mapeamento de colunas'],leaks:['Central de Leaks','Spots recorrentes, confiança e prioridade de revisão'],plan:['Plano de Estudos','Fila automática do que estudar agora'],evolution:['Evolução','Cruze estudo, revisão e performance ao longo do tempo'],goals:['Metas','Objetivos de volume e estudo'],reports:['Relatórios','Leitura consolidada dos dados']}[p]
  title.textContent=meta[0];subtitle.textContent=meta[1]
  page.innerHTML=({dashboard,analytics,studies,hands,results,importer,leaks,plan,evolution,goals,reports})[p]()
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
function handCards(list){return `<div class="hand-grid">${list.length?list.map(h=>`<article class="hand-card">${h.image_url?`<img src="${h.image_url}" alt="Imagem da mão">`:`<div class="no-image">Sem imagem</div>`}<div class="hand-body"><h3>${h.favorite?'★ ':''}${esc(h.tournament||'Mão sem torneio')}</h3><div class="muted">${h.date} · ${esc(h.site||'')} · ${esc(h.format||'')}</div><p><b>${esc(h.spot||'Spot')}</b> · ${esc(h.topic||'Geral')} ${h.priority==='high'?'<span class="pill warn">alta</span>':''}</p><p>${esc(h.question||'')}</p><div>${tagList(h.tags).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="toolbar" style="margin-top:10px"><button class="btn small secondary" data-view-hand="${h.id}">Ver detalhes</button><button class="btn small" data-toggle-hand="${h.id}">${h.status==='done'?'Reabrir':'Marcar estudada'}</button><button class="btn small secondary" data-fav-hand="${h.id}">${h.favorite?'★':'☆'}</button></div></div></article>`).join(''):'<p class="muted">Nenhuma mão encontrada.</p>'}</div>`}
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
  document.querySelectorAll('[data-fav-hand]').forEach(b=>b.onclick=()=>favoriteHand(b.dataset.favHand))
}
function bindPage(p){
  if(p==='dashboard'||p==='analytics')bindFilters()
  if(p==='studies'){newStudy.onclick=studyModal;document.querySelectorAll('[data-toggle-study]').forEach(b=>b.onclick=()=>toggleStudy(b.dataset.toggleStudy))}
  if(p==='hands'){newHand.onclick=handModal;bindHandCards();const filterHands=()=>{let a=db.hands;if(handStatus.value==='pending')a=a.filter(x=>x.status!=='done');if(handStatus.value==='done')a=a.filter(x=>x.status==='done');if(handStatus.value==='favorite')a=a.filter(x=>x.favorite);if(handPriority.value!=='all')a=a.filter(x=>x.priority===handPriority.value);if(handFormat.value!=='all')a=a.filter(x=>x.format===handFormat.value);if(handTopic.value!=='all')a=a.filter(x=>x.topic===handTopic.value);if(handPosition.value!=='all')a=a.filter(x=>x.hero_position===handPosition.value);const q=handSearch.value.trim().toLowerCase();if(q)a=a.filter(x=>[x.spot,x.topic,x.tags,x.preflop,x.flop,x.turn,x.river,x.question,x.hero_position,x.villain_position,x.effective_stack].some(v=>String(v||'').toLowerCase().includes(q)));handCount.textContent=`${a.length} de ${db.hands.length} mãos`;handList.innerHTML=handCards(a);bindHandCards()};[handStatus,handPriority,handFormat,handTopic,handPosition].forEach(x=>x.onchange=filterHands);handSearch.oninput=filterHands}
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
function handModal(){openModal('Nova mão',`<div class="form"><div class="field"><label>Data</label><input id="h_date" type="date" value="${today()}"></div><div class="field"><label>Site</label><input id="h_site"></div><div class="field"><label>Torneio</label><input id="h_tournament"></div><div class="field"><label>Formato</label><select id="h_format"><option>PKO</option><option>MTT Regular</option><option>Satélite</option><option>Outro</option></select></div><div class="field"><label>Spot</label><input id="h_spot"></div><div class="field"><label>Tema</label><input id="h_topic"></div><div class="field"><label>Blinds</label><input id="h_blinds"></div><div class="field"><label>Stack efetivo</label><input id="h_stack"></div><div class="field"><label>Hero</label><input id="h_hero"></div><div class="field"><label>Vilão</label><input id="h_villain"></div><div class="field"><label>Prioridade</label><select id="h_priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="low">Baixa</option></select></div><div class="field"><label>Confiança na decisão (0–5)</label><input id="h_confidence" type="number" min="0" max="5" value="0"></div><div class="field span2"><label>Pré-flop</label><textarea id="h_preflop"></textarea></div><div class="field span2"><label>Flop</label><textarea id="h_flop"></textarea></div><div class="field span2"><label>Turn</label><textarea id="h_turn"></textarea></div><div class="field span2"><label>River</label><textarea id="h_river"></textarea></div><div class="field span2"><label>Dúvida</label><textarea id="h_question"></textarea></div><div class="field span2"><label>Análise / solução</label><textarea id="h_notes"></textarea></div><div class="field"><label>Tags</label><input id="h_tags"></div><div class="field"><label>Imagem da mão</label><input id="h_image" type="file" accept="image/*"></div></div><br><button class="btn" id="saveHand">Salvar mão</button><p id="uploadMsg" class="muted"></p>`);saveHand.onclick=async()=>{if(!h_question.value.trim())return alert('Digite a dúvida da mão.');saveHand.disabled=true;uploadMsg.textContent='Salvando...';let image_path=null;const f=h_image.files[0];if(f){const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,'_');image_path=`${user.id}/${uid()}-${safe}`;const {error}=await supabase.storage.from('hand-images').upload(image_path,f);if(error){saveHand.disabled=false;return uploadMsg.textContent='Erro no upload: '+error.message}}const row={date:h_date.value,site:h_site.value,tournament:h_tournament.value,format:h_format.value,spot:h_spot.value,topic:h_topic.value||'Geral',blinds:h_blinds.value,effective_stack:h_stack.value,hero_position:h_hero.value,villain_position:h_villain.value,priority:h_priority.value,confidence:+h_confidence.value||0,preflop:h_preflop.value,flop:h_flop.value,turn:h_turn.value,river:h_river.value,question:h_question.value,notes:h_notes.value,tags:h_tags.value,status:'pending',image_path};const {error}=await supabase.from('hands').insert({...row,user_id:user.id});if(error){saveHand.disabled=false;return uploadMsg.textContent=error.message}modal.classList.remove('show');await load();route('hands')}}
function viewHand(id){const h=db.hands.find(x=>x.id===id);openModal('Detalhes da mão',`${h.image_url?`<img src="${h.image_url}" class="hand-detail-img">`:''}<div class="grid2"><div class="panel"><b>${esc(h.tournament||'')}</b><p class="muted">${h.date} · ${esc(h.site||'')} · ${esc(h.format||'')}</p><p>${esc(h.spot||'')} · ${esc(h.blinds||'')} · ${esc(h.effective_stack||'')}</p><p>Hero: ${esc(h.hero_position||'')} · Vilão: ${esc(h.villain_position||'')}</p></div><div class="panel"><b>${esc(h.topic||'Geral')}</b><p>Prioridade: ${esc(h.priority||'normal')} · Confiança: ${h.confidence||0}/5</p><div>${tagList(h.tags).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><p><b>Dúvida:</b><br>${esc(h.question||'')}</p></div></div><div class="panel"><p><b>Pré-flop</b><br>${esc(h.preflop||'-')}</p><p><b>Flop</b><br>${esc(h.flop||'-')}</p><p><b>Turn</b><br>${esc(h.turn||'-')}</p><p><b>River</b><br>${esc(h.river||'-')}</p><p><b>Análise / solução</b><br>${esc(h.notes||'-')}</p></div>`)}
function resultModal(){openModal('Novo resultado',`<div class="form form3"><div class="field"><label>Data</label><input id="r_date" type="date" value="${today()}"></div><div class="field"><label>Site</label><input id="r_site"></div><div class="field"><label>Formato</label><select id="r_format"><option>PKO</option><option>MTT Regular</option><option>Satélite</option><option>Outro</option></select></div><div class="field"><label>Torneios</label><input id="r_tournaments" type="number" value="0"></div><div class="field"><label>Buy-ins ($)</label><input id="r_buyins" type="number" step=".01" value="0"></div><div class="field"><label>Prêmios ($)</label><input id="r_prizes" type="number" step=".01" value="0"></div><div class="field"><label>ITM</label><input id="r_itm" type="number" value="0"></div><div class="field"><label>FT</label><input id="r_ft" type="number" value="0"></div><div class="field"><label>Vitórias</label><input id="r_wins" type="number" value="0"></div><div class="field"><label>Horas</label><input id="r_hours" type="number" step=".1" value="0"></div></div><br><button class="btn" id="saveResult">Salvar</button>`);saveResult.onclick=()=>{const t=+r_tournaments.value||0,bi=+r_buyins.value||0,pr=+r_prizes.value||0;if(!t)return alert('Informe o número de torneios.');insert('results',{date:r_date.value,site:r_site.value,format:r_format.value,tournaments:t,buyins:bi,prizes:pr,profit:pr-bi,abi:t?bi/t:0,itm:+r_itm.value||0,ft:+r_ft.value||0,wins:+r_wins.value||0,hours:+r_hours.value||0});modal.classList.remove('show')}}
function goalModal(){openModal('Nova meta',`<div class="form"><div class="field"><label>Título</label><input id="g_title"></div><div class="field"><label>Métrica</label><select id="g_metric"><option>Volume</option><option>Estudo</option><option>Mãos revisadas</option><option>Profit</option><option>ROI</option></select></div><div class="field"><label>Meta</label><input id="g_target" type="number" step=".1"></div><div class="field"><label>Unidade</label><input id="g_unit"></div><div class="field"><label>Prazo</label><input id="g_date" type="date" value="${today()}"></div></div><br><button class="btn" id="saveGoal">Salvar</button>`);saveGoal.onclick=()=>{if(!g_title.value.trim())return alert('Digite o título da meta.');insert('goals',{title:g_title.value,metric:g_metric.value,target_value:+g_target.value||0,current_value:0,unit:g_unit.value,date:g_date.value});modal.classList.remove('show')}}
async function goalProgress(id){const g=db.goals.find(x=>x.id===id),v=prompt(`Valor atual (${g.unit||''})`,g.current_value||0);if(v===null)return;await supabase.from('goals').update({current_value:+v||0}).eq('id',id);await load();route('goals')}

supabase.auth.onAuthStateChange(async(event,s)=>{if(event==='PASSWORD_RECOVERY'){recoveryMode=true;user=s?.user||null;newPasswordView();return}if(recoveryMode)return;user=s?.user||null;if(user){await load();shell()}else loginView()})
const {data:s}=await supabase.auth.getSession();user=s.session?.user||null
const recoveryInUrl=window.location.hash.includes('type=recovery')||window.location.search.includes('type=recovery')
if(recoveryInUrl){recoveryMode=true;newPasswordView()}else if(user){await load();shell()}else loginView()
