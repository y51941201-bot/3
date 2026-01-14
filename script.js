/* Mobile-friendly physics simulation
   - Pointer events (touch & mouse)
   - Swipe to throw, slingshot, drag-to-move
   - Bounce off edges with energy loss
   - Toggle gravity, draw velocity vectors
   - Console debug logs
*/

'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const DPR = window.devicePixelRatio || 1;

const ui = {
  toggleGravity: document.getElementById('toggleGravity'),
  toggleVectors: document.getElementById('toggleVectors'),
  addBall: document.getElementById('addBall'),
};

let width = 0, height = 0;
function resize(){
  width = Math.floor(window.innerWidth);
  height = Math.floor(window.innerHeight);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  canvas.width = Math.floor(width * DPR);
  canvas.height = Math.floor(height * DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', resize, {passive:true});
resize();

// Prevent page scrolling/zooming on touch
document.addEventListener('touchmove', e=>{ e.preventDefault(); }, {passive:false});
window.addEventListener('gesturestart', e=>{ e.preventDefault(); }, {passive:false});
document.body.style.overscrollBehavior = 'none';

// Utilities
class Vec{
  constructor(x=0,y=0){ this.x=x; this.y=y; }
  copy(){ return new Vec(this.x,this.y); }
  add(v){ this.x+=v.x; this.y+=v.y; return this; }
  sub(v){ this.x-=v.x; this.y-=v.y; return this; }
  mul(s){ this.x*=s; this.y*=s; return this; }
  len(){ return Math.hypot(this.x,this.y); }
  normalize(){ const L=this.len()||1; this.x/=L; this.y/=L; return this; }
}

// Circle objects
class Ball{
  constructor(x,y,r=28, color='#58a'){
    this.pos = new Vec(x,y);
    this.vel = new Vec((Math.random()-0.5)*150, (Math.random()-0.5)*150);
    this.r = r;
    this.mass = r * 0.1;
    this.color = color;
    this.restitution = 0.8; // energy retention on bounce
  }
  draw(showVectors=false){
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.pos.x, this.pos.y, this.r, 0, Math.PI*2);
    ctx.fill();
    ctx.closePath();
    if (showVectors){
      // velocity arrow
      const s = 0.2;
      drawArrow(this.pos.x, this.pos.y, this.pos.x + this.vel.x*s, this.pos.y + this.vel.y*s, 'yellow');
    }
  }
}

const balls = [];
function addBall(x=width/2, y=height/2, r=28){
  balls.push(new Ball(x,y,r, `hsl(${Math.random()*360},70%,60%)`));
}

// Add a few initial balls
for(let i=0;i<3;i++) addBall(120 + i*80, 150 + i*40, 28 + i*6);

// Physics parameters
let gravityOn = true;
let gravity = 900; // px/s^2
let friction = 0.999; // air resistance
let globalRest = 0.85;

let showVectors = false;

ui.toggleGravity.addEventListener('click', ()=>{
  gravityOn = !gravityOn;
  ui.toggleGravity.textContent = `Gravity: ${gravityOn? 'ON' : 'OFF'}`;
});
ui.toggleVectors.addEventListener('click', ()=>{
  showVectors = !showVectors;
  ui.toggleVectors.textContent = `Vectors: ${showVectors? 'ON' : 'OFF'}`;
});
ui.addBall.addEventListener('click', ()=> addBall(Math.random()*width, Math.random()*height, 24 + Math.random()*22));

// Drawing helper
function drawArrow(x1,y1,x2,y2, color='white'){
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();
  // arrow head
  const angle = Math.atan2(y2-y1, x2-x1);
  const head = 8;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head*Math.cos(angle - Math.PI/6), y2 - head*Math.sin(angle - Math.PI/6));
  ctx.lineTo(x2 - head*Math.cos(angle + Math.PI/6), y2 - head*Math.sin(angle + Math.PI/6));
  ctx.lineTo(x2,y2);
  ctx.fillStyle = color;
  ctx.fill();
}

// Pointer handling (single-pointer focus)
let active = null; // {ball, pointerId, startPos, lastPositions[], mode}
const MAX_HISTORY_MS = 120;

canvas.addEventListener('pointerdown', (e)=>{
  canvas.setPointerCapture(e.pointerId);
  const rect = canvas.getBoundingClientRect();
  const p = new Vec(e.clientX - rect.left, e.clientY - rect.top);

  // find topmost ball under pointer
  let hit = null;
  for(let i=balls.length-1;i>=0;i--){
    const b = balls[i];
    if (Math.hypot(b.pos.x-p.x, b.pos.y-p.y) <= b.r + 8){ hit = b; break; }
  }

  active = {
    pointerId: e.pointerId,
    startPos: p.copy(),
    lastPositions: [{p, t:performance.now()}],
    ball: hit,
    mode: hit? 'candidate' : 'none',
    slingshotOrigin: hit? hit.pos.copy() : null
  };
});

canvas.addEventListener('pointermove', (e)=>{
  if (!active || e.pointerId !== active.pointerId) return;
  const rect = canvas.getBoundingClientRect();
  const p = new Vec(e.clientX - rect.left, e.clientY - rect.top);
  const now = performance.now();
  active.lastPositions.push({p, t: now});
  // trim
  while(active.lastPositions.length>2 && now - active.lastPositions[0].t > MAX_HISTORY_MS) active.lastPositions.shift();

  if (active.ball){
    const b = active.ball;
    const dist = Math.hypot(p.x - active.startPos.x, p.y - active.startPos.y);
    // Decide mode: if pointer pulled backwards from ball center by some threshold -> slingshot
    const pullVec = new Vec(p.x - active.slingshotOrigin.x, p.y - active.slingshotOrigin.y);
    if (pullVec.len() > 12) active.mode = 'slingshot';
    else active.mode = 'dragforce';

    if (active.mode === 'dragforce'){
      // apply spring-like force towards pointer for smooth dragging
      const toward = new Vec(p.x - b.pos.x, p.y - b.pos.y);
      const K = 8; // spring constant
      b.vel.add(toward.mul(K * (1/60) / Math.max(b.mass,0.1)));
    } else if (active.mode === 'slingshot'){
      // do not modify ball position while slingshot - just show line
    }
  } else {
    // Not touching a ball: we could start a swipe gesture to throw the nearest ball if fast
    active.mode = 'swipe';
  }
});

canvas.addEventListener('pointerup', (e)=>{
  if (!active || e.pointerId !== active.pointerId) return;
  const now = performance.now();
  const hist = active.lastPositions;
  const first = hist[0];
  const last = hist[hist.length-1];
  const dt = Math.max((last.t - first.t)/1000, 0.001);
  const v = new Vec((last.p.x - first.p.x)/dt, (last.p.y - first.p.y)/dt);

  if (active.ball){
    const b = active.ball;
    if (active.mode === 'slingshot'){
      // release with velocity proportional to pull vector (opposite direction to pointer)
      const pull = new Vec(active.slingshotOrigin.x - last.p.x, active.slingshotOrigin.y - last.p.y);
      const strength = 1.2; // tuning
      b.vel.add(new Vec(pull.x * strength / Math.max(b.mass,1), pull.y * strength / Math.max(b.mass,1)));
    } else {
      // swipe to throw: add measured pointer velocity
      b.vel = v;
    }
  } else {
    // If swipe without start on object, find nearest and give it a throw if close
    // pick nearest ball within some radius of last pointer
    let nearest = null; let nd = Infinity;
    for(const ball of balls){
      const d = Math.hypot(ball.pos.x - last.p.x, ball.pos.y - last.p.y);
      if (d < nd){ nd = d; nearest = ball; }
    }
    if (nearest && nd < 140){ nearest.vel.add(v); }
  }

  // release
  try{ canvas.releasePointerCapture(active.pointerId); }catch(err){}
  active = null;
});

canvas.addEventListener('pointercancel', (e)=>{ if (active && e.pointerId === active.pointerId) active = null; });

// Physics update
let lastFrame = performance.now();
function step(){
  const now = performance.now();
  let dt = (now - lastFrame)/1000.0;
  lastFrame = now;
  if (dt > 0.05) dt = 0.05;

  for(const b of balls){
    // gravity
    if (gravityOn) b.vel.y += gravity * dt;
    // integrate
    b.pos.x += b.vel.x * dt;
    b.pos.y += b.vel.y * dt;
    // air drag
    b.vel.x *= Math.pow(friction, dt*60);
    b.vel.y *= Math.pow(friction, dt*60);
    // edge collisions
    if (b.pos.x - b.r < 0){ b.pos.x = b.r; b.vel.x = -b.vel.x * b.restitution * globalRest; }
    if (b.pos.x + b.r > width){ b.pos.x = width - b.r; b.vel.x = -b.vel.x * b.restitution * globalRest; }
    if (b.pos.y - b.r < 0){ b.pos.y = b.r; b.vel.y = -b.vel.y * b.restitution * globalRest; }
    if (b.pos.y + b.r > height){ b.pos.y = height - b.r; b.vel.y = -b.vel.y * b.restitution * globalRest; }
  }

  // Simple ball-ball collisions (pairwise)
  for(let i=0;i<balls.length;i++){
    for(let j=i+1;j<balls.length;j++){
      const A=balls[i], B=balls[j];
      const dx = B.pos.x - A.pos.x;
      const dy = B.pos.y - A.pos.y;
      const dist = Math.hypot(dx,dy) || 1;
      const minD = A.r + B.r;
      if (dist < minD){
        // push them apart
        const overlap = (minD - dist) / 2;
        const nx = dx/dist, ny = dy/dist;
        A.pos.x -= nx*overlap; A.pos.y -= ny*overlap;
        B.pos.x += nx*overlap; B.pos.y += ny*overlap;
        // relative velocity
        const rvx = B.vel.x - A.vel.x;
        const rvy = B.vel.y - A.vel.y;
        const rel = rvx*nx + rvy*ny;
        if (rel < 0){
          const e = Math.min(A.restitution, B.restitution) * globalRest;
          const jimp = -(1+e)*rel / (1/A.mass + 1/B.mass);
          const jx = jimp * nx, jy = jimp * ny;
          A.vel.x -= jx / A.mass; A.vel.y -= jy / A.mass;
          B.vel.x += jx / B.mass; B.vel.y += jy / B.mass;
        }
      }
    }
  }

  render();
  requestAnimationFrame(step);
}

function render(){
  // background
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0,0,width,height);

  // if active slingshot show line
  if (active && active.mode === 'slingshot' && active.lastPositions.length){
    const last = active.lastPositions[active.lastPositions.length-1].p;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.moveTo(active.slingshotOrigin.x, active.slingshotOrigin.y);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.closePath();
    // show potential velocity
    const pull = new Vec(active.slingshotOrigin.x - last.x, active.slingshotOrigin.y - last.y);
    drawArrow(active.slingshotOrigin.x, active.slingshotOrigin.y, active.slingshotOrigin.x + pull.x*0.6, active.slingshotOrigin.y + pull.y*0.6,'#ffdd77');
  }

  for(const b of balls) b.draw(showVectors);
}

// Console debug prints (positions & velocities)
setInterval(()=>{
  console.clear();
  console.log(`--- Simulation debug (${balls.length} balls) ---`);
  balls.forEach((b,i)=> console.log(`ball ${i}: pos=(${b.pos.x.toFixed(1)},${b.pos.y.toFixed(1)}) vel=(${b.vel.x.toFixed(1)},${b.vel.y.toFixed(1)})`));
}, 1000);

// Kick off
requestAnimationFrame(step);

// Expose some helpers for debugging from console
window.sim = {
  balls, addBall, toggleGravity: ()=>{ gravityOn = !gravityOn; ui.toggleGravity.textContent = `Gravity: ${gravityOn? 'ON' : 'OFF'}`; },
  toggleVectors: ()=>{ showVectors = !showVectors; ui.toggleVectors.textContent = `Vectors: ${showVectors? 'ON' : 'OFF'}`; }
};