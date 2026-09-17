export function teamLeakArea(label,group=''){
  const s=(String(label||'')+' '+String(group||'')).toLowerCase()
  if(/3bet|4bet|squeeze/.test(s))return '3Bet / 4Bet'
  if(/cbet|barrel|delay|bet\/check\/bet|probe|donk|x\/f|xr|check.raise/.test(s))return 'CBet / Pós-flop'
  if(/bb|sb|blind|steal|walk|iso/.test(s))return 'Blinds'
  if(/rfi|vpip|pfr|limp|preflop/.test(s))return 'Pré-flop'
  return 'Outros'
}

export function createTeamCenterUI(deps){
  const {
    esc,
    route,
    getUser,
    teamAdaptiveHandsPerPlayer,
    openTeamCollectiveReplayer,
    openTeamPlayerReviewPack,
    openTeamAreaCollectiveReplayer,
    alertFn=msg=>alert(msg)
  }=deps
  const alert=alertFn
  let refresh=()=>{}

let teamCenterFilters={player:'all',period:'all',room:'all'},teamLeakSeverity='all'
function teamcenter(){return `<div id="teamCenterRoot"><section class="panel"><h2>👥 Central do Time <span class="pill good">TEAM INTELLIGENCE</span></h2><p class="muted">Carregando inteligência da equipe…</p></section></div>`}
function teamNum(v,d=1){return Number(v||0).toFixed(d)}
function teamViewSnap(snap,period='all',room='all'){
  if(!snap)return null
  const views=snap.stats?.views||{},key=period+'|'+room
  // A room-specific selection must never fall back to the all-rooms view.
  // Players without data in the selected room are excluded from the active recorte.
  const view=room!=='all' ? views[key] : (views[key]||views[period+'|all']||views[period]||views['all|all']||views.all)
  if(!view)return room==='all'?snap:null
  return {...snap,hands:view.hands,stats:{...view,views:snap.stats?.views,dateRange:snap.stats?.dateRange,pokerIdentities:snap.stats?.pokerIdentities,roomsAvailable:snap.stats?.roomsAvailable,roomBreakdown:snap.stats?.roomBreakdown},leaks:view.leaks||[]}
}
function teamFilteredRows(rows){return rows.filter(x=>teamCenterFilters.player==='all'||x.member.user_id===teamCenterFilters.player).map(x=>({...x,snap:teamViewSnap(x.snap,teamCenterFilters.period,teamCenterFilters.room)})).filter(x=>x.snap)}
function teamFilterBar(rows){
  const labels={all:'Base completa','30d':'Últimos 30 dias','90d':'Últimos 90 dias','180d':'Últimos 6 meses','365d':'Últimos 12 meses'}
  const rooms=[...new Set(rows.flatMap(x=>x.snap?.stats?.roomsAvailable||x.snap?.stats?.pokerIdentities?.map(i=>i.room)||[]))].filter(Boolean).sort()
  return `<section class="team-filterbar team-filterbar-v3"><div class="team-filter-icon">👥</div><div><small>JOGADOR</small><select id="teamFilterPlayer"><option value="all">Todos os jogadores</option>${rows.map(x=>`<option value="${esc(x.member.user_id)}" ${teamCenterFilters.player===x.member.user_id?'selected':''}>${esc(x.member.display_name||x.member.email)}</option>`).join('')}</select></div><div class="team-filter-icon">♠</div><div><small>SALA</small><select id="teamFilterRoom"><option value="all">Todas as salas</option>${rooms.map(r=>`<option value="${esc(r)}" ${teamCenterFilters.room===r?'selected':''}>${esc(r)}</option>`).join('')}</select></div><div class="team-filter-icon">🗓</div><div><small>PERÍODO</small><select id="teamFilterPeriod">${Object.entries(labels).map(([k,v])=>`<option value="${k}" ${teamCenterFilters.period===k?'selected':''}>${v}</option>`).join('')}</select></div><button class="btn secondary small team-clear-btn" id="teamClearFilters">↻ Limpar filtros</button><span class="team-filter-meta">Pessoa consolidada por conta Poker Study; sala e nick permanecem investigáveis.</span></section>`
}
function teamPokerIdentityGroups(row){
  const st=row?.snap?.stats||{},ids=Array.isArray(st.pokerIdentities)?st.pokerIdentities:[],bd=st.roomBreakdown||{}
  const map=new Map()
  ids.forEach(i=>{const room=String(i?.room||'').trim(),nick=String(i?.nick||'').trim();if(!room||room==='Unknown'||!nick)return;if(!map.has(room))map.set(room,{room,nicks:new Set(),hands:+bd[room]||0});map.get(room).nicks.add(nick)})
  ;(st.roomsAvailable||[]).forEach(room=>{room=String(room||'').trim();if(room&&room!=='Unknown'&&!map.has(room))map.set(room,{room,nicks:new Set(),hands:+bd[room]||0})})
  return [...map.values()].map(x=>({...x,nicks:[...x.nicks]})).sort((a,b)=>(b.hands-a.hands)||a.room.localeCompare(b.room))
}
function teamPlayerIdentityPanel(row){
  if(!row?.snap)return ''
  const groups=teamPokerIdentityGroups(row),name=row.member.display_name||row.member.email||'Jogador'
  if(!groups.length)return ''
  return `<section class="panel team-identity-panel"><header><div><small>PLAYER IDENTITY</small><h2>${esc(name)} · salas e nicks</h2><p>Uma pessoa no Poker Study, com as identidades encontradas nas próprias Hand Histories importadas.</p></div><span class="pill">${groups.length} sala${groups.length===1?'':'s'}</span></header><div class="team-identity-grid">${groups.map(g=>`<article class="${teamCenterFilters.room===g.room?'active':''}"><div><small>SALA</small><b>${esc(g.room)}</b></div><div><small>NICK${g.nicks.length===1?'':'S'}</small><strong>${g.nicks.length?g.nicks.map(esc).join(' · '):'Não identificado'}</strong></div><em>${g.hands.toLocaleString('pt-BR')} mãos</em></article>`).join('')}</div><footer>Os nicks vêm somente do jogador identificado como dono/hero da HH; adversários não são associados à conta.</footer></section>`
}
function teamRoomDiagPanel(rows){
  const items=(rows||[]).map(x=>{const st=x.snap?.stats||{},rooms=st.roomsAvailable||[],bd=st.roomBreakdown||{};return `<span><b>${esc(x.member.display_name||x.member.email||'Jogador')}:</b> roomsAvailable=[${esc(rooms.join(', ')||'—')}] · roomBreakdown=${esc(JSON.stringify(bd))}</span>`}).join('')
  return `<section class="team-room-diag"><b>🧪 Diagnóstico Multi-Room · dados recebidos pela Central</b>${items||'<span>Sem snapshots.</span>'}</section>`
}
function teamPriorityScore(x){const leaks=x.snap?.leaks||[],hi=leaks.filter(l=>l.score>=1.5).length,score=leaks.slice(0,5).reduce((n,l)=>n+(+l.score||0),0);return hi*100+score*10+Math.min(20,Math.log10(Math.max(10,+x.snap?.hands||0))*4)}
function teamCollectiveLeaks(ready){
  const map={}
  ready.forEach(x=>(x.snap.leaks||[]).forEach(l=>{const key=String(l.label||'').trim();if(!key)return;if(!map[key])map[key]={label:key,players:new Set(),items:[],score:0};map[key].players.add(x.member.display_name||x.member.email);map[key].items.push({...l,player:x.member.display_name||x.member.email,userId:x.member.user_id});map[key].score+=+l.score||0}))
  return Object.values(map).filter(x=>x.players.size>1).sort((a,b)=>(b.players.size-a.players.size)||(b.score-a.score))
}

function teamAreaClass(leaks,area){
  const a=(leaks||[]).filter(l=>teamLeakArea(l.label,l.group)===area),max=Math.max(0,...a.map(l=>+l.score||0))
  if(!a.length)return {state:'ok',label:'Sem alerta',count:0,max:0}
  if(max>=1.5)return {state:'high',label:'Alta',count:a.length,max}
  if(max>=.75)return {state:'mid',label:'Média',count:a.length,max}
  return {state:'watch',label:'Atenção',count:a.length,max}
}
function teamPlayerXray(row){
  const z=row.snap?.stats||{},leaks=[...(row.snap?.leaks||[])].sort((a,b)=>b.score-a.score),top=leaks.slice(0,6),name=row.member.display_name||row.member.email,initials=name.slice(0,2).toUpperCase()
  const first=leaks[0],second=leaks[1]
  const strength=+z.wwsf>=46?`WWSF ${teamNum(z.wwsf)}% está em uma zona saudável para o benchmark atual.`:+z.bb100>0?`Winrate do recorte está positivo em +${teamNum(z.bb100)} bb/100.`:`Ainda não há um ponto forte estatístico claro com confiança suficiente.`
  const why=first?`O tema ${first.label} combina desvio relevante, ${(+first.den||0).toLocaleString('pt-BR')} oportunidades e prioridade ${first.score>=1.5?'alta':'média'}.`:'Nenhum desvio prioritário neste recorte.'
  const coach=first?`Trabalhar ${first.label} primeiro${second?`, e só depois avançar para ${second.label}`:''}. Evite dispersar a sessão em muitos desvios pequenos.`:'Manter acompanhamento e esperar mais amostra antes de criar uma intervenção.'
  return `<div class="team-modal-backdrop" id="teamXrayBackdrop"><section class="team-xray-modal team-coach-xray"><header><div class="team-xray-avatar">${esc(initials)}</div><div><small>RAIO-X DO COACH</small><h2>${esc(name)}</h2><p>${esc(row.member.role||'player')} · ${(+row.snap.hands||0).toLocaleString('pt-BR')} mãos no recorte</p></div><button id="teamXrayClose">×</button></header>
  <div class="team-xray-kpis"><div><small>bb/100</small><strong class="${+z.bb100>=0?'good-text':'bad-text'}">${+z.bb100>=0?'+':''}${teamNum(z.bb100)}</strong></div><div><small>VPIP / PFR</small><strong>${teamNum(z.vpip)} / ${teamNum(z.pfr)}</strong></div><div><small>3Bet</small><strong>${teamNum(z.threeBet)}%</strong></div><div><small>WWSF</small><strong>${teamNum(z.wwsf)}%</strong></div></div>
  ${(()=>{const groups=teamPokerIdentityGroups(row);return groups.length?`<div class="team-xray-identities"><div><small>IDENTIDADES DE POKER</small><b>Mesma pessoa · ${groups.length} sala${groups.length===1?'':'s'}</b></div>${groups.map(g=>`<span class="${teamCenterFilters.room===g.room?'active':''}"><strong>${esc(g.room)}</strong><i>${g.nicks.length?g.nicks.map(esc).join(' · '):'nick não identificado'}</i><em>${g.hands.toLocaleString('pt-BR')} mãos</em></span>`).join('')}</div>`:''})()}
  <div class="team-coach-summary"><article class="primary"><small>PRINCIPAL PONTO DE ATENÇÃO</small><strong>${first?esc(first.label):'Nenhum crítico agora'}</strong><span>${first?`${teamNum(first.value)}% · ref. ${esc(first.range)} · ${(+first.den||0).toLocaleString('pt-BR')} oportunidades`:'Aguardar mais amostra.'}</span></article><article><small>POR QUE AGORA?</small><p>${esc(why)}</p></article><article class="good"><small>PONTO POSITIVO</small><p>${esc(strength)}</p></article><article class="coach"><small>RECOMENDAÇÃO DO COACH</small><p>${esc(coach)}</p></article></div>
  <div class="team-xray-grid"><div class="team-xray-box"><h3>🎯 Prioridades técnicas</h3>${top.length?top.map((l,i)=>`<button class="team-xray-leak team-open-leak" data-team-leak="${esc(l.label)}"><b>${i+1}</b><span><strong>${esc(l.label)}</strong><small>${teamNum(l.value)}% · ref. ${esc(l.range)} · ${(+l.den||0).toLocaleString('pt-BR')} opp</small></span><em class="${l.score>=1.5?'critical':'important'}">${l.score>=1.5?'ALTA':'MÉDIA'}</em></button>`).join(''):'<p class="muted">Nenhum desvio prioritário neste recorte.</p>'}</div><div class="team-xray-box"><h3>🧠 Próxima ação</h3><div class="team-coach-note"><b>${leaks.filter(l=>l.score>=1.5).length} alerta(s) de alta prioridade</b><span>${first?`Comece por ${esc(first.label)}.`:'Sem foco crítico agora.'}</span></div><div class="team-coach-note"><b>Amostra</b><span>${(+row.snap.hands||0).toLocaleString('pt-BR')} mãos disponíveis neste recorte.</span></div><button class="btn small secondary team-filter-this-player" data-player="${esc(row.member.user_id)}">Filtrar Central por este jogador</button>${row.member.user_id===getUser()?.id?'<button class="btn small" id="teamGoOwnStats">Abrir meu Stats HH</button>':''}</div></div></section></div>`
}
function teamLeakDiagnosis(label,rows,area=null,userId=null){
  const affected=[]
  rows.filter(x=>x.snap).forEach(x=>(x.snap.leaks||[]).forEach(l=>{if((label&&l.label===label)||(area&&teamLeakArea(l.label,l.group)===area&&(!userId||x.member.user_id===userId)))affected.push({...l,player:x.member.display_name||x.member.email,userId:x.member.user_id})}))
  affected.sort((a,b)=>b.score-a.score)
  const title=label||area||'Diagnóstico',totalOpp=affected.reduce((n,x)=>n+(+x.den||0),0),players=[...new Set(affected.map(x=>x.player))],areaMode=!!area
  const uniquePlayers=[...new Map(affected.map(x=>[x.userId,x])).values()]
  const main=affected[0]
  return `<div class="team-modal-backdrop" id="teamLeakBackdrop"><section class="team-xray-modal team-leak-modal coach-diagnosis">
    <header><div class="team-xray-avatar red">🎯</div><div><small>${areaMode?'DIAGNÓSTICO DA ÁREA':'DIAGNÓSTICO DO LEAK'}</small><h2>${esc(title)}</h2><p>${players.length} jogador${players.length===1?'':'es'} · ${totalOpp.toLocaleString('pt-BR')} oportunidades somadas</p></div><button id="teamLeakClose">×</button></header>
    <div class="coach-diagnosis-why"><article><small>POR QUE IMPORTA?</small><b>${main?`${teamNum(main.value)}% vs ref. ${esc(main.range)}`:'Sem sinal prioritário'}</b><span>${main?`${(+main.den||0).toLocaleString('pt-BR')} oportunidades no sinal mais prioritário.`:'Aguardar amostra.'}</span></article><article><small>PRÓXIMO PASSO</small><b>${areaMode?'Escolher o leak e revisar mãos':'Revisar as decisões recentes'}</b><span>${areaMode?'A área agrupa métricas diferentes; use a lista abaixo para chegar ao spot exato.':'O Review Pack traz somente mãos relacionadas a este tema.'}</span></article></div>
    <div class="team-leak-player-list">${affected.map((x,i)=>`<article><span class="rank">${i+1}</span><div><b>${esc(x.player)}</b><small>${esc(x.label)} · ${teamNum(x.value)}% · ref. ${esc(x.range)} · ${(+x.den||0).toLocaleString('pt-BR')} opp</small></div><em class="${x.score>=1.5?'critical':'important'}">${x.score>=1.5?'ALTA':'MÉDIA'}</em><button class="btn small secondary team-leak-player-hands" data-team-leak="${esc(x.label)}" data-team-player="${esc(x.userId)}" data-team-player-name="${esc(x.player)}">Mãos</button><button class="btn small secondary team-leak-player-xray" data-team-player="${esc(x.userId)}">Raio-X</button></article>`).join('')||'<p class="muted">Nenhum sinal neste recorte.</p>'}</div>
    <div class="team-leak-actions"><button class="btn secondary" id="teamLeakGoPlan">🗓 Plano de Estudos</button>${label?`<button class="btn" id="teamLeakCollectiveReplay">🎬 ${players.length>1?'Replayer coletivo':'Abrir Review Pack'}</button>`:''}${areaMode?`<button class="btn" id="teamAreaCollectiveReplay" data-team-area="${esc(area)}" data-team-area-user="${esc(userId||'')}">🎬 Review Pack da área</button>`:''}</div>
    <div class="notice team-sync-note"><b>Como funciona:</b> “oportunidades” mede o denominador estatístico; “mãos” abre apenas o subconjunto recente sincronizado no Review Pack. Se um jogador ainda não tiver pacote, abra o Stats HH dele uma vez após esta atualização.</div>
  </section></div>`
}
function teamAreaPressure(leaks,area){
  const rows=(leaks||[]).filter(l=>teamLeakArea(l.label,l.group)===area)
  if(!rows.length)return {score:0,count:0,high:0,mid:0,watch:0}
  const high=rows.filter(l=>(+l.score||0)>=1.5).length,mid=rows.filter(l=>(+l.score||0)>=.75&&(+l.score||0)<1.5).length,watch=rows.length-high-mid
  const raw=rows.reduce((n,l)=>n+Math.min(2.5,+l.score||0),0)
  return {score:Math.min(100,Math.round(raw/(rows.length*2.1)*100)),count:rows.length,high,mid,watch}
}
function teamVisualAnalytics(ready){
  const areas=['Pré-flop','3Bet / 4Bet','Blinds','CBet / Pós-flop','Outros']
  const totals=areas.map(a=>{
    const ps=ready.map(x=>teamAreaPressure(x.snap?.leaks||[],a))
    const count=ps.reduce((n,p)=>n+p.count,0),high=ps.reduce((n,p)=>n+p.high,0),mid=ps.reduce((n,p)=>n+p.mid,0)
    const score=ps.length?Math.round(ps.reduce((n,p)=>n+p.score,0)/ps.length):0
    return {area:a,count,high,mid,score}
  })
  const cx=150,cy=132,r=94,levels=[.25,.5,.75,1]
  const point=(i,ratio)=>{const ang=-Math.PI/2+i*(Math.PI*2/areas.length);return [cx+Math.cos(ang)*r*ratio,cy+Math.sin(ang)*r*ratio]}
  const grid=levels.map(l=>areas.map((_,i)=>point(i,l).map(v=>v.toFixed(1)).join(',')).join(' ')).join('|')
  const polygon=totals.map((x,i)=>point(i,Math.max(.08,x.score/100)).map(v=>v.toFixed(1)).join(',')).join(' ')
  const axes=areas.map((_,i)=>{const [x,y]=point(i,1);return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"></line>`}).join('')
  const rings=grid.split('|').map(points=>`<polygon points="${points}"></polygon>`).join('')
  const labels=totals.map((x,i)=>{const [px,py]=point(i,1.26);return `<button class="team-radar-label" style="left:${px}px;top:${py}px" data-team-area="${esc(x.area)}"><b>${esc(x.area)}</b><small>${x.score} pressão · ${x.count} sinais</small></button>`}).join('')
  const maxCount=Math.max(1,...totals.map(x=>x.count))
  const playerCards=ready.map(x=>{
    const name=x.member.display_name||x.member.email,parts=areas.map(a=>({a,...teamAreaPressure(x.snap?.leaks||[],a)})),max=Math.max(1,...parts.map(p=>p.score))
    return `<button class="team-player-visual" data-team-player="${esc(x.member.user_id)}"><header><span>${esc(name)}</span><small>${(x.snap?.leaks||[]).length} sinais</small></header><div class="team-player-bars">${parts.map(p=>`<div title="${esc(p.a)}: ${p.score}"><span>${esc(p.a.replace('CBet / Pós-flop','Pós-flop').replace('3Bet / 4Bet','3B/4B'))}</span><i><b style="width:${p.score}%"></b></i><em>${p.score}</em></div>`).join('')}</div></button>`
  }).join('')
  return `<section class="team-visual-suite"><div class="team-visual-title"><div><span class="team-kicker">VISUAL ANALYTICS</span><h2>Onde o time está sentindo mais pressão?</h2><p>Os gráficos abaixo transformam os sinais do motor em leitura visual. Clique em qualquer área ou jogador para investigar.</p></div><span class="pill">${ready.length} jogador${ready.length===1?'':'es'}</span></div>
  <div class="team-visual-grid">
    <section class="panel team-radar-card"><header class="team-section-head"><div><span class="team-section-icon purple">✦</span><h2>Radar técnico do time</h2><p class="muted">Quanto mais distante do centro, maior a concentração de desvios naquela família.</p></div></header><div class="team-radar-wrap"><svg viewBox="0 0 300 264" class="team-radar-svg"><g class="grid">${rings}${axes}</g><polygon class="shape" points="${polygon}"></polygon><circle cx="${cx}" cy="${cy}" r="3"></circle></svg>${labels}</div></section>
    <section class="panel team-concentration-card"><header class="team-section-head"><div><span class="team-section-icon red">▥</span><h2>Concentração dos leaks</h2><p class="muted">Quantidade de sinais por família técnica. Clique em uma barra para abrir o diagnóstico.</p></div></header><div class="team-concentration-bars">${[...totals].sort((a,b)=>b.count-a.count).map(x=>`<button data-team-area="${esc(x.area)}"><span><b>${esc(x.area)}</b><small>${x.high} alta · ${x.mid} média</small></span><i><b style="width:${Math.max(4,x.count/maxCount*100)}%"></b></i><em>${x.count}</em></button>`).join('')}</div></section>
  </div>
  <section class="panel team-player-compare"><header class="team-section-head"><div><span class="team-section-icon blue">▤</span><h2>Pressão técnica por jogador</h2><p class="muted">Não repete VPIP/PFR da tabela: compara a força dos desvios por família. Clique no jogador para abrir o Raio-X do Coach.</p></div></header><div class="team-player-visual-grid">${playerCards||'<div class="notice">Sem jogadores neste recorte.</div>'}</div></section>
  </section>`
}
function teamTechnicalMatrix(ready){
  const areas=['Pré-flop','3Bet / 4Bet','Blinds','CBet / Pós-flop','Outros']
  return `<section class="panel team-matrix"><header class="team-section-head"><div><span class="team-section-icon purple">▦</span><h2>Mapa técnico do time</h2><p class="muted">Cada célula resume uma família técnica. A cor é definida pelo sinal mais grave; “n sinais” é a quantidade de métricas fora da referência. Clique para abrir o diagnóstico daquela área.</p></div></header><div class="team-map-legend"><span class="ok">● Sem alerta</span><span class="watch">● Atenção</span><span class="mid">● Média</span><span class="high">● Alta</span></div><div class="team-matrix-table"><div class="team-matrix-row head"><span>Jogador</span>${areas.map(a=>`<b>${esc(a)}</b>`).join('')}</div>${ready.map(x=>{const name=x.member.display_name||x.member.email;return `<div class="team-matrix-row"><button class="team-matrix-player" data-team-player="${esc(x.member.user_id)}">${esc(name)}</button>${areas.map(a=>{const s=teamAreaClass(x.snap.leaks,a);return `<button class="team-matrix-cell ${s.state}" data-team-area="${esc(a)}" data-team-area-player="${esc(x.member.user_id)}"><i></i><span>${esc(s.label)}</span><small>${s.count?`${s.count} sinal${s.count===1?'':'is'}`:'—'}</small></button>`}).join('')}</div>`}).join('')}</div></section>`
}

function teamLessonPlanHtml(ready,collective,allLeaks){
  const shared=collective[0]||null
  const top=shared?.items?.sort((a,b)=>b.score-a.score)?.[0]||allLeaks[0]||null
  if(!top)return `<section class="panel team-lesson"><header class="team-section-head"><div><span class="team-section-icon gold">🎓</span><h2>Aula recomendada do time</h2><p class="muted">Ainda não há um tema com amostra suficiente para recomendar uma aula.</p></div></header></section>`
  const affected=shared?[...shared.players]:[top.player].filter(Boolean),n=affected.length,per=teamAdaptiveHandsPerPlayer(Math.max(1,n)),replayMax=Math.min(200,Math.max(1,n)*per)
  const replayText=n>1?`amostra adaptativa · até ${replayMax} mãos no total`:'até 20 mãos recentes'
  return `<section class="panel team-lesson" id="teamLessonSection"><header class="team-section-head"><div><span class="team-section-icon gold">🎓</span><h2>Aula recomendada do gestor</h2><p class="muted">Tema escolhido por recorrência, gravidade, amostra e impacto coletivo.</p></div><span class="pill">${n>1?'COLETIVA':'INDIVIDUAL'}</span></header>
  <div class="team-lesson-grid"><div class="team-lesson-main"><small>TEMA SUGERIDO AGORA</small><h3>${esc(shared?.label||top.label)}</h3><p><b>Por quê?</b> ${n>1?`O mesmo problema aparece em ${n} jogadores (${affected.map(esc).join(', ')}).`:`É o sinal mais prioritário do recorte atual.`} A amostra total soma ${(shared?.items||[top]).reduce((s,x)=>s+(+x.den||0),0).toLocaleString('pt-BR')} oportunidades.</p><div class="team-lesson-actions"><button class="btn team-lesson-open" data-team-lesson-leak="${esc(shared?.label||top.label)}">Investigar tema</button>${n>1?`<button class="btn secondary team-lesson-replay" data-team-lesson-replay="${esc(shared?.label||top.label)}">🎬 Replayer coletivo</button>`:''}<button class="btn secondary" data-team-create-plan="${esc(shared?.label||top.label)}">🗓 Criar no Plano de Estudos</button></div></div>
  <div class="team-lesson-agenda"><h4>Plano sugerido · 50 min</h4><div><b>10 min</b><span>Conceitos e referência do spot</span></div><div><b>15 min</b><span>Comparar padrões dos jogadores afetados</span></div><div><b>20 min</b><span>Replayer: ${esc(replayText)}</span></div><div><b>5 min</b><span>Definir tarefa e critério de reavaliação</span></div><footer>Reavaliar em 14 dias ou após nova amostra relevante.</footer></div></div></section>`
}

function teamPriorityReason(l){
  if(!l)return 'Aguardar nova amostra.'
  const diff=String(l.state)==='aggro'?'acima':'abaixo'
  return `${teamNum(l.value)}% · ref. ${esc(l.range)} · ${(+l.den||0).toLocaleString('pt-BR')} oportunidades · ${diff} da referência`
}
function teamCommandData(ready){
  const all=ready.flatMap(x=>(x.snap?.leaks||[]).map(l=>({...l,player:x.member.display_name||x.member.email,userId:x.member.user_id}))).sort((a,b)=>b.score-a.score)
  const collective=teamCollectiveLeaks(ready)
  const topCollective=collective[0]||null
  const perPlayer=ready.map(x=>{const leaks=[...(x.snap?.leaks||[])].sort((a,b)=>b.score-a.score);return {row:x,top:leaks[0]||null,high:leaks.filter(l=>l.score>=1.5).length,total:leaks.length}}).sort((a,b)=>(b.high-a.high)||(b.top?.score||0)-(a.top?.score||0))
  const areaNames=['Pré-flop','3Bet / 4Bet','Blinds','CBet / Pós-flop','Outros']
  const areas=areaNames.map(area=>{const ls=all.filter(l=>teamLeakArea(l.label,l.group)===area);return {area,count:ls.length,high:ls.filter(l=>l.score>=1.5).length,top:ls[0]||null}}).sort((a,b)=>b.high-a.high||b.count-a.count)
  return {all,collective,topCollective,perPlayer,areas}
}

const TEAM_DAILY_EXECUTION_KEY='poker_study_team_daily_execution_v111'
function teamTodayKey(){return new Date().toISOString().slice(0,10)}
function teamDailyExecution(){
  try{
    const x=JSON.parse(localStorage.getItem(TEAM_DAILY_EXECUTION_KEY)||'{}')
    if(x.date!==teamTodayKey())return {date:teamTodayKey(),done:{}}
    return x
  }catch{return {date:teamTodayKey(),done:{}}}
}
function saveTeamDailyExecution(x){localStorage.setItem(TEAM_DAILY_EXECUTION_KEY,JSON.stringify(x))}
function teamTaskKey(x){return [x.action||'',x.label||'',x.userId||'team'].join('|')}
function toggleTeamDailyTask(key){
  const s=teamDailyExecution();s.done[key]=!s.done[key];saveTeamDailyExecution(s)
}
function teamDailyProgress(plan){
  const s=teamDailyExecution(),total=plan.length,done=plan.filter(x=>s.done[teamTaskKey(x)]).length
  return {done,total,pct:total?Math.round(done/total*100):0,state:s}
}

function teamLeakTrendForRow(row,label){
  const views=row?.snap?.stats?.views||{},v30=views['30d']||views['30d|all'],v90=views['90d']||views['90d|all']||views.all
  const find=v=>(v?.leaks||[]).find(l=>String(l.label||'')===String(label||''))
  const a=find(v30),b=find(v90)
  if(!a&&!b)return {status:'unknown',delta:0,label:'sem histórico',a:null,b:null}
  const av=+a?.score||0,bv=+b?.score||0,delta=av-bv
  if(delta>.12)return {status:'worse',delta,label:'piorando',a,b}
  if(delta<-.12)return {status:'better',delta,label:'melhorando',a,b}
  return {status:'stable',delta,label:'estável',a,b}
}
function teamReviewHandsTarget(leak,collectivePlayers=1){
  const den=+leak?.den||0
  const per=den>=1000?25:den>=300?20:den>=100?15:10
  return Math.min(100,Math.max(10,per*Math.max(1,collectivePlayers)))
}
function teamCoachSignals(ready,data){
  const rows=[]
  ready.forEach(x=>(x.snap?.leaks||[]).forEach(l=>{
    const trend=teamLeakTrendForRow(x,l.label)
    rows.push({row:x,leak:l,trend,player:x.member.display_name||x.member.email})
  }))
  const worsening=rows.filter(x=>x.trend.status==='worse').sort((a,b)=>b.trend.delta-a.trend.delta||b.leak.score-a.leak.score)
  const improving=rows.filter(x=>x.trend.status==='better').sort((a,b)=>a.trend.delta-b.trend.delta||b.leak.score-a.leak.score)
  const critical=rows.filter(x=>(+x.leak.score||0)>=1.5).sort((a,b)=>b.leak.score-a.leak.score)
  return {rows,worsening,improving,critical}
}
function teamCoachBriefing(ready,data){
  const s=teamCoachSignals(ready,data),bad=s.worsening[0]||s.critical[0]||null,good=s.improving[0]||null
  const collective=data.topCollective||null
  return `<section class="panel coach-briefing"><header><div><small>BRIEFING AUTOMÁTICO</small><h2>O que mudou desde a última leitura?</h2><p>Três respostas rápidas antes de você começar a trabalhar.</p></div></header>
    <div class="coach-briefing-grid">
      <article class="${bad?.trend.status==='worse'?'bad':'warn'}"><small>⚠️ MERECE ATENÇÃO</small><b>${bad?`${esc(bad.player)} · ${esc(bad.leak.label)}`:'Nenhuma piora relevante'}</b><span>${bad?`${teamPriorityReason(bad.leak)} · ${bad.trend.status==='worse'?'tendência de piora':'prioridade alta atual'}`:'O recorte está estável.'}</span>${bad?`<button class="team-open-leak" data-team-leak="${esc(bad.leak.label)}">Investigar →</button>`:''}</article>
      <article class="${good?'good':'neutral'}"><small>✅ EVOLUÇÃO</small><b>${good?`${esc(good.player)} · ${esc(good.leak.label)}`:'Sem melhora confirmada ainda'}</b><span>${good?`O desvio recente caiu em relação à base de 90 dias.`:'Precisamos de mais mãos recentes para confirmar evolução.'}</span>${good?`<button data-team-player="${esc(good.row.member.user_id)}">Abrir Raio-X →</button>`:''}</article>
      <article class="collective"><small>👥 OPORTUNIDADE COLETIVA</small><b>${collective?esc(collective.label):'Nenhum tema coletivo dominante'}</b><span>${collective?`${collective.players.size} jogadores afetados · ${collective.items.reduce((n,x)=>n+(+x.den||0),0).toLocaleString('pt-BR')} oportunidades somadas.`:'Os problemas estão mais individualizados neste recorte.'}</span>${collective?`<button data-team-create-plan="${esc(collective.label)}">Preparar aula →</button>`:''}</article>
    </div>
  </section>`
}
function teamMorningPlan(ready,data){
  const items=[]
  if(data.topCollective){
    const sorted=[...(data.topCollective.items||[])].sort((a,b)=>b.score-a.score),x=sorted[0],players=data.topCollective.players.size
    const affected=ready.filter(r=>(r.snap?.leaks||[]).some(l=>l.label===data.topCollective.label))
    const trends=affected.map(r=>teamLeakTrendForRow(r,data.topCollective.label))
    const worsening=trends.filter(t=>t.status==='worse').length,improving=trends.filter(t=>t.status==='better').length
    const trendLabel=worsening?`${worsening} piorando`:improving===players?'grupo melhorando':improving?`${improving} melhorando`:'estável'
    const hands=teamReviewHandsTarget(x,players)
    items.push({kind:'AULA COLETIVA',title:data.topCollective.label,why:`${players} jogadores · ${trendLabel} · ${data.topCollective.items.reduce((n,l)=>n+(+l.den||0),0).toLocaleString('pt-BR')} opp`,mins:20,action:'collective',label:data.topCollective.label,hands,trend:worsening?'worse':improving?'better':'stable'})
  }
  const individuals=data.perPlayer.filter(x=>x.top).map(x=>{
    const trend=teamLeakTrendForRow(x.row,x.top.label),player=x.row.member.display_name||x.row.member.email,hands=teamReviewHandsTarget(x.top,1)
    const trendWeight=trend.status==='worse'?3:trend.status==='stable'?1:trend.status==='better'?-1:0
    return {kind:'REVISÃO INDIVIDUAL',title:`${player} · ${x.top.label}`,why:`${teamPriorityReason(x.top)} · ${trend.label}`,mins:15,action:'playerLeak',label:x.top.label,userId:x.row.member.user_id,player,hands,trend:trend.status,rank:(+x.top.score||0)*10+trendWeight}
  }).sort((a,b)=>b.rank-a.rank)
  items.push(...individuals.slice(0,3))
  return items.slice(0,4)
}
function teamTrendModel(x){
  const s=x?.snap;if(!s)return null
  const views=s.stats?.views||{},now=views['30d']||views['30d|all']||null,base=views['90d']||views['90d|all']||views.all||null
  if(!now||!base||!(+now.hands))return null
  const nLeaks=now.leaks||[],bLeaks=base.leaks||[]
  const severity=a=>(a||[]).reduce((n,l)=>n+(+l.score||0),0)
  const current=severity(nLeaks),reference=severity(bLeaks)
  const leakDelta=current-reference
  const wrNow=+now.bb100||0,wrBase=+base.bb100||0
  return {now,base,leakDelta,wrDelta:wrNow-wrBase,wrNow,wrBase,current,reference}
}
function teamTrendArrow(v,invert=false){
  const good=invert?v<-.05:v>.05,bad=invert?v>.05:v<-.05
  return {cls:good?'good':bad?'bad':'flat',icon:good?'↗':bad?'↘':'→'}
}
function teamAreaExplainedCard(row,area){
  const fam=(row?.snap?.leaks||[]).filter(l=>(l.area||'').toLowerCase()===area.toLowerCase())
  if(!fam.length){
    return `<div class="coach-area clean"><small>${area}</small><b>Sem alerta</b><span>—</span></div>`
  }
  fam.sort((a,b)=>(+b.score||0)-(+a.score||0))
  const top=fam[0]
  const sev=(+top.score||0)>=1.5?'Alta':(+top.score||0)>=1?'Média':'Atenção'
  return `<button class="coach-area ${sev.toLowerCase()}" data-team-leak="${esc(top.label)}">
    <small>${area}</small>
    <b>${esc(top.label)}</b>
    <span>${sev} · ${(top.den||0).toLocaleString('pt-BR')} opp</span>
  </button>`
}

function teamTrendPanel(ready){
  const rows=ready.map(x=>({x,t:teamTrendModel(x)})).filter(z=>z.t)
  if(!rows.length)return `<section class="panel coach-trends"><header><div><small>TENDÊNCIA</small><h2>O time está melhorando?</h2><p>Precisamos de amostra recente para comparar os últimos 30 dias com a base de 90 dias.</p></div></header><div class="notice">Ainda não há recorte temporal suficiente para uma leitura confiável.</div></section>`
  const avgWr=rows.reduce((n,z)=>n+z.t.wrDelta,0)/rows.length,avgLeak=rows.reduce((n,z)=>n+z.t.leakDelta,0)/rows.length
  const wrA=teamTrendArrow(avgWr),leakA=teamTrendArrow(avgLeak,true)
  const maxWr=Math.max(1,...rows.flatMap(z=>[Math.abs(z.t.wrNow),Math.abs(z.t.wrBase)]))
  return `<section class="panel coach-trends"><header><div><small>TENDÊNCIA · 30D VS 90D</small><h2>O time está melhorando?</h2><p>Direção do grupo e leitura visual por jogador. Clique em um jogador para abrir o Raio-X.</p></div><span class="pill">${rows.length} jogador${rows.length===1?'':'es'}</span></header>
    <div class="trend-summary"><article class="${wrA.cls}"><small>WINRATE</small><b>${wrA.icon} ${avgWr>=0?'+':''}${teamNum(avgWr)} bb/100</b><span>mudança média do grupo</span></article><article class="${leakA.cls}"><small>CARGA DE DESVIOS</small><b>${leakA.icon} ${avgLeak>=0?'+':''}${teamNum(avgLeak)}</b><span>${avgLeak<-.05?'menos desvios':avgLeak>.05?'mais desvios':'estável'}</span></article></div>
    <div class="trend-visual-list">${rows.map(({x,t})=>{const wa=teamTrendArrow(t.wrDelta),la=teamTrendArrow(t.leakDelta,true);const bw=Math.max(4,Math.min(100,Math.abs(t.wrBase)/maxWr*100)),nw=Math.max(4,Math.min(100,Math.abs(t.wrNow)/maxWr*100));return `<button data-team-player="${esc(x.member.user_id)}"><div class="trend-name"><b>${esc(x.member.display_name||x.member.email)}</b><small>${(+t.now.hands||0).toLocaleString('pt-BR')} mãos · últimos 30d</small></div><div class="trend-mini-chart"><span><em>90d</em><i><b style="width:${bw}%"></b></i><strong>${t.wrBase>=0?'+':''}${teamNum(t.wrBase)}</strong></span><span class="recent"><em>30d</em><i><b style="width:${nw}%"></b></i><strong>${t.wrNow>=0?'+':''}${teamNum(t.wrNow)}</strong></span></div><div class="trend-verdict ${wa.cls}"><b>${wa.icon} ${t.wrDelta>=0?'+':''}${teamNum(t.wrDelta)} bb/100</b><small class="${la.cls}">${la.icon} ${Math.abs(t.leakDelta)<.05?'desvios estáveis':t.leakDelta<0?'menos desvios':'mais desvios'}</small></div></button>`}).join('')}</div>
  </section>`
}
function teamFocusTrendPanel(ready,data){
  const focus=data.topCollective?.label||data.all[0]?.label
  if(!focus)return ''
  const pts=ready.map(x=>{
    const views=x.snap?.stats?.views||{},v30=views['30d']||views['30d|all'],v90=views['90d']||views['90d|all']||views.all
    const find=(v)=>(v?.leaks||[]).find(l=>l.label===focus)
    return {x,a:find(v30),b:find(v90)}
  }).filter(z=>z.a||z.b)
  if(!pts.length)return ''
  return `<section class="panel coach-focus-trend"><header><div><small>EVOLUÇÃO DO FOCO #1</small><h2>${esc(focus)}</h2><p>Como o principal tema de hoje se comporta no recorte recente em relação à base.</p></div></header><div class="focus-trend-bars">${pts.map(({x,a,b})=>{const av=+a?.score||0,bv=+b?.score||0,max=Math.max(1,av,bv),delta=av-bv,ta=teamTrendArrow(delta,true);return `<button data-team-player="${esc(x.member.user_id)}"><b>${esc(x.member.display_name||x.member.email)}</b><div class="focus-bars"><i><em style="width:${Math.min(100,bv/max*100)}%"></em></i><i class="recent"><em style="width:${Math.min(100,av/max*100)}%"></em></i></div><span class="${ta.cls}">${ta.icon} ${delta<-.05?'melhorando':delta>.05?'piorando':'estável'}</span><small>90d → 30d</small></button>`}).join('')}</div></section>`
}
function teamCorrectionItems(ready){
  const items=[]
  ;(ready||[]).forEach(x=>{
    const name=x.member.display_name||x.member.email||'Jogador'
    ;(x.snap?.stats?.leakCorrections||[]).forEach(c=>{
      const room=String(c.room||'all')
      if(teamCenterFilters.room!=='all' && room!=='all' && room!==teamCenterFilters.room)return
      items.push({...c,player:name,userId:x.member.user_id})
    })
  })
  const rank=c=>c.state==='changed'?0:c.state==='stable'?1:2
  return items.sort((a,b)=>rank(a)-rank(b)||(+a.postDen||0)-(+b.postDen||0)||String(b.startedAt||'').localeCompare(String(a.startedAt||'')))
}
function teamCorrectionStatus(c){
  const n=+c.postDen||0,need=Math.max(0,50-n)
  if(c.state==='forming')return {label:`Amostra ${n}/50`,detail:`faltam ${need} oportunidade${need===1?'':'s'}`,cls:'forming',pct:Math.min(100,n/50*100)}
  if(c.state==='changed')return {label:'Mudança observada',detail:'amostra mínima atingida',cls:'changed',pct:100}
  return {label:'Acompanhamento estável',detail:'amostra mínima atingida',cls:'stable',pct:100}
}
function teamCorrectionModal(c){
  const st=teamCorrectionStatus(c),date=String(c.startedAt||'').slice(0,10).split('-').reverse().join('/')||'—'
  const after=c.postValue==null?'—':(+c.postValue).toFixed(1)+'%'
  const room=c.room&&c.room!=='all'?c.room:'Base completa'
  return `<div class="team-modal-backdrop" id="teamCorrectionBackdrop"><section class="team-xray-modal team-correction-modal"><header><div><div class="team-xray-avatar">${esc(String(c.player||'??').slice(0,2).toUpperCase())}</div><div><small>LEAK EM CORREÇÃO</small><h2>${esc(c.player)} · ${esc(c.label||c.metric)}</h2><p>${esc(room)} · iniciado em ${esc(date)}</p></div></div><button id="teamCorrectionClose">×</button></header><div class="team-correction-hero"><div><small>ANTES DO ESTUDO</small><strong>${(+c.baselineValue||0).toFixed(1)}%</strong><span>${(+c.baselineDen||0).toLocaleString('pt-BR')} oportunidades</span></div><div class="arrow">→</div><div><small>DEPOIS DO ESTUDO</small><strong>${after}</strong><span>${(+c.postDen||0).toLocaleString('pt-BR')} novas oportunidades</span></div></div><section class="team-correction-progress"><div class="team-correction-progress-head"><div><b>${esc(st.label)}</b><span>${esc(st.detail)}</span></div><strong>${Math.round(st.pct)}%</strong></div><div class="team-correction-track"><i style="width:${st.pct}%"></i></div><p>O Poker Study compara somente decisões posteriores ao estudo. O painel descreve a evolução da amostra e não conclui automaticamente que a estratégia está correta.</p></section><section class="team-correction-actions"><button class="btn" data-team-correction-diagnosis="1" data-team-correction-player="${esc(c.userId)}" data-team-correction-leak="${esc(c.label||c.metric)}">🔎 Abrir acompanhamento</button><button class="btn secondary" data-team-correction-replay="1" data-team-correction-player="${esc(c.userId)}" data-team-correction-leak="${esc(c.label||c.metric)}" data-team-correction-name="${esc(c.player)}">🎬 Revisar mãos do jogador</button></section></section></div>`
}
function teamCorrectionsPanel(ready){
  const items=teamCorrectionItems(ready)
  if(!items.length)return ''
  const forming=items.filter(c=>c.state==='forming').length
  const mature=items.filter(c=>(+c.postDen||0)>=50).length
  const totalOpp=items.reduce((n,c)=>n+(+c.postDen||0),0)
  return `<section class="panel coach-corrections"><header><div><small>V14.3 · ACOMPANHAMENTO PÓS-ESTUDO</small><h2>Leaks em correção</h2><p>Visualize quem já está trabalhando um leak, o ponto de partida e a evolução da nova amostra sem misturar mãos anteriores ao estudo.</p></div><span class="pill">${items.length} acompanhamento${items.length===1?'':'s'}</span></header><div class="coach-correction-summary"><div><small>EM FORMAÇÃO</small><b>${forming}</b><span>abaixo de 50 novas opp</span></div><div><small>AMOSTRA MÍNIMA</small><b>${mature}</b><span>50+ novas oportunidades</span></div><div><small>NOVAS OPORTUNIDADES</small><b>${totalOpp.toLocaleString('pt-BR')}</b><span>somadas no time</span></div></div><div class="coach-correction-list">${items.slice(0,12).map(c=>{const st=teamCorrectionStatus(c);return `<button data-team-correction-key="${esc(c.key)}" data-team-correction-player="${esc(c.userId)}"><div class="coach-correction-main"><b>${esc(c.player)} · ${esc(c.label||c.metric)}</b><small>${c.room&&c.room!=='all'?esc(c.room)+' · ':''}desde ${String(c.startedAt||'').slice(0,10).split('-').reverse().join('/')}</small></div><span><em>Antes</em><strong>${(+c.baselineValue||0).toFixed(1)}%</strong><small>${(+c.baselineDen||0).toLocaleString('pt-BR')} opp</small></span><span><em>Depois</em><strong>${c.postValue==null?'—':(+c.postValue).toFixed(1)+'%'}</strong><small>${(+c.postDen||0).toLocaleString('pt-BR')} novas opp</small></span><div class="coach-correction-status ${st.cls}"><b>${esc(st.label)}</b><div><i><em style="width:${st.pct}%"></em></i><small>${esc(st.detail)}</small></div></div><i class="coach-correction-open">Abrir →</i></button>`}).join('')}</div><footer>Use cada linha para abrir o acompanhamento daquele jogador, revisar as mãos relacionadas ou voltar ao diagnóstico individual. O painel acompanha evidência; não substitui análise estratégica.</footer></section>`
}

function teamCoachCommandCenter(rows,allRows=rows){
  const ready=rows.filter(x=>x.snap),data=teamCommandData(ready),plan=teamMorningPlan(ready,data),total=ready.reduce((n,x)=>n+(+x.snap.hands||0),0),critical=data.all.filter(x=>x.score>=1.5).length
  const current=(allRows||[]).find(x=>x.member.user_id===getUser()?.id),name=current?.member?.display_name||'Gestor'
  const focus=data.topCollective?.items?.sort((a,b)=>b.score-a.score)?.[0]||data.all[0]||null
  const focusPlayers=data.topCollective?[...data.topCollective.players]:focus?[focus.player]:[]
  const maxArea=Math.max(1,...data.areas.map(x=>x.count))
  return `<div class="coach-command">
    <div class="coach-command-head"><div><span class="team-kicker">V11.4 · COACH INTELLIGENCE</span><h1>Bom dia, ${esc(name)}.</h1><p>Seu time precisa de atenção em <b>${Math.min(critical||data.all.length,4)}</b> ponto${Math.min(critical||data.all.length,4)===1?'':'s'} prioritário${Math.min(critical||data.all.length,4)===1?'':'s'} hoje. A Central já organizou o que fazer primeiro.</p></div><div class="coach-health"><small>RECORTE ATUAL</small><strong>${ready.length} jogadores · ${total.toLocaleString('pt-BR')} mãos</strong><span>${critical} alertas altos</span></div></div>
    ${teamFilterBar(allRows)}
    ${teamCenterFilters.player!=='all'&&ready.length===1?teamPlayerIdentityPanel(ready[0]):''}
    <section class="coach-focus-card"><div class="coach-focus-copy"><small>FOCO #1 DO TIME</small><h2>${focus?esc(data.topCollective?.label||focus.label):'Nenhuma prioridade crítica agora'}</h2><p>${focus?`${focusPlayers.map(esc).join(' + ')} · ${teamPriorityReason(focus)}`:'Continue acumulando amostra e acompanhando o time.'}</p><div class="coach-focus-why"><b>Por que isso vem primeiro?</b><span>${data.topCollective?`O mesmo tema aparece em ${data.topCollective.players.size} jogadores, combinando recorrência coletiva, severidade e amostra.`:focus?`É o desvio com maior prioridade no recorte atual.`:'Sem intervenção necessária.'}</span></div></div><div class="coach-focus-actions">${focus?`<button class="btn team-open-leak" data-team-leak="${esc(data.topCollective?.label||focus.label)}">🔎 Entender o problema</button>${data.topCollective?`<button class="btn secondary team-focus-replay" data-team-focus-replay="${esc(data.topCollective.label)}">🎬 Revisar mãos</button>`:''}<button class="btn secondary" data-team-create-plan="${esc(data.topCollective?.label||focus.label)}">🎓 Criar aula</button>`:''}</div></section>${teamCoachBriefing(ready,data)}${teamCorrectionsPanel(ready)}
    <div class="coach-command-grid">
      <section class="panel coach-today"><header><div><small>AGENDA DO COACH</small><h2>O que fazer hoje</h2><p>Uma fila curta, em ordem de impacto. Cada item já leva direto para a ação necessária.</p></div><span class="pill">${teamDailyProgress(plan).done}/${teamDailyProgress(plan).total} concluídas</span></header>
      <div class="coach-day-progress"><i><b style="width:${teamDailyProgress(plan).pct}%"></b></i><span>${teamDailyProgress(plan).pct}% do plano de hoje</span></div>
      <div class="coach-today-list">${plan.map((x,i)=>{const key=teamTaskKey(x),done=!!teamDailyProgress(plan).state.done[key];return `<article class="${done?'done':''}"><button class="coach-task-main" data-coach-action="${esc(x.action)}" data-team-leak="${esc(x.label||'')}" data-team-player="${esc(x.userId||'')}" data-team-player-name="${esc(x.player||'')}"><span>${done?'✓':i+1}</span><div><small>${esc(x.kind)}</small><b>${esc(x.title)}</b><p>${esc(x.why)}</p><div class="coach-task-meta"><span class="${esc(x.trend||'stable')}">${x.trend==='worse'?'↘ piorando':x.trend==='better'?'↗ melhorando':'→ estável'}</span><span>🎬 ${x.hands||20} mãos</span></div></div><em>${x.mins} min →</em></button><div class="coach-task-actions">${x.action==='collective'?`<button class="btn small secondary team-focus-replay" data-team-focus-replay="${esc(x.label)}">🎬 Revisar ${x.hands||40} mãos</button><button class="btn small secondary" data-team-create-plan="${esc(x.label)}">🎓 Preparar aula</button>`:`<button class="btn small secondary team-open-leak" data-team-leak="${esc(x.label)}">🔎 Diagnóstico</button><button class="btn small secondary team-player-pack" data-team-leak="${esc(x.label)}" data-team-player="${esc(x.userId||'')}" data-team-player-name="${esc(x.player||'')}">🎬 Revisar ${x.hands||20} mãos</button>`}<button class="btn small ghost" data-team-task-done="${esc(key)}">${done?'↩ Reabrir':'✓ Concluir'}</button></div></article>`}).join('')||'<div class="notice">Nenhuma ação prioritária hoje.</div>'}</div></section>
      <section class="panel coach-players"><header><div><small>GESTÃO INDIVIDUAL</small><h2>Quem precisa de você hoje</h2><p>Um motivo claro por jogador; clique para abrir o Raio-X do Coach.</p></div></header><div class="coach-player-cards">${data.perPlayer.map((x,i)=>{const n=x.row.member.display_name||x.row.member.email;return `<button data-team-player="${esc(x.row.member.user_id)}"><i>${esc(n.slice(0,2).toUpperCase())}</i><div><b>${esc(n)}</b><small>${x.top?esc(x.top.label):'Sem prioridade crítica'}</small><p>${x.top?teamPriorityReason(x.top):'Aguardando mais amostra.'}</p></div><em class="${x.high?'bad-text':'good-text'}">${x.high?`${x.high} alta${x.high===1?'':'s'}`:'estável'} →</em></button>`}).join('')}</div></section>
    </div>
    <section class="panel coach-priorities"><header><div><small>PRIORIZAÇÃO</small><h2>Prioridades do time</h2><p>Coletivo vira aula; individual vira revisão 1:1. Sem duplicar a mesma informação em dois blocos.</p></div></header><div class="coach-priority-columns"><div><h3>👥 Coletivas</h3>${data.collective.slice(0,5).map((g,i)=>{const top=g.items.sort((a,b)=>b.score-a.score)[0];return `<button class="team-open-leak" data-team-leak="${esc(g.label)}"><span>${i+1}</span><div><b>${esc(g.label)}</b><small>${[...g.players].map(esc).join(' · ')} · ${g.items.reduce((n,x)=>n+(+x.den||0),0).toLocaleString('pt-BR')} opp</small></div><em>Aula →</em></button>`}).join('')||'<p class="muted">Nenhum problema coletivo neste recorte.</p>'}</div><div><h3>👤 Individuais</h3>${data.perPlayer.filter(x=>x.top).slice(0,5).map((x,i)=>`<button class="team-open-leak" data-team-leak="${esc(x.top.label)}"><span>${i+1}</span><div><b>${esc(x.row.member.display_name||x.row.member.email)} · ${esc(x.top.label)}</b><small>${teamPriorityReason(x.top)}</small></div><em>Revisar →</em></button>`).join('')||'<p class="muted">Nenhuma prioridade individual.</p>'}</div></div></section>
    <section class="panel coach-map"><header><div><small>MAPA TÉCNICO EXPLICADO</small><h2>Onde cada jogador está pedindo atenção?</h2><p>A célula não mostra só “Média”: mostra o principal problema, referência, amostra e quantas métricas daquela família estão fora do esperado.</p></div></header><div class="coach-map-table"><div class="coach-map-head"><span>Jogador</span>${['Pré-flop','3Bet / 4Bet','Blinds','CBet / Pós-flop','Outros'].map(a=>`<b>${esc(a)}</b>`).join('')}</div>${ready.map(x=>`<div class="coach-map-row"><button class="coach-map-player" data-team-player="${esc(x.member.user_id)}">${esc(x.member.display_name||x.member.email)}</button>${['Pré-flop','3Bet / 4Bet','Blinds','CBet / Pós-flop','Outros'].map(a=>teamAreaExplainedCard(x,a)).join('')}</div>`).join('')}</div></section>
    ${teamTrendPanel(ready)}${teamFocusTrendPanel(ready,data)}<div class="coach-command-grid coach-bottom-grid execution-only"><section class="panel coach-secondary coach-secondary-full"><header><div><small>VISÃO SECUNDÁRIA</small><h2>Contexto de desempenho</h2><p>Consulta rápida. A agenda acima continua sendo a fonte de decisão do gestor.</p></div></header><div class="coach-mini-table">${ready.map(x=>{const z=x.snap.stats||{};return `<button data-team-player="${esc(x.member.user_id)}"><b>${esc(x.member.display_name||x.member.email)}</b><span>${(+x.snap.hands||0).toLocaleString('pt-BR')} mãos</span><span class="${+z.bb100>=0?'good-text':'bad-text'}">${+z.bb100>=0?'+':''}${teamNum(z.bb100)} bb/100</span><span>VPIP ${teamNum(z.vpip)} · PFR ${teamNum(z.pfr)} · 3B ${teamNum(z.threeBet)}</span></button>`}).join('')}</div></section>
    </div>
  </div>`
}

function teamcenterHtml(rows,allRows=rows){return teamCoachCommandCenter(rows,allRows)}

function bindTeamCenterFilters(allRows){
  const render=()=>{const root=document.getElementById('teamCenterRoot');if(!root)return;const filtered=teamFilteredRows(allRows);root.innerHTML=teamcenterHtml(filtered,allRows);bindTeamCenterFilters(allRows);bindTeamActions(filtered,allRows)}
  const p=document.getElementById('teamFilterPlayer'),room=document.getElementById('teamFilterRoom'),d=document.getElementById('teamFilterPeriod');if(p)p.onchange=()=>{teamCenterFilters.player=p.value;teamLeakSeverity='all';render()};if(room)room.onchange=()=>{teamCenterFilters.room=room.value;teamLeakSeverity='all';render()};if(d)d.onchange=()=>{teamCenterFilters.period=d.value;teamLeakSeverity='all';render()};const c=document.getElementById('teamClearFilters');if(c)c.onclick=()=>{teamCenterFilters={player:'all',period:'all',room:'all'};teamLeakSeverity='all';render()}
}
function bindTeamActions(rows,allRows){
  const openXray=id=>{const row=rows.find(x=>x.member.user_id===id)||allRows.find(x=>x.member.user_id===id);if(!row||!row.snap)return;document.body.insertAdjacentHTML('beforeend',teamPlayerXray(row));const close=()=>document.getElementById('teamXrayBackdrop')?.remove();document.getElementById('teamXrayClose')?.addEventListener('click',close);document.getElementById('teamXrayBackdrop')?.addEventListener('click',e=>{if(e.target.id==='teamXrayBackdrop')close()});document.querySelector('.team-filter-this-player')?.addEventListener('click',e=>{teamCenterFilters.player=e.currentTarget.dataset.player;close();route('teamcenter')});document.getElementById('teamGoOwnStats')?.addEventListener('click',()=>{close();route('hhstats')});document.querySelectorAll('#teamXrayBackdrop .team-open-leak').forEach(b=>b.onclick=()=>{const lab=b.dataset.teamLeak;close();openLeak(lab)})}
  const openLeak=(label,area=null,playerId=null)=>{
    document.body.insertAdjacentHTML('beforeend',teamLeakDiagnosis(label,rows,area,playerId))
    const close=()=>document.getElementById('teamLeakBackdrop')?.remove()
    const backdrop=document.getElementById('teamLeakBackdrop')
    document.getElementById('teamLeakClose')?.addEventListener('click',close)
    backdrop?.addEventListener('click',e=>{if(e.target.id==='teamLeakBackdrop')close()})
    backdrop?.querySelectorAll('.team-leak-player-xray').forEach(b=>b.onclick=()=>{const id=b.dataset.teamPlayer;close();openXray(id)})
    backdrop?.querySelectorAll('.team-leak-player-hands').forEach(b=>b.onclick=async ev=>{
      ev.stopPropagation();b.disabled=true;const old=b.textContent;b.textContent='Carregando…'
      try{await openTeamPlayerReviewPack(b.dataset.teamLeak,b.dataset.teamPlayer,b.dataset.teamPlayerName,teamCenterFilters.room)}
      catch(e){console.error(e);alert('Não foi possível abrir as mãos: '+(e?.message||String(e)))}
      finally{if(document.body.contains(b)){b.disabled=false;b.textContent=old}}
    })
    document.getElementById('teamLeakGoPlan')?.addEventListener('click',()=>{close();route('plan')})
    const collective=document.getElementById('teamLeakCollectiveReplay')
    if(collective&&!collective.disabled)collective.onclick=async()=>{
      collective.disabled=true;const old=collective.textContent;collective.textContent='Carregando pacote…'
      try{const ok=await openTeamCollectiveReplayer(label,teamCenterFilters.room);if(ok)close()}
      catch(e){console.error(e);alert('Não foi possível abrir o Replayer coletivo: '+(e?.message||String(e)))}
      finally{if(document.body.contains(collective)){collective.disabled=false;collective.textContent=old}}
    }
    const areaReplay=document.getElementById('teamAreaCollectiveReplay')
    if(areaReplay)areaReplay.onclick=async()=>{
      areaReplay.disabled=true;const old=areaReplay.textContent;areaReplay.textContent='Montando Review Pack…'
      try{
        const ok=await openTeamAreaCollectiveReplayer(areaReplay.dataset.teamArea,rows,areaReplay.dataset.teamAreaUser||null,teamCenterFilters.room)
        if(ok)close()
      }catch(e){
        console.error(e);alert('Não foi possível montar o Review Pack da área: '+(e?.message||String(e)))
      }finally{
        if(document.body.contains(areaReplay)){areaReplay.disabled=false;areaReplay.textContent=old}
      }
    }
  }
  document.querySelectorAll('[data-team-player]').forEach(el=>el.addEventListener('click',ev=>{if(ev.currentTarget.classList.contains('team-action-item'))return;openXray(el.dataset.teamPlayer)}))
  document.querySelectorAll('.team-open-leak').forEach(el=>el.addEventListener('click',ev=>{ev.stopPropagation();openLeak(el.dataset.teamLeak)}))
  document.querySelectorAll('[data-team-area-player]').forEach(el=>el.addEventListener('click',()=>openLeak(null,el.dataset.teamArea,el.dataset.teamAreaPlayer)))
  document.querySelectorAll('[data-team-area]:not([data-team-area-player])').forEach(el=>el.addEventListener('click',()=>openLeak(null,el.dataset.teamArea)))
  document.querySelectorAll('[data-team-collective]').forEach(el=>el.addEventListener('click',()=>{if(el.dataset.teamCollective)openLeak(el.dataset.teamCollective)}))
  document.querySelectorAll('[data-team-lesson-leak]').forEach(el=>el.addEventListener('click',()=>openLeak(el.dataset.teamLessonLeak)))
  document.querySelectorAll('[data-team-lesson-replay]').forEach(el=>el.addEventListener('click',async()=>{el.disabled=true;const old=el.textContent;el.textContent='Carregando…';try{await openTeamCollectiveReplayer(el.dataset.teamLessonReplay,teamCenterFilters.room)}catch(e){alert('Não foi possível abrir o pacote: '+(e?.message||String(e)))}finally{el.disabled=false;el.textContent=old}}))
  document.querySelectorAll('[data-team-focus-replay]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;const old=b.textContent;b.textContent='Carregando…';try{await openTeamCollectiveReplayer(b.dataset.teamFocusReplay,teamCenterFilters.room)}catch(e){alert('Não foi possível abrir o Review Pack: '+(e?.message||String(e)))}finally{b.disabled=false;b.textContent=old}}))
  document.querySelectorAll('[data-coach-action]').forEach(b=>b.addEventListener('click',async()=>{const kind=b.dataset.coachAction;if(kind==='collective'){await openTeamCollectiveReplayer(b.dataset.teamLeak,teamCenterFilters.room);return}if(kind==='playerLeak'){openLeak(b.dataset.teamLeak);return}}))
  document.querySelectorAll('.team-player-pack').forEach(b=>b.addEventListener('click',async ev=>{ev.stopPropagation();b.disabled=true;const old=b.textContent;b.textContent='Carregando…';try{await openTeamPlayerReviewPack(b.dataset.teamLeak,b.dataset.teamPlayer,b.dataset.teamPlayerName,teamCenterFilters.room)}catch(e){alert('Não foi possível abrir o Review Pack: '+(e?.message||String(e)))}finally{if(document.body.contains(b)){b.disabled=false;b.textContent=old}}}))

  document.querySelectorAll('[data-team-task-done]').forEach(b=>b.addEventListener('click',ev=>{ev.stopPropagation();toggleTeamDailyTask(b.dataset.teamTaskDone);refresh()}))

  document.querySelectorAll('[data-team-correction-key]').forEach(el=>el.addEventListener('click',()=>{
    const all=teamCorrectionItems(rows)
    const c=all.find(x=>String(x.userId)===String(el.dataset.teamCorrectionPlayer)&&String(x.key)===String(el.dataset.teamCorrectionKey))
    if(!c)return
    document.body.insertAdjacentHTML('beforeend',teamCorrectionModal(c))
    const close=()=>document.getElementById('teamCorrectionBackdrop')?.remove()
    document.getElementById('teamCorrectionClose')?.addEventListener('click',close)
    document.getElementById('teamCorrectionBackdrop')?.addEventListener('click',e=>{if(e.target.id==='teamCorrectionBackdrop')close()})
    document.querySelector('[data-team-correction-diagnosis]')?.addEventListener('click',()=>{const id=document.querySelector('[data-team-correction-diagnosis]').dataset.teamCorrectionPlayer,lab=document.querySelector('[data-team-correction-diagnosis]').dataset.teamCorrectionLeak;close();openLeak(lab,null,id)})
    document.querySelector('[data-team-correction-replay]')?.addEventListener('click',async()=>{const b=document.querySelector('[data-team-correction-replay]');const id=b.dataset.teamCorrectionPlayer,lab=b.dataset.teamCorrectionLeak,name=b.dataset.teamCorrectionName;b.disabled=true;const old=b.textContent;b.textContent='Carregando…';try{await openTeamPlayerReviewPack(lab,id,name,teamCenterFilters.room);close()}catch(e){console.error(e);alert('Não foi possível abrir as mãos: '+(e?.message||String(e)))}finally{if(document.body.contains(b)){b.disabled=false;b.textContent=old}}})
  }))

  document.querySelectorAll('[data-team-severity]').forEach(el=>el.addEventListener('click',()=>{teamLeakSeverity=el.dataset.teamSeverity||'all';const root=document.getElementById('teamCenterRoot');if(root){root.innerHTML=teamcenterHtml(rows,allRows);bindTeamCenterFilters(allRows);bindTeamActions(rows,allRows);setTimeout(()=>document.getElementById('teamLeaksSection')?.scrollIntoView({behavior:'smooth',block:'center'}),30)}}))
  document.querySelectorAll('[data-team-nav]').forEach(el=>el.addEventListener('click',()=>{const dest=el.dataset.teamNav;if(dest==='players'){document.getElementById('teamPlayersSection')?.scrollIntoView({behavior:'smooth',block:'center'});return}route(dest)}))
}


  return {
    teamcenter,
    teamFilteredRows,
    teamcenterHtml,
    bindTeamCenterFilters,
    bindTeamActions,
    getFilters:()=>({...teamCenterFilters}),
    setRefresh:fn=>{refresh=typeof fn==='function'?fn:()=>{}}
  }
}
