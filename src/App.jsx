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
  aiDifficulty: 1 
};

let gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
let roles = { 1: null, 2: null };
let readyStatus = { 1: false, 2: false };
let isGameStarted = false;
let gameInterval = null;

// --- 🧠 AI Helper Functions (길찾기 & 검증) ---

// 좌표가 보드 내부인지 확인
const inBoard = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 9;

// 벽 충돌 체크
const isBlocked = (cx, cy, tx, ty, walls) => {
  if (ty < cy) return walls.some(w => w.orientation === 'h' && w.y === ty && (w.x === cx || w.x === cx - 1));
  if (ty > cy) return walls.some(w => w.orientation === 'h' && w.y === cy && (w.x === cx || w.x === cx - 1));
  if (tx < cx) return walls.some(w => w.orientation === 'v' && w.x === tx && (w.y === cy || w.y === cy - 1));
  if (tx > cx) return walls.some(w => w.orientation === 'v' && w.x === cx && (w.y === cy || w.y === cy - 1));
  return false;
};

// BFS: 최단 경로와 거리 계산
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
        nextStep: path.length > 1 ? path[1] : null, // 바로 다음 이동할 칸
        fullPath: path // 전체 경로
      };
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
  return null; // 길 없음
};

// 벽 유효성 검사 (겹침 + 길 막힘)
const isValidWall = (x, y, orientation, currentWalls, p1Pos, p2Pos) => {
  if (x < 0 || x > 7 || y < 0 || y > 7) return false;

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

  // 2. 길 막힘 체크 (Pathfinding)
  const simulatedWalls = [...currentWalls, { x, y, orientation }];
  const p1Path = getPathData(p1Pos, 8, simulatedWalls); // P1은 아래(8)로
  const p2Path = getPathData(p2Pos, 0, simulatedWalls); // P2(AI)는 위(0)로
  
  return p1Path !== null && p2Path !== null;
};

// --- 🤖 AI 핵심 두뇌 (난이도별 로직) ---
const processAIMove = () => {
  if (gameState.winner) return;

  // 1초 딜레이 (사람처럼 생각하는 척)
  setTimeout(() => {
    const p2Pos = { x: gameState.p2.x, y: gameState.p2.y }; // AI
    const p1Pos = { x: gameState.p1.x, y: gameState.p1.y }; // 사람
    const walls = gameState.walls;
    const difficulty = gameState.aiDifficulty;
    const wallCount = gameState.p2.wallCount;

    let moveAction = null; // { x, y }
    let wallAction = null; // { x, y, orientation }

    // 기본적으로 '나'와 '상대'의 최단 경로를 계산
    const myPathData = getPathData(p2Pos, 0, walls);
    const oppPathData = getPathData(p1Pos, 8, walls);

    // ----------------------------------------------------
    // LEVEL 1: 매우 쉬움 (Very Easy)
    // - 전략: 무조건 최단 경로로 이동만 한다. 벽 안 씀.
    // ----------------------------------------------------
    if (difficulty === 1) {
       if (myPathData && myPathData.nextStep) {
         moveAction = myPathData.nextStep;
       }
    }

    // ----------------------------------------------------
    // LEVEL 2: 쉬움 (Easy)
    // - 전략: 주로 이동하지만, 20% 확률로 아무 데나 벽을 둔다. (트롤링 포함)
    // ----------------------------------------------------
    else if (difficulty === 2) {
      const randomChance = Math.random();
      
      // 20% 확률로 벽 설치 시도
      if (randomChance < 0.2 && wallCount > 0) {
         for(let i=0; i<15; i++) { // 15번 랜덤 시도
            const rx = Math.floor(Math.random() * 8);
            const ry = Math.floor(Math.random() * 8);
            const rOr = Math.random() > 0.5 ? 'h' : 'v';
            
            if (isValidWall(rx, ry, rOr, walls, p1Pos, p2Pos)) {
                wallAction = { x: rx, y: ry, orientation: rOr };
                break;
            }
         }
      }
      
      // 벽 결정 안 됐으면 이동
      if (!wallAction && myPathData && myPathData.nextStep) {
          moveAction = myPathData.nextStep;
      }
    }

    // ----------------------------------------------------
    // LEVEL 3: 보통 (Normal)
    // - 전략: 상대가 목표지점 3칸 이내로 오면 급하게 막는다. 아니면 달린다.
    // ----------------------------------------------------
    else if (difficulty === 3) {
      // 상대가 이기기 직전(거리 3 이하)이고 내 벽이 있으면 방어 시도
      if (oppPathData && oppPathData.distance <= 3 && wallCount > 0) {
         // 상대의 예상 경로 바로 앞을 막아본다
         const nextNode = oppPathData.fullPath[1] || oppPathData.fullPath[0]; 
         
         // 막을 수 있는 후보 위치들 (상대 앞 가로/세로)
         const candidates = [
            { x: nextNode.x, y: nextNode.y, o: 'h' },     // 상대 발밑 가로
            { x: nextNode.x - 1, y: nextNode.y, o: 'h' }, // 상대 발밑 왼쪽 가로
            { x: nextNode.x, y: nextNode.y, o: 'v' },     // 상대 옆 세로
            { x: nextNode.x, y: nextNode.y - 1, o: 'v' }  // 상대 옆 위 세로
         ];
         
         for (let cand of candidates) {
            if (isValidWall(cand.x, cand.y, cand.o, walls, p1Pos, p2Pos)) {
                wallAction = { x: cand.x, y: cand.y, orientation: cand.o };
                break; // 하나라도 성공하면 채택
            }
         }
      }

      // 방어할 필요 없거나 방어 실패 시 이동
      if (!wallAction && myPathData && myPathData.nextStep) {
          moveAction = myPathData.nextStep;
      }
    }

    // ----------------------------------------------------
    // LEVEL 4: 어려움 (Hard)
    // - 전략: 시뮬레이션. 내가 불리하면(상대가 더 빠르면) 상대 경로를
    //         가장 크게 늘릴 수 있는 '치명적인 벽'을 찾아 설치한다.
    // ----------------------------------------------------
    else if (difficulty === 4) {
      const myDist = myPathData ? myPathData.distance : 999;
      const oppDist = oppPathData ? oppPathData.distance : 999;

      // 내가 지고 있거나(거리가 멀거나), 비슷할 때(1칸 차이) 견제 들어감
      if (myDist >= oppDist - 1 && wallCount > 0) {
         let bestWall = null;
         let maxDelay = -1; // 상대를 얼마나 늦출 수 있는가?

         // 상대방의 최단 경로 중 앞쪽 5스텝을 분석하여 방해
         const checkNodes = oppPathData.fullPath.slice(0, 5);
         
         // 검사할 후보 벽 리스트 생성
         let candidateWalls = [];
         for (let node of checkNodes) {
             candidateWalls.push(
                { x: node.x, y: node.y, o: 'h' },
                { x: node.x -1, y: node.y, o: 'h' },
                { x: node.x, y: node.y - 1, o: 'h' }, // 한 칸 위도 체크
                { x: node.x, y: node.y, o: 'v' },
                { x: node.x, y: node.y -1, o: 'v' },
                { x: node.x -1, y: node.y, o: 'v' } // 한 칸 옆도 체크
             );
         }

         // 중복 제거 및 시뮬레이션
         for (let cand of candidateWalls) {
             if (isValidWall(cand.x, cand.y, cand.o, walls, p1Pos, p2Pos)) {
                 // 가상으로 벽을 설치해보고 경로 재계산
                 const simWalls = [...walls, {x:cand.x, y:cand.y, orientation:cand.o}];
                 const simOppPath = getPathData(p1Pos, 8, simWalls);
                 const simMyPath = getPathData(p2Pos, 0, simWalls); // 내 길도 막히는지 확인

                 if (simOppPath && simMyPath) {
                     const newOppDist = simOppPath.distance;
                     const newMyDist = simMyPath.distance;
                     
                     // 점수 = (상대가 늘어난 거리) - (내가 늘어난 거리/2)
                     // 즉, 나는 별로 손해 안 보고 상대를 많이 늦추는 벽이 최고
                     const delayScore = (newOppDist - oppDist) - (newMyDist - myDist);

                     // 상대를 2칸 이상 늦출 수 있다면 아주 좋은 벽
                     if (delayScore > maxDelay && delayScore > 0) {
                         maxDelay = delayScore;
                         bestWall = { x: cand.x, y: cand.y, orientation: cand.o };
                     }
                 }
             }
         }
         
         // 좋은 방해 벽을 찾았다면 설치
         if (bestWall && maxDelay > 0) {
             wallAction = bestWall;
         }
      }

      // 견제할 게 없거나 내가 유리하면 그냥 최단 거리 이동
      if (!wallAction && myPathData && myPathData.nextStep) {
          moveAction = myPathData.nextStep;
      }
    }
    
    // ----------------------------------------------------
    // Fallback: 만약 어떤 이유로 아무 행동도 결정 안 됐으면 이동
    if (!moveAction && !wallAction && myPathData && myPathData.nextStep) {
        moveAction = myPathData.nextStep;
    }

    // 최종 상태 업데이트 적용
    let newState = { ...gameState };
    
    if (wallAction) {
        newState.walls.push(wallAction);
        newState.p2.wallCount -= 1;
        newState.lastWall = wallAction;
        newState.lastMove = null; // 벽 뒀으면 이동 잔상 제거 (선택)
    } else if (moveAction) {
        newState.lastMove = { player: 2, x: gameState.p2.x, y: gameState.p2.y }; // 이전 위치 잔상
        newState.lastWall = null;
        newState.p2 = { ...gameState.p2, x: moveAction.x, y: moveAction.y };
        if (newState.p2.y === 0) newState.winner = 2; // AI 승리 체크
    } else {
        console.log("AI: 할 수 있는 게 없어요..."); // 턴 넘김
    }

    // 턴 교체 및 시간 충전
    newState.turn = 1;
    newState.p2Time = Math.min(MAX_TIME, gameState.p2Time + INCREMENT);
    
    gameState = newState;
    io.emit('update_state', gameState);

  }, 1000); // 1초 후 행동
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
  console.log(`[접속] ${socket.id}`);
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

  // ★ AI 게임 시작 핸들러
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

  // 게임 행동 처리
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

    // ★ 사람이 뒀으면 AI 턴 실행
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