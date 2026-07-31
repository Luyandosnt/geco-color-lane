import Phaser from 'phaser';
import { Core } from '../core/Core';

type Gate = Phaser.GameObjects.Container & { lane?: number; colorIndex?: number };
const COLORS = [0x22c55e, 0x3b82f6, 0xf43f5e];

export class ColorLane extends Phaser.Scene {
  lane = 1; score = 0; runCoins = 0; speed = 250; playing = false;
  player!: Phaser.GameObjects.Rectangle; gates!: Phaser.GameObjects.Group; scoreText!: Phaser.GameObjects.Text;
  title!: Phaser.GameObjects.Text; hint!: Phaser.GameObjects.Text;
  lanes = [95,195,295];
  create() {
    this.add.rectangle(195,422,390,844,0x111827);
    [95,195,295].forEach(x => this.add.rectangle(x,430,2,720,0xffffff,0.09));
    this.add.text(20,24,'GECO GAMES',{fontFamily:'Arial',fontSize:'16px',color:'#94a3b8',fontStyle:'bold'});
    this.scoreText=this.add.text(370,24,'0',{fontFamily:'Arial',fontSize:'28px',color:'#ffffff',fontStyle:'bold'}).setOrigin(1,0);
    this.player=this.add.rectangle(this.lanes[this.lane],720,58,58,COLORS[this.lane]).setStrokeStyle(4,0xffffff,0.9);
    this.gates=this.add.group();
    this.title=this.add.text(195,300,'COLOR\nLANE',{align:'center',fontFamily:'Arial',fontSize:'54px',color:'#ffffff',fontStyle:'bold'}).setOrigin(.5);
    this.hint=this.add.text(195,430,'Tap a lane to move\nPass through the matching color\n\nBEST '+Core.data.highScore,{align:'center',fontFamily:'Arial',fontSize:'20px',color:'#cbd5e1',lineSpacing:10}).setOrigin(.5);
    this.add.text(195,570,'TAP TO PLAY',{fontFamily:'Arial',fontSize:'24px',color:'#fde047',fontStyle:'bold'}).setOrigin(.5);
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{ if(!this.playing){this.start();return;} const i=Math.max(0,Math.min(2,Math.floor(p.x/(this.scale.displaySize.width/3)))); this.lane=i; this.tweens.add({targets:this.player,x:this.lanes[i],duration:90,ease:'Sine.out'}); });
  }
  start(){ this.playing=true; this.score=0; this.runCoins=0; this.speed=250; this.title.setVisible(false);this.hint.setVisible(false); this.children.list.filter((o:any)=>o.text==='TAP TO PLAY').forEach((o:any)=>o.setVisible(false)); Core.event('run_start'); this.time.addEvent({delay:900,loop:true,callback:()=>this.spawn()}); }
  spawn(){ if(!this.playing)return; const lane=Phaser.Math.Between(0,2); const c=Phaser.Math.Between(0,2); const box=this.add.rectangle(this.lanes[lane],-30,74,36,COLORS[c]).setStrokeStyle(3,0xffffff,.8); const g=this.add.container(0,0,[box]) as Gate; g.lane=lane;g.colorIndex=c;this.gates.add(g); }
  update(_:number,delta:number){ if(!this.playing)return; this.speed=Math.min(600,250+this.score*6); for(const obj of this.gates.getChildren() as Gate[]){ obj.y+=this.speed*delta/1000; if(obj.y>680&&obj.y<755){ if(!obj.getData('checked')){obj.setData('checked',true); if(obj.lane===this.lane){ if(obj.colorIndex===this.lane){this.score++;this.runCoins++;this.scoreText.setText(String(this.score));}else{return this.over();}} }} if(obj.y>880)obj.destroy(); } }
  over(){ if(!this.playing)return;this.playing=false;this.time.removeAllEvents();this.gates.clear(true,true);Core.finish(this.score,this.runCoins);Core.event('run_end',{score:this.score});this.title.setText('GAME OVER').setVisible(true);this.hint.setText('SCORE '+this.score+'\nBEST '+Core.data.highScore+'\nCOINS '+Core.data.coins+'\n\nTap to play again').setVisible(true); }
}
