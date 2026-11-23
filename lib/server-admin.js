import {getApps, initializeApp, cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

export function serverServices(){
  const {FIREBASE_PROJECT_ID,FIREBASE_CLIENT_EMAIL,FIREBASE_PRIVATE_KEY}=process.env;
  if(!FIREBASE_PROJECT_ID||!FIREBASE_CLIENT_EMAIL||!FIREBASE_PRIVATE_KEY)throw Error('Admin SDK not configured');
  const app=getApps()[0]||initializeApp({credential:cert({projectId:FIREBASE_PROJECT_ID,clientEmail:FIREBASE_CLIENT_EMAIL,privateKey:FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')})});
  return {adminAuth:getAuth(app),adminDb:getFirestore(app)};
}
export async function requireAdmin(request){
  const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token)throw Error('Unauthorized');
  const {adminAuth,adminDb}=serverServices();
  const decoded=await adminAuth.verifyIdToken(token,true);
  const adminEmail=(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
  if(!decoded.email_verified && !decoded.email)throw Error('Unauthorized');
  if(!adminEmail || decoded.email?.toLowerCase()!==adminEmail)throw Error('Forbidden');
  return {adminAuth,adminDb,decoded};
}
