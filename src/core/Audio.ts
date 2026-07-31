import { Core } from './Core';
export const Audio={
 ctx:null as AudioContext|null,
 tone(freq=440,duration=.06,type:OscillatorType='sine'){
  if(!Core.data.sound)return;try{this.ctx??=new AudioContext();const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=freq;g.gain.value=.035;o.connect(g);g.connect(this.ctx.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,this.ctx.currentTime+duration);o.stop(this.ctx.currentTime+duration);}catch{}
 },
 move(){this.tone(260,.025);},catch(){this.tone(620,.05);},gold(){this.tone(880,.08);setTimeout(()=>this.tone(1180,.1),70);},miss(){this.tone(120,.12,'sawtooth');},level(){this.tone(520,.06);setTimeout(()=>this.tone(780,.08),65);}
};