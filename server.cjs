const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

// pingTimeout: 10초 (네트워크 끊김 방지 최적화)
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 10000, 
  pingInterval: 5000 
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
  winReason: null
};

let gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
let roles = { 1: null, 2: null };
let readyStatus = { 1: false, 2: false };
let isGameStarted = false;
let gameInterval = null;

// --- Helper Functions ---
// 보드 내부인지 확인
const inBoard = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 9;

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
      return { distance: current.dist, nextStep: path.length > 1 ? path[1] : null, fullPath: path };
    }
    for (let dir of directions) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      if (inBoard(nx, ny)) {
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
  // 범위 체크
  if (x < 0 || x > 7 || y < 0 || y > 7) return false;

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


// --- AI Logic (활성화됨) ---
const processAIMove = () => {
  if (gameState.winner) return;
  setTimeout(() => {
    // 턴이 바뀌었거나 게임이 끝났으면 중단
    if (gameState.winner || !isGameStarted || gameState.turn !== 2) return;

    const p2Pos = { x: gameState.p2.x, y: gameState.p2.y };
    const p1Pos = { x: gameState.p1.x, y: gameState.p1.y };
    const walls = gameState.walls;
    const difficulty = gameState.aiDifficulty;

    let moveAction = null;
    let wallAction = null;

    const myPathData = getPathData(p2Pos, 0, walls);
    const oppPathData = getPathData(p1Pos, 8, walls);

    // 난이도별 로직
    if (difficulty === 1) { 
       // 매우 쉬움: 그냥 달림
       if (myPathData?.nextStep) moveAction = myPathData.nextStep;
    } else if (difficulty === 2) { 
       // 쉬움: 가끔 랜덤 벽
       if (Math.random() < 0.2 && gameState.p2.wallCount > 0) {
          for(let i=0; i<15; i++) {
             const rx = Math.floor(Math.random() * 8);
             const ry = Math.floor(Math.random() * 8);
             const rOr = Math.random() > 0.5 ? 'h' : 'v';
             if (isValidWall(rx, ry, rOr, walls, p1Pos, p2Pos)) {
                 wallAction = { x: rx, y: ry, orientation: rOr };
                 break;
             }
          }
       }
       if (!wallAction && myPathData?.nextStep) moveAction = myPathData.nextStep;
    } else if (difficulty === 3) {
       // 보통: 상대 방어
       if (oppPathData?.distance <= 3 && gameState.p2.wallCount > 0) {
          const nextNode = oppPathData.fullPath[1] || oppPathData.fullPath[0];
          const candidates = [
             { x: nextNode.x, y: nextNode.y, o: 'h' },
             { x: nextNode.x - 1, y: nextNode.y, o: 'h' },
             { x: nextNode.x, y: nextNode.y, o: 'v' },
             { x: nextNode.x, y: nextNode.y - 1, o: 'v' }
          ];
          for (let cand of candidates) {
             if (isValidWall(cand.x, cand.y, cand.o, walls, p1Pos, p2Pos)) {
                 wallAction = { x: cand.x, y: cand.y, orientation: cand.o };
                 break;
             }
          }
       }
       if (!wallAction && myPathData?.nextStep) moveAction = myPathData.nextStep;
    } else if (difficulty === 4) {
       // 어려움: 전략적 벽 (현재는 3단계와 유사하지만 추후 확장 가능)
       if ((myPathData?.distance || 999) >= (oppPathData?.distance || 999) - 1 && gameState.p2.wallCount > 0) { 
           // ... (간소화)
       }
       if (!wallAction && myPathData?.nextStep) moveAction = myPathData.nextStep;
    }

    // 만약 결정된 게 없으면(길이 막혔거나 등등) 최단 경로 이동 시도
    if (!moveAction && !wallAction && myPathData?.nextStep) moveAction = myPathData.nextStep;

    // 그래도 없으면(갇힘?) 랜덤 이동 시도 (비상 대책)
    if (!moveAction && !wallAction) {
        const neighbors = [
            {x: p2Pos.x, y: p2Pos.y-1}, {x: p2Pos.x, y: p2Pos.y+1},
            {x: p2Pos.x-1, y: p2Pos.y}, {x: p2Pos.x+1, y: p2Pos.y}
        ];
        for (let n of neighbors) {
            if (inBoard(n.x, n.y) && !isBlocked(p2Pos.x, p2Pos.y, n.x, n.y, walls)) {
                moveAction = n;
                break;
            }
        }
    }

    // 상태 업데이트
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
            newState.winReason = 'goal';
        }
    }

    if (!newState.winner) {
        newState.turn = 1; // 턴 넘김
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
          gameState.winReason = 'timeout'; 
          io.emit('update_state', gameState); 
          clearInterval(gameInterval); 
      }
    } else {
      gameState.p2Time -= 1;
      if (gameState.p2Time <= 0) { 
          gameState.p2Time = 0; 
          gameState.winner = 1; 
          gameState.winReason = 'timeout'; 
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

    // 흑색(P2) 이동 감지 로직 강화
    let newLastMove = gameState.lastMove;
    let newLastWall = null;

    if (gameState.p1.x !== newState.p1.x || gameState.p1.y !== newState.p1.y) {
       newLastMove = { player: 1, x: gameState.p1.x, y: gameState.p1.y };
       newLastWall = null;
    } 
    else if (gameState.p2.x !== newState.p2.x || gameState.p2.y !== newState.p2.y) {
       newLastMove = { player: 2, x: gameState.p2.x, y: gameState.p2.y };
       newLastWall = null;
    }
    else if ((newState.walls||[]).length > (gameState.walls||[]).length) {
       const walls = newState.walls || [];
       if (walls.length > 0) newLastWall = walls[walls.length-1];
    }
    
    const prevTurn = gameState.turn;
    let winReason = newState.winner ? 'goal' : null;

    gameState = { 
        ...newState, 
        p1Time: gameState.p1Time, 
        p2Time: gameState.p2Time, 
        lastMove: newLastMove, 
        lastWall: newLastWall,
        winReason: winReason 
    };

    if (prevTurn === 1) gameState.p1Time = Math.min(MAX_TIME, gameState.p1Time + INCREMENT);
    else gameState.p2Time = Math.min(MAX_TIME, gameState.p2Time + INCREMENT);

    io.emit('update_state', gameState);

    // ★ [핵심] 여기서 AI 턴인지 확인하고 실행!
    if (gameState.isVsAI && gameState.turn === 2 && !gameState.winner) {
        processAIMove();
    }
  });

  socket.on('resign_game', () => {
    let p = null;
    if (roles[1]===socket.id) p=1; else if (roles[2]===socket.id) p=2;
    if (p && isGameStarted && !gameState.winner) {
      gameState.winner = p===1?2:1;
      gameState.winReason = 'resign';
      if (gameInterval) clearInterval(gameInterval);
      io.emit('update_state', gameState);
    }
  });

  socket.on('reset_game', () => {
    if (roles[1]!==socket.id && roles[2]!==socket.id) return; 
    
    if (gameInterval) clearInterval(gameInterval);
    isGameStarted = false;
    
    // 역할까지 모두 초기화
    roles = { 1: null, 2: null }; 
    readyStatus = { 1: false, 2: false };
    
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
      
      // AI 모드가 아닐 때, 실제 플레이어가 나가면 게임 종료
      if (isGameStarted) {
        if (gameInterval) clearInterval(gameInterval);
        isGameStarted = false;
        io.emit('game_start', false);
        console.log(`Player disconnected: ${socket.id}. Game reset.`);
      }
      broadcastLobby();
    }
  });
});

const PORT = 3001;
server.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });