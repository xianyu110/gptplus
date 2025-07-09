const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 静态文件服务
app.use(express.static(path.join(__dirname, '.')));

// 游戏房间管理
const rooms = new Map();
const MAX_PLAYERS = 4; // 最大4人游戏

// 玩家区域配置（每个玩家的建造区域）
const PLAYER_ZONES = [
    { id: 0, name: '左上角', x: 0, y: 0, width: 200, height: 200, color: '#4facfe' },
    { id: 1, name: '右上角', x: 600, y: 0, width: 200, height: 200, color: '#ff4757' },
    { id: 2, name: '左下角', x: 0, y: 400, width: 200, height: 200, color: '#2ed573' },
    { id: 3, name: '右下角', x: 600, y: 400, width: 200, height: 200, color: '#ffa502' }
];

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

// 游戏配置
const LEVELS = [
    {
        waves: 5,
        enemyCount: [10, 15, 20, 25, 30],
        enemyHealth: [100, 150, 200, 250, 300],
        enemySpeed: [1, 1.2, 1.5, 1.8, 2],
        enemyReward: [10, 12, 15, 18, 20],
        spawnInterval: 1000
    },
    {
        waves: 5,
        enemyCount: [15, 20, 25, 30, 35],
        enemyHealth: [150, 200, 250, 300, 400],
        enemySpeed: [1.2, 1.5, 1.8, 2, 2.5],
        enemyReward: [15, 18, 20, 25, 30],
        spawnInterval: 800
    },
    {
        waves: 5,
        enemyCount: [20, 25, 30, 35, 40],
        enemyHealth: [200, 250, 300, 400, 500],
        enemySpeed: [1.5, 1.8, 2, 2.5, 3],
        enemyReward: [20, 25, 30, 35, 40],
        spawnInterval: 600
    }
];

const PATHS = [
    [
        { x: 0, y: 150 },
        { x: 200, y: 150 },
        { x: 200, y: 250 },
        { x: 400, y: 250 },
        { x: 400, y: 100 },
        { x: 600, y: 100 },
        { x: 600, y: 300 },
        { x: 800, y: 300 }
    ],
    [
        { x: 0, y: 100 },
        { x: 150, y: 100 },
        { x: 150, y: 300 },
        { x: 350, y: 300 },
        { x: 350, y: 150 },
        { x: 550, y: 150 },
        { x: 550, y: 350 },
        { x: 750, y: 350 },
        { x: 750, y: 200 },
        { x: 800, y: 200 }
    ],
    [
        { x: 0, y: 200 },
        { x: 100, y: 200 },
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 300 },
        { x: 500, y: 300 },
        { x: 500, y: 150 },
        { x: 700, y: 150 },
        { x: 700, y: 350 },
        { x: 800, y: 350 }
    ]
];

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
        this.id = Date.now() + Math.random();
    }

    update(enemies, bullets, currentTime) {
        this.findTarget(enemies);
        this.fire(bullets, currentTime);
    }

    findTarget(enemies) {
        let closestEnemy = null;
        let closestDistance = Infinity;

        for (let enemy of enemies) {
            if (enemy.isDead) continue;
            
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

    fire(bullets, currentTime) {
        if (this.target && currentTime - this.lastFired > this.config.fireRate) {
            bullets.push(new Bullet(
                this.x, this.y, 
                this.target.x, this.target.y,
                this.config.damage,
                this.target.id
            ));
            this.lastFired = currentTime;
        }
    }
}

// 子弹类
class Bullet {
    constructor(x, y, targetX, targetY, damage, targetId) {
        this.x = x;
        this.y = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.damage = damage;
        this.targetId = targetId;
        this.speed = 8;
        this.id = Date.now() + Math.random();
        
        const dx = targetX - x;
        const dy = targetY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            this.vx = (dx / distance) * this.speed;
            this.vy = (dy / distance) * this.speed;
        } else {
            this.vx = 0;
            this.vy = 0;
        }
    }

    update(enemies) {
        this.x += this.vx;
        this.y += this.vy;
        
        // 检查碰撞
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.isDead) continue;
            
            const distance = Math.sqrt(
                Math.pow(enemy.x - this.x, 2) + 
                Math.pow(enemy.y - this.y, 2)
            );
            
            if (distance < 20) {
                if (enemy.takeDamage(this.damage)) {
                    enemies.splice(i, 1);
                    console.log(`Enemy killed! Reward: ${enemy.reward}`);
                }
                return true; // 子弹命中，需要移除
            }
        }
        
        // 检查是否超出边界
        return this.x < -50 || this.x > 850 || 
               this.y < -50 || this.y > 650;
    }
}

// 敌人类
class Enemy {
    constructor(path, health, speed, reward) {
        this.path = path;
        this.health = health;
        this.maxHealth = health;
        this.speed = speed;
        this.reward = reward;
        this.currentPathIndex = 0;
        this.x = path[0].x;
        this.y = path[0].y;
        this.id = Date.now() + Math.random();
        this.isDead = false;
        this.hasEscaped = false;
    }

    update() {
        if (this.isDead) return;

        this.move();
        
        // 检查是否到达终点
        if (this.currentPathIndex >= this.path.length) {
            this.hasEscaped = true;
            return;
        }
    }

    move() {
        if (this.currentPathIndex >= this.path.length) return;

        const target = this.path[this.currentPathIndex];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 5) {
            this.currentPathIndex++;
            return;
        }

        const moveX = (dx / distance) * this.speed;
        const moveY = (dy / distance) * this.speed;

        this.x += moveX;
        this.y += moveY;
    }

    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            this.isDead = true;
            return true;
        }
        return false;
    }
}

// 游戏状态
const createGameState = () => ({
    level: 1,
    lives: 20, // 多人游戏增加生命值
    money: 150, // 多人游戏增加初始金币
    score: 0,
    currentWave: 0,
    isPlaying: false,
    isPaused: false,
    gameOver: false,
    towers: [],
    enemies: [],
    bullets: [],
    particles: [],
    players: new Map(),
    createdAt: Date.now(),
    enemySpawnTimer: 0,
    enemiesSpawned: 0,
    waveStartTime: 0
});

// 房间类
class GameRoom {
    constructor(id) {
        this.id = id;
        this.players = new Map();
        this.gameState = createGameState();
        this.lastUpdate = Date.now();
        this.gameLoop = null;
        this.waveInterval = null;
    }

    addPlayer(socket) {
        if (this.players.size >= MAX_PLAYERS) {
            return false;
        }

        const playerId = this.players.size;
        const zone = PLAYER_ZONES[playerId];
        
        const player = {
            id: playerId,
            socketId: socket.id,
            name: `玩家${playerId + 1}`,
            zone: zone,
            ready: false,
            connected: true
        };

        this.players.set(socket.id, player);
        this.gameState.players.set(socket.id, player);
        
        console.log(`Player ${player.name} joined room ${this.id}`);
        return player;
    }

    removePlayer(socketId) {
        const player = this.players.get(socketId);
        if (player) {
            this.players.delete(socketId);
            this.gameState.players.delete(socketId);
            console.log(`Player ${player.name} left room ${this.id}`);
        }
        
        // 如果房间空了，停止游戏循环
        if (this.players.size === 0) {
            this.stopGameLoop();
        }
    }

    startGameLoop() {
        if (this.gameLoop) return;
        
        this.gameLoop = setInterval(() => {
            this.updateGame();
            this.broadcastGameState();
        }, 1000 / 60); // 60 FPS
    }

    stopGameLoop() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
        if (this.waveInterval) {
            clearInterval(this.waveInterval);
            this.waveInterval = null;
        }
    }

    updateGame() {
        const now = Date.now();
        const deltaTime = now - this.lastUpdate;
        this.lastUpdate = now;

        if (this.gameState.isPaused || this.gameState.gameOver) {
            return;
        }

        // 如果游戏正在进行，处理游戏逻辑
        if (this.gameState.isPlaying) {
            this.spawnEnemies();
            this.updateTowers(now);
            this.updateBullets();
            this.updateEnemies();
        }
    }

    updateTowers(currentTime) {
        // 更新所有炮塔
        for (let tower of this.gameState.towers) {
            if (tower.update) {
                tower.update(this.gameState.enemies, this.gameState.bullets, currentTime);
            }
        }
    }

    updateBullets() {
        // 更新所有子弹
        for (let i = this.gameState.bullets.length - 1; i >= 0; i--) {
            const bullet = this.gameState.bullets[i];
            if (bullet.update(this.gameState.enemies)) {
                this.gameState.bullets.splice(i, 1);
            }
        }
    }

    spawnEnemies() {
        if (this.gameState.currentWave === 0) return;

        const level = LEVELS[this.gameState.level - 1];
        const waveIndex = this.gameState.currentWave - 1;
        const path = PATHS[this.gameState.level - 1];

        const enemyCount = level.enemyCount[waveIndex];
        const enemyHealth = level.enemyHealth[waveIndex];
        const enemySpeed = level.enemySpeed[waveIndex];
        const enemyReward = level.enemyReward[waveIndex];

        // 检查是否需要生成敌人
        if (this.gameState.enemiesSpawned < enemyCount) {
            const now = Date.now();
            
            // 如果这是第一次生成敌人，记录开始时间
            if (this.gameState.enemySpawnTimer === 0) {
                this.gameState.enemySpawnTimer = now;
            }

            // 检查是否到了生成下一个敌人的时间
            if (now - this.gameState.enemySpawnTimer >= level.spawnInterval) {
                const enemy = new Enemy(path, enemyHealth, enemySpeed, enemyReward);
                this.gameState.enemies.push(enemy);
                this.gameState.enemiesSpawned++;
                this.gameState.enemySpawnTimer = now;
                
                console.log(`Spawned enemy ${this.gameState.enemiesSpawned}/${enemyCount} in room ${this.id}`);
            }
        }
    }

    updateEnemies() {
        // 更新所有敌人
        for (let i = this.gameState.enemies.length - 1; i >= 0; i--) {
            const enemy = this.gameState.enemies[i];
            enemy.update();

            // 移除死亡或逃脱的敌人
            if (enemy.isDead) {
                // 敌人被击杀，不需要从数组中移除，因为子弹系统已经处理了
                this.gameState.money += enemy.reward;
                this.gameState.score += enemy.reward * 2;
                console.log(`Enemy killed in room ${this.id}. Reward: ${enemy.reward} coins`);
            } else if (enemy.hasEscaped) {
                this.gameState.enemies.splice(i, 1);
                this.gameState.lives--;
                
                console.log(`Enemy escaped in room ${this.id}. Lives remaining: ${this.gameState.lives}`);
                
                // 检查游戏失败
                if (this.gameState.lives <= 0) {
                    this.gameState.gameOver = true;
                    this.gameState.isPlaying = false;
                    io.to(this.id).emit('gameOver', { 
                        title: '游戏失败！', 
                        message: '太多敌人逃脱了！' 
                    });
                }
            }
        }

        // 检查波次是否结束
        if (this.gameState.isPlaying && 
            this.gameState.enemiesSpawned >= LEVELS[this.gameState.level - 1].enemyCount[this.gameState.currentWave - 1] &&
            this.gameState.enemies.length === 0) {
            
            this.gameState.isPlaying = false;
            this.gameState.enemySpawnTimer = 0;
            this.gameState.enemiesSpawned = 0;
            
            const level = LEVELS[this.gameState.level - 1];
            
            if (this.gameState.currentWave >= level.waves) {
                // 关卡完成
                if (this.gameState.level >= LEVELS.length) {
                    // 游戏胜利
                    this.gameState.gameOver = true;
                    io.to(this.id).emit('gameOver', { 
                        title: '恭喜胜利！', 
                        message: '您已完成所有关卡！' 
                    });
                } else {
                    // 进入下一关
                    this.gameState.level++;
                    this.gameState.currentWave = 0;
                    this.gameState.money += 100; // 奖励金币
                    io.to(this.id).emit('levelComplete', { 
                        level: this.gameState.level 
                    });
                }
            } else {
                // 波次完成，给予奖励
                this.gameState.money += 50;
                io.to(this.id).emit('waveComplete', { 
                    wave: this.gameState.currentWave 
                });
            }
        }
    }

    broadcastGameState() {
        io.to(this.id).emit('gameState', {
            gameState: this.gameState,
            players: Array.from(this.players.values())
        });
    }

    canBuildTower(playerId, x, y) {
        const player = Array.from(this.players.values()).find(p => p.id === playerId);
        if (!player) return false;

        const zone = player.zone;
        return x >= zone.x && x <= zone.x + zone.width &&
               y >= zone.y && y <= zone.y + zone.height;
    }
}

// Socket.IO 连接处理
io.on('connection', (socket) => {
    console.log(`用户连接: ${socket.id}`);

    // 加入房间
    socket.on('joinRoom', (roomId) => {
        if (!roomId) roomId = 'default';
        
        let room = rooms.get(roomId);
        if (!room) {
            room = new GameRoom(roomId);
            rooms.set(roomId, room);
        }

        const player = room.addPlayer(socket);
        if (!player) {
            socket.emit('error', { message: '房间已满' });
            return;
        }

        socket.join(roomId);
        socket.roomId = roomId;
        socket.playerId = player.id;

        // 发送玩家信息
        socket.emit('playerJoined', {
            player: player,
            room: {
                id: roomId,
                players: Array.from(room.players.values()),
                gameState: room.gameState
            }
        });

        // 通知其他玩家
        socket.to(roomId).emit('playerConnected', player);

        // 启动游戏循环
        room.startGameLoop();
        
        console.log(`Player ${player.name} joined room ${roomId}`);
    });

    // 建造炮塔
    socket.on('buildTower', (data) => {
        const room = rooms.get(socket.roomId);
        if (!room) return;

        const { x, y, towerType, cost } = data;
        
        // 验证炮塔类型
        if (!TOWER_TYPES[towerType]) {
            socket.emit('error', { message: '无效的炮塔类型' });
            return;
        }

        // 验证费用
        if (cost !== TOWER_TYPES[towerType].cost) {
            socket.emit('error', { message: '炮塔费用不匹配' });
            return;
        }
        
        if (!room.canBuildTower(socket.playerId, x, y)) {
            socket.emit('error', { message: '只能在自己的区域内建造炮塔' });
            return;
        }

        if (room.gameState.money < cost) {
            socket.emit('error', { message: '金币不足' });
            return;
        }

        const tower = new Tower(x, y, towerType, socket.playerId);

        room.gameState.towers.push(tower);
        room.gameState.money -= cost;

        io.to(socket.roomId).emit('towerBuilt', tower);
        room.broadcastGameState();
    });

    // 开始波次
    socket.on('startWave', () => {
        const room = rooms.get(socket.roomId);
        if (!room || room.gameState.isPlaying) return;

        room.gameState.isPlaying = true;
        room.gameState.currentWave++;
        room.gameState.enemySpawnTimer = 0;
        room.gameState.enemiesSpawned = 0;
        
        console.log(`Starting wave ${room.gameState.currentWave} in room ${socket.roomId}`);
        
        io.to(socket.roomId).emit('waveStarted', {
            wave: room.gameState.currentWave
        });
        
        room.broadcastGameState();
    });

    // 玩家准备
    socket.on('playerReady', (ready) => {
        const room = rooms.get(socket.roomId);
        if (!room) return;

        const player = room.players.get(socket.id);
        if (player) {
            player.ready = ready;
            io.to(socket.roomId).emit('playerStatusChanged', player);
        }
    });

    // 暂停游戏
    socket.on('pauseGame', () => {
        const room = rooms.get(socket.roomId);
        if (!room) return;

        room.gameState.isPaused = !room.gameState.isPaused;
        io.to(socket.roomId).emit('gamePaused', room.gameState.isPaused);
        room.broadcastGameState();
    });

    // 重新开始游戏
    socket.on('restartGame', () => {
        const room = rooms.get(socket.roomId);
        if (!room) return;

        room.gameState = createGameState();
        room.gameState.players = new Map();
        
        // 重新添加玩家
        room.players.forEach(player => {
            room.gameState.players.set(player.socketId, player);
        });

        io.to(socket.roomId).emit('gameRestarted');
        room.broadcastGameState();
    });

    // 聊天消息
    socket.on('chatMessage', (message) => {
        const room = rooms.get(socket.roomId);
        if (!room) return;

        const player = room.players.get(socket.id);
        if (player) {
            const chatData = {
                playerId: player.id,
                playerName: player.name,
                message: message,
                timestamp: Date.now()
            };
            
            io.to(socket.roomId).emit('chatMessage', chatData);
        }
    });

    // 断开连接
    socket.on('disconnect', () => {
        console.log(`用户断开连接: ${socket.id}`);
        
        const room = rooms.get(socket.roomId);
        if (room) {
            const player = room.players.get(socket.id);
            if (player) {
                socket.to(socket.roomId).emit('playerDisconnected', player);
                room.removePlayer(socket.id);
                
                // 如果房间空了，删除房间
                if (room.players.size === 0) {
                    rooms.delete(socket.roomId);
                    console.log(`Room ${socket.roomId} deleted`);
                }
            }
        }
    });
});

// 清理空房间
setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
        if (room.players.size === 0 && now - room.gameState.createdAt > 300000) { // 5分钟
            room.stopGameLoop();
            rooms.delete(roomId);
            console.log(`Cleaned up empty room: ${roomId}`);
        }
    }
}, 60000); // 每分钟检查一次

// 启动服务器
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // 监听所有网络接口
server.listen(PORT, HOST, () => {
    console.log(`🎮 多人塔防游戏服务器运行在端口 ${PORT}`);
    console.log(`📡 本地访问地址: http://localhost:${PORT}`);
    console.log(`🌐 网络访问地址: http://0.0.0.0:${PORT}`);
    console.log(`💡 其他设备可通过您的IP地址访问游戏`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭服务器...');
    
    // 通知所有玩家服务器关闭
    io.emit('serverShutdown');
    
    // 停止所有游戏循环
    rooms.forEach(room => room.stopGameLoop());
    
    server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
}); 