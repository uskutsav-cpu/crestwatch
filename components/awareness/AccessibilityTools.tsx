"use client";
import { useEffect, useState } from 'react';
export function AccessibilityTools(){const [contrast,setContrast]=useState(false);
 useEffect(()=>{try{const enabled=localStorage.getItem('crestwatch.contrast')==='high';setContrast(enabled);document.documentElement.classList.toggle('high-contrast',enabled);}catch{}},[]);
 function toggle(){const next=!contrast;setContrast(next);document.documentElement.classList.toggle('high-contrast',next);try{localStorage.setItem('crestwatch.contrast',next?'high':'normal');}catch{}}
 return <div className="accessibility-tools" aria-label="Reading options"><a href="/es" lang="es">Español</a><button type="button" aria-pressed={contrast} onClick={toggle}>High contrast {contrast?'on':'off'}</button></div>;
}
