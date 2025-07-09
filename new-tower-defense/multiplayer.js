// 多人游戏客户端类
class MultiplayerGame {
    constructor() {
        this.socket = null;
        this.playerId = null;
        this.currentRoom = null;
        this.playerZone = null;
        this.isHost = false;
        this.gameState = {
            money: 100,
            lives: 20,
            wave: 1,
            enemies: [],
            towers: [],
            bullets: []
        };
        this.selectedTowerType = null;
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        
        this.initializeSocket();
        this.setupEventListeners();
    }

    initializeSocket() {
        this.socket = io();
        
        // 连接事件
        this.socket.on('connect', () => {
            console.log('已连接到服务器');
            this.updateConnectionStatus('已连接到服务器', 'success');
        });

        this.socket.on('disconnect', () => {
            console.log('与服务器断开连接');
            this.updateConnectionStatus('与服务器断开连接', 'error');
        });

        // 错误处理
        this.socket.on('error', (data) => {
            console.error('错误:', data.message);
            this.showError(data.message);
        });

        // 房间相关事件
        this.socket.on('joined_room', (data) => {
            this.handleJoinedRoom(data);
        });

        this.socket.on('player_joined', (data) => {
            this.handlePlayerJoined(data);
        });

        this.socket.on('player_left', (data) => {
            this.handlePlayerLeft(data);
        });

        this.socket.on('player_ready_changed', (data) => {
            this.handlePlayerReadyChanged(data);
        });

        // 游戏相关事件
        this.socket.on('game_started', (data) => {
            this.handleGameStarted(data);
        });

        this.socket.on('game_update', (data) => {
            this.handleGameUpdate(data);
        });

        this.socket.on('wave_started', (data) => {
            this.handleWaveStarted(data);
        });

        this.socket.on('wave_completed', (data) => {
            this.handleWaveCompleted(data);
        });

        this.socket.on('tower_built', (data) => {
            this.handleTowerBuilt(data);
        });

        this.socket.on('game_over', (data) => {
            this.handleGameOver(data);
        });

        this.socket.on('game_won', (data) => {
            this.handleGameWon(data);
        });

        // 聊天相关事件
        this.socket.on('chat_message', (data) => {
            this.handleChatMessage(data);
        });
    }

    setupEventListeners() {
        // 加入房间
        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            this.joinRoom();
        });

        document.getElementById('createRoomBtn').addEventListener('click', () => {
            this.createRoom();
        });

        // 房间输入框回车事件
        document.getElementById('roomId').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });

        document.getElementById('playerName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });

        // 大厅相关
        document.getElementById('leaveRoomBtn').addEventListener('click', () => {
            this.leaveRoom();
        });

        document.getElementById('readyBtn').addEventListener('click', () => {
            this.toggleReady();
        });

        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.startGame();
        });

        // 聊天相关
        document.getElementById('sendChatBtn').addEventListener('click', () => {
            this.sendChatMessage();
        });

        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });

        document.getElementById('sendGameChatBtn').addEventListener('click', () => {
            this.sendGameChatMessage();
        });

        document.getElementById('gameChatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendGameChatMessage();
            }
        });

        // 游戏相关
        document.getElementById('startWaveBtn').addEventListener('click', () => {
            this.startWave();
        });

        document.getElementById('exitGameBtn').addEventListener('click', () => {
            this.exitGame();
        });

        // 炮塔选择
        document.querySelectorAll('.tower-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectTowerType(btn.dataset.type);
            });
        });

        // 模态框
        document.getElementById('errorOkBtn').addEventListener('click', () => {
            this.hideModal('errorModal');
        });

        document.getElementById('gameOverOkBtn').addEventListener('click', () => {
            this.hideModal('gameOverModal');
            this.exitGame();
        });
    }

    // 房间管理
    joinRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        const roomId = document.getElementById('roomId').value.trim();

        if (!playerName) {
            this.showError('请输入玩家名称');
            return;
        }

        if (!roomId) {
            this.showError('请输入房间ID');
            return;
        }

        this.updateConnectionStatus('正在加入房间...', 'info');
        this.socket.emit('join_room', { playerName, roomId });
    }

    createRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        
        if (!playerName) {
            this.showError('请输入玩家名称');
            return;
        }

        const roomId = 'room_' + Date.now().toString(36).substr(2, 9);
        document.getElementById('roomId').value = roomId;
        
        this.updateConnectionStatus('正在创建房间...', 'info');
        this.socket.emit('join_room', { playerName, roomId });
    }

    leaveRoom() {
        this.socket.disconnect();
        this.socket.connect();
        this.showScreen('joinRoomScreen');
        this.currentRoom = null;
        this.playerId = null;
        this.playerZone = null;
        this.isHost = false;
    }

    toggleReady() {
        const readyBtn = document.getElementById('readyBtn');
        const isReady = readyBtn.textContent === '取消准备';
        
        this.socket.emit('player_ready', { ready: !isReady });
    }

    startGame() {
        if (this.isHost) {
            this.socket.emit('start_game');
        }
    }

    // 游戏控制
    startWave() {
        this.socket.emit('start_wave');
    }

    exitGame() {
        this.showScreen('lobbyScreen');
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    selectTowerType(type) {
        this.selectedTowerType = type;
        
        // 更新UI
        document.querySelectorAll('.tower-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        document.querySelector(`[data-type="${type}"]`).classList.add('selected');
    }

    buildTower(x, y) {
        if (!this.selectedTowerType) return;
        
        // 检查是否在自己的区域内
        if (!this.playerZone) return;
        
        const zone = this.playerZone;
        if (x < zone.x || x > zone.x + zone.width || 
            y < zone.y || y > zone.y + zone.height) {
            this.showMessage('只能在自己的区域内建造炮塔！');
            return;
        }

        this.socket.emit('build_tower', {
            x: x,
            y: y,
            type: this.selectedTowerType
        });
    }

    // 聊天系统
    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        this.socket.emit('send_chat', { message });
        input.value = '';
    }

    sendGameChatMessage() {
        const input = document.getElementById('gameChatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        this.socket.emit('send_chat', { message });
        input.value = '';
    }

    // 事件处理
    handleJoinedRoom(data) {
        this.playerId = data.playerId;
        this.currentRoom = data.roomId;
        this.playerZone = data.players.find(p => p.id === this.playerId)?.zone;
        this.isHost = data.players.find(p => p.id === this.playerId)?.isHost || false;
        
        document.getElementById('currentRoomId').textContent = data.roomId;
        this.updatePlayersList(data.players);
        this.showScreen('lobbyScreen');
        
        this.updateConnectionStatus('已加入房间', 'success');
    }

    handlePlayerJoined(data) {
        this.updatePlayersList(data.players);
        this.addChatMessage({
            playerName: '系统',
            message: `${data.player.name} 加入了房间`,
            timestamp: new Date().toISOString()
        });
    }

    handlePlayerLeft(data) {
        this.updatePlayersList(data.players);
        // 更新房主状态
        const currentPlayer = data.players.find(p => p.id === this.playerId);
        if (currentPlayer) {
            this.isHost = currentPlayer.isHost;
        }
    }

    handlePlayerReadyChanged(data) {
        this.updatePlayersList(data.players);
        
        // 更新自己的准备状态
        const currentPlayer = data.players.find(p => p.id === this.playerId);
        if (currentPlayer) {
            const readyBtn = document.getElementById('readyBtn');
            readyBtn.textContent = currentPlayer.ready ? '取消准备' : '准备';
        }
        
        // 更新开始游戏按钮
        const allReady = data.players.every(p => p.ready);
        const startGameBtn = document.getElementById('startGameBtn');
        if (this.isHost && allReady && data.players.length > 0) {
            startGameBtn.style.display = 'block';
        } else {
            startGameBtn.style.display = 'none';
        }
    }

    handleGameStarted(data) {
        this.gameState = data;
        this.setupGameCanvas();
        this.showScreen('gameScreen');
        this.startGameLoop();
    }

    handleGameUpdate(data) {
        this.gameState = {
            ...this.gameState,
            ...data
        };
        
        this.updateGameUI();
    }

    handleWaveStarted(data) {
        this.showMessage(`第 ${data.wave} 波开始！`);
    }

    handleWaveCompleted(data) {
        this.showMessage(`第 ${data.wave - 1} 波完成！`);
    }

    handleTowerBuilt(data) {
        this.gameState.money = data.money;
        this.updateGameUI();
    }

    handleGameOver(data) {
        this.showGameOverModal('游戏失败', '所有生命值已耗尽！');
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    handleGameWon(data) {
        this.showGameOverModal('游戏胜利', '恭喜您完成了所有波次！');
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    handleChatMessage(data) {
        this.addChatMessage(data);
        this.addGameChatMessage(data);
    }

    // UI 更新
    updatePlayersList(players) {
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';
        
        players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            
            const avatar = document.createElement('div');
            avatar.className = 'player-avatar';
            avatar.style.backgroundColor = player.zone.color;
            avatar.textContent = player.name.charAt(0).toUpperCase();
            
            const playerInfo = document.createElement('div');
            playerInfo.className = 'player-info';
            
            const playerName = document.createElement('div');
            playerName.className = 'player-name';
            playerName.textContent = player.name;
            
            const playerZone = document.createElement('div');
            playerZone.className = 'player-zone';
            playerZone.textContent = player.zone.name;
            
            playerInfo.appendChild(playerName);
            playerInfo.appendChild(playerZone);
            
            const playerStatus = document.createElement('div');
            playerStatus.className = 'player-status';
            
            if (player.isHost) {
                playerStatus.className += ' host';
                playerStatus.textContent = '👑 房主';
            } else if (player.ready) {
                playerStatus.className += ' ready';
                playerStatus.textContent = '✅ 已准备';
            } else {
                playerStatus.className += ' not-ready';
                playerStatus.textContent = '❌ 未准备';
            }
            
            playerCard.appendChild(avatar);
            playerCard.appendChild(playerInfo);
            playerCard.appendChild(playerStatus);
            
            playersList.appendChild(playerCard);
        });
    }

    addChatMessage(data) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        if (data.playerId === this.playerId) {
            messageDiv.classList.add('own');
        }
        
        const header = document.createElement('div');
        header.className = 'chat-message-header';
        
        const name = document.createElement('div');
        name.className = 'chat-message-name';
        name.textContent = data.playerName;
        
        const time = document.createElement('div');
        time.className = 'chat-message-time';
        time.textContent = new Date(data.timestamp).toLocaleTimeString();
        
        header.appendChild(name);
        header.appendChild(time);
        
        const text = document.createElement('div');
        text.className = 'chat-message-text';
        text.textContent = data.message;
        
        messageDiv.appendChild(header);
        messageDiv.appendChild(text);
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    addGameChatMessage(data) {
        const chatMessages = document.getElementById('gameChatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        if (data.playerId === this.playerId) {
            messageDiv.classList.add('own');
        }
        
        const header = document.createElement('div');
        header.className = 'chat-message-header';
        
        const name = document.createElement('div');
        name.className = 'chat-message-name';
        name.textContent = data.playerName;
        
        const time = document.createElement('div');
        time.className = 'chat-message-time';
        time.textContent = new Date(data.timestamp).toLocaleTimeString();
        
        header.appendChild(name);
        header.appendChild(time);
        
        const text = document.createElement('div');
        text.className = 'chat-message-text';
        text.textContent = data.message;
        
        messageDiv.appendChild(header);
        messageDiv.appendChild(text);
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    updateGameUI() {
        document.getElementById('lives').textContent = this.gameState.lives;
        document.getElementById('money').textContent = this.gameState.money;
        document.getElementById('wave').textContent = this.gameState.wave;
        
        // 更新炮塔按钮状态
        const towerConfigs = {
            basic: { cost: 20 },
            heavy: { cost: 50 },
            rapid: { cost: 35 }
        };
        
        document.querySelectorAll('.tower-btn').forEach(btn => {
            const type = btn.dataset.type;
            const config = towerConfigs[type];
            const canAfford = this.gameState.money >= config.cost;
            btn.disabled = !canAfford;
            btn.style.opacity = canAfford ? '1' : '0.5';
        });
    }

    // 游戏渲染
    setupGameCanvas() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 设置画布点击事件
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.buildTower(x, y);
        });
        
        // 设置玩家区域显示
        this.setupPlayerZones();
    }

    setupPlayerZones() {
        const playerZones = document.getElementById('playerZones');
        playerZones.innerHTML = '';
        
        const zones = [
            { id: 0, name: '左上角', x: 0, y: 0, width: 200, height: 200, color: '#4facfe' },
            { id: 1, name: '右上角', x: 600, y: 0, width: 200, height: 200, color: '#ff4757' },
            { id: 2, name: '左下角', x: 0, y: 400, width: 200, height: 200, color: '#2ed573' },
            { id: 3, name: '右下角', x: 600, y: 400, width: 200, height: 200, color: '#ffa502' }
        ];
        
        zones.forEach(zone => {
            const zoneDiv = document.createElement('div');
            zoneDiv.className = 'player-zone';
            zoneDiv.style.left = zone.x + 'px';
            zoneDiv.style.top = zone.y + 'px';
            zoneDiv.style.width = zone.width + 'px';
            zoneDiv.style.height = zone.height + 'px';
            zoneDiv.style.borderColor = zone.color;
            zoneDiv.textContent = zone.name;
            
            if (this.playerZone && this.playerZone.id === zone.id) {
                zoneDiv.classList.add('own');
            }
            
            playerZones.appendChild(zoneDiv);
        });
    }

    startGameLoop() {
        const gameLoop = () => {
            this.renderGame();
            this.animationId = requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }

    renderGame() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制路径
        this.drawPath();
        
        // 绘制炮塔
        this.gameState.towers.forEach(tower => {
            this.drawTower(tower);
        });
        
        // 绘制敌人
        this.gameState.enemies.forEach(enemy => {
            this.drawEnemy(enemy);
        });
        
        // 绘制子弹
        this.gameState.bullets.forEach(bullet => {
            this.drawBullet(bullet);
        });
    }

    drawPath() {
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

    drawTower(tower) {
        // 绘制炮塔
        this.ctx.fillStyle = tower.color;
        this.ctx.beginPath();
        this.ctx.arc(tower.x, tower.y, 15, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // 绘制炮塔边框
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    drawEnemy(enemy) {
        if (!enemy.alive) return;
        
        // 绘制敌人
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.beginPath();
        this.ctx.arc(enemy.x, enemy.y, 15, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // 绘制血条
        const barWidth = 30;
        const barHeight = 4;
        const healthPercent = enemy.health / enemy.maxHealth;
        
        this.ctx.fillStyle = 'red';
        this.ctx.fillRect(enemy.x - barWidth/2, enemy.y - 25, barWidth, barHeight);
        
        this.ctx.fillStyle = 'green';
        this.ctx.fillRect(enemy.x - barWidth/2, enemy.y - 25, barWidth * healthPercent, barHeight);
    }

    drawBullet(bullet) {
        this.ctx.fillStyle = '#ffff00';
        this.ctx.beginPath();
        this.ctx.arc(bullet.x, bullet.y, 3, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    // 工具方法
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    showModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        this.showModal('errorModal');
    }

    showGameOverModal(title, message) {
        document.getElementById('gameOverTitle').textContent = title;
        document.getElementById('gameOverMessage').textContent = message;
        this.showModal('gameOverModal');
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

    updateConnectionStatus(message, type) {
        const statusDiv = document.getElementById('connectionStatus');
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${type}`;
    }
}

// 初始化多人游戏
let multiplayerGame;
window.addEventListener('load', () => {
    multiplayerGame = new MultiplayerGame();
}); 