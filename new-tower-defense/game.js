// 游戏配置
const GAME_CONFIG = {
    canvas: {
        width: 800,
        height: 600
    },
    path: [
        {x: 0, y: 300},
        {x: 200, y: 300},
        {x: 200, y: 150},
        {x: 400, y: 150},
        {x: 400, y: 450},
        {x: 600, y: 450},
        {x: 600, y: 300},
        {x: 800, y: 300}
    ],
    towers: {
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
    },
    enemies: {
        basic: {
            health: 100,
            speed: 1,
            reward: 10,
            color: '#e74c3c',
            size: 15
        },
        fast: {
            health: 60,
            speed: 2,
            reward: 15,
            color: '#f39c12',
            size: 12
        },
        heavy: {
            health: 200,
            speed: 0.5,
            reward: 25,
            color: '#8e44ad',
            size: 20
        }
    },
    levels: {
        1: {
            name: '简单关卡',
            waves: 10,
            enemyTypes: ['basic'],
            enemyCount: [5, 8, 10, 12, 15, 18, 20, 25, 30, 35],
            spawnDelay: 1000,
            startMoney: 100,
            startLives: 20
        },
        2: {
            name: '中等关卡',
            waves: 12,
            enemyTypes: ['basic', 'fast'],
            enemyCount: [8, 12, 15, 18, 20, 25, 30, 35, 40, 45, 50, 60],
            spawnDelay: 800,
            startMoney: 80,
            startLives: 15
        },
        3: {
            name: '困难关卡',
            waves: 15,
            enemyTypes: ['basic', 'fast', 'heavy'],
            enemyCount: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80],
            spawnDelay: 600,
            startMoney: 60,
            startLives: 10
        }
    }
};

// 游戏状态管理
class GameState {
    constructor() {
        this.money = 100;
        this.lives = 20;
        this.wave = 1;
        this.level = 1;
        this.score = 0;
        this.gameRunning = false;
        this.gamePaused = false;
        this.gameOver = false;
        this.selectedTowerType = null;
        this.waveInProgress = false;
    }

    reset(level = 1) {
        const levelConfig = GAME_CONFIG.levels[level];
        this.money = levelConfig.startMoney;
        this.lives = levelConfig.startLives;
        this.wave = 1;
        this.level = level;
        this.score = 0;
        this.gameRunning = false;
        this.gamePaused = false;
        this.gameOver = false;
        this.selectedTowerType = null;
        this.waveInProgress = false;
    }

    canAfford(cost) {
        return this.money >= cost;
    }

    spendMoney(amount) {
        this.money -= amount;
    }

    earnMoney(amount) {
        this.money += amount;
    }

    loseLife() {
        this.lives--;
        if (this.lives <= 0) {
            this.gameOver = true;
        }
    }

    nextWave() {
        this.wave++;
        const levelConfig = GAME_CONFIG.levels[this.level];
        if (this.wave > levelConfig.waves) {
            return false; // 关卡完成
        }
        return true;
    }
}

// 炮塔类
class Tower {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.config = GAME_CONFIG.towers[type];
        this.lastFireTime = 0;
        this.target = null;
        this.level = 1;
    }

    canFire() {
        return Date.now() - this.lastFireTime > this.config.fireRate;
    }

    findTarget(enemies) {
        this.target = null;
        let closestDistance = Infinity;
        
        for (let enemy of enemies) {
            const distance = Math.sqrt(
                Math.pow(enemy.x - this.x, 2) + Math.pow(enemy.y - this.y, 2)
            );
            
            if (distance <= this.config.range && distance < closestDistance) {
                this.target = enemy;
                closestDistance = distance;
            }
        }
        
        return this.target;
    }

    fire() {
        if (this.target && this.canFire()) {
            this.lastFireTime = Date.now();
            return new Bullet(this.x, this.y, this.target, this.config.damage);
        }
        return null;
    }

    draw(ctx) {
        // 绘制射程圆圈（仅在选中时显示）
        if (this === game.selectedTower) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.config.range, 0, 2 * Math.PI);
            ctx.strokeStyle = 'rgba(79, 172, 254, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // 绘制炮塔
        ctx.fillStyle = this.config.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 15, 0, 2 * Math.PI);
        ctx.fill();
        
        // 绘制炮塔边框
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 绘制炮管
        if (this.target) {
            const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(angle);
            ctx.fillStyle = '#333';
            ctx.fillRect(0, -3, 20, 6);
            ctx.restore();
        }
    }
}

// 敌人类
class Enemy {
    constructor(type, path) {
        this.type = type;
        this.config = GAME_CONFIG.enemies[type];
        this.health = this.config.health;
        this.maxHealth = this.config.health;
        this.speed = this.config.speed;
        this.reward = this.config.reward;
        this.path = path;
        this.pathIndex = 0;
        this.x = path[0].x;
        this.y = path[0].y;
        this.alive = true;
    }

    update() {
        if (!this.alive || this.pathIndex >= this.path.length - 1) {
            return;
        }

        const target = this.path[this.pathIndex + 1];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.speed) {
            this.pathIndex++;
            if (this.pathIndex >= this.path.length - 1) {
                this.reachedEnd = true;
            }
        } else {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }
    }

    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            this.alive = false;
        }
    }

    draw(ctx) {
        if (!this.alive) return;

        // 绘制敌人
        ctx.fillStyle = this.config.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.config.size, 0, 2 * Math.PI);
        ctx.fill();

        // 绘制血条
        const barWidth = 30;
        const barHeight = 4;
        const healthPercent = this.health / this.maxHealth;
        
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - barWidth/2, this.y - this.config.size - 10, barWidth, barHeight);
        
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x - barWidth/2, this.y - this.config.size - 10, barWidth * healthPercent, barHeight);
    }
}

// 子弹类
class Bullet {
    constructor(x, y, target, damage) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.speed = 5;
        this.alive = true;
    }

    update() {
        if (!this.target || !this.target.alive) {
            this.alive = false;
            return;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.speed) {
            this.target.takeDamage(this.damage);
            this.alive = false;
        } else {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// 主游戏类
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = new GameState();
        this.towers = [];
        this.enemies = [];
        this.bullets = [];
        this.selectedTower = null;
        this.lastUpdateTime = 0;
        this.enemySpawnTimer = 0;
        this.currentWaveEnemies = 0;
        this.waveEnemiesSpawned = 0;
        
        this.initializeEventListeners();
        this.updateUI();
        this.gameLoop();
    }

    initializeEventListeners() {
        // 画布点击事件
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.handleCanvasClick(x, y);
        });

        // 炮塔选择按钮
        document.querySelectorAll('.tower-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectTowerType(btn.dataset.type);
            });
        });

        // 游戏控制按钮
        document.getElementById('startWave').addEventListener('click', () => {
            this.startWave();
        });

        document.getElementById('pauseGame').addEventListener('click', () => {
            this.togglePause();
        });

        document.getElementById('resetGame').addEventListener('click', () => {
            this.resetGame();
        });

        // 关卡选择按钮
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectLevel(parseInt(btn.dataset.level));
            });
        });

        // 重新开始按钮
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.hideModal();
            this.resetGame();
        });
    }

    handleCanvasClick(x, y) {
        // 检查是否点击了炮塔
        this.selectedTower = null;
        for (let tower of this.towers) {
            const distance = Math.sqrt(
                Math.pow(x - tower.x, 2) + Math.pow(y - tower.y, 2)
            );
            if (distance <= 15) {
                this.selectedTower = tower;
                return;
            }
        }

        // 如果选择了炮塔类型，尝试建造炮塔
        if (this.state.selectedTowerType) {
            this.buildTower(x, y, this.state.selectedTowerType);
        }
    }

    selectTowerType(type) {
        this.state.selectedTowerType = type;
        
        // 更新UI
        document.querySelectorAll('.tower-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        document.querySelector(`[data-type="${type}"]`).classList.add('selected');
    }

    buildTower(x, y, type) {
        const config = GAME_CONFIG.towers[type];
        
        // 检查是否有足够的金币
        if (!this.state.canAfford(config.cost)) {
            this.showMessage('金币不足！');
            return;
        }

        // 检查是否在路径上
        if (this.isOnPath(x, y)) {
            this.showMessage('不能在路径上建造炮塔！');
            return;
        }

        // 检查是否与其他炮塔重叠
        if (this.towerExists(x, y)) {
            this.showMessage('这里已经有炮塔了！');
            return;
        }

        // 建造炮塔
        this.state.spendMoney(config.cost);
        this.towers.push(new Tower(x, y, type));
        this.updateUI();
    }

    isOnPath(x, y) {
        const path = GAME_CONFIG.path;
        for (let i = 0; i < path.length - 1; i++) {
            const start = path[i];
            const end = path[i + 1];
            
            if (this.pointToLineDistance(x, y, start.x, start.y, end.x, end.y) < 30) {
                return true;
            }
        }
        return false;
    }

    pointToLineDistance(px, py, x1, y1, x2, y2) {
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

    towerExists(x, y) {
        for (let tower of this.towers) {
            const distance = Math.sqrt(
                Math.pow(x - tower.x, 2) + Math.pow(y - tower.y, 2)
            );
            if (distance < 40) {
                return true;
            }
        }
        return false;
    }

    startWave() {
        if (this.state.waveInProgress || this.state.gameOver) {
            return;
        }

        this.state.waveInProgress = true;
        this.state.gameRunning = true;
        
        const levelConfig = GAME_CONFIG.levels[this.state.level];
        this.currentWaveEnemies = levelConfig.enemyCount[this.state.wave - 1];
        this.waveEnemiesSpawned = 0;
        this.enemySpawnTimer = 0;
        
        this.updateUI();
    }

    spawnEnemy() {
        if (this.waveEnemiesSpawned >= this.currentWaveEnemies) {
            return;
        }

        const levelConfig = GAME_CONFIG.levels[this.state.level];
        const enemyTypes = levelConfig.enemyTypes;
        const randomType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        
        this.enemies.push(new Enemy(randomType, GAME_CONFIG.path));
        this.waveEnemiesSpawned++;
    }

    selectLevel(level) {
        if (this.state.gameRunning) {
            this.showMessage('游戏进行中不能切换关卡！');
            return;
        }

        this.state.reset(level);
        this.resetGame();
        
        // 更新UI
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelector(`[data-level="${level}"]`).classList.add('active');
        this.updateUI();
    }

    togglePause() {
        if (!this.state.gameRunning) return;
        
        this.state.gamePaused = !this.state.gamePaused;
        const pauseBtn = document.getElementById('pauseGame');
        pauseBtn.textContent = this.state.gamePaused ? '继续游戏' : '暂停游戏';
    }

    resetGame() {
        this.state.reset(this.state.level);
        this.towers = [];
        this.enemies = [];
        this.bullets = [];
        this.selectedTower = null;
        this.currentWaveEnemies = 0;
        this.waveEnemiesSpawned = 0;
        this.enemySpawnTimer = 0;
        
        this.updateUI();
    }

    updateUI() {
        document.getElementById('lives').textContent = this.state.lives;
        document.getElementById('money').textContent = this.state.money;
        document.getElementById('wave').textContent = this.state.wave;
        document.getElementById('level').textContent = this.state.level;
        
        // 更新炮塔按钮状态
        document.querySelectorAll('.tower-btn').forEach(btn => {
            const type = btn.dataset.type;
            const config = GAME_CONFIG.towers[type];
            const canAfford = this.state.canAfford(config.cost);
            btn.disabled = !canAfford;
            btn.style.opacity = canAfford ? '1' : '0.5';
        });
    }

    gameLoop() {
        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastUpdateTime;
        this.lastUpdateTime = currentTime;

        if (!this.state.gamePaused && this.state.gameRunning && !this.state.gameOver) {
            this.update(deltaTime);
        }

        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    update(deltaTime) {
        // 生成敌人
        if (this.state.waveInProgress && this.waveEnemiesSpawned < this.currentWaveEnemies) {
            this.enemySpawnTimer += deltaTime;
            const levelConfig = GAME_CONFIG.levels[this.state.level];
            
            if (this.enemySpawnTimer >= levelConfig.spawnDelay) {
                this.spawnEnemy();
                this.enemySpawnTimer = 0;
            }
        }

        // 更新敌人
        this.enemies = this.enemies.filter(enemy => {
            enemy.update();
            
            if (enemy.reachedEnd) {
                this.state.loseLife();
                return false;
            }
            
            if (!enemy.alive) {
                this.state.earnMoney(enemy.reward);
                return false;
            }
            
            return true;
        });

        // 炮塔攻击
        for (let tower of this.towers) {
            tower.findTarget(this.enemies);
            const bullet = tower.fire();
            if (bullet) {
                this.bullets.push(bullet);
            }
        }

        // 更新子弹
        this.bullets = this.bullets.filter(bullet => {
            bullet.update();
            return bullet.alive;
        });

        // 检查波次结束
        if (this.state.waveInProgress && 
            this.waveEnemiesSpawned >= this.currentWaveEnemies && 
            this.enemies.length === 0) {
            
            this.state.waveInProgress = false;
            
            if (this.state.nextWave()) {
                this.showMessage(`第 ${this.state.wave} 波准备就绪！`);
            } else {
                this.showWinModal();
            }
        }

        // 检查游戏结束
        if (this.state.gameOver) {
            this.showLoseModal();
        }

        this.updateUI();
    }

    draw() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制路径
        this.drawPath();

        // 绘制炮塔
        for (let tower of this.towers) {
            tower.draw(this.ctx);
        }

        // 绘制敌人
        for (let enemy of this.enemies) {
            enemy.draw(this.ctx);
        }

        // 绘制子弹
        for (let bullet of this.bullets) {
            bullet.draw(this.ctx);
        }

        // 绘制游戏状态信息
        if (this.state.gamePaused) {
            this.drawPauseOverlay();
        }
    }

    drawPath() {
        const path = GAME_CONFIG.path;
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 40;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(path[0].x, path[0].y);
        
        for (let i = 1; i < path.length; i++) {
            this.ctx.lineTo(path[i].x, path[i].y);
        }
        
        this.ctx.stroke();

        // 绘制路径边框
        this.ctx.strokeStyle = '#999';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    drawPauseOverlay() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('游戏暂停', this.canvas.width / 2, this.canvas.height / 2);
    }

    showMessage(message) {
        // 创建临时消息显示
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            font-size: 14px;
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 2000);
    }

    showWinModal() {
        document.getElementById('gameOverTitle').textContent = '胜利！';
        document.getElementById('gameOverMessage').textContent = `恭喜您完成了${GAME_CONFIG.levels[this.state.level].name}！`;
        document.getElementById('gameOverModal').style.display = 'block';
    }

    showLoseModal() {
        document.getElementById('gameOverTitle').textContent = '失败！';
        document.getElementById('gameOverMessage').textContent = `游戏结束，您坚持到了第 ${this.state.wave} 波！`;
        document.getElementById('gameOverModal').style.display = 'block';
    }

    hideModal() {
        document.getElementById('gameOverModal').style.display = 'none';
    }
}

// 初始化游戏
let game;
window.addEventListener('load', () => {
    game = new Game();
}); 