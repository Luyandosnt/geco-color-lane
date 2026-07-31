import Phaser from 'phaser';
import { Core } from '../core/Core';

type Gate=Phaser.GameObjects.Container&{lane?:number};
const COLORS=[0x22c55e,0x3b82f6,0xf43f5e];
const NAMES=['GREEN','BLUE','RED'];
export class ColorLane extends Phaser.Scene{
 lane=1;score=0;runCoins=0;speed=225;playing=false;combo=0;spawnDelay=1150;
 player!:Phaser.GameObjects.Rectangle;gates!:Phaser.GameObjects.Group;scoreText!:Phaser.GameObjects.Text;comboText!:Phaser.GameObjects.Text;
 title!:Phaser.GameObjects.Text;hint!:Phaser.GameObjects.Text;playText!:Phaser.GameObjects.Text;status!:Phaser.GameObjects.Text;
 lanes=[65,195,325];
 constructor(){super('ColorLane');}
 create(){
  this.add.rectangle(195,422,390,844,0x0b1220);
  this.lanes.forEach((x,i)=>{this.add.rectangle(x,430,126,720,COLORS[i],.065);this.add.rectangle(x,430,2,720,0xffffff,.1);this.add.text(x,90,NAMES[i],{fontFamily:'Arial',fontSize:'14px',color:'#cbd5e1',fontStyle:'bold'}).setOrigin(.5);});
  this.add.text(18,20,'GECO GAMES',{fontFamily:'Arial',fontSize:'14px',color:'#94a3b8',fontStyle:'bold'});
  this.scoreText=this.add.text(370,16,'0',{fontFamily:'Arial',fontSize:'32px',color:'#ffffff',fontStyle:'bold'}).setOrigin(1,0);
  this.comboText=this.add.text(370,54,'',{fontFamily:'Arial',fontSize:'14px',color:'#fde047',fontStyle:'bold'}).setOrigin(1,0);
  this.status=this.add.text(195,150,'',{fontFamily:'Arial',fontSize:'23px',color:'#ffffff',fontStyle:'bold'}).setOrigin(.5).setDepth(20);
  this.player=this.add.rectangle(this.lanes[this.lane],720,64,64,COLORS[this.lane]).setStrokeStyle(4,0xffffff,.95).setDepth(10);
  this.gates=this.add.group();
  this.title=this.add.text(195,285,'COLOR\nLANE',{align:'center',fontFamily:'Arial',fontSize:'52px',color:'#ffffff',fontStyle:'bold'}).setOrigin(.5);
  this.hint=this.add.text(195,430,'CATCH EACH COLOR IN ITS LANE\n\nGREEN → GREEN   BLUE → BLUE\nRED → RED\n\nTap the lane before it reaches you.\nBEST '+Core.data.highScore,{align:'center',fontFamily:'Arial',fontSize:'17px',color:'#cbd5e1',lineSpacing:9}).setOrigin(.5);
  this.playText=this.add.text(195,600,'TAP TO PLAY',{fontFamily:'Arial',fontSize:'24px',color:'#fde047',fontStyle:'bold'}).setOrigin(.5);
  this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{if(!this.playing){this.start();return;}const localX=p.x*(390/this.scale.displaySize.width);this.move(Math.max(0,Math.min(2,Math.floor(localX/130))));});
 }
 move(i:number){if(i===this.lane)return;this.lane=i;this.player.setFillStyle(COLORS[i]);this.tweens.killTweensOf(this.player);this.tweens.add({targets:this.player,x:this.lanes[i],duration:105,ease:'Cubic.out'});if(Core.data.vibration&&navigator.vibrate)navigator.vibrate(7);}
 start(){this.time.removeAllEvents();this.gates.clear(true,true);this.playing=true;this.score=0;this.runCoins=0;this.combo=0;this.speed=225;this.spawnDelay=1150;this.scoreText.setText('0');this.comboText.setText('');this.title.setVisible(false);this.hint.setVisible(false);this.playText.setVisible(false);this.flash('READY!',650);Core.event('run_start');this.time.delayedCall(500,()=>{this.spawn();this.scheduleSpawn();});}
 scheduleSpawn(){if(!this.playing)return;this.time.delayedCall(this.spawnDelay,()=>{if(!this.playing)return;this.spawn();this.scheduleSpawn();});}
 spawn(){const lane=Phaser.Math.Between(0,2);const box=this.add.rectangle(this.lanes[lane],-38,94,48,COLORS[lane]).setStrokeStyle(4,0xffffff,.95);const label=this.add.text(this.lanes[lane],-38,NAMES[lane],{fontFamily:'Arial',fontSize:'13px',color:'#ffffff',fontStyle:'bold'}).setOrigin(.5);const g=this.add.container(0,0,[box,label]) as Gate;g.lane=lane;this.gates.add(g);this.tweens.add({targets:g,scaleX:1.05,scaleY:1.05,yoyo:true,duration:160});}
 update(_:number,delta:number){if(!this.playing)return;this.speed=Math.min(590,225+this.score*8);this.spawnDelay=Math.max(560,1150-this.score*16);for(const obj of [...this.gates.getChildren()] as Gate[]){obj.y+=this.speed*delta/1000;if(obj.y>675&&!obj.getData('checked')){obj.setData('checked',true);if(obj.lane===this.lane)this.success(obj);else{this.fail(obj);return;}}if(obj.y>880)obj.destroy();}}
 success(obj:Gate){this.score++;this.runCoins++;this.combo++;this.scoreText.setText(String(this.score));this.comboText.setText(this.combo>=3?'COMBO x'+this.combo:'');const x=this.lanes[obj.lane!];obj.destroy();for(let i=0;i<6;i++){const dot=this.add.circle(x,700,Phaser.Math.Between(3,7),COLORS[this.lane]).setDepth(15);this.tweens.add({targets:dot,x:x+Phaser.Math.Between(-65,65),y:700+Phaser.Math.Between(-70,35),alpha:0,scale:0,duration:300,onComplete:()=>dot.destroy()});}this.flash(this.combo>=5?'GREAT! x'+this.combo:'MATCH! +1',300);this.tweens.add({targets:this.player,scaleX:1.25,scaleY:1.25,yoyo:true,duration:85});if(Core.data.vibration&&navigator.vibrate)navigator.vibrate(16);}
 fail(obj:Gate){this.combo=0;this.comboText.setText('');obj.setAlpha(.35);this.cameras.main.shake(180,.014);this.player.setFillStyle(0xffffff);this.flash('MISSED '+NAMES[obj.lane!]+'!',450);if(Core.data.vibration&&navigator.vibrate)navigator.vibrate([55,35,100]);this.time.delayedCall(330,()=>this.over());}
 flash(text:string,duration:number){this.status.setText(text).setAlpha(1).setScale(.8);this.tweens.add({targets:this.status,alpha:0,scale:1.12,duration});}
 over(){if(!this.playing)return;this.playing=false;this.time.removeAllEvents();this.gates.clear(true,true);this.player.setFillStyle(COLORS[this.lane]);Core.finish(this.score,this.runCoins);Core.event('run_end',{score:this.score});this.title.setText('GAME OVER').setVisible(true);this.hint.setText('SCORE '+this.score+'   •   BEST '+Core.data.highScore+'\nCOINS '+Core.data.coins+'\n\nCatch every color in its matching lane.').setVisible(true);this.playText.setText('TAP TO RETRY').setVisible(true);this.status.setText('').setAlpha(0);}
}
