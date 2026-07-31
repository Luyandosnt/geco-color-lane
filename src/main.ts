import Phaser from 'phaser';
import './style.css';
import { Core } from './core/Core';
import { Online } from './core/Online';
import { ColorLaneRC } from './game/ColorLaneRC';

Core.boot();
Online.boot().finally(()=>new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 390,
  height: 844,
  backgroundColor: '#111827',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [ColorLaneRC]
}));

if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'));
