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
  aiDifficulty: 1 // 1:매우쉬움, 2:쉬움, 3:보통, 4:어려움
};

let gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
let roles = { 1: null, 2: null };
let readyStatus = { 1: false, 2: false };
let isGameStarted = false;
let gameInterval = null;

// --- 🧠 AI Helper Functions ---

// 벽 충돌 체크
const isBlocked = (cx, cy, tx, ty, walls) => {
  if (ty < cy) return walls.some(w => w.orientation === 'h' && w.y === ty && (w.x === cx || w.x === cx - 1));
  if (ty > cy) return walls.some(w => w.orientation === 'h' && w.y === cy && (w.x === cx || w.x === cx - 1));
  if (tx < cx) return walls.some(w => w.orientation === 'v' && w.x === tx && (w.y === cy || w.y === cy - 1));
  if (tx > cx) return walls.some(w => w.orientation === 'v' && w.x === cx && (w.y === cy || w.y === cy - 1));
  return false;
};

// BFS: 최단 경로와 거리 계산
// return: { distance: number, nextStep: {x,y}, path: [{x,y}...] }
const getPathData = (startNode, targetRow, currentWalls) => {
  const queue = [{ x: startNode.x, y: startNode.y, dist: 0, parent: null }];
  const visited = new Set();
  visited.add(`${startNode.x},${startNode.y}`);
  const directions = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
  
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.y === targetRow) {
      // 경로 역추적
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
  return null; // 길 없음
};

// 벽 유효성 검사 (겹침 + 길 막힘)
const isValidWall = (x, y, orientation, currentWalls, p1Pos, p2Pos) => {
  // 1. 겹침 체크
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

  // 2. 길 막힘 체크
  const simulatedWalls = [...currentWalls, { x, y, orientation }];
  const p1Path = getPathData(p1Pos, 8, simulatedWalls);
  const p2Path = getPathData(p2Pos, 0, simulatedWalls);
  
  return p1Path !== null && p2Path !== null;
};

// --- 🤖 AI Process Logic ---
const processAIMove = () => {
  if (gameState.winner) return;

  setTimeout(() => {
    const p2Pos = { x: gameState.p2.x, y: gameState.p2.y };
    const p1Pos = { x: gameState.p1.x, y: gameState.p1.y };
    const walls = gameState.walls;
    const difficulty = gameState.aiDifficulty;

    let moveAction = null; // { type: 'move', x, y }
    let wallAction = null; // { type: 'wall', x, y, orientation }

    // 기본적으로 최단 경로 계산
    const myPathData = getPathData(p2Pos, 0, walls);
    const oppPathData = getPathData(p1Pos, 8, walls);

    // AI 레벨별 로직 분기
    // ----------------------------------------------------
    
    // Level 1: 매우 쉬움 (무조건 이동만 함)
    if (difficulty === 1) {
       if (myPathData && myPathData.nextStep) {
         moveAction = myPathData.nextStep;
       }
    }

    // Level 2: 쉬움 (80% 이동, 20% 랜덤 벽 설치)
    else if (difficulty === 2) {
      const randomAction = Math.random();
      if (randomAction > 0.8 && gameState.p2.wallCount > 0) {
         // 랜덤한 위치에 벽 시도
         for(let i=0; i<10; i++) { // 10번 시도
            const rx = Math.floor(Math.random() * 8);
            const ry = Math.floor(Math.random() * 8);
            const rOr = Math.random() > 0.5 ? 'h' : 'v';
            if (isValidWall(rx, ry, rOr, walls, p1Pos, p2Pos)) {
                wallAction = { x: rx, y: ry, orientation: rOr };
                break;
            }
         }
      }
      // 벽 못 놓거나 확률 아니면 이동
      if (!wallAction && myPathData && myPathData.nextStep) {
          moveAction = myPathData.nextStep;
      }
    }

    // Level 3: 보통 (상대가 3칸 내로 오면 방어, 아니면 이동)
    else if (difficulty === 3) {
      if (oppPathData && oppPathData.distance <= 3 && gameState.p2.wallCount > 0) {
         // 상대방 경로의 바로 앞을 막으려 시도
         const targetNode = oppPathData.fullPath[1] || oppPathData.fullPath[0]; // 상대의 다음 스텝
         // 간단히 상대 앞에 가로/세로 벽 시도
         const tryWalls = [
            { x: targetNode.x, y: targetNode.y, o: 'h' },
            { x: targetNode.x - 1, y: targetNode.y, o: 'h' },
            { x: targetNode.x, y: targetNode.y, o: 'v' },
            { x: targetNode.x, y: targetNode.y - 1, o: 'v' }
         ];
         
         for (let w of tryWalls) {
            if (w.x>=0 && w.x<8 && w.y>=0 && w.y<8) {
                if (isValidWall(w.x, w.y, w.o, walls, p1Pos, p2Pos)) {
                    wallAction = { x: w.x, y: w.y, orientation: w.o };
                    break;
                }
            }
         }
      }

      if (!wallAction && myPathData && myPathData.nextStep) {
          moveAction = myPathData.nextStep;
      }
    }

    // Level 4: 어려움 (내가 불리하면 상대방의 최단 경로를 방해, 아니면 최단 이동)
    else if (difficulty === 4) {
      const myDist = myPathData ? myPathData.distance : 999;
      const oppDist = oppPathData ? oppPathData.distance : 999;

      // 내가 불리하거나(거리가 더 멀거나), 비슷할 때 벽으로 견제
      if (myDist >= oppDist - 1 && gameState.p2.wallCount > 0) {
         // 상대방의 최단 경로 상의 좌표들을 순회하며 가장 괴로울 위치 찾기
         let bestWall = null;
         let maxDiff = -Infinity;

         // 상대 경로의 앞쪽 3스텝 정도를 집중 공략
         const checkNodes = oppPathData.fullPath.slice(0, 4);
         
         for (let node of checkNodes) {
             // 해당 노드 주변에 벽을 놓아보고, 상대 거리가 얼마나 늘어나는지 시뮬레이션
             const candidates = [
                { x: node.x, y: node.y, o: 'h' }, { x: node.x -1, y: node.y, o: 'h' },
                { x: node.x, y: node.y, o: 'v' }, { x: node.x, y: node.y -1, o: 'v' },
                { x: node.x, y: node.y -1, o: 'h' } // 약간 변칙
             ];

             for (let cand of candidates) {
                 if (cand.x < 0 || cand.x > 7 || cand.y < 0 || cand.y > 7) continue;
                 if (isValidWall(cand.x, cand.y, cand.o, walls, p1Pos, p2Pos)) {
                     // 시뮬레이션
                     const simWalls = [...walls, {x:cand.x, y:cand.y, orientation:cand.o}];
                     const simOppData = getPathData(p1Pos, 8, simWalls);
                     const simMyData = getPathData(p2Pos, 0, simWalls);
                     
                     if (simOppData && simMyData) {
                         // (상대 거리 증가분) - (내 거리 증가분) 이 클수록 좋음
                         const score = (simOppData.distance - oppDist) - (simMyData.distance - myDist);
                         if (score > maxDiff && score > 0) { // 최소한 상대를 방해해야 함
                             maxDiff = score;
                             bestWall = { x: cand.x, y: cand.y, orientation: cand.o };
                         }
                     }
                 }
             }
         }
         
         if (bestWall && maxDiff > 0) {
             wallAction = bestWall;
         }
      }

      if (!wallAction && myPathData && myPathData.nextStep) {
          moveAction = myPathData.nextStep;
      }
    }
    
    // Fallback: 결정된 게 없으면 그냥 이동
    if (!moveAction && !wallAction && myPathData && myPathData.nextStep) {
        moveAction = myPathData.nextStep;
    }

    // ----------------------------------------------------

    // 최종 실행
    let newState = { ...gameState };
    
    if (wallAction) {
        newState.walls.push(wallAction);
        newState.p2.wallCount -= 1;
        newState.lastWall = wallAction;
        newState.lastMove = null; // 벽 놓으면 이동 잔상 제거? 취향차이.
    } else if (moveAction) {
        newState.lastMove = { player: 2, x: gameState.p2.x, y: gameState.p2.y };
        newState.lastWall = null;
        newState.p2 = { ...gameState.p2, x: moveAction.x, y: moveAction.y };
        if (newState.p2.y === 0) newState.winner = 2;
    } else {
        // 아무것도 못하는 상황 (갇힘? 버그?) -> 턴 넘김
        console.log("AI Stuck or Bug");
    }

    newState.turn = 1;
    newState.p2Time = Math.min(MAX_TIME, gameState.p2Time + INCREMENT);
    
    gameState = newState;
    io.emit('update_state', gameState);

  }, 1000); // 1초 생각
};

// --- Socket Handlers ---
const broadcastLobby = () => io.emit('lobby_update', { roles, readyStatus, isGameStarted });

const startGameTimer = () => {
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    if (!isGameStarted || gameState.winner) { clearInterval(gameInterval); return; }
    if (gameState.turn === 1) {
      gameState.p1Time -= 1;
      if (gameState.p1Time <= 0) { gameState.p1Time = 0; gameState.winner = 2; io.emit('update_state', gameState); clearInterval(gameInterval); }
    } else {
      gameState.p2Time -= 1;
      if (gameState.p2Time <= 0) { gameState.p2Time = 0; gameState.winner = 1; io.emit('update_state', gameState); clearInterval(gameInterval); }
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

  // ★ AI 게임 시작 핸들러 (난이도 포함)
  socket.on('start_ai_game', (difficulty) => {
    roles = { 1: socket.id, 2: 'AI' };
    readyStatus = { 1: true, 2: true };
    isGameStarted = true;
    gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
    gameState.isVsAI = true;
    gameState.aiDifficulty = difficulty; // 난이도 설정

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
    gameState = { ...newState, p1Time: gameState.p1Time, p2Time: gameState.p2Time, lastMove: newLastMove, lastWall: newLastWall };
    
    if (prevTurn === 1) gameState.p1Time = Math.min(MAX_TIME, gameState.p1Time + INCREMENT);
    else gameState.p2Time = Math.min(MAX_TIME, gameState.p2Time + INCREMENT);

    io.emit('update_state', gameState);

    // ★ AI 턴 트리거
    if (gameState.isVsAI && gameState.turn === 2 && !gameState.winner) {
        processAIMove();
    }
  });

  socket.on('resign_game', () => {
    let p = null;
    if (roles[1]===socket.id) p=1; else if (roles[2]===socket.id) p=2;
    if (p && isGameStarted && !gameState.winner) {
      gameState.winner = p===1?2:1;
      if (gameInterval) clearInterval(gameInterval);
      io.emit('update_state', gameState);
    }
  });

  socket.on('reset_game', () => {
    if (roles[1]!==socket.id && roles[2]!==socket.id) return;
    if (gameInterval) clearInterval(gameInterval);
    isGameStarted = false;
    readyStatus = { 1: false, 2: false };
    gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
    io.emit('game_start', false);
    broadcastLobby();
  });

  socket.on('disconnect', () => {
    const isP1 = roles[1]===socket.id;
    if (isP1 || roles[2]===socket.id) {
      if (isP1) { roles[1]=null; readyStatus[1]=false; } else { roles[2]=null; readyStatus[2]=false; }
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
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});