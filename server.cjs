const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Worker } = require('worker_threads');
const path = require('path');
// const { minimax } = require('./server/aiCore.cjs'); // Worker에서 사용하므로 메인 스레드에선 제거 가능하지만, 혹시 모르니 주석 처리 or 제거

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



const processAIMove = () => {
  if (gameState.winner) return;
  if (!isGameStarted || gameState.turn !== 2) return;

  const difficulty = gameState.aiDifficulty;
  let depth = 1;

  // 난이도별 Depth 설정
  if (difficulty === 1) depth = 1;      // Easy
  else if (difficulty === 2) depth = 2; // Medium
  else if (difficulty === 3) depth = 3; // Hard
  else if (difficulty === 4) depth = 4; // Expert

  const startTime = Date.now();
  const minDelay = 1000; // AI가 너무 빨리 두는 것을 방지하기 위한 최소 딜레이 (1초)

  // Worker 생성 및 실행
  const workerPath = path.resolve(__dirname, 'server/aiWorker.cjs');
  const worker = new Worker(workerPath);

  worker.postMessage({ gameState, depth });

  worker.on('message', ({ success, result, error }) => {
    if (success) {
      const bestMove = result.move;
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      const computeSeconds = Math.floor(elapsed / 1000);

      // AI 연산 시간만큼 타이머 차감 (최소 딜레이 대기 시간 포함X, 순수 연산 시간만)
      if (computeSeconds > 0) {
        gameState.p2Time -= computeSeconds;
        if (gameState.p2Time <= 0) {
          gameState.p2Time = 0;
          gameState.winner = 1;
          gameState.winReason = 'timeout';
          io.emit('update_state', gameState);
          worker.terminate();
          return;
        }
      }

      // 최소 딜레이 보장 (연산이 빨라도 minDelay만큼은 기다림)
      const remainingDelay = Math.max(0, minDelay - elapsed);

      setTimeout(() => {
        if (gameState.winner) { worker.terminate(); return; } // 기다리는 동안 게임 끝났으면 종료

        if (bestMove) {
          const newState = { ...gameState };

          if (bestMove.type === 'move') {
            newState.lastMove = { player: 2, x: gameState.p2.x, y: gameState.p2.y };
            newState.lastWall = null;
            newState.p2 = { ...gameState.p2, x: bestMove.x, y: bestMove.y };

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

          if (!newState.winner) {
            newState.turn = 1;
            newState.p2Time = Math.min(MAX_TIME, gameState.p2Time + INCREMENT);
          }

          gameState = newState;
          io.emit('update_state', gameState);
        } else {
          console.log("AI has no moves available.");
        }
        worker.terminate(); // 작업 완료 후 Worker 종료
      }, remainingDelay);

    } else {
      console.error("AI Worker Error:", error);
      worker.terminate();
    }
  });

  worker.on('error', (err) => {
    console.error("Worker Thread Error:", err);
    worker.terminate();
  });

  worker.on('exit', (code) => {
    if (code !== 0) console.error(`Worker stopped with exit code ${code}`);
  });
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