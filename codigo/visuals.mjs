// Seven-segment geometry: two 42 × 80 digits with a 10-unit gap.
export const DIGIT_SEGMENTS = {
  a:[[6,0],[36,0],[41,5],[35,10],[7,10],[1,5]],
  b:[[42,6],[42,35],[37,40],[32,35],[32,13],[38,7]],
  c:[[37,40],[42,45],[42,74],[37,79],[32,73],[32,45]],
  d:[[7,70],[35,70],[41,76],[36,80],[6,80],[1,75]],
  e:[[0,45],[5,40],[10,45],[10,68],[4,74],[0,74]],
  f:[[0,6],[5,1],[10,12],[10,35],[5,40],[0,35]],
  g:[[7,35],[35,35],[40,40],[35,45],[7,45],[2,40]],
};
export const DIGIT_MAP = ['abcdef','bc','abged','abgcd','fgbc','afgcd','afgecd','abc','abcdefg','abfgcd'];
export function clockPolygons(value,all=false){
  const text=String(Math.max(0,Math.min(20,value))).padStart(2,'0');
  const polygons=[];
  for(let i=0;i<2;i++)for(const [segment,points] of Object.entries(DIGIT_SEGMENTS)){
    const active=DIGIT_MAP[Number(text[i])].includes(segment);
    if(all||active)polygons.push({active,points:points.map(([x,y])=>[x+i*52,y])});
  }
  return polygons;
}
export function smoothHover(state,x,y,inside,dt){
  const interval=Math.max(.001,dt),fresh=!state.initialized||!inside;
  if(fresh){state.lastX=x;state.lastY=y;state.initialized=inside;}
  let vx=inside?(x-state.lastX)/interval:0,vy=inside?(y-state.lastY)/interval:0;
  const speed=Math.hypot(vx,vy),cap=950;
  if(speed>cap){vx*=cap/speed;vy*=cap/speed;}
  const blend=1-Math.exp(-Math.min(dt,.12)*10);
  state.vx+=(vx-state.vx)*blend;state.vy+=(vy-state.vy)*blend;
  state.lastX=x;state.lastY=y;
  return state;
}
