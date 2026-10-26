import {describe,it,expect,vi} from 'vitest';
import {isPin,type Pin} from '@/lib/pins';
import {encodeWatchLink,decodeWatchLink} from '@/lib/watch-link';
import {survey} from '@/lib/surveyor';
import {optionalGroundHeight,inSupportedBounds} from '@/lib/location-save';
const pin:Pin={id:'no-ground',name:'Public place',matchedAddress:'Vicksburg, Mississippi',lat:32.35,lon:-90.88,elevationFt:null,approximate:true};
describe('Optional ground data',()=>{
 it('allows an explicit missing ground height without accepting a malformed number',()=>{expect(isPin(pin)).toBe(true);expect(isPin({...pin,elevationFt:NaN})).toBe(false);expect(isPin({...pin,elevationFt:'0'})).toBe(false)});
 it('round-trips missing ground in share links instead of converting it to zero',()=>{const decoded=decodeWatchLink(encodeWatchLink([pin]));expect(decoded?.[0].elevationFt).toBeNull();expect(decoded?.[0].lat).toBe(pin.lat)});
 it('falls back to gauge-category context when ground is missing',()=>{const verdict=survey({pinElevationFt:null,now:'2026-10-25T16:00:00Z',gauge:{observed:[{t:'2026-10-25T15:45:00Z',stageFt:13.7}],forecast:[{t:'2026-10-25T20:00:00Z',stageFt:15},{t:'2026-10-26T00:00:00Z',stageFt:17}],forecastIssued:'2026-10-25T15:00:00Z',gaugeZeroFt:46.22,gaugeDatum:'NGVD29',categories:{minor:43}}});expect(verdict.tier).toBe('CATEGORY');expect(verdict).not.toHaveProperty('marginFt')});
 it('returns null for network failures, non-JSON responses and invalid upstream data',async()=>{
  const network=vi.fn().mockRejectedValue(new Error('offline')) as typeof fetch;
  expect(await optionalGroundHeight(pin,network)).toBeNull();
  for(const response of [new Response('<html>outage</html>',{status:502}),Response.json({ok:true,elevationFt:null}),Response.json({ok:true,elevationFt:'0'}),Response.json({ok:true,elevationFt:30000})])expect(await optionalGroundHeight(pin,async()=>response)).toBeNull();
 });
 it('keeps a legitimate zero elevation and only accepts successful validated replies',async()=>{expect(await optionalGroundHeight(pin,async()=>Response.json({ok:true,elevationFt:0}))).toBe(0);expect(await optionalGroundHeight(pin,async()=>Response.json({ok:true,elevationFt:120}))).toBe(120);expect(await optionalGroundHeight(pin,async()=>Response.json({ok:true,elevationFt:120},{status:503}))).toBeNull()});
 it('does not turn a user cancellation into an upstream-failure fallback',async()=>{const c=new AbortController();c.abort();await expect(optionalGroundHeight(pin,async()=>{throw new DOMException('Canceled','AbortError')},c.signal)).rejects.toThrow()});
 it('rejects nonfinite or outside-coverage coordinate edits',()=>{expect(inSupportedBounds(pin)).toBe(true);expect(inSupportedBounds({lat:NaN,lon:-90})).toBe(false);expect(inSupportedBounds({lat:40,lon:-90})).toBe(false);expect(inSupportedBounds({lat:32,lon:0})).toBe(false)});
});
