const esc = (s='') => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))
const uid = () => crypto.randomUUID()

const MAXLATE_KEY='poker_study_maxlate_alarms_v113'
let maxLateTimerHandle=null
let maxLateAudioCtx=null
let maxLateAlarmTimers=[]
function maxLateAlarms(){
  try{return JSON.parse(localStorage.getItem(MAXLATE_KEY)||'[]')}catch{return []}
}
function saveMaxLateAlarms(rows){localStorage.setItem(MAXLATE_KEY,JSON.stringify(rows||[]))}
function maxLateFmt(ms){
  ms=Math.max(0,ms||0);const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60
  return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
}
function maxLateActive(){return maxLateAlarms().filter(a=>!a.fired&&+a.endsAt>Date.now()).sort((a,b)=>a.endsAt-b.endsAt)}
function maxLateNext(){return maxLateActive()[0]||null}
async function maxLateRequestPermission(){
  if(!('Notification'in window))return 'unsupported'
  await maxLateRegisterServiceWorker()
  if(Notification.permission==='default')try{return await Notification.requestPermission()}catch{return Notification.permission}
  return Notification.permission
}
async function maxLateUnlockAudio(){
  try{
    const AC=window.AudioContext||window.webkitAudioContext
    if(!AC)return false
    if(!maxLateAudioCtx)maxLateAudioCtx=new AC()
    if(maxLateAudioCtx.state==='suspended')await maxLateAudioCtx.resume()
    const g=maxLateAudioCtx.createGain();g.gain.value=.0001;g.connect(maxLateAudioCtx.destination)
    const o=maxLateAudioCtx.createOscillator();o.connect(g);o.start();o.stop(maxLateAudioCtx.currentTime+.03)
    return true
  }catch{return false}
}
function maxLateStopSound(){
  maxLateAlarmTimers.forEach(clearTimeout);maxLateAlarmTimers=[]
  try{window.speechSynthesis?.cancel()}catch{}
}
function maxLatePickMaleVoice(){
  try{
    const voices=window.speechSynthesis?.getVoices?.()||[]
    const pt=voices.filter(v=>/^pt(-|_)/i.test(v.lang||''))
    const maleHints=['antonio','daniel','felipe','ricardo','male','mascul','paulo','brasil']
    return pt.find(v=>maleHints.some(h=>String(v.name||'').toLowerCase().includes(h)))||pt.find(v=>/pt-BR/i.test(v.lang||''))||pt[0]||voices[0]||null
  }catch{return null}
}
function maxLateSpeak(name){
  try{
    if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window))return false
    window.speechSynthesis.cancel()
    const u=new SpeechSynthesisUtterance(`Atenção. Max late do ${String(name||'torneio')}.`)
    u.lang='pt-BR';u.rate=.92;u.pitch=.82;u.volume=1
    const voice=maxLatePickMaleVoice();if(voice)u.voice=voice
    window.speechSynthesis.speak(u);return true
  }catch{return false}
}
async function maxLateSingleBeep(){
  try{
    const ok=await maxLateUnlockAudio();if(!ok)return
    const ctx=maxLateAudioCtx,o1=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain()
    o1.type='square';o2.type='sawtooth';o1.frequency.value=980;o2.frequency.value=490
    g.gain.setValueAtTime(.42,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.01,ctx.currentTime+.7)
    o1.connect(g);o2.connect(g);g.connect(ctx.destination);o1.start();o2.start();o1.stop(ctx.currentTime+.72);o2.stop(ctx.currentTime+.72)
  }catch{}
}
async function maxLateAlarmSequence(name){
  maxLateStopSound()
  for(let i=0;i<3;i++){
    const timer=setTimeout(async()=>{
      await maxLateSingleBeep()
      const voiceTimer=setTimeout(()=>maxLateSpeak(name),850)
      maxLateAlarmTimers.push(voiceTimer)
    },i*6500)
    maxLateAlarmTimers.push(timer)
  }
}
async function maxLateRegisterServiceWorker(){
  if(!('serviceWorker'in navigator))return null
  try{return await navigator.serviceWorker.register('/maxlate-sw.js')}catch(e){console.warn('Max Late SW registration failed',e);return null}
}
async function maxLateSystemNotify(title,body,id=''){
  if(!('Notification'in window)||Notification.permission!=='granted')return false
  try{
    const reg=(await maxLateRegisterServiceWorker())||await navigator.serviceWorker.ready
    if(reg?.showNotification){
      await reg.showNotification(title,{body,tag:'poker-study-maxlate-'+id,requireInteraction:true,renotify:true,data:{url:location.href}})
      return true
    }
  }catch(e){console.warn('Service Worker notification failed',e)}
  try{
    const n=new Notification(title,{body,tag:'poker-study-maxlate-'+id,requireInteraction:true})
    n.onclick=()=>{window.focus();n.close()}
    return true
  }catch(e){console.warn('Notification fallback failed',e);return false}
}
function maxLateFire(a){
  const rows=maxLateAlarms(),x=rows.find(r=>r.id===a.id);if(!x||x.fired)return
  x.fired=true;x.firedAt=Date.now();saveMaxLateAlarms(rows);maxLateAlarmSequence(x.name)
  const title=`MAX LATE ${String(x.name||'TORNEIO').toUpperCase()}`
  maxLateSystemNotify(title,'O Max Late chegou. Abra o Poker Study para revisar o torneio.',x.id)
  const toast=document.createElement('div');toast.className='maxlate-alarm-toast';toast.innerHTML=`<div>⏰</div><section><small>POKER STUDY · MAX LATE</small><b>${esc(title)}</b><span>O cronômetro chegou a zero. O aviso será repetido 3x.</span></section><button>Parar alarme</button>`;document.body.appendChild(toast);toast.querySelector('button').onclick=()=>{maxLateStopSound();toast.remove()}
  updateMaxLateHeader()
}
function maxLateTick(){
  const rows=maxLateAlarms(),now=Date.now()
  rows.filter(a=>!a.fired&&+a.endsAt<=now).forEach(maxLateFire)
  updateMaxLateHeader()
  updateMaxLateModalCountdowns()
}
function startMaxLateWatcher(){
  maxLateRegisterServiceWorker()
  if(maxLateTimerHandle)clearInterval(maxLateTimerHandle)
  maxLateTimerHandle=setInterval(maxLateTick,1000);maxLateTick()
}
function updateMaxLateHeader(){
  const box=document.getElementById('maxLateWidget');if(!box)return
  const next=maxLateNext(),count=maxLateActive().length
  box.classList.toggle('active',!!next)
  const time=box.querySelector('.maxlate-header-time'),badge=box.querySelector('.maxlate-count')
  if(time)time.textContent=next?maxLateFmt(next.endsAt-Date.now()):'Registro de Max late'
  if(badge){badge.textContent=count;badge.hidden=!count}
}
function updateMaxLateModalCountdowns(){
  const root=document.getElementById('maxLateModalBody');if(!root)return
  const rows=maxLateAlarms()
  root.querySelectorAll('[data-maxlate-time]').forEach(el=>{
    const a=rows.find(x=>String(x.id)===String(el.dataset.maxlateTime))
    if(a&&!a.fired&&a.endsAt>Date.now())el.textContent=maxLateFmt(a.endsAt-Date.now())
  })
}
function openMaxLateModal(){
  document.getElementById('maxLateOverlay')?.remove()
  const el=document.createElement('div');el.id='maxLateOverlay';el.className='maxlate-overlay';el.innerHTML=`<section class="maxlate-modal"><header><div><small>⏰ POKER STUDY</small><h2>Registro de Max Late</h2><p>Crie alarmes para não perder o fim do late registration.</p></div><button class="maxlate-close">×</button></header><div id="maxLateModalBody"></div></section>`;document.body.appendChild(el)
  el.querySelector('.maxlate-close').onclick=()=>el.remove();el.onclick=e=>{if(e.target===el)el.remove()}
  renderMaxLateModalBody()
}
function renderMaxLateModalBody(){
  const root=document.getElementById('maxLateModalBody');if(!root)return
  const rows=maxLateAlarms().sort((a,b)=>a.endsAt-b.endsAt),active=rows.filter(a=>!a.fired&&a.endsAt>Date.now())
  root.innerHTML=`<div class="maxlate-create"><label><span>Torneio / identificação</span><input id="maxLateName" placeholder="Ex.: 109 ACR"></label><label><span>Horas</span><input id="maxLateHours" type="number" min="0" max="24" value="0"></label><label><span>Minutos</span><input id="maxLateMinutes" type="number" min="0" max="59" value="30"></label><button class="btn" id="maxLateCreate">⏰ Iniciar cronômetro</button></div>
  <div class="maxlate-permission"><div><b>Notificação do Windows</b><span>${!('Notification'in window)?'Seu navegador não suporta notificações.':Notification.permission==='granted'?'✓ Permissão concedida — usaremos o sistema do Windows':Notification.permission==='denied'?'Bloqueada no navegador/Windows':'Ainda não autorizada'}</span></div><div class="maxlate-permission-actions"><button class="btn secondary small" id="maxLatePermission" ${!('Notification'in window)||Notification.permission==='granted'?'disabled':''}>Permitir notificação</button><button class="btn secondary small" id="maxLateTest">🔊 Testar voz + alerta</button></div></div>
  <div class="maxlate-list-head"><b>Alarmes ativos</b><span>${active.length}</span></div>
  <div class="maxlate-list">${active.length?active.map(a=>`<article><div class="maxlate-clock">⏰</div><div><b>${esc(a.name)}</b><span>Termina ${new Date(a.endsAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span></div><strong data-maxlate-time="${esc(a.id)}">${maxLateFmt(a.endsAt-Date.now())}</strong><button data-maxlate-cancel="${esc(a.id)}">Cancelar</button></article>`).join(''):'<div class="notice">Nenhum cronômetro ativo.</div>'}</div>
  <p class="maxlate-note">Para a notificação do sistema aparecer, deixe o navegador aberto (pode estar minimizado). Se o navegador estiver fechado por completo, esta versão web não consegue disparar o alerta.</p>`
  const create=document.getElementById('maxLateCreate');if(create)create.onclick=async()=>{
    const name=String(document.getElementById('maxLateName')?.value||'').trim()
    const h=Math.max(0,+document.getElementById('maxLateHours')?.value||0),m=Math.max(0,+document.getElementById('maxLateMinutes')?.value||0),duration=(h*60+m)*60000
    if(!name)return alert('Digite o nome do torneio. Ex.: 109 ACR')
    if(duration<60000)return alert('Defina pelo menos 1 minuto.')
    await maxLateUnlockAudio();await maxLateRequestPermission()
    const rows=maxLateAlarms();rows.push({id:uid(),name,createdAt:Date.now(),endsAt:Date.now()+duration,fired:false});saveMaxLateAlarms(rows);renderMaxLateModalBody();updateMaxLateHeader()
  }
  const perm=document.getElementById('maxLatePermission');if(perm)perm.onclick=async()=>{await maxLateRequestPermission();renderMaxLateModalBody()}
  const test=document.getElementById('maxLateTest');if(test)test.onclick=async()=>{const testName=String(document.getElementById('maxLateName')?.value||'Daily Big 10').trim()||'Daily Big 10';await maxLateUnlockAudio();await maxLateRequestPermission();maxLateAlarmSequence(testName);const ok=await maxLateSystemNotify(`MAX LATE ${testName.toUpperCase()}`,'Teste do alerta de Max Late.','test');if(!ok)alert('O navegador não conseguiu enviar a notificação do Windows. A voz ainda pode funcionar normalmente com o Poker Study aberto.')}
  root.querySelectorAll('[data-maxlate-cancel]').forEach(b=>b.onclick=()=>{saveMaxLateAlarms(maxLateAlarms().filter(a=>a.id!==b.dataset.maxlateCancel));renderMaxLateModalBody();updateMaxLateHeader()})
}

export function maxLateWidgetHtml(){
  return `<button id="maxLateWidget" class="maxlate-header" title="Registro de Max Late"><span class="maxlate-icon">⏰</span><span class="maxlate-header-time">Registro de Max late</span><i class="maxlate-count" hidden>0</i></button>`
}
export function bindMaxLateWidget(){
  document.getElementById('maxLateWidget')?.addEventListener('click',openMaxLateModal)
  startMaxLateWatcher()
}
