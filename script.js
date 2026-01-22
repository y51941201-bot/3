const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const scoreEl = document.getElementById('scoreBoard');
const timerEl = document.getElementById('timerBoard');
const infoPanel = document.getElementById('infoPanel');

// Modals
const roundOverModal = document.getElementById('roundOverModal');
const roundTitle = document.getElementById('roundTitle');
const finalScoreEl = document.getElementById('finalScore');
const shopModal = document.getElementById('shopModal');
const shopGrid = document.getElementById('shopGrid');
const rulesModal = document.getElementById('rulesModal');

// Buttons & Menus
const physicsMenu = document.getElementById('physicsMenu');
const topLeftBar = document.getElementById('topLeftBar');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const demoInstruction = document.getElementById('demoInstruction');
const hardRestartBtn = document.getElementById('hardRestartBtn');

// Controls
const ctrlBasketball = document.getElementById('ctrl-basketball');
const basketScoreEl = document.getElementById('basketScore');

// Spring Controls
const ctrlSpring = document.getElementById('ctrl-spring');
const springSlider = document.getElementById('springSlider');
const springVal = document.getElementById('springVal');
const surfaceBtn = document.getElementById('surfaceBtn');

let width, height;

// --- Game State & Economy ---
let gameState = 'RACE'; 
let timeLeft = 20;
let score = 0;
let raceSpeed = 5;
let timerInterval = null;
let isRaceActive = true; 

// Shop Data
const shopItems = [
    { id: 'rabbit', name: 'Speedy Rabbit', icon: '🐰', price: 300, color: '#ff9ff3' },
    { id: 'cat', name: 'Neon Cat', icon: '🐱', price: 600, color: '#feca57' },
    { id: 'dog', name: 'Cool Dog', icon: '🐶', price: 1000, color: '#54a0ff' }
];
let inventory = []; 

// Player Setup
const player = { x: 0, y: 0, r: 15, color: '#00ccff', defaultColor: '#00ccff', icon: '' };

// Race Objects
let obstacles = [];
let bonuses = [];
let targetX = 0;

// Physics Objects
let physicsObjects = []; 
let mouse = { x: 0, y: 0, isDown: false, startX: 0, startY: 0 };
let isDragging = false; // General drag flag

// Basketball Vars
let basket = { x: 0, y: 0, w: 60, h: 5 };
let hoopScore = 0;

// Spring Vars
let springSystem = {
    wallX: 50,
    floorY: 0,
    blockX: 200,
    blockY: 0,
    blockSize: 40,
    velocity: 0,
    k: 0.1, // Stiffness
    equilibrium: 300, // Rest length position
    isRough: false, // Surface material
    color: '#fab1a0'
};

// --- Initialization ---
function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    if (gameState === 'RACE') {
        player.y = height - 100;
        if(player.x === 0) player.x = width / 2;
        targetX = width / 2;
    }
}
window.addEventListener('resize', resize);
resize();

// --- Input Handling ---
canvas.addEventListener('mousedown', e => handleInputStart(e.clientX, e.clientY));
canvas.addEventListener('touchstart', e => handleInputStart(e.touches[0].clientX, e.touches[0].clientY), {passive: false});
window.addEventListener('mousemove', e => handleInputMove(e.clientX, e.clientY));
window.addEventListener('touchmove', e => { e.preventDefault(); handleInputMove(e.touches[0].clientX, e.touches[0].clientY); }, {passive: false});
window.addEventListener('mouseup', handleInputEnd);
window.addEventListener('touchend', handleInputEnd);

function handleInputStart(x, y) {
    mouse.x = x; mouse.y = y;
    mouse.startX = x; mouse.startY = y;
    mouse.isDown = true;

    if (gameState === 'DEMO_BASKETBALL') {
        const ball = physicsObjects[0];
        if (ball) {
            const dist = Math.sqrt((x - ball.x)**2 + (y - ball.y)**2);
            if (dist < 100) { // Large grab area
                isDragging = true;
                ball.vx = 0; ball.vy = 0; // Stop ball
            }
        }
    }
    else if (gameState === 'DEMO_SPRING') {
        // Check collision with block
        const b = springSystem;
        if (x > b.blockX && x < b.blockX + b.blockSize &&
            y > b.blockY && y < b.blockY + b.blockSize) {
            isDragging = true;
            b.velocity = 0;
        }
    }
}

function handleInputMove(x, y) {
    mouse.x = x; mouse.y = y;
    if (gameState === 'RACE' && isRaceActive) targetX = x;
    
    // Spring Dragging
    if (gameState === 'DEMO_SPRING' && isDragging) {
        springSystem.blockX = x - springSystem.blockSize/2;
        // Limit to prevent going behind wall
        if(springSystem.blockX < springSystem.wallX + 10) springSystem.blockX = springSystem.wallX + 10;
    }
}

function handleInputEnd() {
    if (gameState === 'DEMO_BASKETBALL' && isDragging) {
        shootBasketball();
    }
    isDragging = false;
    mouse.isDown = false;
}

// --- UI Logic ---
document.getElementById('physicsBtn').onclick = () => {
    gameState = 'MENU';
    physicsMenu.style.display = 'flex';
    topLeftBar.style.display = 'none';
    hardRestartBtn.style.display = 'none';
    infoPanel.style.display = 'none';
    pauseTimer();
};

document.getElementById('shopBtn').onclick = openShop;
document.getElementById('rulesBtn').onclick = () => rulesModal.style.display = 'block';
hardRestartBtn.onclick = resetGame;

window.closeRules = () => rulesModal.style.display = 'none';
window.closeShop = () => shopModal.style.display = 'none';
window.closeRoundOver = () => roundOverModal.style.display = 'none';

function openShop() {
    roundOverModal.style.display = 'none';
    shopModal.style.display = 'block';
    renderShop();
}

function renderShop() {
    shopGrid.innerHTML = '';
    shopItems.forEach(item => {
        const isOwned = inventory.includes(item.id);
        const canAfford = score >= item.price;
        const div = document.createElement('div');
        div.className = `shop-item ${isOwned ? 'owned' : ''}`;
        div.innerHTML = `
            <span class="shop-icon">${item.icon}</span>
            <span class="shop-name">${item.name}</span>
            <span class="shop-price">${isOwned ? 'OWNED' : item.price + ' pts'}</span>
        `;
        div.onclick = () => {
            if (isOwned) {
                player.color = item.color; player.icon = item.icon; renderShop();
            } else if (canAfford) {
                score -= item.price;
                inventory.push(item.id);
                scoreEl.innerText = "Score: " + score;
                player.color = item.color; player.icon = item.icon;
                renderShop();
            }
        };
        shopGrid.appendChild(div);
    });
}

window.startDemo = function(type) {
    gameState = 'DEMO_' + type.toUpperCase();
    physicsMenu.style.display = 'none';
    backToMenuBtn.style.display = 'block';
    
    if (type === 'basketball') initBasketball();
    if (type === 'spring') initSpring();
};

window.backToRace = function() {
    gameState = 'RACE';
    physicsMenu.style.display = 'none';
    topLeftBar.style.display = 'flex';
    hardRestartBtn.style.display = 'block';
    infoPanel.style.display = 'block';
    backToMenuBtn.style.display = 'none';
    hideControls();
    if (isRaceActive) startTimer();
};

window.openPhysicsMenu = function() {
    roundOverModal.style.display = 'none';
    gameState = 'MENU';
    physicsMenu.style.display = 'flex';
    backToMenuBtn.style.display = 'none';
    hideControls();
};

function hideControls() {
    ctrlBasketball.style.display = 'none';
    ctrlSpring.style.display = 'none';
    demoInstruction.innerText = "";
}

// --- Timer Logic ---
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (gameState === 'RACE' && isRaceActive) {
            timeLeft--;
            timerEl.innerText = "Time: " + timeLeft + "s";
            if (timeLeft <= 0) {
                endRound("TIME'S UP!");
            }
        }
    }, 1000);
}

function pauseTimer() { clearInterval(timerInterval); }

// --- Main Loop ---
function loop() {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    if (gameState === 'RACE') {
        updateRace();
        drawRace();
    } else if (gameState === 'DEMO_BASKETBALL') {
        updateBasketball();
        drawBasketball();
    } else if (gameState === 'DEMO_SPRING') {
        updateSpring();
        drawSpring();
    }
    requestAnimationFrame(loop);
}

// --- Race Logic ---
function spawnObjects() {
    if (!isRaceActive) return;
    if (Math.random() < 0.05) {
        const r = 15 + Math.random() * 20;
        obstacles.push({ x: Math.random()*(width-2*r)+r, y: -50, r: r, speed: raceSpeed + Math.random()*2 });
    }
    if (Math.random() < 0.04) {
        const size = 30;
        const hue = Math.random() * 360;
        const color = `hsl(${hue}, 100%, 50%)`;
        bonuses.push({ x: Math.random()*(width-size)+size/2, y: -50, size: size, speed: raceSpeed, color: color });
    }
}

function updateRace() {
    if (isRaceActive) {
        raceSpeed = 5 + (score * 0.002);
        player.x += (targetX - player.x) * 0.15;
        if (player.x < player.r) player.x = player.r;
        if (player.x > width - player.r) player.x = width - player.r;
        spawnObjects();
    }
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let o = obstacles[i]; o.y += o.speed;
        if (isRaceActive && Math.hypot(player.x - o.x, player.y - o.y) < player.r + o.r) {
            endRound("CRASHED!"); return;
        }
        if (o.y > height) obstacles.splice(i, 1);
    }
    for (let i = bonuses.length - 1; i >= 0; i--) {
        let b = bonuses[i]; b.y += b.speed;
        if (isRaceActive && player.x > b.x-b.size && player.x < b.x+b.size && player.y > b.y-b.size && player.y < b.y+b.size) {
            score += 50; scoreEl.innerText = "Score: " + score; player.color = b.color; bonuses.splice(i, 1);
        } else if (b.y > height) bonuses.splice(i, 1);
    }
}

function drawRace() {
    ctx.beginPath(); ctx.shadowBlur = 20; ctx.shadowColor = player.color; ctx.fillStyle = player.color;
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    if (player.icon) {
        ctx.fillStyle = "white"; ctx.font = "20px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(player.icon, player.x, player.y);
    }
    ctx.fillStyle = '#ff4444'; obstacles.forEach(o => { ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill(); });
    bonuses.forEach(b => { ctx.fillStyle = b.color; ctx.fillRect(b.x-b.size/2, b.y-b.size/2, b.size, b.size); });
}

function endRound(reason) {
    isRaceActive = false;
    pauseTimer();
    roundTitle.innerText = reason;
    finalScoreEl.innerText = "Final Score: " + score;
    roundOverModal.style.display = 'block';
}

function resetGame() {
    obstacles = []; bonuses = []; 
    score = 0; timeLeft = 20; inventory = []; 
    player.color = player.defaultColor; player.icon = '';
    scoreEl.innerText = "Score: 0";
    timerEl.innerText = "Time: 20s";
    roundOverModal.style.display = 'none';
    shopModal.style.display = 'none';
    rulesModal.style.display = 'none';
    isRaceActive = true;
    player.x = width / 2; targetX = width / 2;
    startTimer();
}

// --- Basketball Logic ---

function initBasketball() {
    physicsObjects = [];
    hoopScore = 0;
    ctrlBasketball.style.display = 'block';
    basketScoreEl.innerText = "Hoops: 0";
    demoInstruction.innerText = "Grab ball, drag forward to throw!";
    
    basket.x = width - 150; basket.y = height / 2;
    physicsObjects.push({ x: 150, y: height - 150, r: 20, vx: 0, vy: 0, color: '#ff9f43', isBasketball: true });
}

function shootBasketball() {
    const ball = physicsObjects[0];
    // Vector = End - Start (Drag Direction)
    const dx = mouse.x - mouse.startX;
    const dy = mouse.y - mouse.startY;
    
    const power = 0.15;
    let vx = dx * power; 
    let vy = dy * power; 
    
    const maxSpeed = 40; 
    const speed = Math.sqrt(vx*vx + vy*vy);
    if (speed > maxSpeed) { vx = (vx/speed)*maxSpeed; vy = (vy/speed)*maxSpeed; }

    ball.vx = vx; ball.vy = vy;
}

function updateBasketball() {
    const ball = physicsObjects[0];
    if (!ball || isDragging) return;

    ball.vy += 0.6; // Gravity
    ball.x += ball.vx; 
    ball.y += ball.vy;

    // Collisions
    if (ball.y + ball.r > height) { ball.y = height - ball.r; ball.vy *= -0.7; ball.vx *= 0.96; }
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy *= -0.7; }
    if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx *= -0.7; }
    if (ball.x + ball.r > width) { ball.x = width - ball.r; ball.vx *= -0.7; }

    // Stop rolling
    if (Math.abs(ball.vy) < 1 && ball.y > height - ball.r - 2) ball.vy = 0;

    // Hoop
    if (ball.vy > 0 && ball.x > basket.x && ball.x < basket.x + basket.w && ball.y > basket.y && ball.y < basket.y + 20) {
        hoopScore++;
        basketScoreEl.innerText = "Hoops: " + hoopScore;
        ball.y += 15;
    }
}

function drawBasketball() {
    ctx.fillStyle = '#eb4d4b'; ctx.fillRect(basket.x, basket.y, basket.w, basket.h);
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(basket.x, basket.y); ctx.lineTo(basket.x+15, basket.y+40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(basket.x+basket.w, basket.y); ctx.lineTo(basket.x+basket.w-15, basket.y+40); ctx.stroke();
    ctx.lineWidth = 1;

    const ball = physicsObjects[0];
    if (!ball) return;

    // Aim Line (Visualizing flight path)
    if (isDragging) {
        ctx.beginPath(); 
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; 
        ctx.lineWidth = 3;
        ctx.moveTo(ball.x, ball.y); 
        
        // Project current drag vector relative to ball
        let dragX = mouse.x - mouse.startX;
        let dragY = mouse.y - mouse.startY;
        
        ctx.lineTo(ball.x + dragX, ball.y + dragY); 
        ctx.stroke();
        ctx.lineWidth = 1;
        
        // Draw Arrow Head
        let endX = ball.x + dragX;
        let endY = ball.y + dragY;
        ctx.beginPath();
        ctx.fillStyle = 'white';
        ctx.arc(endX, endY, 5, 0, Math.PI*2);
        ctx.fill();
    }

    ctx.beginPath(); ctx.fillStyle = ball.color; ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#d35400'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ball.x-ball.r, ball.y); ctx.lineTo(ball.x+ball.r, ball.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ball.x, ball.y-ball.r); ctx.lineTo(ball.x, ball.y+ball.r); ctx.stroke();
    ctx.lineWidth = 1;
}

// --- Spring Logic ---

function initSpring() {
    ctrlSpring.style.display = 'block';
    demoInstruction.innerText = "Drag the block to stretch the spring.";
    
    springSystem.floorY = height / 2 + 100;
    springSystem.blockY = springSystem.floorY - springSystem.blockSize;
    springSystem.blockX = 300;
    springSystem.velocity = 0;
}

// Spring UI Controls
springSlider.oninput = function() {
    springSystem.k = this.value / 100; // 0.01 to 0.5
    springVal.innerText = springSystem.k;
};
window.toggleSurface = function() {
    springSystem.isRough = !springSystem.isRough;
    surfaceBtn.innerText = springSystem.isRough ? "Surface: Rough (Wood)" : "Surface: Smooth (Ice)";
};

function updateSpring() {
    if (isDragging) return; // User controlling block

    const s = springSystem;
    
    // Equilibrium check (Wall position + rest length)
    const eqPos = s.wallX + s.equilibrium;
    const displacement = s.blockX - eqPos;

    // Hooke's Law: F = -k * x
    const forceSpring = -s.k * displacement;
    
    // Friction
    let friction = 0;
    if (s.isRough) {
        // Simple friction opposing velocity
        friction = -s.velocity * 0.05; 
    } else {
        // Very minimal air resistance so it doesn't explode
        friction = -s.velocity * 0.001; 
    }

    // Acceleration (F=ma, assume m=1)
    const acceleration = forceSpring + friction;
    
    s.velocity += acceleration;
    s.blockX += s.velocity;
}

function drawSpring() {
    const s = springSystem;

    // 1. Draw Table
    ctx.fillStyle = s.isRough ? '#8b4513' : '#a29bfe'; // Brown for wood, Blue for ice
    ctx.fillRect(0, s.floorY, width, height - s.floorY);
    // Draw Wall
    ctx.fillStyle = '#555';
    ctx.fillRect(0, s.floorY - 200, s.wallX, 200);

    // 2. Draw Spring
    ctx.beginPath();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.moveTo(s.wallX, s.floorY - s.blockSize/2);
    
    // ZigZag pattern
    const segments = 20;
    const springLen = s.blockX - s.wallX;
    const segLen = springLen / segments;
    
    for(let i=1; i<=segments; i++) {
        let x = s.wallX + i * segLen;
        let y = (s.floorY - s.blockSize/2) + ((i%2===0) ? 10 : -10);
        if (i === segments) y = s.floorY - s.blockSize/2; // Align end
        ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 3. Draw Block
    ctx.fillStyle = s.color;
    ctx.fillRect(s.blockX, s.blockY, s.blockSize, s.blockSize);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(s.blockX, s.blockY, s.blockSize, s.blockSize);

    // 4. Equilibrium Line (Optional)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.setLineDash([5,5]);
    ctx.moveTo(s.wallX + s.equilibrium, s.floorY);
    ctx.lineTo(s.wallX + s.equilibrium, s.floorY - 150);
    ctx.stroke();
    ctx.setLineDash([]);
}

resetGame();
loop();