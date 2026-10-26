import type { SeriesPoint } from './gauges';
import type { RiverImpact } from './impacts';
import { isFresh } from './river-stations';
import { thresholdForecast } from './threshold-forecast';
export interface HistoricCrest { stage: number; date: string; }
/** Same-gauge crests on the current datum only; daily means are not substituted. */
export function parseHistoricCrests(raw: unknown, now = Date.now()): HistoricCrest[] {
 const d = raw as {flood?:{stageUnits?:string;crests?:{historic?:{stage?:unknown;occurredTime?:unknown;olddatum?:unknown}[]}}};
 if(d?.flood?.stageUnits !== 'ft' || !Array.isArray(d.flood.crests?.historic)) return [];
 return d.flood.crests.historic.filter(c=>typeof c.stage==='number'&&Number.isFinite(c.stage)&&c.stage>-100&&c.olddatum===false&&typeof c.occurredTime==='string'&&Number.isFinite(Date.parse(c.occurredTime))&&Date.parse(c.occurredTime)<=now).map(c=>({stage:c.stage as number,date:(c.occurredTime as string).slice(0,10)})).sort((a,b)=>b.stage-a.stage);
}
export function impactBriefing(forecast:SeriesPoint[],issued:string|null, floodStage:number|null, notes:RiverImpact[],now=Date.now()) {
 const fc=thresholdForecast(forecast,issued,floodStage??NaN,now);
 const high=fc.high;
 const valid=notes.filter(n=>Number.isFinite(n.stage)&&n.statement.trim()).slice().sort((a,b)=>a.stage-b.stage);
 const reached=high ? valid.filter(n=>n.stage<=high.stageFt).at(-1)??null : null;
 const next=high ? valid.find(n=>n.stage>high.stageFt)??null : null;
 return {high,first:fc.first,status:fc.status,reached,next,issuedFresh:isFresh(issued,24,now),difference:high&&floodStage!==null?high.stageFt-floodStage:null};
}
export const OFFICIAL_MAP_SOURCE='https://www.usgs.gov/data/flood-inundation-maps-and-water-surface-elevation-data-february-17-2020-flood-pearl-river';
export const SCENARIO_MAP_SOURCE='https://www.weather.gov/jan/riverfloodextents';

/** Linked from the NWS Jackson flood-extent collection; explicitly non-operational prototypes. */
export const PROTOTYPE_MAP_LINKS:Record<string,string>={
 JACM6:'https://noaa.maps.arcgis.com/apps/webappviewer/index.html?id=48f6e22ec5904fc08d8a0d316e6b9bd9',
 GEEM6:'https://noaa.maps.arcgis.com/apps/webappviewer/index.html?id=a04ed05a6bf744d8b2ce4dc535dc0215',
 VCKM6:'https://noaa.maps.arcgis.com/apps/webappviewer/index.html?id=97c57c9b2b074f23bd63ad99e030cbe2',
};
