/** Shared, client-safe validation for browser push subscriptions and gauge thresholds. */
export const PUSH_STATIONS=['VCKM6','GEEM6','YZOM6','JACM6'] as const;
export interface PushSubscriptionData {endpoint:string;keys:{p256dh:string;auth:string};}
export function validPushSubscription(value:unknown):value is PushSubscriptionData {
 const s=value as PushSubscriptionData;
 if(typeof s?.endpoint!=='string'||s.endpoint.length>2048||typeof s.keys?.p256dh!=='string'||typeof s.keys?.auth!=='string')return false;
 if(!/^[A-Za-z0-9_-]{87}$/.test(s.keys.p256dh)||!/^[A-Za-z0-9_-]{22}$/.test(s.keys.auth))return false;
 try{const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','wns2-par02p.notify.windows.com'].some(h=>u.hostname===h||h==='web.push.apple.com'&&u.hostname.endsWith('.web.push.apple.com')||h.endsWith('.notify.windows.com')&&u.hostname.endsWith('.notify.windows.com'));}catch{return false;}
}
export function validPushWatch(lid:unknown,threshold:unknown){return typeof lid==='string'&&PUSH_STATIONS.includes(lid as typeof PUSH_STATIONS[number])&&typeof threshold==='number'&&Number.isFinite(threshold)&&threshold>=-20&&threshold<=100&&Math.abs(Math.round(threshold*10)-threshold*10)<1e-8;}
/** Only fresh, feet-based, future official forecast samples can trigger a push. */
export function pushForecast(raw:unknown,threshold:number,now=Date.now()) {
 const d=raw as {forecast?:{primaryUnits?:string;issuedTime?:string;data?:{primary?:unknown;validTime?:unknown}[]}};const f=d?.forecast;
 const issued=Date.parse(f?.issuedTime??'');
 if(f?.primaryUnits!=='ft'||!Number.isFinite(issued)||issued>now+300000||now-issued>86400000||!Array.isArray(f.data))return null;
 const points=f.data.filter(p=>typeof p.primary==='number'&&Number.isFinite(p.primary)&&typeof p.validTime==='string'&&Number.isFinite(Date.parse(p.validTime))&&Date.parse(p.validTime)>now).map(p=>({stage:p.primary as number,time:p.validTime as string})).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 if(!points.length)return null;
 const high=points.reduce((a,b)=>a.stage>=b.stage?a:b);return {issued:f.issuedTime!,high,first:points.find(p=>p.stage>=threshold)??null,reached:high.stage>=threshold};
}
