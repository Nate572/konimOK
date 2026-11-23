import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../lib/server-admin';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req){
  let services;
  try{services=await requireAdmin(req)}catch{return NextResponse.json({error:'Forbidden'},{status:403})}
  try{
    const snapshot=await services.adminDb.collection('activity_logs').orderBy('createdAt','desc').limit(100).get();
    const events=snapshot.docs.map(d=>{
      const r=d.data();
      return {id:d.id,uid:r.uid,email:r.email||null,type:r.type,status:r.status,count:r.count??null,createdAt:r.createdAt?.toDate?.()?.toISOString?.()||null};
    });
    return NextResponse.json({events},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return NextResponse.json({error:'Unable to load activity'},{status:503})}
}
