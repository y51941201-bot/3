const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('scoreBoard');
const gameOverScreen = document.getElementById('gameOverScreen');

let width, height;
let isGameOver = false;
let score = 0;
let gameSpeed = 5;

// --- 玩家小球设置 ---
const player = {
    x: 0,
    y: 0,
    r: 15,          // 半径
    color: '#00ccff' // 蓝色
};

// 存放物体
let obstacles = [];   // 红色障碍球
let bonuses = [];     // 绿色得分方块

// --- 1. 窗口尺寸初始化 ---
function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    player.y = height - 100; // 玩家固定在底部上方一点
    // 如果玩家还在原点，放到屏幕中间
    if(player.x === 0) player.x = width / 2;
}
window.addEventListener('resize', resize);
resize();

// --- 2. 鼠标/触摸 控制 ---
let targetX = width / 2; // 目标位置

function updateInput(clientX) {
    targetX = clientX;
}

// 电脑鼠标
window.addEventListener('mousemove', e => {
    if(!isGameOver) updateInput(e.clientX);
});

// 手机触摸
window.addEventListener('touchmove', e => {
    e.preventDefault(); 
    if(!isGameOver) updateInput(e.touches[0].clientX);
}, { passive: false });

// 点击重开游戏
window.addEventListener('mousedown', tryRestart);
window.addEventListener('touchstart', tryRestart);

function tryRestart() {
    if(isGameOver) {
        resetGame();
    }
}

// --- 3. 游戏核心逻辑 ---

function spawnObjects() {
    // 生成红色障碍球 (概率 3%)
    if (Math.random() < 0.03) {
        const r = 15 + Math.random() * 20; // 随机大小
        obstacles.push({
            x: Math.random() * (width - 2 * r) + r,
            y: -50,
            r: r,
            speed: gameSpeed + Math.random() * 2 // 速度略有不同
        });
    }

    // 生成绿色得分方块 (概率 2%)
    if (Math.random() < 0.02) {
        const size = 30;
        bonuses.push({
            x: Math.random() * (width - size) + size/2,
            y: -50,
            size: size,
            speed: gameSpeed
        });
    }
}

function update() {
    if (isGameOver) return;

    // 难度随分数增加
    gameSpeed = 5 + (score * 0.005);

    // 玩家平滑移动
    player.x += (targetX - player.x) * 0.15;
    
    // 防止跑出屏幕
    if (player.x < player.r) player.x = player.r;
    if (player.x > width - player.r) player.x = width - player.r;

    spawnObjects();

    // --- 更新障碍物 (红球) ---
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let o = obstacles[i];
        o.y += o.speed;

        // 碰撞检测 (圆心距离)
        const dx = player.x - o.x;
        const dy = player.y - o.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < player.r + o.r) {
            endGame(); // 撞到了，游戏结束
        }

        // 超出屏幕底部删除
        if (o.y > height + 50) obstacles.splice(i, 1);
    }

    // --- 更新得分物 (绿方块) ---
    for (let i = bonuses.length - 1; i >= 0; i--) {
        let b = bonuses[i];
        b.y += b.speed;

        // 碰撞检测 (矩形范围)
        if (
            player.x > b.x - b.size &&
            player.x < b.x + b.size &&
            player.y > b.y - b.size &&
            player.y < b.y + b.size
        ) {
            // 吃到分了
            score += 100;
            scoreEl.innerText = "Score: " + score;
            bonuses.splice(i, 1); // 移除该方块
            continue;
        }

        if (b.y > height + 50) bonuses.splice(i, 1);
    }
}

function draw() {
    // 1. 清空画布
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // 2. 画玩家 (蓝色发光球)
    ctx.beginPath();
    ctx.shadowBlur = 20;
    ctx.shadowColor = player.color;
    ctx.fillStyle = player.color;
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // 重置阴影

    // 3. 画障碍物 (红色球)
    ctx.fillStyle = '#ff4444';
    obstacles.forEach(o => {
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
    });

    // 4. 画得分物 (绿色方块)
    ctx.fillStyle = '#44ff44';
    bonuses.forEach(b => {
        ctx.fillRect(b.x - b.size/2, b.y - b.size/2, b.size, b.size);
    });
}

// --- 4. 循环与控制 ---

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

function endGame() {
    isGameOver = true;
    gameOverScreen.style.display = 'flex'; // 显示结束画面
}

function resetGame() {
    // 重置所有数据
    obstacles = [];
    bonuses = [];
    score = 0;
    gameSpeed = 5;
    scoreEl.innerText = "Score: 0";
    isGameOver = false;
    gameOverScreen.style.display = 'none'; // 隐藏结束画面
    
    // 重置玩家位置
    player.x = width / 2;
    targetX = width / 2;
}

// 启动！
resetGame();
loop();