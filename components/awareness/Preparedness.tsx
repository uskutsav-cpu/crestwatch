"use client";
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadPins } from '@/lib/pin-store';
import { PREPAREDNESS_ITEMS, PREPAREDNESS_SOURCES } from '@/lib/preparedness';
import type { Pin } from '@/lib/pins';
export function Preparedness({spanish=false}:{spanish?:boolean}){
 const search=useSearchParams();const es=spanish||search.get('lang')==='es';
 const [checked,setChecked]=useState<string[]>([]),[pins,setPins]=useState<Pin[]>([]),[pin,setPin]=useState('');
 useEffect(()=>{setPins(loadPins());try{const d=JSON.parse(localStorage.getItem('crestwatch.preparedness')??'[]');if(Array.isArray(d))setChecked(d.filter(x=>PREPAREDNESS_ITEMS.some(i=>i.id===x)));}catch{}},[]);
 const [saveError,setSaveError]=useState(false);
 function toggle(id:string){const next=checked.includes(id)?checked.filter(x=>x!==id):[...checked,id];setChecked(next);try{localStorage.setItem('crestwatch.preparedness',JSON.stringify(next));setSaveError(false);}catch{setSaveError(true);}}
 return <section className="preparedness-page" lang={es?'es':'en'}><div className="page-title"><span className="eyebrow">{es?'Preparación del hogar':'Household preparedness'}</span><h1>{es?'Un plan antes de la inundación':'A plan before the flood'}</h1><p>{es?'Una lista para revisar con su hogar, basada en las recomendaciones del Servicio Meteorológico Nacional y los CDC.':'A checklist to review with your household, based on National Weather Service and CDC guidance.'}</p></div>
 <div className="prepare-tools"><a className="secondary-button" href={es?'/prepare':'/prepare?lang=es'}>{es?'English':'Español'}</a><button className="primary-button" onClick={()=>window.print()}>{es?'Imprimir la lista':'Print checklist'}</button></div>
 {pins.length>0&&<label className="awareness-field">{es?'Lugar (opcional, solo en este dispositivo)':'Place (optional, stays on this device)'}<select value={pin} onChange={e=>setPin(e.target.value)}><option value="">{es?'Todo el hogar':'Whole household'}</option>{pins.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
 {pin&&<p className="print-place">{es?'Plan para':'Plan for'}: <strong>{pins.find(p=>p.id===pin)?.name}</strong></p>}
 <p className="checklist-progress" role="status">{checked.length} / {PREPAREDNESS_ITEMS.length} {es?'revisados':'reviewed'}</p><div className="preparedness-list">{PREPAREDNESS_ITEMS.map(item=><label key={item.id}><input type="checkbox" checked={checked.includes(item.id)} onChange={()=>toggle(item.id)}/><span>{item[es?'es':'en']}</span></label>)}</div>
 <p>{es?'Las casillas se guardan en este navegador, no en una cuenta. Esta lista no determina si una propiedad es segura y no sustituye las instrucciones locales.':'Checkmarks stay in this browser. This list does not determine whether a property is safe and does not replace local instructions.'}</p>{saveError&&<p role="status">{es?'No se pudo guardar en este navegador. Puede imprimir la lista.':'This browser could not save your checkmarks. You can still print the list.'}</p>}
 <div className="uncertainty-note"><h2>{es?'Durante una emergencia':'During an emergency'}</h2><p>{es?'Siga las instrucciones de las autoridades locales. No camine ni conduzca por agua de inundación.':'Follow local authorities’ instructions. Do not walk or drive through floodwater.'}</p></div>
 <div className="awareness-links"><a href={PREPAREDNESS_SOURCES.en} target="_blank" rel="noreferrer">NWS · {es?'Antes de una inundación (inglés)':'Before a flood'} ↗</a><a href={PREPAREDNESS_SOURCES.cdc} target="_blank" rel="noreferrer">CDC · {es?'Preparación para inundaciones':'Flood preparedness'} ↗</a><a href={PREPAREDNESS_SOURCES.es} target="_blank" rel="noreferrer">NWS · Recursos en español ↗</a></div>
 </section>;
}
