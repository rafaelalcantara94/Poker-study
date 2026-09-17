// Painel DR V12.9.0 — Replayer Runtime module
// Playback, hand selection and stage bindings extracted from main.js.
export function createReplayerRuntime(deps){
  const {
    getReplayState, firstReplayActionIndex, replayStageHtml, bindEquilab,
    saveReplayTournament, onSaveHand, hasStudyContext, bindStudyWorkflow
  }=deps
  const state=()=>getReplayState()
  let replayTimer=null

  function adjacentReplayHand(direction){
    const s=state(),hs=(s.viewHands&&s.viewHands.length?s.viewHands:s.hands)||[]
    if(!hs.length||!s.selected)return null
    const i=hs.findIndex(x=>x.handId===s.selected.handId);if(i<0)return null
    const ni=i+direction;if(ni<0||ni>=hs.length)return null
    return hs[ni]
  }
  function stopReplay(){
    if(replayTimer){clearInterval(replayTimer);replayTimer=null}
    state().playing=false
  }
  function selectReplayHand(id){
    const s=state(),h=s.hands.find(x=>x.handId===id);if(!h)return
    stopReplay();s.selected=h;s.step=firstReplayActionIndex(h)
    const stage=document.getElementById('replayStage');if(stage)stage.innerHTML=replayStageHtml(h)
    document.querySelectorAll('[data-replay-hand]').forEach(b=>b.classList.toggle('active',b.dataset.replayHand===id))
    bindReplayStage()
  }
  function bindReplayStage(){
    const s=state(),h=s.selected;if(!h)return
    const rerender=()=>{const el=document.getElementById('replayStage');if(!el)return;el.innerHTML=replayStageHtml(h);bindReplayStage()}
    document.querySelectorAll('[data-replay-step]').forEach(b=>b.onclick=()=>{stopReplay();state().step=+b.dataset.replayStep;rerender()})
    const first=document.getElementById('replayFirst'),last=document.getElementById('replayLast'),prev=document.getElementById('replayPrev'),next=document.getElementById('replayNext'),range=document.getElementById('replayRange'),save=document.getElementById('saveReplayHand'),opp=document.getElementById('toggleOpponentCards'),eq=document.getElementById('toggleEquilab'),speed=document.getElementById('replaySpeed'),play=document.getElementById('replayPlay')
    if(first)first.onclick=()=>{const x=adjacentReplayHand(-1);if(x)selectReplayHand(x.handId)}
    if(last)last.onclick=()=>{const x=adjacentReplayHand(1);if(x)selectReplayHand(x.handId)}
    if(prev)prev.onclick=()=>{stopReplay();state().step=Math.max(0,state().step-1);rerender()}
    if(next)next.onclick=()=>{stopReplay();state().step=Math.min(h.steps.length-1,state().step+1);rerender()}
    if(range)range.oninput=()=>{stopReplay();state().step=+range.value;rerender()}
    if(save)save.onclick=()=>onSaveHand(h)
    const saveTournamentBtn=document.getElementById('saveReplayTournament')
    if(saveTournamentBtn)saveTournamentBtn.onclick=async()=>{const cur=state();if(!cur.rawText)return alert('Importe um arquivo .txt antes de salvar.');const id=(h.tournamentId||h.tournamentName||cur.sourceName).replace(/[^a-zA-Z0-9_-]/g,'_');await saveReplayTournament({id,name:cur.sourceName||h.tournamentName||'Torneio',text:cur.rawText,handsCount:cur.hands.length,savedAt:new Date().toISOString()});saveTournamentBtn.textContent='✓ Torneio salvo';setTimeout(()=>{const b=document.getElementById('saveReplayTournament');if(b)b.textContent='💾 Salvar torneio'},1400)}
    if(opp)opp.onclick=()=>{state().showOpponentCards=!state().showOpponentCards;rerender()}
    if(eq)eq.onclick=()=>{state().equilabOpen=!state().equilabOpen;rerender()}
    if(speed)speed.onchange=()=>{state().speed=+speed.value||1;if(state().playing){stopReplay();startReplay(h,rerender)}}
    if(play)play.onclick=()=>{if(state().playing){stopReplay();rerender()}else startReplay(h,rerender)}
    if(hasStudyContext())bindStudyWorkflow()
    bindEquilab(h,rerender)
  }
  function startReplay(h,rerender){
    stopReplay();const s=state();if(s.step>=h.steps.length-1)s.step=0;s.playing=true;rerender()
    const tick=Math.max(220,900/(s.speed||1));replayTimer=setInterval(()=>{const cur=state();if(cur.step>=h.steps.length-1){stopReplay();rerender();return}cur.step++;rerender()},tick)
  }
  return {adjacentReplayHand,stopReplay,selectReplayHand,bindReplayStage,startReplay}
}
