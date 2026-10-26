/* Push receiver only: no offline caching of forecasts or private responses. */
self.addEventListener('push',event=>{
 let message;try{message=event.data.json();}catch{return;}
 const path=typeof message.path==='string'&&/^\/\?station=(VCKM6|GEEM6|YZOM6|JACM6)(#rivers)?$/.test(message.path)?message.path:'/notifications';
 event.waitUntil(self.registration.showNotification(String(message.title??'CrestWatch').slice(0,100),{body:String(message.body??'Open CrestWatch and check the official forecast.').slice(0,600),icon:'/favicon.svg',tag:String(message.tag??'crestwatch').slice(0,100),data:{path},requireInteraction:false}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();const url=new URL(event.notification.data?.path??'/notifications',self.location.origin).href;event.waitUntil(self.clients.openWindow(url));});
