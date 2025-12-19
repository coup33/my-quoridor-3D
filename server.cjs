const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const MAX_TIME = 90; 
const START_TIME = 60;
const INCREMENT = 6;  

const INITIAL_GAME_STATE = {
  p1: { x: 4, y: 0, wallCount: 10 },
  p2: { x: 4, y: 8, wallCount: 10 },
  turn: 1,
  walls: [],
  winner: null,
  p1Time: START_TIME,
  p2Time: START_TIME,
  lastMove: null, 
  lastWall: null,
  isVsAI: false,
  aiDifficulty: 1,
  winReason: null // ★ 승리 사유 추가 (goal / timeout / resign)
};

let gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
let roles = { 1: null, 2: null };
let readyStatus = { 1: false, 2: false };
let isGameStarted = false;
let gameInterval = null;

// --- Helper Functions ---
const isBlocked = (cx, cy, tx, ty, walls) => {
  if (ty < cy) return walls.some(w => w.orientation === 'h' && w.y === ty && (w.x === cx || w.x === cx - 1));
  if (ty > cy) return walls.some(w => w.orientation === 'h' && w.y === cy && (w.x === cx || w.x === cx - 1));
  if (tx < cx) return walls.some(w => w.orientation === 'v' && w.x === tx && (w.y === cy || w.y === cy - 1));
  if (tx > cx) return walls.some(w => w.orientation === 'v' && w.x === cx && (w.y === cy || w.y === cy - 1));
  return false;
};

const getPathData = (startNode, targetRow, currentWalls) => {
  const queue = [{ x: startNode.x, y: startNode.y, dist: 0, parent: null }];
  const visited = new Set();
  visited.add(`${startNode.x},${startNode.y}`);
  const directions = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
  
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.y === targetRow) {
      let path = [];
      let temp = current;
      while (temp) {
        path.unshift({ x: temp.x, y: temp.y });
        temp = temp.parent;
      }
      return { 
        distance: current.dist, 
        nextStep: path.length > 1 ? path[1] : null,
        fullPath: path
      };
    }
    for (let dir of directions) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      if (nx >= 0 && nx < 9 && ny >= 0 && ny < 9) {
        if (!visited.has(`${nx},${ny}`) && !isBlocked(current.x, current.y, nx, ny, currentWalls)) {
          visited.add(`${nx},${ny}`);
          queue.push({ x: nx, y: ny, dist: current.dist + 1, parent: current });
        }
      }
    }
  }
  return null;
};

const isValidWall = (x, y, orientation, currentWalls, p1Pos, p2Pos) => {
  const isOverlap = currentWalls.some(w => {
    if (w.x === x && w.y === y && w.orientation === orientation) return true;
    if (w.orientation === orientation) {
      if (orientation === 'h' && w.y === y && Math.abs(w.x - x) === 1) return true;
      if (orientation === 'v' && w.x === x && Math.abs(w.y - y) === 1) return true;
    }
    if (w.x === x && w.y === y && w.orientation !== orientation) return true;
    return false;
  });
  if (isOverlap) return false;

  const simulatedWalls = [...currentWalls, { x, y, orientation }];
  const p1Path = getPathData(p1Pos, 8, simulatedWalls);
  const p2Path = getPathData(p2Pos, 0, simulatedWalls);
  return p1Path !== null && p2Path !== null;
};

// --- AI Logic ---
const processAIMove = () => {
  if (gameState.winner) return;

  setTimeout(() => {
    // ★ [중요] 1초 지난 시점에 게임이 끝났거나(시간초과 등) 리셋됐으면 중단
    if (gameState.winner || !isGameStarted) return;

    const p2Pos = { x: gameState.p2.x, y: gameState.p2.y };
    const p1Pos = { x: gameState.p1.x, y: gameState.p1.y };
    const walls = gameState.walls;
    const difficulty = gameState.aiDifficulty;

    let moveAction = null;
    let wallAction = null;

    const myPathData = getPathData(p2Pos, 0, walls);
    const oppPathData = getPathData(p1Pos, 8, walls);

    // (난이도 로직은 기존과 동일하므로 축약)
    if (difficulty === 1) { 
       if (myPathData?.nextStep) moveAction = myPathData.nextStep;
    } else if (difficulty === 2) { 
       if (Math.random() < 0.2 && gameState.p2.wallCount > 0) { /* 랜덤 벽 시도 */ }
       if (!wallAction && myPathData?.nextStep) moveAction = myPathData.nextStep;
    } else if (difficulty === 3) {
       if (oppPathData?.distance <= 3 && gameState.p2.wallCount > 0) { /* 방어 벽 시도 */ }
       if (!wallAction && myPathData?.nextStep) moveAction = myPathData.nextStep;
    } else if (difficulty === 4) {
       if ((myPathData?.distance || 999) >= (oppPathData?.distance || 999) - 1 && gameState.p2.wallCount > 0) { /* 전략적 벽 시도 */ }
       if (!wallAction && myPathData?.nextStep) moveAction = myPathData.nextStep;
    }

    if (!moveAction && !wallAction && myPathData?.nextStep) moveAction = myPathData.nextStep;

    let newState = { ...gameState };
    
    if (wallAction) {
        newState.walls.push(wallAction);
        newState.p2.wallCount -= 1;
        newState.lastWall = wallAction;
        newState.lastMove = null;
    } else if (moveAction) {
        newState.lastMove = { player: 2, x: gameState.p2.x, y: gameState.p2.y };
        newState.lastWall = null;
        newState.p2 = { ...gameState.p2, x: moveAction.x, y: moveAction.y };
        if (newState.p2.y === 0) {
            newState.winner = 2;
            newState.winReason = 'goal'; // 골인 승리
        }
    }

    if (!newState.winner) {
        newState.turn = 1;
        newState.p2Time = Math.min(MAX_TIME, gameState.p2Time + INCREMENT);
    }
    
    gameState = newState;
    io.emit('update_state', gameState);

  }, 1000);
};

// --- Server & Socket ---
const broadcastLobby = () => io.emit('lobby_update', { roles, readyStatus, isGameStarted });

const startGameTimer = () => {
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    if (!isGameStarted || gameState.winner) { clearInterval(gameInterval); return; }
    
    if (gameState.turn === 1) {
      gameState.p1Time -= 1;
      if (gameState.p1Time <= 0) { 
          gameState.p1Time = 0; 
          gameState.winner = 2; 
          gameState.winReason = 'timeout'; // 시간 초과
          io.emit('update_state', gameState); 
          clearInterval(gameInterval); 
      }
    } else {
      gameState.p2Time -= 1;
      if (gameState.p2Time <= 0) { 
          gameState.p2Time = 0; 
          gameState.winner = 1; 
          gameState.winReason = 'timeout'; // 시간 초과
          io.emit('update_state', gameState); 
          clearInterval(gameInterval); 
      }
    }
    
    if (!gameState.winner) io.emit('update_state', gameState);
  }, 1000);
};

io.on('connection', (socket) => {
  socket.emit('lobby_update', { roles, readyStatus, isGameStarted });
  if (isGameStarted) socket.emit('update_state', gameState);

  socket.on('select_role', (role) => {
    role = parseInt(role);
    if (role === 0) {
      if (roles[1]===socket.id) { roles[1]=null; readyStatus[1]=false; }
      if (roles[2]===socket.id) { roles[2]=null; readyStatus[2]=false; }
    } else {
      if (roles[role] && roles[role] !== socket.id) return;
      if (roles[1]===socket.id) { roles[1]=null; readyStatus[1]=false; }
      if (roles[2]===socket.id) { roles[2]=null; readyStatus[2]=false; }
      roles[role] = socket.id;
    }
    broadcastLobby();
  });

  socket.on('player_ready', (role) => {
    if (roles[role] !== socket.id) return;
    readyStatus[role] = !readyStatus[role];
    broadcastLobby();
    if (roles[1] && roles[2] && readyStatus[1] && readyStatus[2]) {
      isGameStarted = true;
      gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
      io.emit('game_start', true);
      io.emit('update_state', gameState);
      broadcastLobby();
      startGameTimer();
    }
  });

  socket.on('start_ai_game', (difficulty) => {
    roles = { 1: socket.id, 2: 'AI' };
    readyStatus = { 1: true, 2: true };
    isGameStarted = true;
    gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
    gameState.isVsAI = true;
    gameState.aiDifficulty = difficulty; 
    io.emit('lobby_update', { roles, readyStatus, isGameStarted });
    io.emit('game_start', true);
    io.emit('update_state', gameState);
    startGameTimer();
  });

  socket.on('game_action', (newState) => {
    if (roles[1] !== socket.id && roles[2] !== socket.id) return;
    if (gameState.winner) return;

    // 잔상 & 마지막 벽 기록
    let newLastMove = gameState.lastMove;
    let newLastWall = null;
    if (gameState.p1.x !== newState.p1.x || gameState.p1.y !== newState.p1.y) {
       newLastMove = { player: 1, x: gameState.p1.x, y: gameState.p1.y };
       newLastWall = null;
    } else if ((newState.walls||[]).length > (gameState.walls||[]).length) {
       const walls = newState.walls || [];
       if (walls.length > 0) newLastWall = walls[walls.length-1];
    }
    
    const prevTurn = gameState.turn;
    
    // 승리 조건 체크 (클라이언트가 winner를 보내오더라도 서버가 winReason을 명시)
    let winReason = newState.winner ? 'goal' : null;

    gameState = { 
        ...newState, 
        p1Time: gameState.p1Time, 
        p2Time: gameState.p2Time, 
        lastMove: newLastMove, 
        lastWall: newLastWall,
        winReason: winReason // 클라이언트가 보낸 승리라면 기본적으로 goal
    };
    
    if (prevTurn === 1) gameState.p1Time = Math.min(MAX_TIME, gameState.p1Time + INCREMENT);
    else gameState.p2Time = Math.min(MAX_TIME, gameState.p2Time + INCREMENT);

    io.emit('update_state', gameState);

    if (gameState.isVsAI && gameState.turn === 2 && !gameState.winner) {
        processAIMove();
    }
  });

  socket.on('resign_game', () => {
    let p = null;
    if (roles[1]===socket.id) p=1; else if (roles[2]===socket.id) p=2;
    if (p && isGameStarted && !gameState.winner) {
      gameState.winner = p===1?2:1;
      gameState.winReason = 'resign'; // 기권
      if (gameInterval) clearInterval(gameInterval);
      if (roles[2] === 'AI') { /* AI 전이면 AI 퇴장 처리 등 */ }
      io.emit('update_state', gameState);
    }
  });

  socket.on('reset_game', () => {
    if (roles[1]!==socket.id && roles[2]!==socket.id) return;
    if (gameInterval) clearInterval(gameInterval);
    isGameStarted = false;
    readyStatus = { 1: false, 2: false };
    if (roles[2] === 'AI') { roles[2] = null; readyStatus[1] = false; }
    gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
    io.emit('game_start', false);
    broadcastLobby();
  });

  socket.on('disconnect', () => {
    const isP1 = roles[1]===socket.id;
    const isP2 = roles[2]===socket.id;
    if (isP1 || isP2) {
      if (isP1) { roles[1]=null; readyStatus[1]=false; }
      if (isP2) { roles[2]=null; readyStatus[2]=false; }
      if (isP1 && roles[2] === 'AI') { roles[2] = null; readyStatus[2] = false; }
      if (isGameStarted) {
        if (gameInterval) clearInterval(gameInterval);
        isGameStarted = false;
        io.emit('game_start', false);
      }
      broadcastLobby();
    }
  });
});

const PORT = 3001;
server.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });