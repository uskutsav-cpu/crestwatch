import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('ships a closed, finite WGS84 historical boundary with its original event attribution',()=>{
 const d=JSON.parse(readFileSync('public/maps/pearl-2020.geojson','utf8'));
 expect(d.features).toHaveLength(1);expect(d.features[0].properties.event).toBe('2020-02-17');
 const polygons=d.features[0].geometry.coordinates;expect(polygons.length).toBe(649);let count=0;
 for(const polygon of polygons)for(const ring of polygon){expect(ring.length).toBeGreaterThanOrEqual(4);expect(ring[0]).toEqual(ring.at(-1));for(const [lon,lat] of ring){expect(Number.isFinite(lon)&&Number.isFinite(lat)).toBe(true);expect(lon).toBeGreaterThan(-90.5);expect(lon).toBeLessThan(-89.8);expect(lat).toBeGreaterThan(32);expect(lat).toBeLessThan(32.6);count++;}}
 expect(count).toBe(39381);
});
