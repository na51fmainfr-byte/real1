const { cards } = require('./data/cards');
const { computeScaledStats, calculateUserDamage } = require('./commands/isail') ? require('./commands/isail') : {};
// Actually calculateUserDamage is in isail, not exported; we can replicate logic here
function randomInt(min,max){return Math.floor(Math.random()*(max-min+1))+min;}
function calculateUserDamageLocal(card, type){
  const scaled = card.scaled || {};
  if (type === 'special'){
    if (card.def.special_attack && scaled.special_attack){
      const min = scaled.special_attack.min;
      const max = scaled.special_attack.max;
      const dmg = randomInt(min,max);
      return dmg < min ? min : dmg;
    }
    if (scaled.attack_min!=null && scaled.attack_max!=null){
      return randomInt(scaled.attack_min, scaled.attack_max);
    }
    return 0;
  }
  if (scaled.attack_min!=null && scaled.attack_max!=null){
    return randomInt(scaled.attack_min, scaled.attack_max);
  }
  return 0;
}

let user = { ownedCards: [{cardId:'makino_u1'},{cardId:'luffy-u2'}]};
function calculateBoostPct(character,user){
  let total=0;
  user.ownedCards.forEach(entry=>{
    const def=cards.find(c=>c.id===entry.cardId);
    if(def && def.type==='Boost' && def.boost){
      const regex=new RegExp(`${character.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*\\((\\d+)%\\)`,'i');
      const m=def.boost.match(regex);
      if(m) total+=parseInt(m[1],10);
    }
  });
  return total;
}

const luffy=cards.find(c=>c.id==='luffy-u2');
const boost=calculateBoostPct(luffy.character,user);
console.log('boost pct',boost);
const scaled= (()=>{
  const entry={level:2};
  const scaled= (require('./utils/cards').computeScaledStats(luffy,entry.level,boost));
  return scaled;
})();
console.log('scaled',scaled);
let dist={};
for(let i=0;i<100000;i++){const dmg=calculateUserDamageLocal({def:luffy,scaled},'special');dist[dmg]=(dist[dmg]||0)+1;}
console.log(dist);
