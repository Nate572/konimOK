import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
// Reverse geocoding runs only after the user requests location; no search autocomplete or bulk requests.
export async function GET(request){
 const url=new URL(request.url);const lat=Number(url.searchParams.get('lat'));const lon=Number(url.searchParams.get('lon'));
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return NextResponse.json({error:'מיקום לא תקין'},{status:400});
 const target=new URL('https://nominatim.openstreetmap.org/reverse');
 target.searchParams.set('lat',lat.toFixed(4));target.searchParams.set('lon',lon.toFixed(4));target.searchParams.set('format','jsonv2');target.searchParams.set('addressdetails','1');target.searchParams.set('accept-language','he,en');target.searchParams.set('zoom','10');
 try{const response=await fetch(target,{headers:{'User-Agent':'KonimOK-shopping-site/1.1 (https://github.com/Nate572/konimOK)','Accept-Language':'he,en'},next:{revalidate:86400},signal:AbortSignal.timeout(9000)});
 if(!response.ok)return NextResponse.json({error:'שירות זיהוי העיר אינו זמין כרגע'},{status:502});
 const data=await response.json();const a=data.address||{};const city=a.city||a.town||a.village||a.municipality||a.locality||a.city_district;
 if(!city)return NextResponse.json({error:'לא נמצאה עיר בנקודה שזוהתה'},{status:404});
 return NextResponse.json({city:String(city).slice(0,90),source:'OpenStreetMap contributors'},{headers:{'Cache-Control':'public, s-maxage=86400'}});
 }catch{return NextResponse.json({error:'לא ניתן לזהות עיר כרגע'},{status:504})}
}
