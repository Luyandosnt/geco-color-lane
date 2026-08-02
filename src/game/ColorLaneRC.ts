import { ColorLane } from './ColorLane';
import { Core } from '../core/Core';
import { Audio } from '../core/Audio';
import { UI_ASSETS } from '../ui/HyperCasualUIAssets';

export class ColorLaneRC extends ColorLane {
  create(){
    super.create();
    // Gameplay information must always remain readable above gates and VFX.
    [this.score,this.distanceLabel,this.lives,this.level,this.streak,this.pause].forEach(x=>x.setDepth(90));
    this.status.setDepth(95);
  }

  start(){
    if(!Core.data.tutorialSeen){this.tutorial();return;}
    super.start();
  }

  tutorial(){
    this.onboarding?.cancel();
    this.playing=false;
    this.clear();
    this.gates.clear(true,true);
    this.player.setVisible(false);
    this.pause.setText('');
    this.pauseBg.setVisible(false);
    this.menuPanel();
    this.shell(true);
    this.title.setPosition(195, 178).setFontSize(36).setText('HOW TO PLAY');
    this.hint.setPosition(195, 342).setFontSize(14);
    this.hint.setText(
      'MATCH THE FALLING BOX\n\n'+
      'Tap one of the three lanes to move your aircraft there.\n\n'+
      'Be in the SAME COLOR lane when the box reaches you.\n\n'+
      '✓ Matches build momentum\n'+
      '★ Gold boxes give bonus coins\n'+
      'Fuel depleted costs one life\n\n'+
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
      Audio.pauseMusic();
      this.onboarding.pause();
      this.paused=true;
      this.overlay.setVisible(true).setAlpha(.9);
      this.shell(true);
      this.shellPanel.setTexture(UI_ASSETS.panels.pause.key).setDisplaySize(310, 360).setPosition(195, 422);
      this.title.setPosition(195, 250).setFontSize(42).setText('PAUSED');
      this.hint.setPosition(195, 352).setFontSize(15).setText('Your run is safe.\nResume when you are ready.');
      this.pause.setText('');
      this.pauseBg.setVisible(false);
      this.btn(485,'RESUME',()=>this.resumeRun(),190);
      this.btn(552,'HOME',()=>this.quitToHome(),170);
    }else this.resumeRun();
  }

  resumeRun(){
    this.clear();
    this.paused=false;
    this.onboarding.resume();
    Audio.resumeMusic();
    this.shell(false);
    this.menuPanel();
    this.overlay.setVisible(false);
    this.pause.setText('Ⅱ PAUSE');
    this.pauseBg.setVisible(true);
  }

  quitToHome(){
    this.clear();
    this.onboarding.cancel();
    this.paused=false;
    this.playing=false;
    this.pauseBg.setVisible(false);
    Audio.stopMusic();
    this.time.removeAllEvents();
    this.tweens.killTweensOf(this.danger);
    this.danger.setAlpha(0);
    this.gates.clear(true,true);
    this.home();
  }
}
