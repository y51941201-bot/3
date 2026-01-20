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

// Spring constraint
class Spring{
  constructor(ballA, ballB, restLen=80, stiffness=0.05){
    this.ballA = ballA;
    this.ballB = ballB;
    this.restLen = restLen;
    this.k = stiffness;
  }
  apply(){
    const dx = this.ballB.pos.x - this.ballA.pos.x;
    const dy = this.ballB.pos.y - this.ballA.pos.y;
    const dist = Math.hypot(dx,dy) || 1;
    const delta = dist - this.restLen;
    const force = this.k * delta;
    const fx = (dx/dist) * force;
    const fy = (dy/dist) * force;
    this.ballA.vel.x += fx / this.ballA.mass;
    this.ballA.vel.y += fy / this.ballA.mass;
    this.ballB.vel.x -= fx / this.ballB.mass;
    this.ballB.vel.y -= fy / this.ballB.mass;
  }
  draw(){
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(100,200,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(this.ballA.pos.x, this.ballA.pos.y);
    ctx.lineTo(this.ballB.pos.x, this.ballB.pos.y);
    ctx.stroke();
  }
}

// Fixed obstacle
class FixedBody{
  constructor(x,y,r=28, color='#f88'){
    this.pos = new Vec(x,y);
    this.r = r;
    this.color = color;
    this.fixed = true;
  }
  draw(){
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.pos.x, this.pos.y, this.r, 0, Math.PI*2);
    ctx.fill();
    // draw X to indicate fixed
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.pos.x - this.r*0.4, this.pos.y - this.r*0.4);
    ctx.lineTo(this.pos.x + this.r*0.4, this.pos.y + this.r*0.4);
    ctx.moveTo(this.pos.x + this.r*0.4, this.pos.y - this.r*0.4);
    ctx.lineTo(this.pos.x - this.r*0.4, this.pos.y + this.r*0.4);
    ctx.stroke();
  }
}

const springs = [];
const fixedBodies = [];

function addFixedBody(x,y,r=28){
  fixedBodies.push(new FixedBody(x,y,r));
}

function addSpring(ball1, ball2, restLen=80){
  springs.push(new Spring(ball1, ball2, restLen, 0.06));
}

// Add some fixed obstacles
addFixedBody(width*0.2, height*0.3, 32);
addFixedBody(width*0.8, height*0.5, 28);
addFixedBody(width*0.5, height*0.7, 25);

// Circle objects
class Ball{
  constructor(x,y,r=28, color='#58a'){
    this.pos = new Vec(x,y);
    this.vel = new Vec((Math.random()-0.5)*150, (Math.random()-0.5)*150);
    this.r = r;
    this.mass = r * 0.1;
    this.color = color;
    this.restitution = 0.8; // energy retention on bounce
    this.trail = [];
  }
  draw(showVectors=false){
    // draw trail
    if (trailsOn && this.trail && this.trail.length){
      for(let i=0;i<this.trail.length;i++){
        const p = this.trail[i];
        const alpha = (i+1)/this.trail.length * 0.7;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${alpha*0.06})`;
        ctx.arc(p.x, p.y, Math.max(1, this.r*0.08*(i/this.trail.length)), 0, Math.PI*2);
        ctx.fill();
        ctx.closePath();
      }
    }

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

// Add initial balls
for(let i=0;i<8;i++) addBall(60 + (i%4)*140, 100 + Math.floor(i/4)*120, 22 + Math.random()*12);

// Connect some balls with springs for physical linkage
if (balls.length >= 2){
  addSpring(balls[0], balls[1], 100);
  addSpring(balls[1], balls[2], 90);
  addSpring(balls[4], balls[5], 110);
}

// Physics parameters
let gravityOn = true;
let gravity = 900; // px/s^2
let friction = 0.999; // air resistance
let globalRest = 0.85;

let showVectors = false;
let trailsOn = true;
let soundOn = false;

// slow-motion / time scaling
let timeScale = 1;
let slowMotionTimer = 0;
const SLOW_MOTION_THRESHOLD = 1200; // px/s threshold for entering slow-mo
const SLOW_MOTION_DURATION = 1000; // ms
const SLOW_MOTION_SCALE = 0.25; // slow-mo speed


// audio helpers and toggles
let audioCtx = null;
function ensureAudioContext(){ if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playCollisionSound(intensity=0.5){
  if (!soundOn) return;
  ensureAudioContext();
  const ctxA = audioCtx;
  const o = ctxA.createOscillator();
  const g = ctxA.createGain();
  const freq = 220 + Math.min(1400, intensity * 1000);
  o.type = 'sawtooth';
  o.frequency.value = freq;
  const vol = Math.min(0.9, 0.06 + intensity*0.7);
  g.gain.value = vol;
  const now = ctxA.currentTime;
  o.connect(g); g.connect(ctxA.destination);
  o.start(now);
  g.gain.setValueAtTime(g.gain.value, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.06 + intensity*0.12);
  o.stop(now + 0.08 + intensity*0.12);
}

ui.toggleGravity.addEventListener('click', ()=>{
  gravityOn = !gravityOn;
  ui.toggleGravity.textContent = `Gravity: ${gravityOn? 'ON' : 'OFF'}`;
});
ui.toggleVectors.addEventListener('click', ()=>{
  showVectors = !showVectors;
  ui.toggleVectors.textContent = `Vectors: ${showVectors? 'ON' : 'OFF'}`;
});
const toggleSoundBtn = document.getElementById('toggleSound');
const toggleTrailsBtn = document.getElementById('toggleTrails');

toggleSoundBtn.addEventListener('click', ()=>{
  soundOn = !soundOn;
  toggleSoundBtn.textContent = `Sound: ${soundOn? 'ON' : 'OFF'}`;
  toggleSoundBtn.classList.toggle('active', soundOn);
  if (soundOn) ensureAudioContext();
});

toggleTrailsBtn.addEventListener('click', ()=>{
  trailsOn = !trailsOn;
  toggleTrailsBtn.textContent = `Trails: ${trailsOn? 'ON' : 'OFF'}`;
  toggleTrailsBtn.classList.toggle('active', trailsOn);
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
  // ensure audio unlocked on first user gesture if sound is enabled
  if (soundOn) ensureAudioContext();

  // find topmost ball under pointer (for drag) or nearest ball (for click-to-move)
  let hit = null;
  let nearest = null; let nd = Infinity;
  for(let i=balls.length-1;i>=0;i--){
    const b = balls[i];
    const d = Math.hypot(b.pos.x-p.x, b.pos.y-p.y);
    if (d <= b.r + 8 && !hit){ hit = b; }
    if (d < nd){ nd = d; nearest = b; }
  }

  active = {
    pointerId: e.pointerId,
    startPos: p.copy(),
    currentPos: p.copy(),
    lastPositions: [{p: p.copy(), t:performance.now()}],
    ball: hit,
    nearestBall: nearest,
    mode: hit? 'candidate' : 'none',
    slingshotOrigin: hit? hit.pos.copy() : null,
    isClickMode: !hit // if not on ball, enter click-to-move mode
  };
});

canvas.addEventListener('pointermove', (e)=>{
  if (!active || e.pointerId !== active.pointerId) return;
  const rect = canvas.getBoundingClientRect();
  const p = new Vec(e.clientX - rect.left, e.clientY - rect.top);
  active.currentPos = p.copy();
  const now = performance.now();
  active.lastPositions.push({p: p.copy(), t: now});
  while(active.lastPositions.length>2 && now - active.lastPositions[0].t > MAX_HISTORY_MS) active.lastPositions.shift();

  // If race is running, control player position
  if (gameState === 'running' && player){
    const toward = new Vec(p.x - player.pos.x, p.y - player.pos.y);
    player.vel.x += toward.x * (PLAYER_FOLLOW_SPEED * 0.06); // increased from 0.02
    player.vel.y += toward.y * (PLAYER_FOLLOW_SPEED * 0.06);
    const maxPlayerSpeed = 1400; // increased from 900
    const sp = player.vel.len();
    if (sp > maxPlayerSpeed){ player.vel.mul(maxPlayerSpeed/sp); }
    active.mode = 'racecontrol';
    return;
  }

  // Click-to-move mode: show line to target
  if (active.isClickMode && active.nearestBall && active.mode === 'none'){
    active.mode = 'clickmove';
  }

  if (active.ball){
    const b = active.ball;
    const dist = Math.hypot(p.x - active.startPos.x, p.y - active.startPos.y);
    const pullVec = new Vec(p.x - active.slingshotOrigin.x, p.y - active.slingshotOrigin.y);
    if (pullVec.len() > 12) active.mode = 'slingshot';
    else active.mode = 'dragforce';

    if (active.mode === 'dragforce'){
      const toward = new Vec(p.x - b.pos.x, p.y - b.pos.y);
      const K = 8;
      b.vel.add(toward.mul(K * (1/60) / Math.max(b.mass,0.1)));
    }
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

  // Click-to-move mode: apply force toward clicked position
  if (active.isClickMode && active.nearestBall && active.mode === 'clickmove'){
    const b = active.nearestBall;
    const toward = new Vec(active.currentPos.x - b.pos.x, active.currentPos.y - b.pos.y);
    const dist = toward.len();
    if (dist > 10){
      toward.normalize();
      const forceStrength = Math.min(800, dist*2);
      b.vel.add(new Vec(toward.x*forceStrength, toward.y*forceStrength));
    }
  } else if (active.ball){
    const b = active.ball;
    if (active.mode === 'slingshot'){
      const pull = new Vec(active.slingshotOrigin.x - last.p.x, active.slingshotOrigin.y - last.p.y);
      const strength = 1.2;
      b.vel.add(new Vec(pull.x * strength / Math.max(b.mass,1), pull.y * strength / Math.max(b.mass,1)));
    } else {
      b.vel = v;
    }
  } else {
    let nearest = null; let nd = Infinity;
    for(const ball of balls){
      const d = Math.hypot(ball.pos.x - last.p.x, ball.pos.y - last.p.y);
      if (d < nd){ nd = d; nearest = ball; }
    }
    if (nearest && nd < 140){ nearest.vel.add(v); }
  }

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

  // handle slow-motion timer
  if (slowMotionTimer > 0){
    slowMotionTimer -= dt*1000;
    if (slowMotionTimer <= 0){ timeScale = 1; slowMotionTimer = 0; }
  }
  const dtScaled = dt * timeScale;

  for(const b of balls){
    // gravity
    if (gravityOn) b.vel.y += gravity * dtScaled;
    // integrate
    b.pos.x += b.vel.x * dtScaled;
    b.pos.y += b.vel.y * dtScaled;
    // air drag
    b.vel.x *= Math.pow(friction, dtScaled*60);
    b.vel.y *= Math.pow(friction, dtScaled*60);

    // trail update
    if (trailsOn){
      b.trail.unshift({x: b.pos.x, y: b.pos.y, t: now});
      if (b.trail.length > 18) b.trail.length = 18;
    } else {
      b.trail.length = 0;
    }

    // detect high-speed entry to slow-motion
    const speed = Math.hypot(b.vel.x, b.vel.y);
    if (speed > SLOW_MOTION_THRESHOLD && slowMotionTimer <= 0){
      slowMotionTimer = SLOW_MOTION_DURATION;
      timeScale = SLOW_MOTION_SCALE;
      console.log('Entering slow motion for high-speed throw');
    }

    // edge collisions
    if (b.pos.x - b.r < 0){ b.pos.x = b.r; b.vel.x = -b.vel.x * b.restitution * globalRest; const impact = Math.hypot(b.vel.x, b.vel.y); playCollisionSound(Math.min(1, impact/1200)); }
    if (b.pos.x + b.r > width){ b.pos.x = width - b.r; b.vel.x = -b.vel.x * b.restitution * globalRest; const impact = Math.hypot(b.vel.x, b.vel.y); playCollisionSound(Math.min(1, impact/1200)); }
    if (b.pos.y - b.r < 0){ b.pos.y = b.r; b.vel.y = -b.vel.y * b.restitution * globalRest; const impact = Math.hypot(b.vel.x, b.vel.y); playCollisionSound(Math.min(1, impact/1200)); }
    if (b.pos.y + b.r > height){ b.pos.y = height - b.r; b.vel.y = -b.vel.y * b.restitution * globalRest; const impact = Math.hypot(b.vel.x, b.vel.y); playCollisionSound(Math.min(1, impact/1200)); }
  }

  // --- Race updates: obstacles, collision with player, progress ---
  if (gameState === 'running'){
    // difficulty increases with progress
    difficulty = 1 + (raceProgress / RACE_LENGTH) * 2; // 1.0 -> 3.0
    baseObstacleInterval = Math.max(300, 700 - difficulty*80); // faster spawning

    // spawn obstacles
    obstacleTimer += dt*1000;
    if (obstacleTimer > baseObstacleInterval){ obstacleTimer = 0; spawnObstacle(); }

    // spawn collectibles
    collectibleTimer += dt*1000;
    if (collectibleTimer > COLLECTIBLE_INTERVAL){ collectibleTimer = 0; spawnCollectible(); }

    // update obstacles
    for(let i=obstacles.length-1;i>=0;i--){
      const o = obstacles[i];
      o.y += o.vy * dtScaled;
      // remove if off-screen
      if (o.y - o.r > height + 80){ obstacles.splice(i,1); continue; }
    }

    // update collectibles
    for(let i=collectibles.length-1;i>=0;i--){
      const c = collectibles[i];
      c.y += OBSTACLE_SPEED * dtScaled;
      if (c.y - c.h/2 > height + 80){ collectibles.splice(i,1); continue; }
    }

    // progress
    raceProgress += OBSTACLE_SPEED * dtScaled;
    const pct = Math.min(1, raceProgress / RACE_LENGTH);
    raceProgressEl.textContent = `${Math.floor(pct*100)}% D${Math.floor(difficulty*10)/10}`;
    raceScoreEl.textContent = `Score: ${raceScore}`;

    // check finish
    if (raceProgress >= RACE_LENGTH){ endRace(true); }

    // player-obstacle collisions
    if (player){
      // apply reduced gravity for player during race (more floaty, easier control)
      if (gameState === 'running'){
        player.vel.y += gravity * 0.15 * dtScaled; // reduced gravity for better control
      }
      // integrate player
      player.pos.x += player.vel.x * dtScaled; player.pos.y += player.vel.y * dtScaled;
      // keep player within screen
      player.pos.x = Math.max(player.r, Math.min(width - player.r, player.pos.x));
      player.pos.y = Math.max(player.r, Math.min(height - player.r, player.pos.y));
      // reduced damping in race mode for more responsive feel
      if (gameState === 'running'){
        player.vel.mul(0.985); // less damping
      } else {
        player.vel.mul(0.98); // normal damping
      }

      // check obstacle collisions
      for(const o of obstacles){
        const dx = o.x - player.pos.x; const dy = o.y - player.pos.y; const d = Math.hypot(dx,dy);
        if (d < o.r + player.r - 2){ // collision
          endRace(false); break;
        }
      }

      // check collectible collisions
      for(let i=collectibles.length-1;i>=0;i--){
        const c = collectibles[i];
        if (!c.collected && c.collidesWith(player.pos, player.r)){
          c.collected = true;
          raceScore += 10; // 10 points per collectible
          collectibles.splice(i,1);
          playCollisionSound(0.3); // soft sound for collection
        }
      }
    }
  }


  // Apply spring constraints
  for(const spring of springs) spring.apply();

  // Collisions with fixed bodies
  for(const ball of balls){
    for(const fixed of fixedBodies){
      const dx = ball.pos.x - fixed.pos.x;
      const dy = ball.pos.y - fixed.pos.y;
      const dist = Math.hypot(dx,dy) || 1;
      const minD = ball.r + fixed.r;
      if (dist < minD){
        // push ball away from fixed
        const overlap = minD - dist;
        const nx = dx/dist; const ny = dy/dist;
        ball.pos.x += nx*overlap; ball.pos.y += ny*overlap;
        // reflect velocity
        const rel = ball.vel.x*nx + ball.vel.y*ny;
        if (rel < 0){
          ball.vel.x = (ball.vel.x - 2*rel*nx) * 0.8;
          ball.vel.y = (ball.vel.y - 2*rel*ny) * 0.8;
        }
      }
    }
  }

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
          // play collision sound proportional to impulse
          playCollisionSound(Math.min(1, Math.abs(jimp)/1500));
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

  // draw springs
  for(const spring of springs) spring.draw();

  // draw fixed bodies
  for(const fb of fixedBodies) fb.draw();

  // draw obstacles if race
  if (gameState === 'running'){
    for(const o of obstacles) drawObstacle(o);
    // draw collectibles
    for(const c of collectibles) c.draw();
  }

  // if active slingshot show line
  if (active && active.mode === 'slingshot' && active.lastPositions.length && gameState !== 'running'){
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

  // click-to-move line
  if (active && active.mode === 'clickmove' && active.nearestBall){
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(100,255,150,0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5,5]);
    ctx.moveTo(active.nearestBall.pos.x, active.nearestBall.pos.y);
    ctx.lineTo(active.currentPos.x, active.currentPos.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.closePath();
  }

  // draw player if in race
  if (player) player.draw(showVectors);

  // draw other balls
  for(const b of balls) b.draw(showVectors);

  // HUD
  const sm = document.getElementById('smIndicator');
  if (sm) sm.style.display = (slowMotionTimer>0) ? 'inline-block' : 'none';
}

// Console debug prints (positions, velocities & state)
setInterval(()=>{
  console.clear();
  console.log(`--- Simulation debug (balls=${balls.length} obstacles=${obstacles.length}) ---`);
  balls.forEach((b,i)=> console.log(`ball ${i}: pos=(${b.pos.x.toFixed(1)},${b.pos.y.toFixed(1)}) vel=(${b.vel.x.toFixed(1)},${b.vel.y.toFixed(1)})`));
  if (player) console.log(`player: pos=(${player.pos.x.toFixed(1)},${player.pos.y.toFixed(1)}) vel=(${player.vel.x.toFixed(1)},${player.vel.y.toFixed(1)})`);
  console.log(`sound=${soundOn} trails=${trailsOn} slowMotion=${slowMotionTimer>0} timeScale=${timeScale.toFixed(2)} race=${gameState} progress=${Math.floor(raceProgress)}`);
}, 1000);

// Kick off
requestAnimationFrame(step);

// --- Race Mode Variables & helpers ---
let gameState = 'idle'; // 'idle' | 'running' | 'finished' | 'crashed'
let player = null; // player ball
const obstacles = [];
const collectibles = []; // pink squares to collect for points
let obstacleTimer = 0;
let baseObstacleInterval = 700; // ms, will decrease with difficulty
let collectibleTimer = 0;
const COLLECTIBLE_INTERVAL = 900; // ms
const OBSTACLE_SPEED = 260; // px/s relative to screen (downwards)
const RACE_LENGTH = 4000; // distance to finish in px
let raceProgress = 0; // px progressed
let difficulty = 1; // increases as race progresses
let raceScore = 0; // points earned in race

// Pattern generation
let patternQueue = []; // upcoming obstacle patterns
let patternType = 0; // cycles through different pattern types
const PATTERN_TYPES = {
  LANES: 0,        // 2-3 obstacles in fixed lanes with gap
  ALTERNATING: 1,  // left-right-left pattern
  SQUEEZE: 2,      // obstacles on sides with narrow gap in middle
  WALLS: 3         // dense obstacles with single gap
};

const startBtn = document.getElementById('startRace');
const restartBtn = document.getElementById('restartRace');
const raceHUD = document.getElementById('raceHUD');
const raceStatus = document.getElementById('raceStatus');
const raceProgressEl = document.getElementById('raceProgress');
const raceScoreEl = document.getElementById('raceScore');

startBtn.addEventListener('click', ()=>{
  if (gameState === 'idle' || gameState === 'finished' || gameState === 'crashed') startRace();
});
restartBtn.addEventListener('click', ()=>{
  resetRace();
  startRace();
});

function startRace(){
  // remove non-player balls to reduce noise
  balls.length = 0;
  obstacles.length = 0;
  collectibles.length = 0;
  patternQueue.length = 0;
  player = new Ball(width/2, height - 90, 32, '#6ef');
  // small dampening to keep it responsive
  player.mass = 1.0;
  gameState = 'running';
  raceProgress = 0;
  raceScore = 0;
  obstacleTimer = 0;
  collectibleTimer = 0;
  difficulty = 1;
  patternType = 0;
  baseObstacleInterval = 700;
  startBtn.style.display = 'none';
  restartBtn.style.display = 'inline-block';
  raceHUD.style.display = 'block';
  raceStatus.textContent = 'Racing';
  setTimeout(()=>{
    // focus audio unlocking by user gesture
    if (soundOn) ensureAudioContext();
  },50);
}

function resetRace(){
  gameState = 'idle';
  player = null;
  obstacles.length = 0;
  startBtn.style.display = 'inline-block';
  restartBtn.style.display = 'none';
  raceHUD.style.display = 'none';
  raceStatus.textContent = 'Ready';
}

// Pattern generation helpers
function generatePattern(){
  const pattern = [];
  const type = patternType % 4;
  const minGap = 70 + difficulty*15; // safe gap size
  
  switch(type){
    case PATTERN_TYPES.LANES: { // 2-3 obstacles with gaps
      const numObs = 2 + Math.floor(difficulty*0.5);
      const spacing = width / (numObs + 1);
      for(let i=0;i<numObs;i++){
        pattern.push({ x: spacing * (i+1), r: 14 + Math.random()*8 });
      }
      break;
    }
    case PATTERN_TYPES.ALTERNATING: { // left-right-left
      const gap = width * 0.3;
      pattern.push({ x: width*0.25, r: 16 });
      pattern.push({ x: width*0.75, r: 16 });
      break;
    }
    case PATTERN_TYPES.SQUEEZE: { // tight sides, safe middle
      pattern.push({ x: width*0.15, r: 18 });
      pattern.push({ x: width*0.85, r: 18 });
      break;
    }
    case PATTERN_TYPES.WALLS: { // many small obstacles, one gap
      const gapPos = 0.3 + Math.random()*0.4; // gap location
      const obsCount = 3 + Math.floor(difficulty);
      for(let i=0;i<obsCount;i++){
        const xNorm = i / obsCount;
        if (Math.abs(xNorm - gapPos) > 0.12){ // not in gap
          pattern.push({ x: xNorm * width, r: 10 + Math.random()*6 });
        }
      }
      break;
    }
  }
  
  patternType++;
  return pattern;
}

function spawnObstacle(){
  // pull from pattern queue, or generate new pattern if empty
  if (patternQueue.length === 0){
    const newPattern = generatePattern();
    patternQueue = newPattern.slice();
  }
  
  if (patternQueue.length === 0) return;
  const obs = patternQueue.shift();
  const y = -50;
  const speed = OBSTACLE_SPEED * (0.95 + Math.random()*0.3) * (1 + (difficulty-1)*0.15);
  obstacles.push({
    x: obs.x,
    y: y,
    r: obs.r,
    vx: 0,
    vy: speed,
    color: '#f55'
  });
}

function drawObstacle(o){
  ctx.beginPath();
  ctx.fillStyle = o.color;
  ctx.arc(o.x, o.y, o.r, 0, Math.PI*2);
  ctx.fill();
  ctx.closePath();
}

class Collectible{
  constructor(x, y, w=24, h=24){
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.color = '#ff88ff'; // pink
    this.collected = false;
  }
  draw(){
    if (this.collected) return;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);
    // glowing border
    ctx.strokeStyle = '#ffaaff';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);
  }
  collidesWith(ballPos, ballRadius){
    const closestX = Math.max(this.x - this.w/2, Math.min(ballPos.x, this.x + this.w/2));
    const closestY = Math.max(this.y - this.h/2, Math.min(ballPos.y, this.y + this.h/2));
    const dx = ballPos.x - closestX;
    const dy = ballPos.y - closestY;
    return (dx*dx + dy*dy) < (ballRadius*ballRadius);
  }
}

function spawnCollectible(){
  const x = Math.random() * (width - 40) + 20;
  const y = -30;
  collectibles.push(new Collectible(x, y, 24, 24));
}

function endRace(success){
  if (success){
    gameState = 'finished';
    raceStatus.textContent = 'Finished!';
    playCollisionSound(0.4);
    showFinish('You Win!');
  } else {
    gameState = 'crashed';
    raceStatus.textContent = 'Crashed';
    playCollisionSound(1.0);
    showFinish('Crashed');
  }
}

function showFinish(text){
  let el = document.getElementById('finishOverlay');
  if (!el){
    el = document.createElement('div'); el.id = 'finishOverlay'; el.innerText = text; document.body.appendChild(el);
  } else { el.innerText = text; el.style.display = 'flex'; }
  setTimeout(()=>{ if (el) el.style.display = 'none'; }, 1400);
}

// expose for debugging
window.sim = Object.assign(window.sim || {}, { startRace, resetRace, obstacles, player });

// --- Modified pointer handling for race control ---
// when race running, pointer controls player target; reuse active pointer object
const PLAYER_FOLLOW_SPEED = 28; // higher -> snappier

// adjust pointer handlers when race is active
// pointerdown already sets 'active' object; modify pointermove handler below to move player when gameState==='running'

