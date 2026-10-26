export interface AuditCheck {
 check_id:string;gauge_id:string;category:string;test_name:string;status:string;severity?:string;finding?:string;notes?:string;input_value_ft?:string;expected_result?:string;actual_result?:string;evidence_reference?:string;reproduction_steps?:string;limitations?:string;
}
export function filterAuditChecks(rows:AuditCheck[],gauge:string,kind:string,search:string) {
 const q=search.trim().toLowerCase();
 return rows.filter(r=>(!gauge||r.gauge_id===gauge)&&(!kind||(kind==='slider'?r.category==='impact_slider':r.category!=='impact_slider'))&&(!q||[r.check_id,r.test_name,r.category,r.finding,r.notes].filter(Boolean).join(' ').toLowerCase().includes(q)));
}
export function readableAuditValue(value:string|undefined) {
 if(!value)return 'Not provided in the supplied record.';
 try{return JSON.stringify(JSON.parse(value),null,2);}catch{return value;}
}
