// State machine uses fresh observations, not a held/predicted rendering pose.
export const MOVES=['ROCK','PAPER','SCISSORS'];
export function outcome(player,opponent){
  if(!MOVES.includes(player)||!MOVES.includes(opponent))throw Error('Invalid gesture');
  return player===opponent?'draw':MOVES[(MOVES.indexOf(player)+2)%3]===opponent?'win':'loss';
}
export class Round {
  constructor(random=Math.random){this.random=random;this.reset();}
  reset(){this.phase='idle';this.score={win:0,loss:0,draw:0};this.gesture=null;this.lastSeen=-Infinity;this.since=0;this.result=null;}
  observe(move,now){if(move!==this.gesture||now-this.lastSeen>500)this.since=now;this.gesture=MOVES.includes(move)?move:null;this.lastSeen=now;}
  start(now){if(this.phase==='countdown')return false;this.phase='countdown';this.deadline=now+3000;this.opponent=MOVES[Math.floor(this.random()*3)];this.result=null;return true;}
  tick(now){
    if(this.phase!=='countdown'||now<this.deadline)return null;
    if(!this.gesture||now-this.lastSeen>500||now-this.since<400){this.phase='retry';return {error:'No stable gesture. Keep your hand visible and try again.'};}
    this.result={player:this.gesture,opponent:this.opponent,outcome:outcome(this.gesture,this.opponent)};this.score[this.result.outcome]++;this.phase='result';return this.result;
  }
}
