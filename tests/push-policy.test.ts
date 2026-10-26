import { describe, expect, it } from 'vitest';
import { validPushSubscription,validPushWatch,pushForecast } from '../lib/push-policy';
const now=Date.parse('2026-10-26T06:00:00Z');
const sub={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}};
it('accepts only known HTTPS push providers and correctly shaped browser keys',()=>{expect(validPushSubscription(sub)).toBe(true);for(const endpoint of ['http://fcm.googleapis.com/test','https://fcm.googleapis.com.evil.test/','https://127.0.0.1/','https://user@fcm.googleapis.com/x','https://fcm.googleapis.com:9443/x'])expect(validPushSubscription({...sub,endpoint})).toBe(false);expect(validPushSubscription({...sub,keys:{...sub.keys,auth:'short'}})).toBe(false);});
it('bounds gauge watches to supported stations and tenth-foot thresholds',()=>{expect(validPushWatch('JACM6',28.1)).toBe(true);expect(validPushWatch('bad',28)).toBe(false);expect(validPushWatch('JACM6',28.123)).toBe(false);expect(validPushWatch('JACM6',NaN)).toBe(false);expect(validPushWatch('JACM6',101)).toBe(false);});
describe('push trigger policy',()=>{
 const raw={forecast:{primaryUnits:'ft',issuedTime:'2026-10-26T00:00:00Z',data:[{primary:90,validTime:'2026-10-25T00:00:00Z'},{primary:27,validTime:'2026-10-26T12:00:00Z'},{primary:28,validTime:'2026-10-27T00:00:00Z'}]}};
 it('triggers at equality and ignores past values',()=>{expect(pushForecast(raw,28,now)?.reached).toBe(true);expect(pushForecast(raw,29,now)?.reached).toBe(false);expect(pushForecast(raw,28,now)?.first?.time).toBe('2026-10-27T00:00:00Z');});
 it('skips absent, stale, future-issued, non-feet and no-future-sample feeds',()=>{expect(pushForecast(null,28,now)).toBeNull();for(const change of [{primaryUnits:'m'},{issuedTime:'2020-01-01'},{issuedTime:'2090-01-01'},{data:[]}])expect(pushForecast({forecast:{...raw.forecast,...change}},28,now)).toBeNull();});
});
