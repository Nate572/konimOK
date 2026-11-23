import {NextResponse} from 'next/server';
export const runtime='nodejs';
export async function POST(req){
 const body=await req.json().catch(()=>null);const address=String(body?.address||'').trim();
 if(address.length<6||address.length>220)return NextResponse.json({error:'יש להזין כתובת רחוב מלאה בישראל'},{status:400});
 const key=process.env.ORS_API_KEY;
 if(!key)return NextResponse.json({error:'איתור כתובת ידנית דורש ORS_API_KEY ב־Vercel. אפשר להשתמש ב־GPS או לכבות חישוב נסיעה.'},{status:503});
 const u=new URL('https://api.openrouteservice.org/geocode/search');u.searchParams.set('api_key',key);u.searchParams.set('text',address.includes('ישראל')?address:address+', ישראל');u.searchParams.set('size','1');u.searchParams.set('boundary.country','ISR');
 try{const r=await fetch(u,{signal:AbortSignal.timeout(10000),cache:'no-store'});if(!r.ok)throw Error('לא ניתן לאתר את הכתובת');const data=await r.json();const feature=data.features?.[0];const c=feature?.geometry?.coordinates;const p=feature?.properties||{};
 if(!Array.isArray(c)||!Number.isFinite(c[0])||!Number.isFinite(c[1]))return NextResponse.json({error:'לא נמצאה כתובת מתאימה. נסה רחוב, מספר ועיר.'},{status:404});
 const city=p.locality||p.localadmin||p.county||p.region||'';
 if(!city)return NextResponse.json({error:'הכתובת נמצאה ללא עיר מזוהה. נסה להקליד רחוב, מספר ועיר.'},{status:422});
 return NextResponse.json({point:{lon:c[0],lat:c[1]},city,address:p.label||address},{headers:{'Cache-Control':'no-store'}})
 }catch{return NextResponse.json({error:'לא ניתן לאמת את הכתובת כרגע'},{status:502})}
}
