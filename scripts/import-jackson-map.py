import zipfile,struct,json,hashlib,sys
from pathlib import Path
if len(sys.argv)!=2: raise SystemExit('Usage: python3 scripts/import-jackson-map.py /path/to/2020_Pearl_Flood_GIS2.zip')
with zipfile.ZipFile(sys.argv[1]) as z: data=z.read('2020_Pearl_Inundation.shp')
assert struct.unpack('>i',data[:4])[0]==9994
at=100; polygons=[]
def area(r): return sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(r,r[1:]))/2
def inside(p,r):
 x,y=p;c=False
 for a,b in zip(r,r[1:]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:c=not c
 return c
while at<len(data):
 num,length=struct.unpack('>2i',data[at:at+8]); body=data[at+8:at+8+length*2];at+=8+length*2
 shape=struct.unpack('<i',body[:4])[0]
 if shape==0:continue
 assert shape==5
 count,n=struct.unpack('<2i',body[36:44]); starts=list(struct.unpack('<'+'i'*count,body[44:44+count*4]))+[n]
 pts=[list(struct.unpack('<2d',body[44+count*4+i*16:44+count*4+(i+1)*16])) for i in range(n)]
 rings=[pts[starts[i]:starts[i+1]] for i in range(count)]
 outer=[[r] for r in rings if area(r)<0];holes=[r for r in rings if area(r)>=0]
 for h in holes:
  hosts=[p for p in outer if inside(h[0],p[0])]
  assert hosts,'Unassigned hole'
  min(hosts,key=lambda p:abs(area(p[0]))).append(h)
 polygons+=outer
coords=[p for poly in polygons for ring in poly for p in ring]
assert all(-90.5<x<-89.8 and 32<y<32.6 for x,y in coords)
out={'type':'FeatureCollection','features':[{'type':'Feature','properties':{'source':'USGS 10.5066/P90YKHP3','event':'2020-02-17','kind':'Documented historical flood extent; not a forecast'},'geometry':{'type':'MultiPolygon','coordinates':polygons}}]}
root=Path('public/maps');root.mkdir(exist_ok=True)
(root/'pearl-2020.geojson').write_text(json.dumps(out,separators=(',',':')))
(root/'PROVENANCE.md').write_text('''# Jackson 2020 documented flood extent

Source: USGS data release 10.5066/P90YKHP3, item 5eb05ccd82cefae35a27a5ab, 2020_Pearl_Flood_GIS2.zip / 2020_Pearl_Inundation.shp. CC0 public-domain release.

https://doi.org/10.5066/P90YKHP3

The original WGS84 polygon vertices are converted directly from the shapefile into GeoJSON. No boundary simplification, reprojection, terrain modeling, or inferred flooding was applied. ESRI outer rings and holes are grouped as a GeoJSON MultiPolygon. This records the February 2020 event along the studied Pearl River reach; it is neither a forecast nor a complete flood-risk map.

Source shapefile SHA-256: `'''+hashlib.sha256(data).hexdigest()+'`\n')
print('Converted',len(polygons),'polygons;',len(coords),'vertices; bbox', [min(p[0] for p in coords),min(p[1] for p in coords),max(p[0] for p in coords),max(p[1] for p in coords)])
