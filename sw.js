const CACHE='suivi-achats-v2';
const ASSETS=['./','./index.html','./styles.css','./manifest.webmanifest','./icons/icon.svg','./js/app.js','./js/config.js','./js/calculations.mjs','./js/storage.js'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(event.request);
    if(cached)return cached;
    try{
      const response=await fetch(event.request);
      cache.put(event.request,response.clone());
      return response;
    }catch(error){
      return cached||Response.error();
    }
  }));
});
