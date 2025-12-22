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
const inBoard = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 9;

const isBlocked = (cx, cy, tx, ty, walls) => {
  if (ty < cy) return walls.some(w => w.orientation === 'h' && w.y === ty && (w.x === cx || w.x === cx - 1));
  if (ty > cy) return walls.some(w => w.orientation === 'h' && w.y === cy && (w.x === cx || w.x === cx - 1));
  if (tx < cx) return walls.some(w => w.orientation === 'v' && w.x === tx && (w.y === cy || w.y === cy - 1));
  if (tx > cx) return walls.some(w => w.orientation === 'v' && w.x === cx && (w.y === cy || w.y === cy - 1));
  return false;
};

const getPathData = (startNode, targetRow, currentWalls, opponentPos = null) => {
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
        // 상대방 위치 체크 - 상대가 있으면 점프 고려
        const isOpponentHere = opponentPos && nx === opponentPos.x && ny === opponentPos.y;

        if (!visited.has(`${nx},${ny}`) && !isBlocked(current.x, current.y, nx, ny, currentWalls)) {
          if (isOpponentHere) {
            // 상대방이 있는 경우: 점프 시도
            const jumpX = nx + dir.dx;
            const jumpY = ny + dir.dy;

            // 직선 점프 가능한지 확인
            if (inBoard(jumpX, jumpY) && !isBlocked(nx, ny, jumpX, jumpY, currentWalls)) {
              if (!visited.has(`${jumpX},${jumpY}`)) {
                visited.add(`${jumpX},${jumpY}`);
                queue.push({ x: jumpX, y: jumpY, dist: current.dist + 1, parent: current });
              }
            } else {
              // 직선 점프 불가 시 대각선 이동 시도
              const diagonals = [
                { dx: dir.dy, dy: dir.dx },  // 90도 회전
                { dx: -dir.dy, dy: -dir.dx } // -90도 회전
              ];
              for (let diag of diagonals) {
                const diagX = nx + diag.dx;
                const diagY = ny + diag.dy;
                if (inBoard(diagX, diagY) && !isBlocked(nx, ny, diagX, diagY, currentWalls)) {
                  if (!visited.has(`${diagX},${diagY}`)) {
                    visited.add(`${diagX},${diagY}`);
                    queue.push({ x: diagX, y: diagY, dist: current.dist + 1, parent: current });
                  }
                }
              }
            }
          } else {
            visited.add(`${nx},${ny}`);
            queue.push({ x: nx, y: ny, dist: current.dist + 1, parent: current });
          }
        }
      }
    }
  }
  return null;
};

const isValidWall = (x, y, orientation, currentWalls, p1Pos, p2Pos) => {
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

// 폰의 유효한 이동 목록 반환 (점프, 대각선 이동 포함)
const getValidMovesForPawn = (pawnPos, opponentPos, walls) => {
  const validMoves = [];
  const directions = [
    { dx: 0, dy: -1 }, // 위
    { dx: 0, dy: 1 },  // 아래
    { dx: -1, dy: 0 }, // 왼쪽
    { dx: 1, dy: 0 }   // 오른쪽
  ];

  for (let dir of directions) {
    const nx = pawnPos.x + dir.dx;
    const ny = pawnPos.y + dir.dy;

    if (!inBoard(nx, ny)) continue;
    if (isBlocked(pawnPos.x, pawnPos.y, nx, ny, walls)) continue;

    // 상대방이 해당 칸에 있는지 확인
    const isOpponentHere = nx === opponentPos.x && ny === opponentPos.y;

    if (isOpponentHere) {
      // 점프 시도: 상대방 너머로 이동
      const jumpX = nx + dir.dx;
      const jumpY = ny + dir.dy;

      if (inBoard(jumpX, jumpY) && !isBlocked(nx, ny, jumpX, jumpY, walls)) {
        // 직선 점프 가능
        validMoves.push({ x: jumpX, y: jumpY });
      } else {
        // 직선 점프 불가 시 대각선 이동
        const diagonals = [
          { dx: dir.dy, dy: dir.dx },   // 90도 회전
          { dx: -dir.dy, dy: -dir.dx }  // -90도 회전
        ];
        for (let diag of diagonals) {
          const diagX = nx + diag.dx;
          const diagY = ny + diag.dy;
          if (inBoard(diagX, diagY) && !isBlocked(nx, ny, diagX, diagY, walls)) {
            validMoves.push({ x: diagX, y: diagY });
          }
        }
      }
    } else {
      // 빈 칸으로 이동
      validMoves.push({ x: nx, y: ny });
    }
  }

  return validMoves;
};


// --- Minimax AI Implementation ---

// 상태 평가 함수
const evaluateState = (state, player) => {
  const p1Pos = state.p1;
  const p2Pos = state.p2;

  // 패스파인딩을 위해 현재 벽 상태 사용
  const walls = state.walls;

  // 목표 지점 (P1: y=8, P2: y=0)
  // AI는 P2(Bot) 기준

  const p1Path = getPathData(p1Pos, 8, walls, p2Pos);
  const p2Path = getPathData(p2Pos, 0, walls, p1Pos);

  // 1. 승리 조건: 내 거리가 0이면 승리
  if (p2Path && p2Path.distance === 0) return 10000;
  // 2. 패배 조건: 상대 거리가 0이면 패배
  if (p1Path && p1Path.distance === 0) return -10000;

  // 3. 갇힘 조건 (길이 없음)
  if (!p2Path) return -5000; // 내가 갇힘
  if (!p1Path) return 5000;  // 상대가 갇힘

  const myDist = p2Path.distance;
  const oppDist = p1Path.distance;

  // 기본 점수: (상대 거리 - 내 거리) * 10
  // 내가 목표에 가까울수록, 상대가 멀수록 유리
  let score = (oppDist - myDist) * 10;

  // 4. 벽 개수 가중치 (벽을 아끼면 가산점)
  // 너무 빨리 다 쓰는 것을 방지 (후반 도모)
  if (state.p2.wallCount > 0) {
    score += state.p2.wallCount * 2;
  }

  // 5. 플레이어 관점에 따른 점수 반환
  // Maximize Player(P2, AI) 입장에서 계산된 점수이므로
  // player === 2이면 그대로, player === 1이면 반대로 반환 (Minimax 구조상)
  return player === 2 ? score : -score;
};

// 간단한 상태 복제 (필요한 속성만)
const cloneGameState = (state) => ({
  p1: { ...state.p1 },
  p2: { ...state.p2 },
  walls: [...state.walls],
  turn: state.turn
});

// 가능한 모든 수 생성 (이동 + 유망한 벽 설치)
const getPossibleMoves = (state, player) => {
  const moves = [];
  const myPos = player === 1 ? state.p1 : state.p2;
  const oppPos = player === 1 ? state.p2 : state.p1;
  const walls = state.walls;
  const wallCount = player === 1 ? state.p1.wallCount : state.p2.wallCount;

  // 1. 이동 (Pawn Moves)
  const validPawnMoves = getValidMovesForPawn(myPos, oppPos, walls);
  validPawnMoves.forEach(pos => {
    moves.push({ type: 'move', x: pos.x, y: pos.y });
  });

  // 2. 벽 설치 (Wall Placements) - 휴리스틱 적용 (성능 최적화)
  // 모든 위치를 다 보면 너무 느림.
  // "상대방의 최단 경로" 주변, "내 위치" 주변 위주로 탐색하되 범위를 제한
  if (wallCount > 0) {
    const oppTargetY = player === 1 ? 0 : 8;

    // 상대방 최단 경로 계산
    const oppPathData = getPathData(oppPos, oppTargetY, walls, myPos);

    // 관심 좌표 집합 (Set으로 중복 제거)
    const candidates = new Set();

    // 상대방 경로상 좌표들 추가 (경로 방해)
    if (oppPathData && oppPathData.fullPath) {
      // [최적화] 전체 경로가 아닌 앞쪽 3~4칸만 고려하여 연산량 대폭 감소
      const lookAhead = 4;
      oppPathData.fullPath.slice(0, lookAhead).forEach(pos => {
        candidates.add(`${pos.x},${pos.y}`);
        // 경로 주변 1칸도 추가
        [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
          candidates.add(`${pos.x + dx},${pos.y + dy}`);
        });
      });
    }

    // 내 주변 방어용 (선택적)
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
      candidates.add(`${myPos.x + dx},${myPos.y + dy}`);
    });

    // 후보 좌표들에 대해 가로/세로 벽 유효성 검사
    candidates.forEach(coord => {
      const [cx, cy] = coord.split(',').map(Number);
      if (inBoard(cx, cy)) {
        ['h', 'v'].forEach(orientation => {
          if (isValidWall(cx, cy, orientation, walls, state.p1, state.p2)) {
            moves.push({ type: 'wall', x: cx, y: cy, orientation });
          }
        });
      }
    });
  }

  // [Move Ordering 최적화]
  // '이동'을 먼저 탐색해야 Alpha-Beta 가지치기가 더 효율적으로 일어남 (점수 변화가 확실하므로)
  // 같은 타입 내에서는 랜덤하게 섞어서 매번 다른 플레이 유도
  const pawnMoves = moves.filter(m => m.type === 'move').sort(() => Math.random() - 0.5);
  const wallMoves = moves.filter(m => m.type === 'wall').sort(() => Math.random() - 0.5);

  return [...pawnMoves, ...wallMoves];
};

// 가상 이동 적용
const applyMove = (state, move) => {
  const newState = cloneGameState(state);
  const player = newState.turn;

  if (move.type === 'move') {
    if (player === 1) newState.p1 = { ...newState.p1, x: move.x, y: move.y };
    else newState.p2 = { ...newState.p2, x: move.x, y: move.y };
  } else if (move.type === 'wall') {
    newState.walls.push({ x: move.x, y: move.y, orientation: move.orientation });
    if (player === 1) newState.p1.wallCount--;
    else newState.p2.wallCount--;
  }

  newState.turn = player === 1 ? 2 : 1;
  return newState;
};

// Minimax Algorithm
const minimax = (state, depth, alpha, beta, isMaximizingPlayer) => {
  const player = isMaximizingPlayer ? 2 : 1; // AI is P2 (Maximizing)

  // 기저 조건: 깊이 도달 or 게임 종료
  const score = evaluateState(state, 2); // 항상 AI(P2) 입장 점수
  if (depth === 0 || score > 5000 || score < -5000) {
    return { score };
  }

  const possibleMoves = getPossibleMoves(state, player);

  if (isMaximizingPlayer) {
    let maxEval = -Infinity;
    let bestMove = null;

    for (let move of possibleMoves) {
      const newState = applyMove(state, move);
      const evalResult = minimax(newState, depth - 1, alpha, beta, false);

      if (evalResult.score > maxEval) {
        maxEval = evalResult.score;
        bestMove = move;
      }
      alpha = Math.max(alpha, evalResult.score);
      if (beta <= alpha) break; // Pruning
    }
    return { score: maxEval, move: bestMove || possibleMoves[0] };
  } else {
    let minEval = Infinity;
    let bestMove = null;

    for (let move of possibleMoves) {
      const newState = applyMove(state, move);
      const evalResult = minimax(newState, depth - 1, alpha, beta, true);

      if (evalResult.score < minEval) {
        minEval = evalResult.score;
        bestMove = move;
      }
      beta = Math.min(beta, evalResult.score);
      if (beta <= alpha) break; // Pruning
    }
    return { score: minEval, move: bestMove || possibleMoves[0] };
  }
};

const processAIMove = () => {
  if (gameState.winner) return;

  // 비동기 처럼 보이게 하여 서버 블로킹 최소화 느낌 주기 (실제 계산은 동기)
  setTimeout(() => {
    if (gameState.winner || !isGameStarted || gameState.turn !== 2) return;

    const difficulty = gameState.aiDifficulty;
    let depth = 1;

    // 난이도별 Depth 설정
    if (difficulty === 1) depth = 1;      // Easy: 바로 앞만 봄 (Greedy)
    else if (difficulty === 2) depth = 2; // Medium: 2수 앞 (내 공격 + 상대 방어)
    else if (difficulty === 3) depth = 3; // Hard: 3수 앞
    else if (difficulty === 4) depth = 4; // Expert: 4수 앞 (깊은 수읽기)

    // AI 계산 시작
    // console.log(`AI Thinking... Difficulty: ${difficulty}, Depth: ${depth}`);

    // 첫 수는 오프닝 라이브러리처럼 중앙 선점 유도 (선택적)

    const result = minimax(gameState, depth, -Infinity, Infinity, true);
    const bestMove = result.move;

    if (bestMove) {
      const newState = { ...gameState };

      if (bestMove.type === 'move') {
        newState.lastMove = { player: 2, x: gameState.p2.x, y: gameState.p2.y };
        newState.lastWall = null;
        newState.p2 = { ...gameState.p2, x: bestMove.x, y: bestMove.y };

        // 승리 체크
        if (newState.p2.y === 0) {
          newState.winner = 2;
          newState.winReason = 'goal';
        }
      } else if (bestMove.type === 'wall') {
        const wall = { x: bestMove.x, y: bestMove.y, orientation: bestMove.orientation };
        newState.walls.push(wall);
        newState.p2.wallCount--;
        newState.lastWall = wall;
        newState.lastMove = null;
      }

      // 턴 넘김 및 시간 업데이트
      if (!newState.winner) {
        newState.turn = 1;
        newState.p2Time = Math.min(MAX_TIME, gameState.p2Time + INCREMENT);
      }

      // 전역 상태 업데이트
      gameState = newState;
      io.emit('update_state', gameState);
    } else {
      // 움직일 수 없는 경우 (거의 없지만 방어 코드)
      console.log("AI has no moves available.");
    }

  }, 500); // 0.5초 딜레이로 "생각하는 척" 연출
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
      if (roles[1] === socket.id) { roles[1] = null; readyStatus[1] = false; }
      if (roles[2] === socket.id) { roles[2] = null; readyStatus[2] = false; }
    } else {
      if (roles[role] && roles[role] !== socket.id) return;
      if (roles[1] === socket.id) { roles[1] = null; readyStatus[1] = false; }
      if (roles[2] === socket.id) { roles[2] = null; readyStatus[2] = false; }
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

    // ★ [핵심] 클라이언트 상태를 덮어쓰되, 중요한 서버 설정(AI여부 등)은 보존
    const preservedState = {
      isVsAI: gameState.isVsAI,
      aiDifficulty: gameState.aiDifficulty,
      p1Time: gameState.p1Time, // 시간은 서버 기준
      p2Time: gameState.p2Time
    };

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
    else if ((newState.walls || []).length > (gameState.walls || []).length) {
      const walls = newState.walls || [];
      if (walls.length > 0) newLastWall = walls[walls.length - 1];
    }

    const prevTurn = gameState.turn;
    let winReason = newState.winner ? 'goal' : null;

    // 상태 병합
    gameState = {
      ...newState,
      ...preservedState, // AI 설정 유지!
      lastMove: newLastMove,
      lastWall: newLastWall,
      winReason: winReason
    };

    if (prevTurn === 1) gameState.p1Time = Math.min(MAX_TIME, gameState.p1Time + INCREMENT);
    else gameState.p2Time = Math.min(MAX_TIME, gameState.p2Time + INCREMENT);

    io.emit('update_state', gameState);

    // ★ [핵심] AI 턴이면 실행 (이제 isVsAI가 사라지지 않으므로 정상 작동)
    if (gameState.isVsAI && gameState.turn === 2 && !gameState.winner) {
      processAIMove();
    }
  });

  socket.on('resign_game', () => {
    let p = null;
    if (roles[1] === socket.id) p = 1; else if (roles[2] === socket.id) p = 2;
    if (p && isGameStarted && !gameState.winner) {
      gameState.winner = p === 1 ? 2 : 1;
      gameState.winReason = 'resign';
      if (gameInterval) clearInterval(gameInterval);
      io.emit('update_state', gameState);
    }
  });

  socket.on('reset_game', () => {
    if (roles[1] !== socket.id && roles[2] !== socket.id) return;

    if (gameInterval) clearInterval(gameInterval);
    isGameStarted = false;

    roles = { 1: null, 2: null };
    readyStatus = { 1: false, 2: false };

    gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));

    io.emit('game_start', false);
    broadcastLobby();
  });

  socket.on('disconnect', () => {
    const isP1 = roles[1] === socket.id;
    const isP2 = roles[2] === socket.id;
    if (isP1 || isP2) {
      if (isP1) { roles[1] = null; readyStatus[1] = false; }
      if (isP2) { roles[2] = null; readyStatus[2] = false; }

      if (isP1 && roles[2] === 'AI') {
        roles[2] = null;
        readyStatus[2] = false;
      }

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