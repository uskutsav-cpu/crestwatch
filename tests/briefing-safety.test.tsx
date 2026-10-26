import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {isFresh} from '@/lib/river-stations';
const mocked=vi.hoisted(()=>({state:{} as any,params:new URLSearchParams()}));
vi.mock('next/navigation',()=>({useSearchParams:()=>mocked.params,useRouter:()=>({push:vi.fn()})}));
vi.mock('@/lib/use-watch',()=>({useWatches:()=>mocked.state}));
vi.mock('@/components/experience/RiverMap',()=>({RiverMap:()=>React.createElement('div',null,'Location map')}));
import {PlaceWatch} from '@/components/experience/PlaceWatch';
const NOW=Date.parse('2026-10-25T16:00:00Z');
function makeState(){return {pins:[{id:'p1',name:'School',matchedAddress:'Public example, Mississippi',lat:32.3,lon:-90.9,elevationFt:100,approximate:true}],watches:[{pinId:'p1',alerts:[],alertsOk:true,verdict:{tier:'CATEGORY'},gauge:{name:'Mississippi River at Vicksburg',lid:'VCKM6',distanceMi:3,gaugeZeroFt:46.22,gaugeDatum:'NGVD29',categories:{minor:43},observed:[{t:'2026-10-25T15:00:00Z',stageFt:13.7},{t:'2026-10-25T15:30:00Z',stageFt:13.7}],forecast:[{t:'2026-10-25T20:00:00Z',stageFt:15},{t:'2026-10-26T00:00:00Z',stageFt:17}],forecastIssued:'2026-10-25T15:00:00Z'}}],loading:false,error:false,fromSaved:false,updatedAt:NOW,refresh:()=>{}}}
function render(){return renderToStaticMarkup(React.createElement(PlaceWatch))}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(NOW);mocked.state=makeState();mocked.params=new URLSearchParams()});afterEach(()=>vi.useRealTimers());
describe('Freshness boundaries',()=>{
 it('rejects absent, invalid, stale and implausibly future timestamps',()=>{expect(isFresh(null)).toBe(false);expect(isFresh('oops')).toBe(false);expect(isFresh('2026-10-25T13:59:59Z')).toBe(false);expect(isFresh('2026-10-25T16:06:00Z')).toBe(false);expect(isFresh('2026-10-25T15:00:00Z')).toBe(true)});
});
describe('Place briefing safety contract',()=>{
 it('shows real gauge context without asserting property inundation',()=>{const html=render();expect(html).toContain('13.7');expect(html).toContain('17.0 ft');expect(html).toContain('Nearby does not mean connected');expect(html).toContain('does not establish whether your property');expect(html).not.toContain('stays dry');expect(html).not.toContain('water reaches your')});
 it('does not subtract incompatible vertical references',()=>{const html=render();expect(html).toContain('does not subtract them without a verified conversion');expect(html).not.toContain('Hypothetical gauge reading')});
 it('suppresses current forecast summary when issue time is stale',()=>{mocked.state.watches[0].gauge.forecastIssued='2026-10-23T15:00:00Z';const html=render();expect(html).toContain('There isn’t enough current forecast information');expect(html).not.toContain('17.0 ft')});
 it('marks a failed refresh and removes the recent-reading claim',()=>{mocked.state.error=true;const html=render();expect(html).toContain('The latest check failed');expect(html).not.toContain('Recent reading');expect(html).toContain('Current reading unavailable')});
 it('never turns alert-service failure into an all-clear',()=>{mocked.state.watches[0].alertsOk=false;const html=render();expect(html).toContain('alert service could not be reached');expect(html).not.toContain('No active flood alerts returned')});
 it('explains proximity and the absence of background monitoring',()=>{const html=render();expect(html).toContain('3.0 miles away, selected by distance');expect(html).toContain('No monitoring happens after you close it')});
 it('preserves river context while clearly marking absent ground height',()=>{mocked.state.pins[0].elevationFt=null;const html=render();expect(html).toContain('Ground height is unavailable');expect(html).toContain('13.7');expect(html).not.toContain('0<small> ft');expect(html).not.toContain('Hypothetical gauge reading')});
 it('handles a malformed shared link without showing personal saved places',()=>{mocked.params=new URLSearchParams('wl=bad');const html=render();expect(html).toContain('This link needs another look');expect(html).not.toContain('School')});
});
