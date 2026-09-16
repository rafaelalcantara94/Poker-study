export function replayPlayerIdentity(h){
  if(!h)return {name:'',site:'',nick:''}
  const name=h.teamSourcePlayer||h.playerName||h.hero||''
  const site=h.teamSite||h.site||h.network||h.room||''
  let nick=h.teamHeroNickname||h.heroNickname||h.heroName||h.hero||''
  if(String(nick).toLowerCase()==='hero')nick=''
  return {name,site,nick}
}

export function teamAdaptiveHandsPerPlayer(n){
  if(n<=2)return 50
  if(n<=6)return 30
  if(n<=10)return 20
  return 15
}

export function createReviewPacks(deps){
  const {
    supabase,
    ensureTeamContext,
    positionGroup,
    hhHandsByIds,
    getDb,
    getUser,
    getReplayState,
    setReplayState,
    firstReplayActionIndex,
    getHhReplayContext,
    setHhReplayContext,
    closeModal,
    route,
    leakArea,
    alertFn=msg=>alert(msg)
  }=deps

  function teamLeakKey(l){
    return [
      String(l?.label||'').trim(),
      String(l?.metric||''),
      String(l?.pos||'all'),
      String(l?.reviewTarget||'hits')
    ].join('|')
  }

  function teamReviewRowsForLeak(facts,leak){
    let rows=(facts||[]).filter(x=>x.game==='holdem')
    const pos=String(leak?.pos||'all')
    if(pos!=='all')rows=rows.filter(x=>positionGroup(String(x.position||''))===pos)

    const metric=String(leak?.metric||''),target=String(leak?.reviewTarget||'hits')
    let opp=()=>true,hit=()=>false
    const bool=(oppKey,hitKey)=>{opp=x=>!!x[oppKey];hit=x=>!!x[hitKey]}

    if(metric==='vpip'){opp=()=>true;hit=x=>!!x.vpip}
    else if(metric==='pfr'){opp=()=>true;hit=x=>!!x.pfr}
    else if(metric==='wwsf'){opp=x=>!!x.sawFlop;hit=x=>!!(x.sawFlop&&x.won)}
    else if(metric==='rfi')bool('rfiOpp','rfi')
    else if(metric==='limp')bool('limpOpp','limp')
    else if(metric==='3bet')bool('threeBetOpp','threeBet')
    else if(metric==='squeeze')bool('squeezeOpp','squeeze')
    else if(metric==='call3')bool('faced3bet','call3bet')
    else if(metric==='fold3')bool('faced3bet','foldTo3bet')
    else if(metric==='4bet')bool('fourBetOpp','fourBet')
    else if(metric==='steal')bool('stealOpp','steal')
    else if(metric==='foldbbsteal')bool('bbVsStealOpp','foldBbVsSteal')
    else if(metric==='cbet')bool('cbetOpp','cbet')
    else if(metric==='cbett')bool('cbetTurnOpp','cbetTurn')
    else if(metric==='cbetr')bool('cbetRiverOpp','cbetRiver')
    else if(metric==='foldcbetf')bool('facedCbetFlop','foldVsCbetFlop')
    else if(metric==='xrf'){opp=x=>(+x.xrFlopOpp||0)>0;hit=x=>(+x.xrFlop||0)>0}
    else if(metric==='xrt'){opp=x=>(+x.xrTurnOpp||0)>0;hit=x=>(+x.xrTurn||0)>0}
    else if(metric==='xrr'){opp=x=>(+x.xrRiverOpp||0)>0;hit=x=>(+x.xrRiver||0)>0}
    else if(metric==='xr'){opp=x=>(+x.xrOppCount||0)>0;hit=x=>(+x.xrCount||0)>0}
    else if(metric.startsWith('adv|')){
      const p=metric.split('|'),hitKey=p[1],oppKey=p[2]
      opp=x=>(+x[oppKey]||0)>0
      hit=x=>(+x[hitKey]||0)>0
    }else return []

    rows=rows.filter(opp)
    rows=target==='misses'?rows.filter(x=>!hit(x)):rows.filter(hit)
    return rows.sort((a,b)=>String(b.time||b.date||'').localeCompare(String(a.time||a.date||'')))
  }

  function teamCompactReplayHand(h,sourcePlayer=''){
    if(!h)return null
    const x=JSON.parse(JSON.stringify(h))
    delete x.raw
    x.teamSourcePlayer=sourcePlayer||x.teamSourcePlayer||''
    x.teamSite=x.teamSite||x.site||x.network||x.room||'GG Poker'
    x.teamHeroNickname=x.teamHeroNickname||x.heroNickname||x.heroName||x.hero||''
    return x
  }

  async function publishTeamReviewPacks(teamId,facts,leaks){
    const selected=(leaks||[]).filter(l=>l?.metric).slice(0,20)
    if(!selected.length)return {packs:0,hands:0}

    const packs=[],allIds=new Set()
    for(const leak of selected){
      const rows=teamReviewRowsForLeak(facts,leak).slice(0,50)
      const ids=[...new Set(rows.map(x=>x.handId).filter(Boolean))]
      ids.forEach(id=>allIds.add(id))
      packs.push({leak,ids})
    }

    const allHands=await hhHandsByIds([...allIds])
    const byId=new Map(allHands.map(h=>[h.handId,h]))
    let ok=0,totalHands=0,empty=0,failed=0

    for(const p of packs){
      const db=getDb()
      const user=getUser()
      const meName=(db.members||[]).find(m=>m.user_id===user?.id)?.display_name||user?.email||''
      const hands=p.ids.map(id=>teamCompactReplayHand(byId.get(id),meName)).filter(Boolean)

      if(!hands.length){
        empty++
        console.warn('Review pack vazio',p.leak.label,p.leak.pos,p.leak.metric)
        continue
      }

      const {error}=await supabase.rpc('publish_team_review_pack',{
        p_team:teamId,
        p_leak_key:teamLeakKey(p.leak),
        p_label:p.leak.label||'Leak',
        p_metric:p.leak.metric||'',
        p_position:p.leak.pos||'all',
        p_review_target:p.leak.reviewTarget||'hits',
        p_hands:hands
      })

      if(error){
        failed++
        console.warn('Review pack sync failed',p.leak.label,error)
        continue
      }

      ok++
      totalHands+=hands.length
    }

    return {packs:ok,hands:totalHands,requested:packs.length,empty,failed}
  }

  async function teamLoadReviewPacks(label){
    const {teamId}=await ensureTeamContext()
    const {data,error}=await supabase.rpc('get_team_review_packs',{p_team:teamId,p_label:label})
    if(error)throw error
    return data||[]
  }

  function reviewRoomName(v){
    const s=String(v||'').trim().toLowerCase()
    if(!s)return 'Unknown'
    if(s.includes('pokerstars'))return 'PokerStars'
    if(s==='acr'||s.includes('americas cardroom')||s.includes('winning poker'))return 'ACR'
    if(s.includes('coinpoker'))return 'CoinPoker'
    if(s.includes('gg'))return 'GGNetwork'
    return String(v||'Unknown')
  }

  function teamReplayFromPacks(packs,label,room='all'){
    if(!packs?.length){
      alertFn('Nenhum Review Pack foi encontrado para este recorte. Abra o Stats HH do jogador uma vez nesta versão e confirme no topo quantos pacotes foram sincronizados.')
      return false
    }

    const players=[...new Set(packs.map(p=>p.user_id))]
    const n=Math.max(1,players.length)
    const requested=teamAdaptiveHandsPerPlayer(n)
    const perPlayer=Math.max(5,Math.min(requested,Math.floor(200/n)))
    const byPlayer=new Map()

    for(const p of packs){
      if(!byPlayer.has(p.user_id))byPlayer.set(p.user_id,[])
      const src=p.display_name||p.email||'Jogador'
      const rows=[...(p.hands||[])].filter(h=>room==='all'||reviewRoomName(h.room||h.teamSite||h.site||h.network)===room).sort((a,b)=>String(b.dateTime||'').localeCompare(String(a.dateTime||'')))

      for(const h of rows){
        const c=JSON.parse(JSON.stringify(h))
        const orig=String(c.handId||'')
        c.originalHandId=orig
        c.handId=String(p.user_id||'player').slice(0,8)+'-'+orig
        c.teamSourcePlayer=src
        c.teamSite=c.teamSite||c.site||c.network||c.room||'GG Poker'
        c.teamHeroNickname=c.teamHeroNickname||c.heroNickname||c.heroName||c.hero||''
        c.teamLeakLabel=p.label||label
        byPlayer.get(p.user_id).push(c)
      }
    }

    const hands=[]
    byPlayer.forEach(rows=>hands.push(...rows.slice(0,perPlayer)))
    const dedup=[...new Map(hands.map(h=>[h.handId,h])).values()]
      .sort((a,b)=>String(b.dateTime||'').localeCompare(String(a.dateTime||'')))
      .slice(0,200)

    if(!dedup.length){
      alertFn('Os Review Packs existem, mas não contêm mãos utilizáveis para este recorte.')
      return false
    }

    setReplayState({
      hands:dedup,
      selected:dedup[0],
      step:firstReplayActionIndex(dedup[0]),
      sourceName:`Replayer · ${label}`,
      rawText:'',
      speed:1,
      playing:false,
      showOpponentCards:false,
      equilabOpen:false,
      rangeByHand:{},
      rangeColor:'blue'
    })

    setHhReplayContext({
      label:`Replayer · ${label}`,
      count:dedup.length,
      metaByHand:{},
      summary:`${players.length} jogador(es) · até ${perPlayer} mãos/jogador · ${dedup.length} mãos`,
      handClassFilter:'all',
      priorityFilter:'all',
      prioritizedIds:[],
      teamCollective:true
    })

    closeModal()
    route('replayer')
    return true
  }

  async function openTeamCollectiveReplayer(label,room='all'){
    const packs=await teamLoadReviewPacks(label)
    return teamReplayFromPacks(packs,label,room)
  }

  async function openTeamPlayerReviewPack(label,userId,playerName='Jogador',room='all'){
    const packs=(await teamLoadReviewPacks(label)).filter(p=>p.user_id===userId)
    return teamReplayFromPacks(packs,`${playerName} · ${label}`,room)
  }

  async function openTeamAreaCollectiveReplayer(area,rows,userId=null,room='all'){
    const labels=[...new Set(
      (rows||[])
        .filter(x=>x.snap&&(!userId||x.member.user_id===userId))
        .flatMap(x=>(x.snap.leaks||[])
          .filter(l=>leakArea(l.label,l.group)===area)
          .map(l=>l.label))
    )]

    if(!labels.length){
      alertFn('Nenhum leak desta área está disponível no recorte atual.')
      return false
    }

    const sets=await Promise.all(labels.map(l=>teamLoadReviewPacks(l).catch(()=>[])))
    let packs=sets.flat()
    if(userId)packs=packs.filter(p=>p.user_id===userId)
    return teamReplayFromPacks(packs,`${area}${userId?' · jogador':''}`)
  }

  return {
    publishTeamReviewPacks,
    openTeamCollectiveReplayer,
    openTeamPlayerReviewPack,
    openTeamAreaCollectiveReplayer,
    teamLoadReviewPacks,
    teamReplayFromPacks
  }
}
