export function createTeamCenterRuntime(deps){
  const {
    loadTeamIntel,
    cacheRead,
    filteredRows,
    html,
    bindFilters,
    bindActions,
    esc
  }=deps

  let renderSeq=0

  async function init(){
    const root=document.getElementById('teamCenterRoot')
    if(!root)return

    const seq=++renderSeq
    const started=performance.now()
    const cached=cacheRead()

    const renderRows=(allRows,meta={})=>{
      if(seq!==renderSeq||!document.getElementById('teamCenterRoot'))return
      const r=document.getElementById('teamCenterRoot')
      if(!r)return

      try{
        window.__teamCoachRows=allRows
        const rows=filteredRows(allRows)
        const htmlStart=performance.now()
        const markup=html(rows,allRows)
        const htmlMs=Math.round(performance.now()-htmlStart)

        r.innerHTML=markup
        bindFilters(allRows)
        bindActions(rows,allRows)

        const totalMs=Math.round(performance.now()-started)
        console.info('[Poker Study][Central] render',{
          source:meta.source||'network',
          htmlMs,
          totalMs,
          rows:allRows.length
        })

        const badge=document.createElement('div')
        badge.className='team-perf-badge'
        badge.textContent=meta.source==='cache'?'⚡ cache':'⚡ atualizado'
        badge.title=`Central: ${totalMs}ms · HTML: ${htmlMs}ms`
        r.prepend(badge)
      }catch(e){
        console.error('[Poker Study][Central] render failed',e)
        r.innerHTML=`<section class="panel team-load-error"><h2>⚠️ Não foi possível montar a Central</h2><p class="muted">Etapa: renderização do Coach Intelligence.</p><code>${esc(e?.message||String(e))}</code><div><button class="btn" id="retryTeamIntel">Tentar novamente</button></div></section>`
        document.getElementById('retryTeamIntel')?.addEventListener('click',()=>init())
      }
    }

    if(cached?.rows?.length){
      renderRows(cached.rows,{source:'cache'})
      const r=document.getElementById('teamCenterRoot')
      if(r)r.insertAdjacentHTML('afterbegin','<div class="team-refresh-strip" id="teamRefreshStrip">Atualizando inteligência em segundo plano…</div>')
    }else{
      root.innerHTML=`<section class="panel team-loading-fast"><div class="team-loading-line"><span></span></div><h2>🧠 Central do Time <span class="pill">TEAM INTELLIGENCE</span></h2><p>Buscando o último snapshot da equipe…</p><small>Se o banco demorar, esta tela não ficará presa indefinidamente.</small></section>`
    }

    await new Promise(resolve=>requestAnimationFrame(()=>resolve()))
    const x=await loadTeamIntel({force:true})
    if(seq!==renderSeq)return

    if(!x.manager){
      root.innerHTML=`<section class="panel"><h2>Área exclusiva do gestor</h2><p class="muted">Seu perfil não possui permissão de owner/manager para visualizar a inteligência da equipe.</p></section>`
      return
    }

    if(x.error&&!x.rows?.length){
      root.innerHTML=`<section class="panel team-load-error"><h2>⚠️ Central do Time indisponível</h2><p class="muted">A consulta não concluiu. O app foi liberado para você continuar usando as outras abas.</p><code>${esc(x.error?.message||String(x.error))}</code><div><button class="btn" id="retryTeamIntel">Tentar novamente</button></div></section>`
      document.getElementById('retryTeamIntel')?.addEventListener('click',()=>init())
      return
    }

    renderRows(x.rows||[],{source:x.stale?'cache-stale':'network'})
  }

  return {init}
}
