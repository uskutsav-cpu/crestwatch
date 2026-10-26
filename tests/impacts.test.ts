import {describe,it,expect} from 'vitest';
import {parseImpacts,impactContext} from '@/lib/impacts';
describe('Official impact thresholds',()=>{
 const raw={flood:{stageUnits:'ft',impacts:[{stage:54,statement:'Intersection inundated.'},{stage:43,statement:'Road begins to flood.'},{stage:'45',statement:'Wrong units type'},{stage:null,statement:'No stage'},{stage:NaN,statement:'No finite stage'},{stage:44,statement:''}]}};
 it('accepts only complete, finite, stage-in-feet source notes',()=>{expect(parseImpacts(raw)).toEqual([{stage:43,statement:'Road begins to flood.'},{stage:54,statement:'Intersection inundated.'}]);expect(parseImpacts({flood:{...raw.flood,stageUnits:'m'}})).toEqual([]);expect(parseImpacts(null)).toEqual([])});
 it('includes exact threshold crossings and preserves the next note',()=>{expect(impactContext(43,parseImpacts(raw))).toEqual({reached:[{stage:43,statement:'Road begins to flood.'}],next:{stage:54,statement:'Intersection inundated.'}})});
 it('does not invent an impact below the published range',()=>{expect(impactContext(13.7,parseImpacts(raw)).reached).toEqual([]);expect(impactContext(NaN,parseImpacts(raw))).toEqual({reached:[],next:null})});
});
