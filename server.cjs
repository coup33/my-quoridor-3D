const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// ★ [수정] 시간 규칙 변경
const MAX_TIME = 90;  // 최대 90초
const START_TIME = 60; // 시작 60초
const INCREMENT = 6;   // 1수당 6초 추가

const INITIAL_GAME_STATE = {
  p1: { x: 4, y: 0, wallCount: 10 },
  p2: { x: 4, y: 8, wallCount: 10 },
  turn: 1,
  walls: [],
  winner: null,
  p1Time: START_TIME,
  p2Time: START_TIME
};

let gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
let roles = { 1: null, 2: null };
let readyStatus = { 1: false, 2: false };
let isGameStarted = false;
let gameInterval = null;

const broadcastLobby = () => {
  io.emit('lobby_update', { roles, readyStatus, isGameStarted });
};

const startGameTimer = () => {
  if (gameInterval) clearInterval(gameInterval);
  
  gameInterval = setInterval(() => {
    if (!isGameStarted || gameState.winner) {
      clearInterval(gameInterval);
      return;
    }

    if (gameState.turn === 1) {
      gameState.p1Time -= 1;
      if (gameState.p1Time <= 0) {
        gameState.p1Time = 0;
        gameState.winner = 2; // P1 시간패 -> P2 승리
        io.emit('update_state', gameState);
        clearInterval(gameInterval);
      }
    } else {
      gameState.p2Time -= 1;
      if (gameState.p2Time <= 0) {
        gameState.p2Time = 0;
        gameState.winner = 1; // P2 시간패 -> P1 승리
        io.emit('update_state', gameState);
        clearInterval(gameInterval);
      }
    }
    
    if (!gameState.winner) {
        io.emit('update_state', gameState); 
    }
  }, 1000);
};

io.on('connection', (socket) => {
  console.log(`[접속] ${socket.id}`);

  socket.emit('lobby_update', { roles, readyStatus, isGameStarted });
  if (isGameStarted) socket.emit('update_state', gameState);

  socket.on('select_role', (roleNumber) => {
    roleNumber = parseInt(roleNumber);
    if (roleNumber === 0) {
      if (roles[1] === socket.id) { roles[1] = null; readyStatus[1] = false; }
      if (roles[2] === socket.id) { roles[2] = null; readyStatus[2] = false; }
    } else {
      if (roles[roleNumber] && roles[roleNumber] !== socket.id) return;
      if (roles[1] === socket.id) { roles[1] = null; readyStatus[1] = false; }
      if (roles[2] === socket.id) { roles[2] = null; readyStatus[2] = false; }
      roles[roleNumber] = socket.id;
    }
    broadcastLobby();
  });

  socket.on('player_ready', (roleNumber) => {
    if (roles[roleNumber] !== socket.id) return;
    readyStatus[roleNumber] = !readyStatus[roleNumber];
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

  socket.on('game_action', (newState) => {
    if (roles[1] !== socket.id && roles[2] !== socket.id) return;
    if (gameState.winner) return;

    const previousTurn = gameState.turn;
    
    gameState = {
        ...newState,
        p1Time: gameState.p1Time, 
        p2Time: gameState.p2Time
    };

    if (previousTurn === 1) {
        gameState.p1Time = Math.min(MAX_TIME, gameState.p1Time + INCREMENT);
    } else {
        gameState.p2Time = Math.min(MAX_TIME, gameState.p2Time + INCREMENT);
    }

    io.emit('update_state', gameState);
  });

  // ★ [추가] 기권(항복) 처리
  socket.on('resign_game', () => {
    // 플레이어인지 확인
    let resignPlayer = null;
    if (roles[1] === socket.id) resignPlayer = 1;
    else if (roles[2] === socket.id) resignPlayer = 2;

    if (resignPlayer && isGameStarted && !gameState.winner) {
        gameState.winner = resignPlayer === 1 ? 2 : 1; // 내가 1이면 2승, 2면 1승
        if (gameInterval) clearInterval(gameInterval);
        io.emit('update_state', gameState);
    }
  });

  socket.on('reset_game', () => {
    if (roles[1] !== socket.id && roles[2] !== socket.id) return;

    if (gameInterval) clearInterval(gameInterval);
    isGameStarted = false;
    readyStatus = { 1: false, 2: false };
    gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
    
    io.emit('game_start', false);
    broadcastLobby();
  });

  socket.on('disconnect', () => {
    console.log(`[퇴장] ${socket.id}`);
    const isP1 = roles[1] === socket.id;
    const isP2 = roles[2] === socket.id;

    if (isP1 || isP2) {
      if (isP1) { roles[1] = null; readyStatus[1] = false; }
      if (isP2) { roles[2] = null; readyStatus[2] = false; }
      
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