import { parseDvSeries } from './replay';
import backwater from './replay-data/dv_backwater2019.json';
import pearl2020 from './replay-data/dv_pearl2020.json';
import pearl2022 from './replay-data/dv_pearl2022.json';
export const HISTORICAL_RECORDS = [
  {id:'backwater2019',year:'2019',name:'The long backwater',place:'Yazoo River at Redwood',period:'JANUARY – AUGUST',unit:'NGVD29 ft',data:backwater},
  {id:'pearl2020',year:'2020',name:'A February rise',place:'Pearl River at Jackson',period:'FEBRUARY – MARCH',unit:'ft on gauge',data:pearl2020},
  {id:'pearl2022',year:'2022',name:'The late-summer flood',place:'Pearl River at Jackson',period:'AUGUST – SEPTEMBER',unit:'ft on gauge',data:pearl2022},
];
export function replayEventId(raw: string | null) { return HISTORICAL_RECORDS.some(r=>r.id===raw) ? raw! : 'pearl2020'; }
export const historyPoints = (id: string) => parseDvSeries(HISTORICAL_RECORDS.find(r=>r.id===id)?.data);
