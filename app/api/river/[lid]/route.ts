import {parseImpacts} from '@/lib/impacts';
import {STATIONS} from '@/lib/river-stations';
import {cached} from '@/lib/cache';
import {fetchJson} from '@/lib/net';
import {nwpsDetailUrl,nwpsStageflowUrl,parseStageflowSeries,parseCategories} from '@/lib/gauges';
export async function GET(_req:Request,{params}:{params:Promise<{lid:string}>}) {
 const {lid}=await params;if(!STATIONS.some(s=>s.lid===lid))return Response.json({ok:false,error:'Unknown station'},{status:404});
 try {const data=await cached(`briefing:${lid}`,900000,async()=>{const [d,s]=await Promise.all([fetchJson(nwpsDetailUrl(lid)),fetchJson(nwpsStageflowUrl(lid))]);const detail=d as Parameters<typeof parseCategories>[0];const flow=s as {observed?:Parameters<typeof parseStageflowSeries>[0];forecast?:Parameters<typeof parseStageflowSeries>[0]&{issuedTime?:string}};return {observed:parseStageflowSeries(flow.observed),forecast:parseStageflowSeries(flow.forecast),forecastIssued:flow.forecast?.issuedTime??null,impacts:parseImpacts(d),categories:parseCategories(detail)};});return Response.json({ok:true,...data,checkedAt:new Date().toISOString()});}catch{return Response.json({ok:false,error:'The official river feed is temporarily unavailable.'},{status:502})}
}
