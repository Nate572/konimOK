import {NextResponse} from 'next/server';
import {serverServices} from '../../../lib/server-admin';
import {validateActivity} from '../../../lib/activity';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req){
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token)return NextResponse.json({error:'Unauthorized'},{status:401});
  let services,decoded;
  try{services=serverServices();decoded=await services.adminAuth.verifyIdToken(token,true)}catch{return NextResponse.json({error:'Unauthorized'},{status:401})}
  let data;try{data=validateActivity(await req.json())}catch{}
  if(!data)return NextResponse.json({error:'Invalid activity'},{status:400});
  try{
    await services.adminDb.collection('activity_logs').add({
      ...data,uid:decoded.uid,email:decoded.email||null,
      createdAt:new Date()
    });
    return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Logging unavailable'},{status:503})}
}
