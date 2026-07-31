export type RunSnapshot={score:number;coins:number;lives:number;streak:number;level:number};
export class RunSystem{
 score=0;coins=0;lives=3;streak=0;level=1;
 reset(){this.score=0;this.coins=0;this.lives=3;this.streak=0;this.level=1;}
 catch(){this.score++;this.coins++;this.streak++;this.level=Math.floor(this.score/10)+1;let bonus=0;if(this.streak>=5){bonus=5;this.coins+=bonus;this.streak=0;}return{bonus,levelUp:this.score%10===0};}
 miss(){this.lives--;this.streak=0;return this.lives<=0;}
 snapshot():RunSnapshot{return{score:this.score,coins:this.coins,lives:this.lives,streak:this.streak,level:this.level};}
}