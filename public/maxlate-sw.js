self.addEventListener('notificationclick',event=>{
  event.notification.close()
  const url=event.notification?.data?.url||'/'
  event.waitUntil((async()=>{
    const wins=await clients.matchAll({type:'window',includeUncontrolled:true})
    for(const w of wins){if('focus' in w){await w.focus();return}}
    if(clients.openWindow)return clients.openWindow(url)
  })())
})
