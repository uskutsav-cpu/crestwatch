"use client";

import { useEffect, useId, useRef, useState } from "react";

/** A gauge-scale illustration, never terrain or a property inundation model. */
export function ReplayWaterScene({ level, low, high, peak, floodStage, playing }: {
  level: number; low: number; high: number; peak: number;
  floodStage: number | null; playing: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const narrow = width < 600;
  const height = narrow ? 260 : 350;
  const bottom = height - 50, top = 54;
  const gaugeX = width - 92;
  const lineEnd = gaugeX - 24;
  const span = Math.max(1, high - low);
  const y = (value: number) => bottom - (value - low) / span * (bottom - top);
  const waterY = y(level);
  return <div ref={root} className={`replay-water ${playing ? "is-playing" : ""}`}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Illustrated river gauge. Selected daily mean ${level.toFixed(2)} feet. Highest daily mean ${peak.toFixed(2)} feet.${floodStage !== null ? ` Flood stage ${floodStage} feet.` : ""}`}>
      <defs>
        <linearGradient id={`water-${id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#75b9b0" stopOpacity=".75"/><stop offset="1" stopColor="#36776f" stopOpacity=".85"/></linearGradient>
        <pattern id={`ripples-${id}`} width="180" height="45" patternUnits="userSpaceOnUse"><path d="M0 20h35m38 17h50m25-28h32" stroke="#c0e2cd" strokeWidth="1" opacity=".3"/></pattern>
        <clipPath id={`scene-${id}`}><rect width={width} height={height} rx="3"/></clipPath>
      </defs>
      <g clipPath={`url(#scene-${id})`}>
        <rect width={width} height={height} fill="#193e35"/>
        <g stroke="#b3c6ad" strokeWidth="1" opacity=".13"><path d="M0 91C170 55 225 107 420 74S760 41 1000 82M0 112C170 76 225 128 420 95S760 62 1000 103M0 133C170 97 225 149 420 116S760 83 1000 124"/></g>
        <text x="22" y="26" fill="#c2d0b7" fontSize="9" letterSpacing="1.5">THE RIVER AT THE GAUGE</text>
        {!narrow && <text x={width-25} y="26" textAnchor="end" fill="#c2d0b7" fontSize="9" letterSpacing="1">ILLUSTRATION · NOT A FLOOD MAP</text>}
        <path d="M0 284Q180 263 360 293T740 305T1000 292V350H0Z" fill="#102f2a"/>
        <g className="replay-water-level" style={{transform:`translateY(${waterY}px)`}}>
          <rect x="0" y="0" width={width} height={height} fill={`url(#water-${id})`}/>
          <rect className="replay-ripples" x="-180" y="10" width={width+360} height={height} fill={`url(#ripples-${id})`}/>
          <path className="replay-wave" d="M-100 0Q-50-5 0 0T100 0T200 0T300 0T400 0T500 0T600 0T700 0T800 0T900 0T1000 0T1100 0" fill="none" stroke="#b7ddd1" strokeWidth="2"/>
        </g>
        <line x1="22" x2={lineEnd} y1={y(peak)} y2={y(peak)} stroke="#c7d5b7" strokeDasharray="3 6" opacity=".7"/>
        <text x="22" y={y(peak)-10} fill="#e0e6cf" fontSize="11">Record high · {peak.toFixed(2)} ft</text>
        {floodStage !== null && <g><line x1="22" x2={lineEnd} y1={y(floodStage)} y2={y(floodStage)} stroke="#e9b57d" strokeDasharray="8 6"/><text x="22" y={y(floodStage)+18} fill="#f6c997" fontSize="11">Flood stage · {floodStage} ft</text></g>}
        <rect x={gaugeX} y={top} width="62" height={bottom-top} rx="3" fill="#f0edda"/>
        {Array.from({length:Math.round(span)+1},(_,i)=>{const value=low+i;return <g key={i}><line x1={gaugeX} x2={gaugeX+(value%5===0?23:12)} y1={y(value)} y2={y(value)} stroke="#234a3c"/>{value%5===0&&<text x={gaugeX+31} y={y(value)+4} fontSize="11" fill="#234a3c">{value.toFixed(0)}</text>}</g>;})}
        <g className="replay-gauge-pointer" style={{transform:`translateY(${waterY}px)`}}><path d={`M${gaugeX-10} 0l-10-6v12Z`} fill="#fff8df"/><line x1={lineEnd-45} x2={gaugeX-22} y1="0" y2="0" stroke="#fff8df" strokeWidth="1.5"/><circle cx={lineEnd-45} cy="0" r="4" fill="#fff8df"/></g>
        <text x={width-22} y={height-18} textAnchor="end" fill="#d2e1cb" fontSize="9" letterSpacing=".7">{narrow ? "GAUGE SCALE · NOT A FLOOD MAP" : "FEET · GAUGE SCALE"}</text>
      </g>
    </svg>
  </div>;
}
