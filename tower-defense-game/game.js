// 游戏状态
let gameState = {
    level: 1,
    lives: 10,
    money: 100,
    score: 0,
    currentWave: 0,
    isPlaying: false,
    isPaused: false,
    selectedTowerType: 'basic',
    gameOver: false
};

// 游戏元素
let canvas, ctx;
let towers = [];
let enemies = [];
let bullets = [];
let particles = [];

// 游戏配置
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GRID_SIZE = 40;

// 炮塔类型配置
const TOWER_TYPES = {
    basic: {
        cost: 20,
        damage: 25,
        range: 150,
        fireRate: 1000,
        color: '#4facfe',
        name: '基础炮塔'
    },
    heavy: {
        cost: 50,
        damage: 75,
        range: 120,
        fireRate: 1500,
        color: '#ff4757',
        name: '重炮塔'
    },
    rapid: {
        cost: 35,
        damage: 15,
        range: 180,
        fireRate: 400,
        color: '#ffa502',
        name: '速射炮塔'
    }
};

// 关卡配置
const LEVELS = [
    {
        name: '简单关卡',
        waves: 5,
        enemyCount: [8, 10, 12, 15, 20],
        enemyHealth: [30, 35, 40, 45, 50],
        enemySpeed: [1, 1.2, 1.4, 1.6, 1.8],
        enemyReward: [5, 6, 7, 8, 10],
        spawnInterval: 2000
    },
    {
        name: '中等关卡',
        waves: 6,
        enemyCount: [15, 20, 25, 30, 35, 40],
        enemyHealth: [50, 60, 70, 80, 90, 100],
        enemySpeed: [1.5, 1.8, 2.0, 2.2, 2.4, 2.6],
        enemyReward: [8, 10, 12, 15, 18, 20],
        spawnInterval: 1500
    },
    {
        name: '困难关卡',
        waves: 8,
        enemyCount: [20, 25, 30, 35, 40, 45, 50, 60],
        enemyHealth: [80, 100, 120, 140, 160, 180, 200, 250],
        enemySpeed: [2.0, 2.3, 2.6, 2.9, 3.2, 3.5, 3.8, 4.0],
        enemyReward: [12, 15, 18, 22, 25, 28, 32, 40],
        spawnInterval: 1200
    }
];

// 路径配置
const PATHS = [
    // 第一关 - 简单路径
    [
        {x: 0, y: 300},
        {x: 200, y: 300},
        {x: 200, y: 150},
        {x: 600, y: 150},
        {x: 600, y: 450},
        {x: 800, y: 450}
    ],
    // 第二关 - 曲折路径
    [
        {x: 0, y: 100},
        {x: 150, y: 100},
        {x: 150, y: 300},
        {x: 400, y: 300},
        {x: 400, y: 100},
        {x: 650, y: 100},
        {x: 650, y: 500},
        {x: 800, y: 500}
    ],
    // 第三关 - 复杂路径
    [
        {x: 0, y: 200},
        {x: 100, y: 200},
        {x: 100, y: 400},
        {x: 300, y: 400},
        {x: 300, y: 100},
        {x: 500, y: 100},
        {x: 500, y: 350},
        {x: 700, y: 350},
        {x: 700, y: 200},
        {x: 800, y: 200}
    ]
];

// 炮塔类
class Tower {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.config = TOWER_TYPES[type];
        this.lastFired = 0;
        this.target = null;
        this.angle = 0;
    }

    update() {
        this.findTarget();
        this.fire();
    }

    findTarget() {
        let closestEnemy = null;
        let closestDistance = Infinity;

        for (let enemy of enemies) {
            const distance = Math.sqrt(
                Math.pow(enemy.x - this.x, 2) + 
                Math.pow(enemy.y - this.y, 2)
            );
            
            if (distance <= this.config.range && distance < closestDistance) {
                closestDistance = distance;
                closestEnemy = enemy;
            }
        }

        this.target = closestEnemy;
        
        if (this.target) {
            this.angle = Math.atan2(
                this.target.y - this.y,
                this.target.x - this.x
            );
        }
    }

    fire() {
        if (this.target && Date.now() - this.lastFired > this.config.fireRate) {
            bullets.push(new Bullet(
                this.x, this.y, 
                this.target.x, this.target.y,
                this.config.damage
            ));
            this.lastFired = Date.now();
        }
    }

    draw() {
        // 绘制炮塔基座
        ctx.fillStyle = this.config.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
        ctx.fill();

        // 绘制炮管
        ctx.strokeStyle = this.config.color;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(
            this.x + Math.cos(this.angle) * 25,
            this.y + Math.sin(this.angle) * 25
        );
        ctx.stroke();

        // 绘制范围（仅当鼠标悬停时）
        if (this.showRange) {
            ctx.strokeStyle = 'rgba(79, 172, 254, 0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.config.range, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

// 敌人类
class Enemy {
    constructor(path, health, speed, reward) {
        this.path = path;
        this.pathIndex = 0;
        this.x = path[0].x;
        this.y = path[0].y;
        this.maxHealth = health;
        this.health = health;
        this.speed = speed;
        this.reward = reward;
        this.progress = 0;
    }

    update() {
        this.move();
    }

    move() {
        if (this.pathIndex < this.path.length - 1) {
            const current = this.path[this.pathIndex];
            const next = this.path[this.pathIndex + 1];
            
            const dx = next.x - current.x;
            const dy = next.y - current.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                const moveX = (dx / distance) * this.speed;
                const moveY = (dy / distance) * this.speed;
                
                this.x += moveX;
                this.y += moveY;
                
                // 检查是否到达下一个路径点
                const remainingDistance = Math.sqrt(
                    Math.pow(next.x - this.x, 2) + 
                    Math.pow(next.y - this.y, 2)
                );
                
                if (remainingDistance < this.speed) {
                    this.pathIndex++;
                    if (this.pathIndex < this.path.length) {
                        this.x = this.path[this.pathIndex].x;
                        this.y = this.path[this.pathIndex].y;
                    }
                }
            }
        }
    }

    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            this.destroy();
            return true;
        }
        return false;
    }

    destroy() {
        gameState.money += this.reward;
        gameState.score += this.reward * 2;
        
        // 创建爆炸粒子效果
        for (let i = 0; i < 5; i++) {
            particles.push(new Particle(this.x, this.y));
        }
    }

    hasEscaped() {
        return this.pathIndex >= this.path.length - 1 && 
               this.x >= CANVAS_WIDTH;
    }

    draw() {
        // 绘制敌人
        ctx.fillStyle = this.getHealthColor();
        ctx.beginPath();
        ctx.arc(this.x, this.y, 15, 0, Math.PI * 2);
        ctx.fill();

        // 绘制血条
        const barWidth = 30;
        const barHeight = 6;
        const healthPercent = this.health / this.maxHealth;
        
        ctx.fillStyle = '#ff4757';
        ctx.fillRect(this.x - barWidth/2, this.y - 25, barWidth, barHeight);
        
        ctx.fillStyle = '#2ed573';
        ctx.fillRect(this.x - barWidth/2, this.y - 25, barWidth * healthPercent, barHeight);
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - barWidth/2, this.y - 25, barWidth, barHeight);
    }

    getHealthColor() {
        const healthPercent = this.health / this.maxHealth;
        if (healthPercent > 0.7) return '#2ed573';
        if (healthPercent > 0.4) return '#ffa502';
        return '#ff4757';
    }
}

// 子弹类
class Bullet {
    constructor(x, y, targetX, targetY, damage) {
        this.x = x;
        this.y = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.damage = damage;
        this.speed = 8;
        
        const dx = targetX - x;
        const dy = targetY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        this.vx = (dx / distance) * this.speed;
        this.vy = (dy / distance) * this.speed;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        
        // 检查碰撞
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            const distance = Math.sqrt(
                Math.pow(enemy.x - this.x, 2) + 
                Math.pow(enemy.y - this.y, 2)
            );
            
            if (distance < 20) {
                if (enemy.takeDamage(this.damage)) {
                    enemies.splice(i, 1);
                }
                return true; // 子弹命中，需要移除
            }
        }
        
        // 检查是否超出边界
        return this.x < 0 || this.x > CANVAS_WIDTH || 
               this.y < 0 || this.y > CANVAS_HEIGHT;
    }

    draw() {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#4facfe';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// 粒子类
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 30;
        this.maxLife = 30;
        this.color = `hsl(${Math.random() * 60 + 10}, 100%, 50%)`;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.life--;
        
        return this.life <= 0;
    }

    draw() {
        const alpha = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 游戏初始化
function initGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // 设置事件监听器
    setupEventListeners();
    
    // 开始游戏循环
    gameLoop();
}

// 设置事件监听器
function setupEventListeners() {
    // 画布点击事件
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    
    // 炮塔选择按钮
    document.querySelectorAll('.tower-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            gameState.selectedTowerType = btn.dataset.type;
        });
    });
    
    // 游戏控制按钮
    document.getElementById('startWave').addEventListener('click', startWave);
    document.getElementById('nextLevel').addEventListener('click', nextLevel);
    document.getElementById('pauseGame').addEventListener('click', togglePause);
    document.getElementById('restartGame').addEventListener('click', restartGame);
}

// 处理画布点击
function handleCanvasClick(event) {
    if (gameState.isPaused || gameState.gameOver) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 检查是否可以建造炮塔
    if (canBuildTower(x, y)) {
        const towerType = gameState.selectedTowerType;
        const cost = TOWER_TYPES[towerType].cost;
        
        if (gameState.money >= cost) {
            towers.push(new Tower(x, y, towerType));
            gameState.money -= cost;
            updateUI();
        }
    }
}

// 处理鼠标移动
function handleMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 显示炮塔范围
    towers.forEach(tower => {
        const distance = Math.sqrt(
            Math.pow(tower.x - x, 2) + 
            Math.pow(tower.y - y, 2)
        );
        tower.showRange = distance < 30;
    });
}

// 检查是否可以建造炮塔
function canBuildTower(x, y) {
    // 检查是否与现有炮塔重叠
    for (let tower of towers) {
        const distance = Math.sqrt(
            Math.pow(tower.x - x, 2) + 
            Math.pow(tower.y - y, 2)
        );
        if (distance < 50) return false;
    }
    
    // 检查是否在路径上
    const path = PATHS[gameState.level - 1];
    for (let i = 0; i < path.length - 1; i++) {
        const point1 = path[i];
        const point2 = path[i + 1];
        
        const distance = distanceToLine(x, y, point1.x, point1.y, point2.x, point2.y);
        if (distance < 40) return false;
    }
    
    return true;
}

// 计算点到线段的距离
function distanceToLine(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B);
    
    const param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

// 开始波次
function startWave() {
    if (gameState.isPlaying) return;
    
    const level = LEVELS[gameState.level - 1];
    if (gameState.currentWave >= level.waves) return;
    
    gameState.isPlaying = true;
    gameState.currentWave++;
    
    spawnEnemies();
    updateUI();
    
    document.getElementById('startWave').style.display = 'none';
}

// 生成敌人
function spawnEnemies() {
    const level = LEVELS[gameState.level - 1];
    const waveIndex = gameState.currentWave - 1;
    const path = PATHS[gameState.level - 1];
    
    const enemyCount = level.enemyCount[waveIndex];
    const enemyHealth = level.enemyHealth[waveIndex];
    const enemySpeed = level.enemySpeed[waveIndex];
    const enemyReward = level.enemyReward[waveIndex];
    
    let spawned = 0;
    const spawnInterval = setInterval(() => {
        if (spawned >= enemyCount) {
            clearInterval(spawnInterval);
            return;
        }
        
        enemies.push(new Enemy(path, enemyHealth, enemySpeed, enemyReward));
        spawned++;
    }, level.spawnInterval);
}

// 下一关
function nextLevel() {
    if (gameState.level >= LEVELS.length) {
        showGameOver('恭喜通关！', '你已经完成了所有关卡！');
        return;
    }
    
    gameState.level++;
    gameState.currentWave = 0;
    gameState.lives = 10;
    gameState.money += 50; // 关卡奖励
    
    // 清空游戏元素
    enemies = [];
    bullets = [];
    particles = [];
    
    updateUI();
    document.getElementById('nextLevel').style.display = 'none';
    document.getElementById('startWave').style.display = 'block';
}

// 切换暂停
function togglePause() {
    gameState.isPaused = !gameState.isPaused;
    const btn = document.getElementById('pauseGame');
    btn.textContent = gameState.isPaused ? '继续' : '暂停';
    
    if (gameState.isPaused) {
        document.querySelector('.game-container').classList.add('game-paused');
    } else {
        document.querySelector('.game-container').classList.remove('game-paused');
    }
}

// 重新开始游戏
function restartGame() {
    gameState = {
        level: 1,
        lives: 10,
        money: 100,
        score: 0,
        currentWave: 0,
        isPlaying: false,
        isPaused: false,
        selectedTowerType: 'basic',
        gameOver: false
    };
    
    // 清空游戏元素
    towers = [];
    enemies = [];
    bullets = [];
    particles = [];
    
    updateUI();
    closeModal();
    
    document.getElementById('startWave').style.display = 'block';
    document.getElementById('nextLevel').style.display = 'none';
    document.getElementById('pauseGame').textContent = '暂停';
    document.querySelector('.game-container').classList.remove('game-paused');
}

// 显示游戏结束
function showGameOver(title, message) {
    gameState.gameOver = true;
    document.getElementById('gameOverTitle').textContent = title;
    document.getElementById('gameOverMessage').textContent = message;
    document.getElementById('gameOverModal').style.display = 'block';
}

// 关闭模态框
function closeModal() {
    document.getElementById('gameOverModal').style.display = 'none';
}

// 更新UI
function updateUI() {
    document.getElementById('level').textContent = gameState.level;
    document.getElementById('lives').textContent = gameState.lives;
    document.getElementById('money').textContent = gameState.money;
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('currentWave').textContent = gameState.currentWave;
    document.getElementById('totalWaves').textContent = LEVELS[gameState.level - 1].waves;
    document.getElementById('remainingEnemies').textContent = enemies.length;
    
    // 更新炮塔按钮状态
    document.querySelectorAll('.tower-btn').forEach(btn => {
        const type = btn.dataset.type;
        const cost = TOWER_TYPES[type].cost;
        const canAfford = gameState.money >= cost;
        
        btn.disabled = !canAfford;
        btn.style.opacity = canAfford ? '1' : '0.5';
    });
}

// 游戏循环
function gameLoop() {
    if (!gameState.isPaused && !gameState.gameOver) {
        update();
    }
    draw();
    requestAnimationFrame(gameLoop);
}

// 更新游戏状态
function update() {
    // 更新炮塔
    towers.forEach(tower => tower.update());
    
    // 更新敌人
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update();
        
        // 检查是否逃脱
        if (enemy.hasEscaped()) {
            enemies.splice(i, 1);
            gameState.lives--;
            
            if (gameState.lives <= 0) {
                showGameOver('游戏失败！', '太多敌人逃脱了！');
                return;
            }
        }
    }
    
    // 更新子弹
    for (let i = bullets.length - 1; i >= 0; i--) {
        if (bullets[i].update()) {
            bullets.splice(i, 1);
        }
    }
    
    // 更新粒子
    for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].update()) {
            particles.splice(i, 1);
        }
    }
    
    // 检查波次结束
    if (gameState.isPlaying && enemies.length === 0) {
        gameState.isPlaying = false;
        const level = LEVELS[gameState.level - 1];
        
        if (gameState.currentWave >= level.waves) {
            // 关卡完成
            document.getElementById('nextLevel').style.display = 'block';
        } else {
            // 显示开始下一波按钮
            document.getElementById('startWave').style.display = 'block';
        }
    }
    
    updateUI();
}

// 绘制游戏
function draw() {
    // 清空画布
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 绘制路径
    drawPath();
    
    // 绘制炮塔
    towers.forEach(tower => tower.draw());
    
    // 绘制敌人
    enemies.forEach(enemy => enemy.draw());
    
    // 绘制子弹
    bullets.forEach(bullet => bullet.draw());
    
    // 绘制粒子
    particles.forEach(particle => particle.draw());
    
    // 绘制网格（可选）
    if (gameState.isPaused) {
        drawGrid();
    }
}

// 绘制路径
function drawPath() {
    const path = PATHS[gameState.level - 1];
    
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 40;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    
    ctx.stroke();
    
    // 绘制路径边框
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 44;
    ctx.stroke();
    
    // 绘制起点和终点
    ctx.fillStyle = '#2ed573';
    ctx.beginPath();
    ctx.arc(path[0].x, path[0].y, 25, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ff4757';
    ctx.beginPath();
    ctx.arc(path[path.length - 1].x, path[path.length - 1].y, 25, 0, Math.PI * 2);
    ctx.fill();
}

// 绘制网格
function drawGrid() {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
    }
    
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
    }
}

// 游戏启动
window.addEventListener('DOMContentLoaded', initGame); 