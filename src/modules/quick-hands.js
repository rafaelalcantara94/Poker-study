const DB_NAME='poker-study-quick-hands'
const DB_VERSION=1
const STORE='quickHands'

function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION)
    req.onupgradeneeded=()=>{
      const db=req.result
      if(!db.objectStoreNames.contains(STORE)){
        const s=db.createObjectStore(STORE,{keyPath:'id'})
        s.createIndex('user_id','user_id',{unique:false})
        s.createIndex('created_at','created_at',{unique:false})
      }
    }
    req.onsuccess=()=>resolve(req.result)
    req.onerror=()=>reject(req.error)
  })
}

async function tx(mode,action){
  const db=await openDb()
  return new Promise((resolve,reject)=>{
    const t=db.transaction(STORE,mode),s=t.objectStore(STORE)
    let result
    try{result=action(s)}catch(e){reject(e);return}
    t.oncomplete=()=>resolve(result)
    t.onerror=()=>reject(t.error)
    t.onabort=()=>reject(t.error)
  })
}

function id(){
  try{return crypto.randomUUID()}catch{return 'qh-'+Date.now()+'-'+Math.random().toString(36).slice(2)}
}
function cleanTags(tags){
  return [...new Set((tags||[]).map(x=>String(x||'').trim()).filter(Boolean))]
}

export function createQuickHands({getUserId}){
  async function get(rowId){
    const db=await openDb()
    return new Promise((resolve,reject)=>{
      const r=db.transaction(STORE,'readonly').objectStore(STORE).get(rowId)
      r.onsuccess=()=>resolve(r.result||null)
      r.onerror=()=>reject(r.error)
    })
  }

  async function list(){
    const userId=getUserId()
    if(!userId)return []
    const db=await openDb()
    return new Promise((resolve,reject)=>{
      const r=db.transaction(STORE,'readonly').objectStore(STORE).getAll()
      r.onsuccess=()=>resolve((r.result||[])
        .filter(x=>x.user_id===userId)
        .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))))
      r.onerror=()=>reject(r.error)
    })
  }

  async function save(data={}){
    const userId=getUserId()
    if(!userId)throw new Error('Usuário não autenticado.')
    const current=data.id?await get(data.id):null
    const row={
      id:data.id||id(),
      user_id:userId,
      created_at:current?.created_at||new Date().toISOString(),
      updated_at:new Date().toISOString(),
      note:String(data.note||'').trim(),
      link:String(data.link||'').trim(),
      tags:cleanTags(data.tags),
      favorite:!!data.favorite,
      image_blob:data.image_blob===undefined?(current?.image_blob||null):data.image_blob,
      image_name:data.image_name===undefined?(current?.image_name||''):data.image_name,
      image_type:data.image_type===undefined?(current?.image_type||''):data.image_type
    }
    await tx('readwrite',s=>s.put(row))
    return row
  }

  async function remove(rowId){
    await tx('readwrite',s=>s.delete(rowId))
  }

  async function toggleFavorite(rowId){
    const row=await get(rowId)
    if(!row)return null
    row.favorite=!row.favorite
    row.updated_at=new Date().toISOString()
    await tx('readwrite',s=>s.put(row))
    return row
  }

  return {get,list,save,remove,toggleFavorite}
}
