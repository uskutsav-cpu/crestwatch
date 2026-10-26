"use client";
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Map as LeafletMap, Marker } from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import { STATIONS } from '@/lib/river-stations';
import { loadPins } from '@/lib/pin-store';
import type { Pin } from '@/lib/pins';
import { OFFICIAL_MAP_SOURCE, SCENARIO_MAP_SOURCE, PROTOTYPE_MAP_LINKS } from '@/lib/flood-awareness';
export function HistoricalMap(){
 const search=useSearchParams();const initial=search.get('station');
 const [lid,setLid]=useState(STATIONS.some(s=>s.lid===initial)?initial!:'JACM6');
 const [pins,setPins]=useState<Pin[]>([]),[pinId,setPinId]=useState(''),[status,setStatus]=useState('Loading documented extent…'),[tilesFailed,setTilesFailed]=useState(false),[retry,setRetry]=useState(0);
 const root=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null),marker=useRef<Marker|null>(null);
 useEffect(()=>setPins(loadPins()),[]);
 useEffect(()=>{if(lid!=='JACM6')return;let dead=false;let observer:ResizeObserver;setStatus('Loading documented extent…');
 Promise.all([import('leaflet'),fetch('/maps/pearl-2020.geojson').then(r=>{if(!r.ok)throw Error();return r.json() as Promise<GeoJsonObject>;})]).then(([L,geo])=>{
  if(dead||!root.current)return;const m=L.map(root.current,{scrollWheelZoom:false}).setView([32.3,-90.16],12);map.current=m;
  const tile=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · flood extent: USGS',maxZoom:18}).addTo(m);
  let failures=0;tile.on('tileerror',()=>{if(++failures>3)setTilesFailed(true);});tile.on('tileload',()=>setTilesFailed(false));
  const layer=L.geoJSON(geo,{style:{color:'#155e75',weight:1.5,fillColor:'#157ea0',fillOpacity:.4}}).addTo(m);m.fitBounds(layer.getBounds(),{padding:[20,20]});
  L.marker([32.28138,-90.17888],{title:'Pearl River at Jackson · USGS 02486000',alt:'Pearl River at Jackson gauge',icon:L.divIcon({className:'station-marker selected',html:'<span>04</span>',iconSize:[32,32],iconAnchor:[16,16]})}).addTo(m).bindTooltip('USGS 02486000 · Pearl River at Jackson');
  observer=new ResizeObserver(()=>m.invalidateSize());observer.observe(root.current);setStatus('Showing the documented February 17, 2020 flood extent.');
 }).catch(()=>{if(!dead)setStatus('The extent could not load. Use the official USGS source below or try again.');});
 return()=>{dead=true;observer?.disconnect();map.current?.remove();map.current=null;marker.current=null;};
 },[lid,retry]);
 useEffect(()=>{const pin=pins.find(p=>p.id===pinId);if(!pin||!map.current)return;let dead=false;import('leaflet').then(L=>{if(dead||!map.current)return;marker.current?.remove();marker.current=L.marker([pin.lat,pin.lon],{title:pin.name,icon:L.divIcon({className:'place-map-marker',html:'<span></span>',iconSize:[24,24],iconAnchor:[12,12]})}).addTo(map.current).bindTooltip(pin.name);map.current.setView([pin.lat,pin.lon],13);});return()=>{dead=true;};},[pinId,pins,status]);
 return <div className="awareness-page"><div className="page-title"><span className="eyebrow">Authoritative map coverage</span><h1>See the documented flood extent</h1><p>Explore the February 2020 Pearl River flood boundary published by USGS, with road and landmark context from OpenStreetMap.</p></div>
 <label className="awareness-field">Gauge area<select value={lid} onChange={e=>{setLid(e.target.value);setPinId('');}}>{STATIONS.map(s=><option key={s.lid} value={s.lid}>{s.name} · {s.city}</option>)}</select></label>
 {lid==='JACM6'?<><div className="map-event-label"><strong>Historical event · February 17, 2020</strong><span>Recorded instantaneous crest: 36.67 ft at the Jackson gauge. This is one event, not an adjustable forecast scenario.</span></div>
 {pins.length>0&&<label className="awareness-field">Locate a saved place on the map<select value={pinId} onChange={e=>setPinId(e.target.value)}><option value="">Select a place</option>{pins.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
 <div ref={root} className="historical-map" role="region" aria-label="Jackson 2020 historical flood extent map"/><p className="map-status" role="status">{status} {tilesFailed&&'Street-map tiles are unavailable; the flood polygon remains separate.'}</p><button className="text-button" onClick={()=>setRetry(v=>v+1)}>Reload map</button><p className="historical-map-key"><i/>USGS documented 2020 flood extent · A marker locates a place; it does not determine its flood exposure.</p>
 <p>USGS developed this boundary from surveyed high-water marks along the Pearl River reach from the Ross Barnett Reservoir dam toward Byram. Unshaded areas are not an all-clear: this is the documented extent of one event.</p>
 <div className="awareness-links"><a href={OFFICIAL_MAP_SOURCE} target="_blank" rel="noreferrer">USGS study & limitations ↗</a><a href="/maps/pearl-2020.geojson" download>Download the original-vertex GeoJSON</a><a href={SCENARIO_MAP_SOURCE} target="_blank" rel="noreferrer">NWS map collection & scenario viewers ↗</a></div>
 </>:<div className="coverage-empty"><h2>No verified layer included for this gauge</h2><p>CrestWatch has not integrated a validated inundation map library for {STATIONS.find(s=>s.lid===lid)?.city}. A river-stage slider cannot create that coverage.</p><a className="secondary-button" href="https://apps.usgs.gov/fim/" target="_blank" rel="noreferrer">Check the USGS Flood Inundation Mapper ↗</a><a className="text-button" href={`/?station=${lid}#impact-explorer`}>Read official gauge impact notes</a>{PROTOTYPE_MAP_LINKS[lid]&&<><p>NWS Jackson links to a separate prototype stage-scenario viewer for this gauge. Its approximate extents are informational, not supported for 24/7 operations or life-critical decisions.</p><a className="text-button" href={PROTOTYPE_MAP_LINKS[lid]} target="_blank" rel="noreferrer">Open the NWS prototype stage viewer ↗</a></>}</div>}
 </div>;
}
