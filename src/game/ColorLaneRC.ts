import { ColorLane } from './ColorLane';
import { Core } from '../core/Core';

export class ColorLaneRC extends ColorLane {
  create(){
    super.create();
    // Gameplay information must always remain readable above gates and VFX.
    [this.score,this.lives,this.level,this.streak,this.pause].forEach(x=>x.setDepth(90));
    this.status.setDepth(95);
  }

  start(){
    if(!Core.data.tutorialSeen){this.tutorial();return;}
    super.start();
  }

  tutorial(){
    this.playing=false;
    this.clear();
    this.gates.clear(true,true);
    this.player.setVisible(false);
    this.pause.setText('');
    this.shell(true);
    this.title.setFontSize(38).setText('HOW TO PLAY');
    this.hint.setText(
      'MATCH THE FALLING BOX\n\n'+
      'Tap GREEN, BLUE or RED to move your block into that lane.\n\n'+
      'Be in the SAME COLOR lane when the box reaches you.\n\n'+
      '✓ Matches build momentum\n'+
      '★ Gold boxes give bonus coins\n'+
      '♥ A miss costs one life\n\n'+
      'Lose all 3 lives and the run ends.'
    );
    this.btn(650,'GOT IT — PLAY',()=>{
      Core.markTutorial();
      super.start();
    },280);
    this.btn(710,'← HOME',()=>this.home(),280);
  }

  togglePause(){
    if(!this.playing)return;
    if(!this.paused){
      this.paused=true;
      this.overlay.setVisible(true).setAlpha(.9);
      this.shell(true);
      this.title.setFontSize(44).setText('PAUSED');
      this.hint.setText('Your run is safe.\nResume when you are ready.');
      this.pause.setText('');
      this.btn(505,'▶ RESUME',()=>this.resumeRun(),280);
      this.btn(565,'⌂ GO TO HOME',()=>this.quitToHome(),280);
    }else this.resumeRun();
  }

  resumeRun(){
    this.clear();
    this.paused=false;
    this.shell(false);
    this.overlay.setVisible(false);
    this.pause.setText('Ⅱ PAUSE');
  }

  quitToHome(){
    this.clear();
    this.paused=false;
    this.playing=false;
    this.time.removeAllEvents();
    this.tweens.killTweensOf(this.danger);
    this.danger.setAlpha(0);
    this.gates.clear(true,true);
    this.home();
  }

  settings(){
    super.settings();
    this.btn(670,'? HOW TO PLAY',()=>this.tutorial(),250);
  }
}
