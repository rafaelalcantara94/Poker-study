const TEAM_INTEL_CACHE_KEY='poker_study_team_intel_cache_v1420'
function emailFirstName(email){
  const local=String(email||'').split('@')[0].trim()
  const first=local.split(/[._+\-\s]+/).filter(Boolean)[0]||''
  return first?first.charAt(0).toUpperCase()+first.slice(1):'Jogador'
}
function smartPlayerName(row){
  const raw=String(row?.display_name||'').trim()
  const generic=!raw||/^(player|jogador|jogadora)$/i.test(raw)
  return row?.role==='player'&&generic?emailFirstName(row?.email):raw||emailFirstName(row?.email)
}


function cacheRead(){
  try{
    const c=JSON.parse(sessionStorage.getItem(TEAM_INTEL_CACHE_KEY)||'null')
    if(!c||!Array.isArray(c.rows))return null
    return c
  }catch{return null}
}
function cacheWrite(rows){
  try{sessionStorage.setItem(TEAM_INTEL_CACHE_KEY,JSON.stringify({savedAt:Date.now(),rows:rows||[]}))}catch{}
}
function withTimeout(promise,ms,label){
  let t
  return Promise.race([
    promise,
    new Promise((_,reject)=>{t=setTimeout(()=>reject(new Error(`${label} excedeu ${Math.round(ms/1000)}s`)),ms)})
  ]).finally(()=>clearTimeout(t))
}

export function createTeamIntelService({supabase,ensureTeamContext}){
  let loadPromise=null

  async function loadFresh(){
    const started=performance.now()
    const ctx=await withTimeout(ensureTeamContext(),8000,'Contexto da equipe')
    const teamId=ctx?.teamId
    if(!teamId)throw new Error('Equipe não encontrada para este usuário.')

    const mgr=await withTimeout(supabase.rpc('is_team_manager',{p_team:teamId}),8000,'Permissão do gestor')
    if(mgr.error||!mgr.data){
      return {manager:false,rows:[],timing:{total:Math.round(performance.now()-started)}}
    }

    const rpcStart=performance.now()
    const {data,error}=await withTimeout(
      supabase.rpc('get_team_hh_intelligence',{p_team:teamId}),
      12000,
      'Inteligência da equipe'
    )
    if(error)throw error

    const rows=(data||[]).map(r=>({
      member:{
        user_id:r.user_id,
        role:r.role,
        display_name:smartPlayerName(r),
        email:r.email,
        joined_at:r.joined_at
      },
      snap:r.hands==null?null:{
        user_id:r.user_id,
        hands:r.hands,
        stats:r.stats||{},
        leaks:r.leaks||[],
        updated_at:r.updated_at
      }
    }))

    cacheWrite(rows)
    return {
      manager:true,
      rows,
      timing:{
        rpc:Math.round(performance.now()-rpcStart),
        total:Math.round(performance.now()-started)
      }
    }
  }

  async function load({force=false}={}){
    const cached=cacheRead()

    if(!force&&cached&&Date.now()-cached.savedAt<120000){
      return {
        manager:true,
        rows:cached.rows,
        cached:true,
        cacheAge:Date.now()-cached.savedAt,
        timing:{total:0}
      }
    }

    if(loadPromise&&!force)return loadPromise

    loadPromise=(async()=>{
      try{
        return await loadFresh()
      }catch(e){
        console.error('Team intelligence load failed',e)
        if(cached?.rows?.length){
          return {
            manager:true,
            rows:cached.rows,
            cached:true,
            stale:true,
            error:e
          }
        }
        return {manager:true,rows:[],error:e}
      }finally{
        loadPromise=null
      }
    })()

    return loadPromise
  }

  function invalidate(){
    try{sessionStorage.removeItem(TEAM_INTEL_CACHE_KEY)}catch{}
  }

  return {
    load,
    cacheRead,
    cacheWrite,
    invalidate
  }
}
