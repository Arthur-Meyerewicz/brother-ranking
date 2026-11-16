import { createClient } from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const configured=Boolean(url&&key);
export const supabase=createClient(url||'https://placeholder.supabase.co',key||'placeholder');
export type Player={id:string,name:string,group_id:string,active:boolean};
export type Group={id:string,name:string,win_points:number,goal_points:number,assist_points:number};
export type Entry={id:string,player_id:string,wins:number,goals:number,assists:number,created_at:string,note:string|null,created_by:string|null};
