const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('startScreen');
const topLeftBar = document.getElementById('topLeftBar');
const rulesBtn = document.getElementById('rulesBtn');
const hardRestartBtn = document.getElementById('hardRestartBtn');
const infoPanel = document.getElementById('infoPanel');
const scoreEl = document.getElementById('scoreBoard');
const timerEl = document.getElementById('timerBoard');

// Modals
const roundOverModal = document.getElementById('roundOverModal');
const roundTitle = document.getElementById('roundTitle');
const finalScoreEl = document.getElementById('finalScore');
const shopModal = document.getElementById('shopModal');
const shopGrid = document.getElementById('shopGrid');
const rulesModal = document.getElementById('rulesModal');

// Buttons & Menus
const physicsMenu = document.getElementById('physicsMenu');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const demoInstruction = document.getElementById('demoInstruction');

// Controls
const ctrlBasketball = document.getElementById('ctrl-basketball');
const basketScoreEl = document.getElementById('basketScore');

// Spring Controls
const ctrlSpring = document.getElementById('ctrl-spring');
const springVal = document.getElementById('springVal');
const surfaceBtn = document.getElementById('surfaceBtn');

let width, height;

// --- Game State ---
let gameState = 'RACE'; 
let isGameStarted = false; // Controls the "Start Screen"
let isRaceActive = false;  // Controls the actual race round logic
let timeLeft = 20;
let score = 0;
let raceSpeed = 5;
let timerInterval = null;

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
let isDragging = false; 

// Basketball Vars
let basket = { x: 0, y: 0, w: 60, h: 5 };
let hoopScore = 0;
let floorLevel = 0; // Will be set in resize

// Spring Vars
let springSystem = {
    wallX: 50,
    floorY: 0,
    blockX: 200,
    blockY: 0,
    blockSize: 50,
    velocity: 0,
    k: 0.1, 
    equilibrium: 300, 
    isRough: false, 
    color: '#fab1a0',
    kControlY: 60 // Height of the touch control area for K
};

// --- Initialization ---
function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    floorLevel = height - 100; // Basketball floor level

    if (gameState === 'RACE') {
        player.y = height - 100;
        if(player.x === 0) player.x = width / 2;
        targetX = width / 2;
    }
    // Update Spring Floor
    springSystem.floorY = height / 2 + 100;
}
window.addEventListener('resize', resize);
resize();

// --- Main Start Function ---
window.startGame = function() {
    startScreen.style.display = 'none';
    isGameStarted = true;
    
    // Show UI
    topLeftBar.style.display = 'flex';
    rulesBtn.style.display = 'block';
    hardRestartBtn.style.display = 'block';
    infoPanel.style.display = 'block';
    
    resetGame();
};

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
            if (dist < 100) { 
                isDragging = true;
                ball.vx = 0; ball.vy = 0; 
            }
        }
    }
    else if (gameState === 'DEMO_SPRING') {
        // 1. Check Block Drag
        const b = springSystem;
        if (x > b.blockX && x < b.blockX + b.blockSize &&
            y > b.blockY && y < b.blockY + b.blockSize) {
            isDragging = true;
            b.velocity = 0;
        }
        // 2. Check K Control Bar Touch (Top Area)
        if (y < springSystem.kControlY + 20) {
            updateSpringK(x);
        }
    }
}

function handleInputMove(x, y) {
    mouse.x = x; mouse.y = y;
    if (gameState === 'RACE' && isGameStarted && isRaceActive) targetX = x;
    
    if (gameState === 'DEMO_SPRING') {
        // Block Drag
        if (isDragging) {
            springSystem.blockX = x - springSystem.blockSize/2;
            if(springSystem.blockX < springSystem.wallX + 10) springSystem.blockX = springSystem.wallX + 10;
        }
        // K Control Drag (if mouse is down and near top)
        if (mouse.isDown && y < springSystem.kControlY + 50) {
            updateSpringK(x);
        }
    }
}

function updateSpringK(inputX) {
    // Map X (0 to width) to K (0.01 to 0.5)
    let ratio = Math.max(0, Math.min(1, inputX / width));
    springSystem.k = 0.01 + (ratio * 0.49);
    springVal.innerText = springSystem.k.toFixed(2);
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
        if (isGameStarted) {
            updateRace();
        }
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
    
    // Only restart timer if we have passed the start screen
    if (isGameStarted) {
        isRaceActive = true;
        player.x = width / 2; targetX = width / 2;
        startTimer();
    }
}

// --- Basketball Logic ---

function initBasketball() {
    physicsObjects = [];
    hoopScore = 0;
    ctrlBasketball.style.display = 'block';
    basketScoreEl.innerText = "Hoops: 0";
    demoInstruction.innerText = "Drag forward to throw!";
    
    basket.x = width - 150; basket.y = height / 2;
    physicsObjects.push({ x: 150, y: floorLevel - 20, r: 20, vx: 0, vy: 0, color: '#ff9f43', isBasketball: true });
}

function shootBasketball() {
    const ball = physicsObjects[0];
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

    // Floor Collision (Using floorLevel)
    if (ball.y + ball.r > floorLevel) { 
        ball.y = floorLevel - ball.r; 
        ball.vy *= -0.7; 
        ball.vx *= 0.96; 
    }
    // Ceiling
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy *= -0.7; }
    // Walls
    if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx *= -0.7; }
    if (ball.x + ball.r > width) { ball.x = width - ball.r; ball.vx *= -0.7; }

    if (Math.abs(ball.vy) < 1 && ball.y > floorLevel - ball.r - 2) ball.vy = 0;

    if (ball.vy > 0 && ball.x > basket.x && ball.x < basket.x + basket.w && ball.y > basket.y && ball.y < basket.y + 20) {
        hoopScore++;
        basketScoreEl.innerText = "Hoops: " + hoopScore;
        ball.y += 15;
    }
}

function drawBasketball() {
    // 1. Draw Floor
    ctx.fillStyle = '#5d4037'; // Wood color
    ctx.fillRect(0, floorLevel, width, height - floorLevel);
    // Floor details
    ctx.fillStyle = '#795548';
    ctx.fillRect(0, floorLevel, width, 5);

    // 2. Basket
    ctx.fillStyle = '#eb4d4b'; ctx.fillRect(basket.x, basket.y, basket.w, basket.h);
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(basket.x, basket.y); ctx.lineTo(basket.x+15, basket.y+40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(basket.x+basket.w, basket.y); ctx.lineTo(basket.x+basket.w-15, basket.y+40); ctx.stroke();
    ctx.lineWidth = 1;

    const ball = physicsObjects[0];
    if (!ball) return;

    // Aim Line
    if (isDragging) {
        ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
        ctx.moveTo(ball.x, ball.y); 
        let dragX = mouse.x - mouse.startX; let dragY = mouse.y - mouse.startY;
        ctx.lineTo(ball.x + dragX, ball.y + dragY); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.fillStyle = 'white'; ctx.arc(ball.x + dragX, ball.y + dragY, 5, 0, Math.PI*2); ctx.fill();
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
    demoInstruction.innerText = "Drag block to move. Touch the top bar to change K.";
    
    springSystem.floorY = height / 2 + 100;
    springSystem.blockY = springSystem.floorY - springSystem.blockSize;
    springSystem.blockX = 300;
    springSystem.velocity = 0;
}

window.toggleSurface = function() {
    springSystem.isRough = !springSystem.isRough;
    surfaceBtn.innerText = springSystem.isRough ? "Surface: Rough (Wood)" : "Surface: Smooth (Ice)";
};

function updateSpring() {
    if (isDragging) return; 

    const s = springSystem;
    const eqPos = s.wallX + s.equilibrium;
    const displacement = s.blockX - eqPos;
    const forceSpring = -s.k * displacement;
    
    let friction = 0;
    if (s.isRough) friction = -s.velocity * 0.05; 
    else friction = -s.velocity * 0.001; 

    s.velocity += forceSpring + friction;
    s.blockX += s.velocity;
}

function drawSpring() {
    const s = springSystem;

    // Draw K Control Bar (Interactive Area)
    const barHeight = 40;
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, width, barHeight);
    
    // Draw Progress bar for K
    const kRatio = (s.k - 0.01) / 0.49; // Normalize 0-1
    ctx.fillStyle = '#0984e3';
    ctx.fillRect(0, 0, width * kRatio, barHeight);
    
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Spring Stiffness (k): ${s.k.toFixed(2)} - Touch here to adjust`, width/2, 25);


    // Table
    ctx.fillStyle = s.isRough ? '#8b4513' : '#a29bfe'; 
    ctx.fillRect(0, s.floorY, width, height - s.floorY);
    ctx.fillStyle = '#555'; ctx.fillRect(0, s.floorY - 200, s.wallX, 200);

    // Spring
    ctx.beginPath(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
    ctx.moveTo(s.wallX, s.floorY - s.blockSize/2);
    const segments = 20;
    const springLen = s.blockX - s.wallX;
    const segLen = springLen / segments;
    for(let i=1; i<=segments; i++) {
        let x = s.wallX + i * segLen;
        let y = (s.floorY - s.blockSize/2) + ((i%2===0) ? 10 : -10);
        if (i === segments) y = s.floorY - s.blockSize/2;
        ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Block
    ctx.fillStyle = s.color; ctx.fillRect(s.blockX, s.blockY, s.blockSize, s.blockSize);
    ctx.strokeStyle = 'white'; ctx.strokeRect(s.blockX, s.blockY, s.blockSize, s.blockSize);
}

// Don't auto-start race logic, but run loop
resetGame();
loop();