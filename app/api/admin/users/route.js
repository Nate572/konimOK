import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../lib/server-admin';
export const runtime='nodejs';
export async function POST(request){
  let services;
  try{services=await requireAdmin(request)}catch(e){return NextResponse.json({error:e.message==='Forbidden'?'אין הרשאת מנהל':'ניהול חשבונות אינו זמין או ההתחברות פגה'},{status:403})}
  let body;try{body=await request.json()}catch{return NextResponse.json({error:'JSON לא תקין'},{status:400})}
  const email=String(body.email||'').trim().toLowerCase(), password=String(body.password||''), label=String(body.label||'').trim().slice(0,70);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||password.length>128||!label)return NextResponse.json({error:'נדרש שם בית, אימייל וסיסמה של 12 תווים לפחות'},{status:400});
  try{
    const user=await services.adminAuth.createUser({email,password,displayName:label,emailVerified:false,disabled:false});
    await services.adminDb.doc(`households/${user.uid}`).set({label,createdAt:new Date(),createdBy:services.decoded.uid});
    return NextResponse.json({ok:true,email,uid:user.uid});
  }catch(e){return NextResponse.json({error:e.code==='auth/email-already-exists'?'האימייל כבר קיים':'יצירת החשבון נכשלה'},{status:400})}
}
