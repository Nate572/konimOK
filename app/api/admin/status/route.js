import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../lib/server-admin';
export const runtime='nodejs';
export async function GET(request){
 try{await requireAdmin(request);return NextResponse.json({isAdmin:true},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({isAdmin:false},{status:403,headers:{'Cache-Control':'no-store'}})}
}
