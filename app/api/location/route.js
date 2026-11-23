import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(request){
 const u=new URL(request.url);const lat=Number(u.searchParams.get('lat'));const lon=Number(u.searchParams.get('lon'));
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return NextResponse.json({error:'מיקום לא תקין'},{status:400});
 const target=new URL('https://nominatim.openstreetmap.org/reverse');
 target.searchParams.set('lat',lat.toFixed(6));target.searchParams.set('lon',lon.toFixed(6));target.searchParams.set('format','jsonv2');target.searchParams.set('addressdetails','1');target.searchParams.set('accept-language','he,en');target.searchParams.set('zoom','18');
 try{const response=await fetch(target,{headers:{'User-Agent':'KonimOK/1.4 (https://github.com/Nate572/konimOK)','Accept-Language':'he,en'},signal:AbortSignal.timeout(10000),cache:'no-store'});
 if(!response.ok)return NextResponse.json({error:'שירות הכתובות אינו זמין'},{status:502});
 const data=await response.json();const a=data.address||{};const city=a.city||a.town||a.village||a.municipality||a.locality||a.city_district||'';
 const address=[a.road||a.pedestrian||a.residential,a.house_number,city].filter(Boolean).join(' ').trim()||data.display_name||'';
 return NextResponse.json({city:String(city).slice(0,90),address:String(address).slice(0,240)},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'שירות איתור הכתובת לא הגיב'},{status:504})}
}
