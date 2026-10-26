import webpush from 'web-push';
import {pushForecast,validPushSubscription} from '../lib/push-policy.ts';
const SERVICE='https://crestwatch-river-guide.utsavsresearch.chatgpt.site/api/push';
const origin='https://crestwatch-rivers.vercel.app';
const token=process.env.CRESTWATCH_MONITOR_TOKEN;
if(!token||!process.env.CRESTWATCH_VAPID_PRIVATE_KEY||!process.env.CRESTWATCH_VAPID_PUBLIC_KEY)throw Error('Notification secrets are not configured.');
webpush.setVapidDetails(origin+'/notifications',process.env.CRESTWATCH_VAPID_PUBLIC_KEY,process.env.CRESTWATCH_VAPID_PRIVATE_KEY);
async function service(input){const r=await fetch(SERVICE,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(input),signal:AbortSignal.timeout(25000)});const d=await r.json();if(!r.ok||!d.ok)throw Error('Private notification service failed: '+r.status);return d;}
const rows=(await service({action:'monitor'})).subscriptions;
const feeds=new Map();let sent=0,tests=0,gone=0,skipped=0,failed=0;
for(const row of rows){
 const subscription={endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}};
 if(!validPushSubscription(subscription)){skipped++;continue;}
 const ack=extra=>service({action:'ack',id:row.id,...extra});
 async function deliver(payload){try{await webpush.sendNotification(subscription,JSON.stringify(payload),{TTL:900,urgency:'normal',timeout:15000});return true;}catch(e){if(e.statusCode===404||e.statusCode===410){await ack({gone:true});gone++;}else failed++;return false;}}
 if(row.test_requested){if(await deliver({title:'CrestWatch delivery test',body:'This test traveled through the scheduled monitor and browser push service. It is not a flood warning.',path:'/?station='+row.lid+'#rivers',tag:'crestwatch-test'})){await ack({test:true});tests++;}else continue;}
 if(!feeds.has(row.lid)){try{const r=await fetch(`https://api.water.noaa.gov/nwps/v1/gauges/${row.lid}/stageflow`,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error();feeds.set(row.lid,await r.json());}catch{feeds.set(row.lid,null);}}
 const result=pushForecast(feeds.get(row.lid),row.threshold_tenths/10);
 if(!result){skipped++;continue;}
 if(!result.reached){if(row.was_above)await ack({above:false});continue;}
 if(row.was_above)continue;
 const time=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Chicago',timeZoneName:'short'});
 const delivered=await deliver({title:`${row.lid}: forecast threshold reached`,body:`NOAA forecast high ${result.high.stage.toFixed(1)} ft reaches your ${(row.threshold_tenths/10).toFixed(1)} ft threshold. Forecast issued ${time.format(new Date(result.issued))}. Check the official forecast; this is not an emergency warning.`,path:'/?station='+row.lid+'#rivers',tag:'crestwatch-'+row.lid});
 if(delivered){await ack({above:true,sent:true});sent++;}
}
// Counts only: endpoints, keys, subscription IDs and private payloads are never logged.
console.log(JSON.stringify({checked:rows.length,sent,tests,gone,skipped,failed}));
if(failed>0)process.exitCode=1;
