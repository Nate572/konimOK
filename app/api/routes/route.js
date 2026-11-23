import {NextResponse} from 'next/server';
export const runtime='nodejs';
const isPoint=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lon))<=180;
async function jsonFrom(url,opts){const c=new AbortController();const t=setTimeout(()=>c.abort(),9000);try{const r=await fetch(url,{...opts,signal:c.signal});if(!r.ok)throw Error('Routing provider error');return await r.json()}finally{clearTimeout(t)}}
export async function POST(request){
  if(!process.env.ORS_API_KEY)return NextResponse.json({error:'לא הוגדר מפתח openrouteservice'},{status:503});
  let body;try{body=await request.json()}catch{return NextResponse.json({error:'JSON שגוי'},{status:400})}
  const start=body.start, stores=body.stores;
  if(!isPoint(start)||!Array.isArray(stores)||stores.length>8)return NextResponse.json({error:'מיקום או סניפים לא תקינים'},{status:400});
  const key=process.env.ORS_API_KEY;
  const rows=await Promise.all(stores.map(async (store)=>{
    const id=String(store.id||'').slice(0,100), address=String(store.address||'').slice(0,200);
    try{
      let point=isPoint(store.point)?store.point:null;
      if(!point && address){
        const uri=new URL('https://api.openrouteservice.org/geocode/search');uri.searchParams.set('api_key',key);uri.searchParams.set('text',address+', ישראל');uri.searchParams.set('size','1');uri.searchParams.set('boundary.country','ISR');
        const geocode=await jsonFrom(uri);const coordinates=geocode.features?.[0]?.geometry?.coordinates;
        if(Array.isArray(coordinates)&&coordinates.length===2)point={lon:coordinates[0],lat:coordinates[1]};
      }
      if(!isPoint(point))return {id,error:'לא נמצאו קואורדינטות אמינות לסניף'};
      const route=await jsonFrom('https://api.openrouteservice.org/v2/directions/driving-car',{method:'POST',headers:{Authorization:key,'Content-Type':'application/json'},body:JSON.stringify({coordinates:[[Number(start.lon),Number(start.lat)],[Number(point.lon),Number(point.lat)]]})});
      const summary=route.routes?.[0]?.summary;
      if(!summary||!Number.isFinite(summary.distance))throw Error('No route');
      return {id,kmOneWay:summary.distance/1000,minutesOneWay:summary.duration/60};
    }catch{return {id,error:'לא ניתן לחשב מסלול לסניף זה'}}
  }));
  return NextResponse.json({results:rows},{headers:{'Cache-Control':'no-store'}});
}
