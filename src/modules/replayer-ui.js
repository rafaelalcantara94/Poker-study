// Poker Study V12.8.0 — Replayer UI module
// Visual table/timeline/range rendering extracted from main.js.
export function createReplayerUi(deps){
  const {esc,computeReplayState,replayActionLabel,replayActionText,fmtChips,fmtFullChips,replayPlayerIdentity,getReplayState}=deps
  const state=()=>getReplayState()

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
  const hs=(state().viewHands&&state().viewHands.length?state().viewHands:state().hands)||[];if(!hs.length||!state().selected)return null
  const i=hs.findIndex(x=>x.handId===state().selected.handId);if(i<0)return null
  const ni=i+direction;if(ni<0||ni>=hs.length)return null
  return hs[ni]
}
function replayTimelineHtml(h){
  const groups=['preflop','flop','turn','river','showdown']
  const labels={preflop:'PRÉ-FLOP',flop:'FLOP',turn:'TURN',river:'RIVER',showdown:'SHOWDOWN'}
  return `<div class="replay-timeline">${groups.map(group=>{const acts=h.steps.map((x,i)=>({x,i,group:['show','collect'].includes(x.type)?'showdown':x.street})).filter(o=>o.x.kind==='action'&&o.group===group);if(!acts.length)return '';return `<section><b>${labels[group]}</b><div>${acts.map(({x,i})=>{const pos=h.positionMap[x.player]||'',lab=replayActionLabel(x,h);return `<button class="timeline-action ${i===state().step?'current':''} type-${x.type}" data-replay-step="${i}"><small>${esc(pos)}</small><strong>${esc(lab)}</strong></button>`}).join('')}</div></section>`}).join('')}</div>`
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
  const st=computeReplayState(h,state().step),step=h.steps[state().step],max=Math.max(0,h.steps.length-1),heroSeat=h.seats.find(x=>x.name===h.hero),heroPos=h.positionMap[h.hero]||'',heroBb=h.bb&&heroSeat?heroSeat.stack/h.bb:0,progress=replayActionProgress(h,state().step),playerIdentity=replayPlayerIdentity(h)
  const currentPlayer=step?.kind==='action'?step.player:''
  const seats=h.seats.map(p=>{
    const coords=replayPlayerCoords(h,p),{left,top}=coords,ps=st.players[p.name]||{},known=knownOpponentCards(h,p.name),cards=p.name===h.hero?h.heroCards:(state().showOpponentCards?known:(ps.cards||[])),pos=h.positionMap[p.name]||`Seat ${p.seat}`,stackBb=h.bb?ps.stack/h.bb:0,bet=st.streetContrib[p.name]||0
    const bp=replayBetCoords(coords),ip=replayInfoCoords(coords),action=currentPlayer===p.name?replayActionLabel(step,h):''
    const classes=`${ps.folded?'folded':''} ${p.name===h.hero?'hero':''} ${currentPlayer===p.name?'acting':''}`
    return `<div class="seat-cards ${classes}" style="left:${left}%;top:${top}%"><div class="mini-cards">${cards.length?cards.map(cardHtml).join(''):'<span class="card-back">?</span><span class="card-back">?</span>'}</div></div><div class="seat-info ${classes}" style="left:${ip.left}%;top:${ip.top}%"><b>${esc(pos)} · ${esc(p.name)}</b><span>${stackBb.toFixed(1)}bb (${fmtFullChips(ps.stack)})</span>${(p.bountyCash??p.bounty)!=null?`<span class="seat-bounty">🎯 $${Number(p.bountyCash??p.bounty).toFixed(2)}</span>`:''}</div>${bet>0?`<div class="table-bet" style="left:${bp.left}%;top:${bp.top}%"><span class="chip-stack"><i></i><i></i><i></i></span><b>${fmtChips(bet)}</b><small>${h.bb?(bet/h.bb).toFixed(1)+'bb':''}</small></div>`:''}`
  }).join('')
  const potBb=h.bb?st.pot/h.bb:0
  return `<div class="panel replay-stage-panel icm-replayer"><div class="replay-head"><div><div class="replay-player-line">${h.teamSourcePlayer?`<span class="replay-player-badge">${esc(playerIdentity.name)}</span><span>${playerIdentity.site?esc(playerIdentity.site):''}${playerIdentity.nick?` · ${esc(playerIdentity.nick)}`:''}</span>`:''}</div><h2>${esc(h.heroCards.join(' '))} · ${esc(heroPos)} · ${heroBb.toFixed(1)}bb</h2><div class="muted">${esc(h.tournamentName)} · ${esc(h.blindText)} · ${esc(h.dateTime)}</div></div><div class="replay-head-actions"><button class="btn secondary" id="saveReplayTournament">💾 Salvar torneio</button><button class="btn secondary" id="toggleOpponentCards">${state().showOpponentCards?'🙈 Esconder mãos':'👁 Mostrar mãos conhecidas'}</button><button class="btn secondary" id="toggleEquilab">▦ Equilab</button><button class="btn" id="saveReplayHand">Salvar mão</button></div></div><div class="replay-main ${state().equilabOpen?'with-equilab':''}"><div class="replay-table-column"><div class="poker-table-wrap players-${h.seats.length}"><div class="poker-scene players-${h.seats.length}"><div class="poker-table"><div class="table-felt-mark">POKER STUDY</div><div class="table-center"><div class="pot-display"><span>POT</span><b>${fmtChips(st.pot)}</b><small>${potBb.toFixed(1)}bb</small></div><div class="board-cards">${st.board.length?st.board.map(cardHtml).join(''):'<span class="board-placeholder"></span>'.repeat(5)}</div></div></div>${seats}</div></div><div class="replay-controlbar"><div class="current-action"><small>${esc(progress.small)}</small><strong>${esc(progress.text)}</strong></div><div class="replay-controls"><button class="btn secondary" id="replayFirst" title="Mão anterior">⏮</button><button class="btn secondary" id="replayPrev">◀ Anterior</button><button class="btn" id="replayPlay">${state().playing?'⏸ Pausar':'▶ Play'}</button><button class="btn secondary" id="replayNext">Próxima ▶</button><button class="btn secondary" id="replayLast" title="Próxima mão">⏭</button><label class="speed-control">Velocidade <select id="replaySpeed">${[1,1.5,2,3].map(v=>`<option value="${v}" ${state().speed===v?'selected':''}>${String(v).replace('.',',')}x</option>`).join('')}</select></label><input id="replayRange" type="range" min="0" max="${max}" value="${Math.min(state().step,max)}"></div></div>${replayTimelineHtml(h)}<details class="raw-actions"><summary>Ações da mão</summary>${h.steps.map((x,i)=>`<div class="raw-action ${i===state().step?'current':''}">${x.kind==='street'?esc('*** '+(x.label||x.street).toUpperCase()+' ***'):esc(replayActionText(x,h))}</div>`).join('')}</details></div>${state().equilabOpen?equilabHtml(h,st):''}</div></div>`
}
function knownOpponentCards(h,name){
  if(name===h.hero)return h.heroCards||[]
  for(let i=h.steps.length-1;i>=0;i--){const x=h.steps[i];if(x.kind==='action'&&x.type==='show'&&x.player===name)return x.cards||[]}
  return []
}
const RANGE_RANKS=['A','K','Q','J','T','9','8','7','6','5','4','3','2']
const RANGE_COLORS={blue:'Azul',green:'Verde',yellow:'Amarelo',red:'Vermelho',purple:'Roxo'}
function rangeKeyForCell(r,c){if(r===c)return RANGE_RANKS[r]+RANGE_RANKS[c];return r<c?RANGE_RANKS[r]+RANGE_RANKS[c]+'s':RANGE_RANKS[c]+RANGE_RANKS[r]+'o'}
function rangeSelections(h){if(!state().rangeByHand[h.handId])state().rangeByHand[h.handId]={};return state().rangeByHand[h.handId]}
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
  const palette=Object.entries(RANGE_COLORS).map(([k,v])=>`<button class="range-color range-${k} ${state().rangeColor===k?'active':''}" data-range-color="${k}" title="${v}"></button>`).join('')
  const colorStats=Object.entries(RANGE_COLORS).map(([k,v])=>`<div class="range-stat"><span class="range-dot range-${k}"></span><span>${v}</span><b>${stats.byColor[k]||0}</b><small>combos</small></div>`).join('')
  return `<aside class="equilab-panel"><div class="equilab-title"><div><h3>Equilab</h3><small>Range Lab integrado ao Replayer</small></div><button class="icon-btn" id="closeEquilab">×</button></div><div class="range-toolbar"><span>Cor:</span>${palette}<button class="btn small secondary" id="rangeErase">Borracha</button><button class="btn small danger" id="rangeClear">Limpar</button></div><div class="range-grid">${grid}</div><div class="range-summary"><div><small>Range selecionado</small><strong>${stats.pct.toFixed(1)}%</strong></div><div><small>Combos disponíveis</small><strong>${stats.total}</strong><span>${stats.gross!==stats.total?` (${stats.gross} brutos)`:''}</span></div></div><div class="range-stats">${colorStats}</div><div class="dead-cards"><small>Cartas conhecidas descontadas</small><div>${stats.dead.length?stats.dead.map(cardHtml).join(''):'<span class="muted">Nenhuma</span>'}</div></div><p class="muted range-help">Clique nas células para pintar. Clique novamente com a mesma cor para remover. Os blockers do Hero e do board são descontados da contagem.</p></aside>`
}
function bindEquilab(h,rerender){
  const close=document.getElementById('closeEquilab');if(close)close.onclick=()=>{state().equilabOpen=false;rerender()}
  document.querySelectorAll('[data-range-color]').forEach(b=>b.onclick=()=>{state().rangeColor=b.dataset.rangeColor;rerender()})
  document.querySelectorAll('[data-range-cell]').forEach(b=>b.onclick=()=>{const sel=rangeSelections(h),k=b.dataset.rangeCell,c=state().rangeColor;if(c==='erase'||sel[k]===c)delete sel[k];else sel[k]=c;rerender()})
  const er=document.getElementById('rangeErase');if(er)er.onclick=()=>{state().rangeColor='erase';rerender()}
  const clear=document.getElementById('rangeClear');if(clear)clear.onclick=()=>{if(confirm('Limpar todo o range desta mão?')){state().rangeByHand[h.handId]={};rerender()}}
}
function cardHtml(c){const m=String(c).match(/^([2-9TJQKA])([cdhs])$/);if(!m)return `<span class="playing-card">${esc(c)}</span>`;const suit={c:'♣',d:'♦',h:'♥',s:'♠'}[m[2]];return `<span class="playing-card suit-${m[2]}"><span class="card-rank">${m[1]}</span><span class="card-suit">${suit}</span></span>`}


  return {replayPlayerCoords,replayBetCoords,replayInfoCoords,replayTimelineHtml,replayActionProgress,firstReplayActionIndex,replayStageHtml,knownOpponentCards,rangeKeyForCell,rangeSelections,rangeCellCombos,equilabStats,equilabHtml,bindEquilab,cardHtml}
}
