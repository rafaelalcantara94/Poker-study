import { supabase } from './supabase.js'
import './style.css'

const app=document.querySelector('#app')
let user=null, data={studies:[],hands:[],results:[]}

function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function money(n){return Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD'})}
function pct(a,b){return b?((a/b)*100).toFixed(1)+'%':'0.0%'}

function login(){
 app.innerHTML=`<main class="auth"><div class="authbox"><div class="brand">Poker <b>Study</b><small>V2 • MTT / PKO</small></div>
 <h1>Entrar</h1><p class="muted">Seu histórico agora fica na nuvem e sincroniza entre dispositivos.</p>
 <input id="email" type="email" placeholder="E-mail"><input id="password" type="password" placeholder="Senha">
 <button id="signin">Entrar</button><button id="signup" class="secondary">Criar conta</button><div id="msg"></div></div></main>`
 document.querySelector('#signin').onclick=async()=>{const {error}=await supabase.auth.signInWithPassword({email:email.value,password:password.value}); if(error)msg.textContent=error.message}
 document.querySelector('#signup').onclick=async()=>{const {error}=await supabase.auth.signUp({email:email.value,password:password.value}); msg.textContent=error?error.message:'Conta criada. Verifique o e-mail se a confirmação estiver ativada.'}
}
async function load(){
 const tables=['studies','hands','results']
 for(const t of tables){const {data:d,error}=await supabase.from(t).select('*').order('date',{ascending:false}); if(error){console.error(t,error);continue} data[t]=d||[]}
}
function shell(){
 app.innerHTML=`<div class="layout"><aside><div class="brand">Poker <b>Study</b><small>V2 • CLOUD</small></div>
 <nav><button data-p="dashboard">📊 Dashboard</button><button data-p="studies">📚 Estudos</button><button data-p="hands">🖐️ Mãos</button><button data-p="results">💰 Resultados</button><button data-p="reports">📈 Relatórios</button></nav>
 <button id="logout" class="logout">Sair</button></aside><section class="content"><header><div><h1 id="title">Dashboard</h1><p class="muted">Dados sincronizados na nuvem</p></div><span class="user">${esc(user.email)}</span></header><div id="page"></div></section></div>`
 document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>route(b.dataset.p))
 logout.onclick=async()=>{await supabase.auth.signOut();login()}
 route('dashboard')
}
function route(p){
 title.textContent={dashboard:'Dashboard',studies:'Estudos',hands:'Banco de mãos',results:'Resultados',reports:'Relatórios'}[p]
 const page=document.querySelector('#page')
 if(p==='dashboard')page.innerHTML=dashboard()
 if(p==='studies')page.innerHTML=studies()
 if(p==='hands')page.innerHTML=hands()
 if(p==='results')page.innerHTML=results()
 if(p==='reports')page.innerHTML=reports()
 bind(p)
}
function dashboard(){
 const r=data.results,g=r.reduce((a,x)=>a+(+x.tournaments||0),0),bi=r.reduce((a,x)=>a+(+x.buyins||0),0),p=r.reduce((a,x)=>a+(+x.profit||0),0),itm=r.reduce((a,x)=>a+(+x.itm||0),0)
 return `<div class="cards">${[['Torneios',g],['ABI',money(g?bi/g:0)],['Profit',money(p)],['ROI',pct(p,bi)],['ITM',pct(itm,g)],['Aulas',data.studies.filter(x=>x.status==='done').length+'/'+data.studies.length]].map(x=>`<div class="card"><small>${x[0]}</small><strong class="${x[0]==='Profit'&&p<0?'bad':''}">${x[1]}</strong></div>`).join('')}</div>
 <div class="grid"><div class="panel"><h2>Últimos resultados</h2>${resultsRows(5)}</div><div class="panel"><h2>Mãos pendentes</h2>${data.hands.filter(x=>x.status==='pending').slice(0,6).map(x=>`<div class="item"><b>${esc(x.topic)}</b><br>${esc(x.question)}</div>`).join('')||'<p class="muted">Nenhuma pendente.</p>'}</div></div>`
}
function studies(){return `<div class="toolbar"><button onclick="window.newStudy()">+ Nova aula</button></div><div class="panel">${data.studies.length?`<table><tr><th>Aula</th><th>Tema</th><th>Data</th><th>Status</th><th></th></tr>${data.studies.map(x=>`<tr><td>${esc(x.title)}</td><td>${esc(x.topic)}</td><td>${x.date}</td><td>${x.status==='done'?'✅ Assistida':'🟡 Pendente'}</td><td><button onclick="window.toggleStudy('${x.id}')">Alternar</button></td></tr>`).join('')}</table>`:'<p class="muted">Nenhuma aula cadastrada.</p>'}</div>`}
function hands(){return `<div class="toolbar"><button onclick="window.newHand()">+ Nova mão</button></div><div class="panel">${data.hands.length?`<table><tr><th>Data</th><th>Torneio</th><th>Spot</th><th>Tema</th><th>Dúvida</th><th>Status</th></tr>${data.hands.map(x=>`<tr><td>${x.date}</td><td>${esc(x.tournament)}</td><td>${esc(x.spot)}</td><td>${esc(x.topic)}</td><td>${esc(x.question)}</td><td><button onclick="window.toggleHand('${x.id}')">${x.status==='done'?'Resolvida':'Pendente'}</button></td></tr>`).join('')}</table>`:'<p class="muted">Nenhuma mão cadastrada.</p>'}</div>`}
function results(){return `<div class="toolbar"><button onclick="window.newResult()">+ Novo resultado</button></div><div class="panel">${resultsRows(100)}</div>`}
function resultsRows(n){const a=data.results.slice(0,n);return a.length?`<table><tr><th>Data</th><th>MTTs</th><th>ABI</th><th>Profit</th><th>ROI</th><th>ITM</th></tr>${a.map(x=>`<tr><td>${x.date}</td><td>${x.tournaments}</td><td>${money(x.abi)}</td><td class="${x.profit>=0?'good':'bad'}">${money(x.profit)}</td><td>${pct(x.profit,x.buyins)}</td><td>${x.itm}</td></tr>`).join('')}</table>`:'<p class="muted">Sem resultados.</p>'}
function reports(){const r=data.results,g=r.reduce((a,x)=>a+(+x.tournaments||0),0),bi=r.reduce((a,x)=>a+(+x.buyins||0),0),p=r.reduce((a,x)=>a+(+x.profit||0),0);return `<div class="cards"><div class="card"><small>Volume</small><strong>${g}</strong></div><div class="card"><small>Profit</small><strong>${money(p)}</strong></div><div class="card"><small>ROI</small><strong>${pct(p,bi)}</strong></div></div><div class="panel"><h2>Diagnóstico V2</h2><p>O relatório agora é calculado diretamente sobre os registros do banco de dados do usuário.</p><p>Próxima camada: filtros por site/ABI/formato, comparação de períodos e importação autorizada do SharkScope.</p></div>`}

async function insert(table,row){const {error}=await supabase.from(table).insert({...row,user_id:user.id});if(error)alert(error.message);else{await load();route(table==='studies'?'studies':table==='hands'?'hands':'results')}}
window.newStudy=()=>{const title=prompt('Título da aula');if(!title)return;insert('studies',{title,topic:prompt('Tema')||'Geral',date:new Date().toISOString().slice(0,10),duration:60,status:'done',notes:''})}
window.newHand=()=>{const q=prompt('Qual é a dúvida da mão?');if(!q)return;insert('hands',{date:new Date().toISOString().slice(0,10),tournament:prompt('Torneio')||'',spot:prompt('Spot')||'',topic:prompt('Tema')||'Geral',question:q,status:'pending',notes:''})}
window.newResult=()=>{const t=+prompt('Número de torneios')||0;if(!t)return;const abi=+prompt('ABI em $')||0,bi=t*abi,pr=+prompt('Prêmios em $')||0;insert('results',{date:new Date().toISOString().slice(0,10),tournaments:t,abi,buyins:bi,prizes:pr,profit:pr-bi,itm:+prompt('ITMs')||0,ft:+prompt('Final tables')||0,wins:+prompt('Vitórias')||0,hours:+prompt('Horas')||0})}
window.toggleStudy=async id=>{const x=data.studies.find(x=>x.id===id);await supabase.from('studies').update({status:x.status==='done'?'pending':'done'}).eq('id',id);await load();route('studies')}
window.toggleHand=async id=>{const x=data.hands.find(x=>x.id===id);await supabase.from('hands').update({status:x.status==='done'?'pending':'done'}).eq('id',id);await load();route('hands')}
function bind(){}

supabase.auth.onAuthStateChange(async(_,s)=>{user=s?.user||null;if(user){await load();shell()}else login()})
const {data:session}=await supabase.auth.getSession();user=session.session?.user||null;if(user){await load();shell()}else login()
