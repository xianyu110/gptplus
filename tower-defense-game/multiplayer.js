// Socket.IO 连接
let socket = null;
let isConnected = false;
let currentPlayer = null;
let allPlayers = [];
let roomId = 'default';

// 游戏状态
let gameState = {
    level: 1,
    lives: 20,
    money: 150,
    score: 0,
    currentWave: 0,
    isPlaying: false,
    isPaused: false,
    selectedTowerType: 'basic', // 确保有默认值
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

// 网络连接初始化
function initSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        isConnected = true;
        updateConnectionStatus('connected', '已连接');
        
        // 自动加入默认房间
        socket.emit('joinRoom', roomId);
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        isConnected = false;
        updateConnectionStatus('disconnected', '连接断开');
    });
    
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        showError(error.message);
    });
    
    // 玩家加入房间
    socket.on('playerJoined', (data) => {
        console.log('Player joined:', data);
        currentPlayer = data.player;
        allPlayers = data.room.players;
        gameState = data.room.gameState;
        
        updatePlayerInfo();
        updatePlayersDisplay();
        updateUI();
    });
    
    // 其他玩家连接
    socket.on('playerConnected', (player) => {
        console.log('Player connected:', player);
        allPlayers.push(player);
        updatePlayersDisplay();
        addChatMessage('系统', `${player.name} 加入了游戏`, 'system');
    });
    
    // 玩家断开连接
    socket.on('playerDisconnected', (player) => {
        console.log('Player disconnected:', player);
        allPlayers = allPlayers.filter(p => p.id !== player.id);
        updatePlayersDisplay();
        addChatMessage('系统', `${player.name} 离开了游戏`, 'system');
    });
    
    // 游戏状态更新
    socket.on('gameState', (data) => {
        gameState = data.gameState;
        allPlayers = data.players;
        updateUI();
        updatePlayersDisplay();
    });
    
    // 炮塔建造
    socket.on('towerBuilt', (tower) => {
        console.log('Tower built:', tower);
        towers.push(new Tower(tower.x, tower.y, tower.type, tower.playerId));
        addChatMessage('系统', `${getPlayerName(tower.playerId)} 建造了${TOWER_TYPES[tower.type].name}`, 'system');
    });
    
    // 波次开始
    socket.on('waveStarted', (data) => {
        console.log('Wave started:', data);
        gameState.isPlaying = true;
        spawnEnemies();
        addChatMessage('系统', `第 ${data.wave} 波开始了！`, 'system');
    });
    
    // 游戏暂停
    socket.on('gamePaused', (isPaused) => {
        gameState.isPaused = isPaused;
        updateUI();
        const message = isPaused ? '游戏已暂停' : '游戏继续';
        addChatMessage('系统', message, 'system');
    });
    
    // 游戏重新开始
    socket.on('gameRestarted', () => {
        console.log('Game restarted');
        restartGame();
        addChatMessage('系统', '游戏重新开始', 'system');
    });
    
    // 玩家状态变化
    socket.on('playerStatusChanged', (player) => {
        const playerIndex = allPlayers.findIndex(p => p.id === player.id);
        if (playerIndex !== -1) {
            allPlayers[playerIndex] = player;
            updatePlayersDisplay();
        }
    });
    
    // 聊天消息
    socket.on('chatMessage', (data) => {
        addChatMessage(data.playerName, data.message, data.playerId === currentPlayer.id ? 'own' : 'other');
    });
    
    // 服务器关闭
    socket.on('serverShutdown', () => {
        showError('服务器正在关闭，请稍后重试');
    });
}

// 更新连接状态
function updateConnectionStatus(status, text) {
    const indicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    
    indicator.className = `status-indicator ${status}`;
    statusText.textContent = text;
}

// 更新玩家信息
function updatePlayerInfo() {
    if (!currentPlayer) return;
    
    const zoneDisplay = document.getElementById('zoneDisplay');
    const roomIdDisplay = document.getElementById('roomId');
    
    zoneDisplay.textContent = currentPlayer.zone.name;
    zoneDisplay.style.color = currentPlayer.zone.color;
    roomIdDisplay.textContent = roomId;
}

// 更新玩家显示
function updatePlayersDisplay() {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    
    allPlayers.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        
        if (currentPlayer && player.id === currentPlayer.id) {
            playerItem.classList.add('current-player');
        }
        
        if (player.ready) {
            playerItem.classList.add('ready');
        }
        
        playerItem.innerHTML = `
            <div class="player-avatar" style="background-color: ${player.zone.color}">
                ${player.id + 1}
            </div>
            <div class="player-info">
                <div class="player-name">${player.name}</div>
                <div class="player-zone">${player.zone.name}</div>
            </div>
            <div class="player-status ${player.ready ? 'ready' : ''}">
                ${player.ready ? '准备' : '等待'}
            </div>
        `;
        
        playersList.appendChild(playerItem);
    });
}

// 获取玩家名称
function getPlayerName(playerId) {
    const player = allPlayers.find(p => p.id === playerId);
    return player ? player.name : `玩家${playerId + 1}`;
}

// 炮塔类
class Tower {
    constructor(x, y, type, playerId) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.playerId = playerId;
        this.config = TOWER_TYPES[type];
        this.lastFired = 0;
        this.target = null;
        this.angle = 0;
        this.playerColor = allPlayers.find(p => p.id === playerId)?.zone.color || '#4facfe';
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
                this.config.damage,
                this.playerColor
            ));
            this.lastFired = Date.now();
        }
    }

    draw() {
        // 绘制炮塔基座
        ctx.fillStyle = this.playerColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
        ctx.fill();

        // 绘制炮管
        ctx.strokeStyle = this.playerColor;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(
            this.x + Math.cos(this.angle) * 25,
            this.y + Math.sin(this.angle) * 25
        );
        ctx.stroke();

        // 绘制玩家标识
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.playerId + 1, this.x, this.y + 4);

        // 绘制范围（仅当鼠标悬停时）
        if (this.showRange) {
            ctx.strokeStyle = this.playerColor + '50';
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
        
        for (let i = 0; i < 5; i++) {
            particles.push(new Particle(this.x, this.y));
        }
    }

    hasEscaped() {
        return this.pathIndex >= this.path.length - 1 && 
               this.x >= CANVAS_WIDTH;
    }

    draw() {
        ctx.fillStyle = this.getHealthColor();
        ctx.beginPath();
        ctx.arc(this.x, this.y, 15, 0, Math.PI * 2);
        ctx.fill();

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
    constructor(x, y, targetX, targetY, damage, color = '#fff') {
        this.x = x;
        this.y = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.damage = damage;
        this.color = color;
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
                return true;
            }
        }
        
        return this.x < 0 || this.x > CANVAS_WIDTH || 
               this.y < 0 || this.y > CANVAS_HEIGHT;
    }

    draw() {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = this.color;
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
    
    // 确保默认选中基础炮塔
    const basicTowerBtn = document.getElementById('basicTower');
    if (basicTowerBtn) {
        basicTowerBtn.classList.add('selected');
        gameState.selectedTowerType = 'basic';
    }
    
    setupEventListeners();
    initSocket();
    gameLoop();
}

// 设置事件监听器
function setupEventListeners() {
    // 画布事件
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    
    // 炮塔选择
    document.querySelectorAll('.tower-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            const towerType = btn.dataset.type;
            if (TOWER_TYPES[towerType]) {
                gameState.selectedTowerType = towerType;
            } else {
                console.error('无效的炮塔类型:', towerType);
                gameState.selectedTowerType = 'basic'; // 回退到默认值
            }
        });
    });
    
    // 游戏控制
    document.getElementById('startWave').addEventListener('click', () => {
        if (socket) socket.emit('startWave');
    });
    
    document.getElementById('pauseGame').addEventListener('click', () => {
        if (socket) socket.emit('pauseGame');
    });
    
    document.getElementById('restartGame').addEventListener('click', () => {
        if (socket) socket.emit('restartGame');
    });
    
    document.getElementById('playerReady').addEventListener('click', () => {
        if (socket && currentPlayer) {
            currentPlayer.ready = !currentPlayer.ready;
            socket.emit('playerReady', currentPlayer.ready);
            updateReadyButton();
        }
    });
    
    // 聊天功能
    document.getElementById('sendChat').addEventListener('click', sendChatMessage);
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    
    // 房间管理
    document.getElementById('joinRoom').addEventListener('click', () => {
        const newRoomId = document.getElementById('roomInput').value.trim();
        if (newRoomId && newRoomId !== roomId) {
            roomId = newRoomId;
            if (socket) {
                socket.emit('joinRoom', roomId);
            }
        }
    });
}

// 处理画布点击
function handleCanvasClick(event) {
    if (gameState.isPaused || gameState.gameOver || !currentPlayer) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 检查是否在当前玩家的区域内
    if (canBuildTower(x, y)) {
        const towerType = gameState.selectedTowerType || 'basic'; // 默认值
        
        // 检查炮塔类型是否有效
        if (!TOWER_TYPES[towerType]) {
            showError('无效的炮塔类型');
            return;
        }
        
        const cost = TOWER_TYPES[towerType].cost;
        
        if (gameState.money >= cost) {
            // 发送建造请求到服务器
            socket.emit('buildTower', {
                x: x,
                y: y,
                towerType: towerType,
                cost: cost
            });
        } else {
            showError('金币不足');
        }
    } else {
        showError('只能在您的区域内建造炮塔');
    }
}

// 检查是否可以建造炮塔
function canBuildTower(x, y) {
    if (!currentPlayer) return false;
    
    const zone = currentPlayer.zone;
    const inZone = x >= zone.x && x <= zone.x + zone.width &&
                  y >= zone.y && y <= zone.y + zone.height;
    
    if (!inZone) return false;
    
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
    
    // 更新鼠标样式
    if (currentPlayer && canBuildTower(x, y)) {
        canvas.style.cursor = 'crosshair';
    } else {
        canvas.style.cursor = 'default';
    }
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

// 聊天功能
function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (message && socket) {
        socket.emit('chatMessage', message);
        input.value = '';
    }
}

function addChatMessage(sender, message, type = 'other') {
    const messagesContainer = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    
    messageElement.className = `chat-message ${type}`;
    
    const time = new Date().toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageElement.innerHTML = `
        <div class="sender">${sender}</div>
        <div class="message">${message}</div>
        <div class="timestamp">${time}</div>
    `;
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 更新准备按钮
function updateReadyButton() {
    const readyBtn = document.getElementById('playerReady');
    if (currentPlayer && currentPlayer.ready) {
        readyBtn.textContent = '取消准备';
        readyBtn.classList.add('ready');
    } else {
        readyBtn.textContent = '准备';
        readyBtn.classList.remove('ready');
    }
}

// 显示错误
function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorModal').style.display = 'block';
}

function closeErrorModal() {
    document.getElementById('errorModal').style.display = 'none';
}

// 游戏重新开始
function restartGame() {
    gameState = {
        level: 1,
        lives: 20,
        money: 150,
        score: 0,
        currentWave: 0,
        isPlaying: false,
        isPaused: false,
        selectedTowerType: 'basic', // 确保重置为默认值
        gameOver: false
    };
    
    towers = [];
    enemies = [];
    bullets = [];
    particles = [];
    
    updateUI();
    closeModal();
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
        
        if (enemy.hasEscaped()) {
            enemies.splice(i, 1);
            gameState.lives--;
            
            if (gameState.lives <= 0) {
                gameState.gameOver = true;
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
            addChatMessage('系统', '关卡完成！', 'system');
        }
    }
    
    updateUI();
}

// 绘制游戏
function draw() {
    // 清空画布
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 绘制玩家区域
    drawPlayerZones();
    
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
}

// 绘制玩家区域
function drawPlayerZones() {
    allPlayers.forEach(player => {
        const zone = player.zone;
        const isCurrentPlayer = currentPlayer && player.id === currentPlayer.id;
        
        // 绘制区域背景
        ctx.fillStyle = zone.color + (isCurrentPlayer ? '20' : '10');
        ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
        
        // 绘制区域边框
        ctx.strokeStyle = zone.color;
        ctx.lineWidth = isCurrentPlayer ? 3 : 1;
        ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
        
        // 绘制玩家标签
        ctx.fillStyle = zone.color;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            player.name,
            zone.x + zone.width / 2,
            zone.y + 20
        );
    });
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

// 显示游戏结束
function showGameOver(title, message) {
    document.getElementById('gameOverTitle').textContent = title;
    document.getElementById('gameOverMessage').textContent = message;
    document.getElementById('gameOverModal').style.display = 'block';
}

// 关闭模态框
function closeModal() {
    document.getElementById('gameOverModal').style.display = 'none';
}

// 全局函数（供HTML调用）
window.restartGame = restartGame;
window.closeModal = closeModal;
window.closeErrorModal = closeErrorModal;

// 游戏启动
window.addEventListener('DOMContentLoaded', initGame); 