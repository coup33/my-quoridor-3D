const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
// const { Worker } = require('worker_threads'); // Worker 관련 코드 삭제
// const path = require('path'); // Worker 관련 코드 삭제
// const { minimax } = require('./server/aiCore.cjs'); // Worker에서 사용하므로 메인 스레드에선 제거 가능하지만, 혹시 모르니 주석 처리 or 제거

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://quoridor-3d-client.onrender.com", "https://coup33.github.io"],
    methods: ["GET", "POST"]
  },
  pingTimeout: 10000,
  pingInterval: 5000
});

// [Server] Validation Logic Only
const { inBoard, isValidWall, getPathData } = require('./server/aiCore.cjs');

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
// let aiWorker = null; // Persistent Worker Instance - Worker 관련 코드 삭제

// const processAIMove = () => { // Worker 관련 코드 삭제
//   if (gameState.winner || !isGameStarted || gameState.turn !== 2) return;
//   if (!aiWorker) return; // Worker가 없으면 실행 불가

//   const difficulty = gameState.aiDifficulty;
//   let depth = 1;

//   // 난이도별 Depth 설정
//   if (difficulty === 1) depth = 1;
//   else if (difficulty === 2) depth = 2;
//   else if (difficulty === 3) depth = 3;
//   else if (difficulty === 4) depth = 4;

//   const startTime = Date.now();
//   console.log(`[${new Date().toISOString()}] AI Thinking... Depth: ${depth}`);

//   // Worker에게 작업 지시
//   aiWorker.postMessage({ gameState, depth });

//   // Worker 응답 핸들러는 startAiGame에서 한 번만 등록하거나, 여기서 등록하되 'once'를 쓰면 안됨(Worker는 계속 살아있음).
//   // 하지만 Worker는 하나고 요청도 순차적이므로, on('message')를 여기서 등록하면 리스너가 중복될 수 있음.
//   // 따라서 Worker 생성 시점에 핸들러를 등록하는 것이 좋음.
//   // 구조 변경 필요: startAiGame에서 Worker 생성 및 핸들러 등록.
// };

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
    // 이미 게임 중이면 무시
    if (isGameStarted) return;

    // P1은 요청한 소켓, P2는 'AI'
    roles[1] = socket.id;
    roles[2] = 'AI';
    readyStatus = { 1: true, 2: true };
    isGameStarted = true;
    gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
    gameState.isVsAI = true;
    gameState.aiDifficulty = difficulty;

    console.log(`[${new Date().toISOString()}] AI Game Started. Difficulty: ${difficulty}`);

    // [Server] 더 이상 Worker를 생성하거나 AI 연산을 수행하지 않음.
    // 클라이언트가 계산해서 'game_action'을 보내주길 기다림.
    // Worker 초기화 및 이벤트 핸들러 관련 코드 삭제

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
    // AI 연산은 클라이언트에서 수행하므로 서버에서는 processAIMove 호출하지 않음.
    // if (gameState.isVsAI && gameState.turn === 2 && !gameState.winner) {
    //   global.aiStartTime = Date.now(); // 시간 측정용 전역 변수
    //   processAIMove();
    // }
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
    // [Server] AI Worker 종료 로직 삭제 (클라이언트가 알아서 처리)
    // if (aiWorker) { aiWorker.terminate(); aiWorker = null; } // Worker 정리
    isGameStarted = false;

    roles = { 1: null, 2: null };
    readyStatus = { 1: false, 2: false };

    gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));

    io.emit('game_start', false);
    broadcastLobby();
    io.emit('update_state', gameState); // Reset client state
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
        // [Server] AI Worker는 클라이언트 소관이므로 여기서 종료할 필요 없음
        isGameStarted = false;
        io.emit('game_start', false);
      }
      broadcastLobby();
    }
  });
});

const PORT = 3001;
server.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });