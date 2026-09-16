// Poker Study · Replayer Core
// Pure parsing/state helpers + IndexedDB persistence shared by Replayer and HH Stats.

export const REPLAY_DB='poker-study-replayer'
export const REPLAY_STORE='tournaments'
export const HH_STATS_STORE='hhStatsImports'
export const HH_SNAPSHOT_STORE='hhStatsSnapshot'

export function replayDb(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(REPLAY_DB,3)
    r.onupgradeneeded=()=>{
      if(!r.result.objectStoreNames.contains(REPLAY_STORE))r.result.createObjectStore(REPLAY_STORE,{keyPath:'id'})
      if(!r.result.objectStoreNames.contains(HH_STATS_STORE))r.result.createObjectStore(HH_STATS_STORE,{keyPath:'id'})
      if(!r.result.objectStoreNames.contains(HH_SNAPSHOT_STORE))r.result.createObjectStore(HH_SNAPSHOT_STORE,{keyPath:'id'})
    }
    r.onsuccess=()=>resolve(r.result)
    r.onerror=()=>reject(r.error)
  })
}

export async function savedReplayList(){
  const d=await replayDb()
  return new Promise((resolve,reject)=>{
    const tx=d.transaction(REPLAY_STORE,'readonly'),r=tx.objectStore(REPLAY_STORE).getAll()
    r.onsuccess=()=>resolve((r.result||[]).sort((a,b)=>(b.savedAt||'').localeCompare(a.savedAt||'')))
    r.onerror=()=>reject(r.error)
  })
}

export async function saveReplayTournament(rec){
  const d=await replayDb()
  return new Promise((resolve,reject)=>{
    const tx=d.transaction(REPLAY_STORE,'readwrite')
    tx.objectStore(REPLAY_STORE).put(rec)
    tx.oncomplete=()=>resolve()
    tx.onerror=()=>reject(tx.error)
  })
}

export async function deleteReplayTournament(id){
  const d=await replayDb()
  return new Promise((resolve,reject)=>{
    const tx=d.transaction(REPLAY_STORE,'readwrite')
    tx.objectStore(REPLAY_STORE).delete(id)
    tx.oncomplete=()=>resolve()
    tx.onerror=()=>reject(tx.error)
  })
}

export function parseGgHistory(text){
  const blocks=String(text||'').replace(/\r/g,'').split(/(?=^Poker Hand #)/m).map(x=>x.trim()).filter(x=>x.startsWith('Poker Hand #'))
  return blocks.map(parseGgHand).filter(Boolean)
}

export function parseGgHand(block){
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
      if(['ante','sb','bb'].includes(a.type))forcedActions.push(a)
      else {steps.push(a);if(streetActions[street])streetActions[street].push(line)}
    }
  }
  const resultLine=lines.find(x=>x.startsWith('Total pot '))||'',potm=resultLine.match(/Total pot ([\d,]+)/),finalPot=potm?+potm[1].replace(/,/g,''):0
  const positionMap=derivePositions(seats,buttonSeat)
  return {handId,tournamentId,tournamentName,level:level.trim(),blindText,dateTime,table,buttonSeat,seats,hero,heroCards,bb,sb,ante,forcedActions,steps,streetActions,finalPot,positionMap,raw:block}
}

export function parseGgAction(line,street){
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

export function derivePositions(seats,buttonSeat){
  const ordered=[...seats].sort((a,b)=>a.seat-b.seat),bi=ordered.findIndex(x=>x.seat===buttonSeat);if(bi<0)return {}
  const clockwise=[...ordered.slice(bi),...ordered.slice(0,bi)],n=clockwise.length,map={}
  const labels=n===2?['BTN/SB','BB']:n===3?['BTN','SB','BB']:n===4?['BTN','SB','BB','CO']:n===5?['BTN','SB','BB','HJ','CO']:n===6?['BTN','SB','BB','UTG','HJ','CO']:n===7?['BTN','SB','BB','UTG','UTG+1','HJ','CO']:n===8?['BTN','SB','BB','UTG','UTG+1','MP','HJ','CO']:['BTN','SB','BB','UTG','UTG+1','MP1','MP2','HJ','CO']
  clockwise.forEach((x,i)=>map[x.name]=labels[i]||`Seat ${x.seat}`)
  return map
}

export function computeReplayState(h,idx){
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
  }
  return {players,pot,board,streetLabel,street,streetContrib}
}

export function fmtChips(n){
  n=+n||0
  return n>=1e6?(n/1e6).toFixed(n>=1e7?1:2)+'M':n>=1e3?(n/1e3).toFixed(n>=1e5?0:1)+'k':Math.round(n).toLocaleString('pt-BR')
}

export function fmtFullChips(n){return Math.max(0,Math.round(+n||0)).toLocaleString('pt-BR')}

export function replayActionLabel(x,h){
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

export function replayActionText(x,h){
  if(!x||x.kind!=='action')return ''
  const pos=h.positionMap[x.player]||x.player,label=replayActionLabel(x,h)
  return `${pos}: ${label}`
}
