export type SkinId='classic'|'sunset'|'neon';
type SaveData={version:number;highScore:number;coins:number;sound:boolean;vibration:boolean;skin:SkinId;unlocked:SkinId[];tutorialSeen:boolean};
export const Core={
 key:'geco.colorlane.save',version:1,
 data:{version:1,highScore:0,coins:0,sound:true,vibration:true,skin:'classic' as SkinId,unlocked:['classic'] as SkinId[],tutorialSeen:false} as SaveData,
 boot(){try{const old=JSON.parse(localStorage.getItem(this.key)||'{}');this.data={...this.data,...old,version:this.version};if(!Array.isArray(this.data.unlocked))this.data.unlocked=['classic'];if(!this.data.unlocked.includes('classic'))this.data.unlocked.unshift('classic');if(!['classic','sunset','neon'].includes(this.data.skin))this.data.skin='classic';this.save()}catch{}},
 save(){localStorage.setItem(this.key,JSON.stringify(this.data));},
 finish(score:number,coins:number){this.data.highScore=Math.max(this.data.highScore,score);this.data.coins+=coins;this.save();if(this.data.vibration&&navigator.vibrate)navigator.vibrate(60);},
 markTutorial(){this.data.tutorialSeen=true;this.save()},resetTutorial(){this.data.tutorialSeen=false;this.save()},
 price(s:SkinId){return s==='sunset'?250:s==='neon'?500:0;},
 buy(s:SkinId){if(this.data.unlocked.includes(s)){this.data.skin=s;this.save();return true;}const p=this.price(s);if(this.data.coins<p)return false;this.data.coins-=p;this.data.unlocked.push(s);this.data.skin=s;this.save();this.event('skin_buy',{skin:s,price:p});return true;},
 toggleSound(){this.data.sound=!this.data.sound;this.save();},toggleVibration(){this.data.vibration=!this.data.vibration;this.save();},
 event(name:string,data:Record<string,unknown>={}){console.info('[GECO Analytics]',name,data);}
};