import Phaser from 'phaser';
import { Core } from '../core/Core';

type Gate = Phaser.GameObjects.Container & { lane?: number; colorIndex?: number };
const COLORS = [0x22c55e, 0x3b82f6, 0xf43f5e];
const NAMES = ['GREEN','BLUE','RED'];

export class ColorLane extends Phaser.Scene {
  lane=1; score=0; runCoins=0; speed=240; playing=false; combo=0;
  player!:Phaser.GameObjects.Rectangle; gates!:Phaser.GameObjects.Group; scoreText!:Phaser.GameObjects.Text;
  title!:Phaser.GameObjects.Text; hint!:Phaser.GameObjects.Text; playText!:Phaser.GameObjects.Text; status!:Phaser.GameObjects.Text;
  lanes=[95,195,295];
  constructor(){super('ColorLane');}
  create(){
    this.add.rectangle(195,422,390,844,0x111827);
    this.lanes.forEach((x,i)=>{this.add.rectangle(x,430,96,720,COLORS[i],0.055);this.add.rectangle(x,430,2,720,0xffffff,0.12);this.add.text(x,92,NAMES[i],{fontFamily:'Arial',fontSize:'13px',color:'#94a3b8',fontStyle:'bold'}).setOrigin(.5);});
    this.add.text(20,22,'GECO GAMES',{fontFamily:'Arial',fontSize:'15px',color:'#94a3b8',fontStyle:'bold'});
    this.scoreText=this.add.text(370,18,'0',{fontFamily:'Arial',fontSize:'30px',color:'#ffffff',fontStyle:'bold'}).setOrigin(1,0);
    this.status=this.add.text(195,145,'',{fontFamily:'Arial',fontSize:'22px',color:'#ffffff',fontStyle:'bold'}).setOrigin(.5).setDepth(10);
    this.player=this.add.rectangle(this.lanes[this.lane],720,58,58,COLORS[this.lane]).setStrokeStyle(4,0xffffff,.95).setDepth(5);
    this.gates=this.add.group();
    this.title=this.add.text(195,285,'COLOR\nLANE',{align:'center',fontFamily:'Arial',fontSize:'52px',color:'#ffffff',fontStyle:'bold'}).setOrigin(.5);
    this.hint=this.add.text(195,430,'MOVE TO THE GATE\'S COLOR\n\nTap GREEN, BLUE or RED lane\nbefore the gate reaches you.\n\nBEST '+Core.data.highScore,{align:'center',fontFamily:'Arial',fontSize:'18px',color:'#cbd5e1',lineSpacing:9}).setOrigin(.5);
    this.playText=this.add.text(195,590,'TAP TO PLAY',{fontFamily:'Arial',fontSize:'24px',color:'#fde047',fontStyle:'bold'}).setOrigin(.5);
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{if(!this.playing){this.start();return;}const localX=p.x*(390/this.scale.displaySize.width);const i=Math.max(0,Math.min(2,Math.floor(localX/130)));this.move(i);});
  }
  move(i:number){this.lane=i;this.player.setFillStyle(COLORS[i]);this.tweens.killTweensOf(this.player);this.tweens.add({targets:this.player,x:this.lanes[i],duration:75,ease:'Sine.out'});if(Core.data.vibration&&navigator.vibrate)navigator.vibrate(8);}
  start(){this.playing=true;this.score=0;this.runCoins=0;this.combo=0;this.speed=240;this.scoreText.setText('0');this.title.setVisible(false);this.hint.setVisible(false);this.playText.setVisible(false);this.status.setText('MATCH THE COLOR!').setAlpha(1);this.time.delayedCall(700,()=>this.status.setAlpha(0));Core.event('run_start');this.spawn();this.time.addEvent({delay:1050,loop:true,callback:()=>this.spawn()});}
  spawn(){if(!this.playing)return;const lane=Phaser.Math.Between(0,2);const c=Phaser.Math.Between(0,2);const box=this.add.rectangle(this.lanes[lane],-35,86,42,COLORS[c]).setStrokeStyle(4,0xffffff,.9);const label=this.add.text(this.lanes[lane],-35,NAMES[c],{fontFamily:'Arial',fontSize:'12px',color:'#ffffff',fontStyle:'bold'}).setOrigin(.5);const g=this.add.container(0,0,[box,label]) as Gate;g.lane=lane;g.colorIndex=c;this.gates.add(g);}
  update(_:number,delta:number){if(!this.playing)return;this.speed=Math.min(560,240+this.score*7);for(const obj of [...this.gates.getChildren()] as Gate[]){obj.y+=this.speed*delta/1000;if(obj.y>670&&!obj.getData('checked')){obj.setData('checked',true);if(obj.lane===this.lane&&obj.colorIndex===this.lane){this.success(obj);}else{this.fail(obj);return;}}if(obj.y>880)obj.destroy();}}
  success(obj:Gate){this.score++;this.runCoins++;this.combo++;this.scoreText.setText(String(this.score));obj.destroy();this.status.setText(this.combo>=3?'COMBO x'+this.combo:'MATCH! +1').setAlpha(1).setScale(.8);this.tweens.add({targets:this.status,alpha:0,scale:1.15,duration:420});this.tweens.add({targets:this.player,scaleX:1.18,scaleY:1.18,yoyo:true,duration:90});if(Core.data.vibration&&navigator.vibrate)navigator.vibrate(18);}
  fail(obj:Gate){obj.setAlpha(.35);this.cameras.main.shake(160,.012);this.status.setText('WRONG LANE!').setAlpha(1).setScale(1);if(Core.data.vibration&&navigator.vibrate)navigator.vibrate([50,35,90]);this.time.delayedCall(250,()=>this.over());}
  over(){if(!this.playing)return;this.playing=false;this.time.removeAllEvents();this.gates.clear(true,true);Core.finish(this.score,this.runCoins);Core.event('run_end',{score:this.score});this.title.setText('GAME OVER').setVisible(true);this.hint.setText('SCORE '+this.score+'\nBEST '+Core.data.highScore+'\nCOINS '+Core.data.coins+'\n\nTap anywhere to try again').setVisible(true);this.playText.setText('TAP TO RETRY').setVisible(true);this.status.setText('').setAlpha(0);}
}
