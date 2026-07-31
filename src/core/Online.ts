import{createClient,User}from'@supabase/supabase-js';
const URL='https://tiimhzjfamuthghhuwtx.supabase.co';
const KEY='sb_publishable_G3FYE0IeYd3GdS7fvBKMgQ_QmZ5XJtj';
const db=createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
export type Leader={display_name:string;best_score:number;updated_at:string};
export const Online={user:null as User|null,
 async boot(){const{data}=await db.auth.getSession();this.user=data.session?.user??null;db.auth.onAuthStateChange((_e,s)=>this.user=s?.user??null);return this.user},
 async signUp(email:string,password:string,name:string){const{data,error}=await db.auth.signUp({email,password,options:{data:{display_name:name.trim().slice(0,18)}}});if(error)throw error;this.user=data.session?.user??null;return{needsConfirmation:!data.session,user:data.user}},
 async signIn(email:string,password:string){const{data,error}=await db.auth.signInWithPassword({email,password});if(error)throw error;this.user=data.user;return data},
 async signOut(){const{error}=await db.auth.signOut();if(error)throw error;this.user=null},
 name(){return String(this.user?.user_metadata?.display_name||this.user?.email?.split('@')[0]||'PLAYER').slice(0,18)},
 async submit(score:number){if(!this.user)return false;const{data:old,error:readError}=await db.from('leaderboard').select('best_score').eq('user_id',this.user.id).maybeSingle();if(readError)throw readError;if((old?.best_score??-1)>=score)return false;const row={user_id:this.user.id,display_name:this.name(),best_score:score,updated_at:new Date().toISOString()};const{error}=await db.from('leaderboard').upsert(row,{onConflict:'user_id'});if(error)throw error;return true},
 async top(limit=20){const{data,error}=await db.from('leaderboard').select('display_name,best_score,updated_at').order('best_score',{ascending:false}).order('updated_at',{ascending:true}).limit(limit);if(error)throw error;return(data??[])as Leader[]},
 async rank(){if(!this.user)return null;const{data:mine,error}=await db.from('leaderboard').select('best_score').eq('user_id',this.user.id).maybeSingle();if(error)throw error;if(!mine)return null;const{count,error:rankError}=await db.from('leaderboard').select('*',{count:'exact',head:true}).gt('best_score',mine.best_score);if(rankError)throw rankError;return{rank:(count??0)+1,score:mine.best_score}}
};
