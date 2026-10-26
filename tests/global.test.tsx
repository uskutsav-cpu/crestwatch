import {describe,it,expect,vi} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('next/navigation',()=>({usePathname:()=>'/'}));
import {AppShell} from '@/components/experience/AppShell';
describe('Accessible application navigation',()=>{
 const html=renderToStaticMarkup(React.createElement(AppShell,{children:React.createElement('h1',null,'River overview')}));
 it('provides a skip link to a single main region',()=>{expect(html).toContain('href="#main"');expect((html.match(/<main/g)||[])).toHaveLength(1);expect(html).toContain('id="main"')});
 it('exposes all primary destinations and the current page',()=>{for(const href of ['/places','/replay','/methodology','/about'])expect(html).toContain(`href="${href}"`);expect(html).toContain('aria-current="page"')});
 it('keeps official forecasts and source details reachable',()=>{expect(html).toContain('https://water.noaa.gov');expect(html).toContain('Sources &amp; limitations')});
});
