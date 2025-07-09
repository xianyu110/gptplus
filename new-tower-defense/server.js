const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// 静态文件服务
app.use(express.static(path.join(__dirname)));

// 路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/multiplayer', (req, res) => {
    res.sendFile(path.join(__dirname, 'multiplayer.html'));
});

// 游戏房间管理
class GameRoom {
    constructor(id, maxPlayers = 4) {
        this.id = id;
        this.maxPlayers = maxPlayers;
        this.players = new Map();
        this.gameState = {
            money: 100,
            lives: 20,
            wave: 1,
            level: 1,
            gameRunning: false,
            gamePaused: false,
            gameOver: false,
            waveInProgress: false,
            towers: [],
            enemies: [],
            bullets: [],
            lastUpdateTime: Date.now(),
            enemySpawnTimer: 0,
            currentWaveEnemies: 0,
            waveEnemiesSpawned: 0
        };
        this.updateInterval = null;
        this.playerZones = [
            { id: 0, name: '左上角', x: 0, y: 0, width: 200, height: 200, color: '#4facfe' },
            { id: 1, name: '右上角', x: 600, y: 0, width: 200, height: 200, color: '#ff4757' },
            { id: 2, name: '左下角', x: 0, y: 400, width: 200, height: 200, color: '#2ed573' },
            { id: 3, name: '右下角', x: 600, y: 400, width: 200, height: 200, color: '#ffa502' }
        ];
    }

    addPlayer(socket, playerName) {
        if (this.players.size >= this.maxPlayers) {
            return false;
        }

        const playerId = socket.id;
        const zoneId = this.players.size;
        const zone = this.playerZones[zoneId];
        
        const player = {
            id: playerId,
            name: playerName,
            socket: socket,
            zone: zone,
            ready: false,
            isHost: this.players.size === 0
        };

        this.players.set(playerId, player);
        
        // 通知所有玩家新玩家加入
        this.broadcastToAll('player_joined', {
            player: {
                id: player.id,
                name: player.name,
                zone: player.zone,
                ready: player.ready,
                isHost: player.isHost
            },
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                zone: p.zone,
                ready: p.ready,
                isHost: p.isHost
            }))
        });

        return true;
    }

    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;

        this.players.delete(playerId);
        
        // 如果是房主离开，选择新房主
        if (player.isHost && this.players.size > 0) {
            const newHost = this.players.values().next().value;
            newHost.isHost = true;
        }

        // 通知所有玩家
        this.broadcastToAll('player_left', {
            playerId: playerId,
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                zone: p.zone,
                ready: p.ready,
                isHost: p.isHost
            }))
        });

        // 如果房间空了，停止游戏循环
        if (this.players.size === 0) {
            this.stopGameLoop();
        }
    }

    setPlayerReady(playerId, ready) {
        const player = this.players.get(playerId);
        if (player) {
            player.ready = ready;
            
            this.broadcastToAll('player_ready_changed', {
                playerId: playerId,
                ready: ready,
                players: Array.from(this.players.values()).map(p => ({
                    id: p.id,
                    name: p.name,
                    zone: p.zone,
                    ready: p.ready,
                    isHost: p.isHost
                }))
            });
        }
    }

    startGame() {
        // 检查所有玩家是否准备就绪
        const allReady = Array.from(this.players.values()).every(p => p.ready);
        if (!allReady || this.players.size === 0) {
            return false;
        }

        this.gameState.gameRunning = true;
        this.gameState.gamePaused = false;
        this.gameState.gameOver = false;
        this.gameState.waveInProgress = false;
        this.gameState.lastUpdateTime = Date.now();

        this.broadcastToAll('game_started', this.gameState);
        this.startGameLoop();
        return true;
    }

    startGameLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(() => {
            this.updateGame();
        }, 1000 / 60); // 60 FPS
    }

    stopGameLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    updateGame() {
        if (!this.gameState.gameRunning || this.gameState.gamePaused || this.gameState.gameOver) {
            return;
        }

        const currentTime = Date.now();
        const deltaTime = currentTime - this.gameState.lastUpdateTime;
        this.gameState.lastUpdateTime = currentTime;

        // 更新敌人
        this.gameState.enemies = this.gameState.enemies.filter(enemy => {
            this.updateEnemy(enemy);
            
            if (enemy.reachedEnd) {
                this.gameState.lives--;
                if (this.gameState.lives <= 0) {
                    this.gameState.gameOver = true;
                    this.broadcastToAll('game_over', { reason: 'lives_depleted' });
                }
                return false;
            }
            
            if (!enemy.alive) {
                this.gameState.money += enemy.reward;
                return false;
            }
            
            return true;
        });

        // 生成敌人
        if (this.gameState.waveInProgress && this.gameState.waveEnemiesSpawned < this.gameState.currentWaveEnemies) {
            this.gameState.enemySpawnTimer += deltaTime;
            
            if (this.gameState.enemySpawnTimer >= 1000) { // 1秒间隔
                this.spawnEnemy();
                this.gameState.enemySpawnTimer = 0;
            }
        }

        // 炮塔攻击
        for (let tower of this.gameState.towers) {
            this.updateTower(tower);
        }

        // 更新子弹
        this.gameState.bullets = this.gameState.bullets.filter(bullet => {
            this.updateBullet(bullet);
            return bullet.alive;
        });

        // 检查波次结束
        if (this.gameState.waveInProgress && 
            this.gameState.waveEnemiesSpawned >= this.gameState.currentWaveEnemies && 
            this.gameState.enemies.length === 0) {
            
            this.gameState.waveInProgress = false;
            this.gameState.wave++;
            
            if (this.gameState.wave > 10) {
                this.gameState.gameOver = true;
                this.broadcastToAll('game_won', {});
            } else {
                this.broadcastToAll('wave_completed', { wave: this.gameState.wave });
            }
        }

        // 广播游戏状态
        this.broadcastToAll('game_update', {
            money: this.gameState.money,
            lives: this.gameState.lives,
            wave: this.gameState.wave,
            enemies: this.gameState.enemies,
            towers: this.gameState.towers,
            bullets: this.gameState.bullets
        });
    }

    updateEnemy(enemy) {
        if (!enemy.alive || enemy.pathIndex >= enemy.path.length - 1) {
            return;
        }

        const target = enemy.path[enemy.pathIndex + 1];
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < enemy.speed) {
            enemy.pathIndex++;
            if (enemy.pathIndex >= enemy.path.length - 1) {
                enemy.reachedEnd = true;
            }
        } else {
            enemy.x += (dx / distance) * enemy.speed;
            enemy.y += (dy / distance) * enemy.speed;
        }
    }

    updateTower(tower) {
        const currentTime = Date.now();
        
        // 寻找目标
        tower.target = null;
        let closestDistance = Infinity;
        
        for (let enemy of this.gameState.enemies) {
            const distance = Math.sqrt(
                Math.pow(enemy.x - tower.x, 2) + Math.pow(enemy.y - tower.y, 2)
            );
            
            if (distance <= tower.range && distance < closestDistance) {
                tower.target = enemy;
                closestDistance = distance;
            }
        }

        // 开火
        if (tower.target && (currentTime - tower.lastFireTime) > tower.fireRate) {
            tower.lastFireTime = currentTime;
            
            const bullet = {
                id: Date.now() + Math.random(),
                x: tower.x,
                y: tower.y,
                targetId: tower.target.id,
                damage: tower.damage,
                speed: 5,
                alive: true
            };
            
            this.gameState.bullets.push(bullet);
        }
    }

    updateBullet(bullet) {
        const target = this.gameState.enemies.find(e => e.id === bullet.targetId);
        
        if (!target || !target.alive) {
            bullet.alive = false;
            return;
        }

        const dx = target.x - bullet.x;
        const dy = target.y - bullet.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < bullet.speed) {
            target.health -= bullet.damage;
            if (target.health <= 0) {
                target.alive = false;
            }
            bullet.alive = false;
        } else {
            bullet.x += (dx / distance) * bullet.speed;
            bullet.y += (dy / distance) * bullet.speed;
        }
    }

    spawnEnemy() {
        if (this.gameState.waveEnemiesSpawned >= this.gameState.currentWaveEnemies) {
            return;
        }

        const path = [
            {x: 0, y: 300},
            {x: 200, y: 300},
            {x: 200, y: 150},
            {x: 400, y: 150},
            {x: 400, y: 450},
            {x: 600, y: 450},
            {x: 600, y: 300},
            {x: 800, y: 300}
        ];

        const enemy = {
            id: Date.now() + Math.random(),
            type: 'basic',
            health: 100,
            maxHealth: 100,
            speed: 1,
            reward: 10,
            path: path,
            pathIndex: 0,
            x: path[0].x,
            y: path[0].y,
            alive: true,
            reachedEnd: false
        };

        this.gameState.enemies.push(enemy);
        this.gameState.waveEnemiesSpawned++;
    }

    startWave() {
        if (this.gameState.waveInProgress || this.gameState.gameOver) {
            return false;
        }

        this.gameState.waveInProgress = true;
        this.gameState.currentWaveEnemies = 5 + (this.gameState.wave - 1) * 3;
        this.gameState.waveEnemiesSpawned = 0;
        this.gameState.enemySpawnTimer = 0;

        this.broadcastToAll('wave_started', { wave: this.gameState.wave });
        return true;
    }

    buildTower(playerId, x, y, type) {
        const player = this.players.get(playerId);
        if (!player || this.gameState.gameOver) {
            return false;
        }

        // 检查是否在玩家区域内
        const zone = player.zone;
        if (x < zone.x || x > zone.x + zone.width || 
            y < zone.y || y > zone.y + zone.height) {
            return false;
        }

        // 炮塔配置
        const towerConfigs = {
            basic: { cost: 20, damage: 25, range: 150, fireRate: 1000, color: '#4facfe' },
            heavy: { cost: 50, damage: 75, range: 120, fireRate: 1500, color: '#ff4757' },
            rapid: { cost: 35, damage: 15, range: 180, fireRate: 400, color: '#ffa502' }
        };

        const config = towerConfigs[type];
        if (!config || this.gameState.money < config.cost) {
            return false;
        }

        // 检查是否与其他炮塔重叠
        for (let tower of this.gameState.towers) {
            const distance = Math.sqrt(
                Math.pow(x - tower.x, 2) + Math.pow(y - tower.y, 2)
            );
            if (distance < 40) {
                return false;
            }
        }

        // 建造炮塔
        this.gameState.money -= config.cost;
        
        const tower = {
            id: Date.now() + Math.random(),
            x: x,
            y: y,
            type: type,
            damage: config.damage,
            range: config.range,
            fireRate: config.fireRate,
            color: config.color,
            lastFireTime: 0,
            target: null,
            playerId: playerId
        };

        this.gameState.towers.push(tower);
        
        this.broadcastToAll('tower_built', {
            tower: tower,
            money: this.gameState.money
        });

        return true;
    }

    sendChatMessage(playerId, message) {
        const player = this.players.get(playerId);
        if (!player) return;

        const chatMessage = {
            id: Date.now(),
            playerId: playerId,
            playerName: player.name,
            message: message,
            timestamp: new Date().toISOString()
        };

        this.broadcastToAll('chat_message', chatMessage);
    }

    broadcastToAll(event, data) {
        for (let player of this.players.values()) {
            player.socket.emit(event, data);
        }
    }

    broadcastToPlayer(playerId, event, data) {
        const player = this.players.get(playerId);
        if (player) {
            player.socket.emit(event, data);
        }
    }
}

// 房间管理
const rooms = new Map();
const playerRooms = new Map();

// Socket.IO 连接处理
io.on('connection', (socket) => {
    console.log(`玩家连接: ${socket.id}`);

    // 加入房间
    socket.on('join_room', (data) => {
        const { roomId, playerName } = data;
        
        if (!roomId || !playerName) {
            socket.emit('error', { message: '房间ID和玩家名称不能为空' });
            return;
        }

        // 检查是否已在其他房间
        if (playerRooms.has(socket.id)) {
            socket.emit('error', { message: '您已在其他房间中' });
            return;
        }

        // 获取或创建房间
        let room = rooms.get(roomId);
        if (!room) {
            room = new GameRoom(roomId);
            rooms.set(roomId, room);
        }

        // 尝试加入房间
        if (room.addPlayer(socket, playerName)) {
            playerRooms.set(socket.id, roomId);
            socket.join(roomId);
            
            socket.emit('joined_room', {
                roomId: roomId,
                playerId: socket.id,
                players: Array.from(room.players.values()).map(p => ({
                    id: p.id,
                    name: p.name,
                    zone: p.zone,
                    ready: p.ready,
                    isHost: p.isHost
                }))
            });
        } else {
            socket.emit('error', { message: '房间已满' });
        }
    });

    // 玩家准备状态
    socket.on('player_ready', (data) => {
        const roomId = playerRooms.get(socket.id);
        const room = rooms.get(roomId);
        if (room) {
            room.setPlayerReady(socket.id, data.ready);
        }
    });

    // 开始游戏
    socket.on('start_game', () => {
        const roomId = playerRooms.get(socket.id);
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.get(socket.id);
            if (player && player.isHost) {
                room.startGame();
            }
        }
    });

    // 开始波次
    socket.on('start_wave', () => {
        const roomId = playerRooms.get(socket.id);
        const room = rooms.get(roomId);
        if (room) {
            room.startWave();
        }
    });

    // 建造炮塔
    socket.on('build_tower', (data) => {
        const roomId = playerRooms.get(socket.id);
        const room = rooms.get(roomId);
        if (room) {
            room.buildTower(socket.id, data.x, data.y, data.type);
        }
    });

    // 发送聊天消息
    socket.on('send_chat', (data) => {
        const roomId = playerRooms.get(socket.id);
        const room = rooms.get(roomId);
        if (room) {
            room.sendChatMessage(socket.id, data.message);
        }
    });

    // 断开连接
    socket.on('disconnect', () => {
        console.log(`玩家断开连接: ${socket.id}`);
        
        const roomId = playerRooms.get(socket.id);
        if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
                room.removePlayer(socket.id);
                
                // 如果房间空了，删除房间
                if (room.players.size === 0) {
                    rooms.delete(roomId);
                }
            }
            playerRooms.delete(socket.id);
        }
    });
});

// 启动服务器
server.listen(PORT, HOST, () => {
    console.log(`🎮 多人塔防游戏服务器运行在: http://${HOST}:${PORT}`);
    console.log(`📱 单人模式: http://${HOST}:${PORT}/`);
    console.log(`👥 多人模式: http://${HOST}:${PORT}/multiplayer`);
    console.log(`🌐 局域网访问: http://[您的IP]:${PORT}`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('收到终止信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
}); 