import { useMemo } from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/context/ThemeContext';
import { KAABA } from '@/lib/prayer';

/**
 * QiblaNativeSat (pass 39) — the SATELLITE qibla map on native, inside a
 * WebView. No Leaflet CDN: a tiny self-contained tile-mosaic renderer.
 * First visit: satellite tiles are downloaded and SAVED to the webview's
 * localStorage; every visit after that the saved map paints with zero
 * network. The old offline world-map is retired.
 */

const html = (lat: number, lon: number, klat: number, klon: number, name: string, km: number) => `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  html,body{margin:0;padding:0;height:100%;background:#0A100D;overflow:hidden;font-family:sans-serif}
  #map{position:relative;width:100%;height:100%;overflow:hidden}
  #tiles,#line{position:absolute;top:0;left:0;width:100%;height:100%}
  img.tile{position:absolute;width:256px;height:256px}
  .chip{position:absolute;top:8px;left:8px;background:rgba(3,10,6,0.62);border:1px solid rgba(212,175,55,0.4);border-radius:999px;padding:3px 8px;color:#E8C96A;font-size:10px;font-weight:700;letter-spacing:.4px}
  .pin{position:absolute;transform:translate(-50%,-50%);text-align:center;color:#fff;font-size:10px;font-weight:700;text-shadow:0 1px 3px #000}
  .dot{width:14px;height:14px;border-radius:50%;background:#4AE38F;border:2.5px solid #fff;margin:0 auto 2px}
  .kaaba{width:28px;height:28px;border-radius:50%;background:#000;border:2.5px solid #D4AF37;line-height:26px;font-size:15px;margin:0 auto 2px}
</style></head><body><div id="map"><div id="tiles"></div>
<svg id="line" xmlns="http://www.w3.org/2000/svg"></svg>
<div class="chip" id="chip">SATELLITE · SAVING…</div>
</div><script>
var lat=${lat},lon=${lon},klat=${klat},klon=${klon},km=${Math.round(km)},name=${JSON.stringify(name || 'You')};
var W=innerWidth,H=innerHeight;
function proj(la,lo,z){var n=256*Math.pow(2,z);var x=(lo+180)/360*n;var s=Math.sin(la*Math.PI/180);var y=(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n;return[x,y];}
/* fit zoom for both points */
var z=1;for(var t=12;t>=1;t--){var a=proj(lat,lon,t),b=proj(klat,klon,t);if(Math.abs(a[0]-b[0])<W-40&&Math.abs(a[1]-b[1])<H-40){z=t;break;}}
var A=proj(lat,lon,z),B=proj(klat,klon,z);
var cx=(A[0]+B[0])/2,cy=(A[1]+B[1])/2;
var ox=cx-W/2,oy=cy-H/2;
var tiles=document.getElementById('tiles');
var max=Math.pow(2,z);var cached=0,fetched=0,used=0;
function key(x,y){return 'dl.tile.'+z+'.'+x+'.'+y;}
function paint(){
  var x0=Math.floor(ox/256),x1=Math.floor((ox+W)/256),y0=Math.floor(oy/256),y1=Math.floor((oy+H)/256);
  for(var ty=y0;ty<=y1;ty++){for(var tx=x0;tx<=x1;tx++){
    if(ty<0||ty>=max)continue;
    var txx=((tx%max)+max)%max;
    var img=document.createElement('img');img.className='tile';
    img.style.left=(tx*256-ox)+'px';img.style.top=(ty*256-oy)+'px';
    tiles.appendChild(img);used++;
    (function(img,txx,ty){
      var k=key(txx,ty);var c=null;try{c=localStorage.getItem(k);}catch(e){}
      if(c){img.src=c;cached++;chip();return;}
      var url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/'+z+'/'+ty+'/'+txx;
      fetch(url,{mode:'cors'}).then(function(r){return r.blob();}).then(function(b){
        var fr=new FileReader();fr.onload=function(){try{localStorage.setItem(k,fr.result);}catch(e){}img.src=fr.result;fetched++;chip();};fr.readAsDataURL(b);
      }).catch(function(){});
    })(img,txx,ty);
  }}
}
function chip(){var e=document.getElementById('chip');
  if(cached>0&&(cached>=used-fetched))e.textContent='SAVED MAP · SATELLITE';
  else if(fetched>0)e.textContent='SATELLITE · SAVING…';}
/* great circle */
var pts=[];var toR=Math.PI/180,l1=lat*toR,g1=lon*toR,l2=klat*toR,g2=klon*toR;
var d=2*Math.asin(Math.sqrt(Math.pow(Math.sin((l2-l1)/2),2)+Math.cos(l1)*Math.cos(l2)*Math.pow(Math.sin((g2-g1)/2),2)));
for(var i=0;i<=64;i++){var f=i/64;if(d===0){pts.push([lat,lon]);continue;}
  var Aa=Math.sin((1-f)*d)/Math.sin(d),Bb=Math.sin(f*d)/Math.sin(d);
  var x=Aa*Math.cos(l1)*Math.cos(g1)+Bb*Math.cos(l2)*Math.cos(g2);
  var y=Aa*Math.cos(l1)*Math.sin(g1)+Bb*Math.cos(l2)*Math.sin(g2);
  var zz=Aa*Math.sin(l1)+Bb*Math.sin(l2);
  pts.push([Math.atan2(zz,Math.sqrt(x*x+y*y))/toR,Math.atan2(y,x)/toR]);}
paint();
var svg=document.getElementById('line');svg.setAttribute('viewBox','0 0 '+W+' '+H);
var pl=pts.map(function(p){var q=proj(p[0],p[1],z);return (q[0]-ox)+','+(q[1]-oy);}).join(' ');
svg.innerHTML='<polyline points="'+pl+'" fill="none" stroke="#D4AF37" stroke-width="3" stroke-dasharray="8 6"/>'+
  '<text x="'+(B[0]-ox+10)+'" y="'+(B[1]-oy-6)+'" fill="#E8C96A" font-size="10" font-weight="700">'+km+' km to Makkah</text>';
function pin(el,px,py){el.style.left=px+'px';el.style.top=py+'px';}
var you=document.createElement('div');you.className='pin';you.innerHTML='<div class="dot"></div>'+name.replace(/</g,'');
var kb=document.createElement('div');kb.className='pin';kb.innerHTML='<div class="kaaba">🕋</div>Kaaba';
document.getElementById('map').appendChild(you);document.getElementById('map').appendChild(kb);
pin(you,A[0]-ox,A[1]-oy);pin(kb,B[0]-ox,B[1]-oy);
</script></body></html>`;

export function QiblaNativeSat({ userLoc, userName, distanceKm, height = 250 }: { userLoc: { lat: number; lon: number }; userName: string; distanceKm: number; height?: number }) {
  const { isDark } = useTheme();
  const src = useMemo(
    () => html(userLoc.lat, userLoc.lon, KAABA.latitude, KAABA.longitude, userName, distanceKm),
    [userLoc.lat, userLoc.lon, userName, distanceKm],
  );
  if (Platform.OS === 'web') return <View style={{ height }} />;
  return (
    <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? 'rgba(242,247,243,0.14)' : 'rgba(20,36,28,0.12)', height, backgroundColor: '#0A100D' }}>
      <WebView source={{ html: src }} originWhitelist={['*']} style={{ flex: 1, backgroundColor: 'transparent' }} />
    </View>
  );
}
