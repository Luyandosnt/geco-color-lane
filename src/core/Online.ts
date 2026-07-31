import{createClient,User}from'@supabase/supabase-js';
const URL='https://tiimhzjfamuthghhuwtx.supabase.co';
const KEY='sb_publishable_G3FYE0IeYd3GdS7fvBKMgQ_QmZ5XJtj';
const db=createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
export type Leader={display_name:string;best_score:number;updated_at:string};
export const Online={user:null as User|null,
 async boot(){const{data}=await db.auth.getSession();this.user=data.session?.user??null;db.auth.onAuthStateChange((_e,s)=>this.user=s?.user??null);return this.user},
 async signUp(email:string,password:string,name:string){const{data,error}=await db.auth.signUp({email,password,options:{data:{display_name:name}}});if(error)throw error;this.user=data.user;return data},
 async signIn(email:string,password:string){const{data,error}=await db.auth.signInWithPassword({email,password});if(error)throw error;this.user=data.user;return data},
 async signOut(){const{error}=await db.auth.signOut();if(error)throw error;this.user=null},
 name(){return String(this.user?.user_metadata?.display_name||this.user?.email?.split('@')[0]||'PLAYER').slice(0,18)},
 async submit(score:number){if(!this.user)return;const row={user_id:this.user.id,display_name:this.name(),best_score:score,updated_at:new Date().toISOString()};const{data:old}=await db.from('leaderboard').select('best_score').eq('user_id',this.user.id).maybeSingle();if((old?.best_score??-1)>=score)return;const{error}=await db.from('leaderboard').upsert(row,{onConflict:'user_id'});if(error)throw error},
 async top(limit=20){const{data,error}=await db.from('leaderboard').select('display_name,best_score,updated_at').order('best_score',{ascending:false}).limit(limit);if(error)throw error;return(data??[])as Leader[]},
 async rank(){if(!this.user)return null;const{data:mine}=await db.from('leaderboard').select('best_score').eq('user_id',this.user.id).maybeSingle();if(!mine)return null;const{count}=await db.from('leaderboard').select('*',{count:'exact',head:true}).gt('best_score',mine.best_score);return{rank:(count??0)+1,score:mine.best_score}}
};
