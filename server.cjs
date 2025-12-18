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

// 초기 게임 상태 (상수)
const INITIAL_GAME_STATE = {
  p1: { x: 4, y: 0, wallCount: 10 },
  p2: { x: 4, y: 8, wallCount: 10 },
  turn: 1,
  walls: [],
  winner: null
};

// 변하는 게임 상태
let gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));

let roles = { 1: null, 2: null };
let readyStatus = { 1: false, 2: false };
let isGameStarted = false;

const broadcastLobby = () => {
  io.emit('lobby_update', { roles, readyStatus, isGameStarted });
};

io.on('connection', (socket) => {
  console.log(`[접속] ${socket.id}`);

  // 1. 접속 시 로비 상태와 게임 상태 모두 전송
  socket.emit('lobby_update', { roles, readyStatus, isGameStarted });
  // 게임 중이라면 현재 보드 상태도 보냄
  if (isGameStarted) socket.emit('update_state', gameState);

  // 2. 역할 선택
  socket.on('select_role', (roleNumber) => {
    roleNumber = parseInt(roleNumber);
    if (roleNumber === 0) { // 역할 취소
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

  // 3. 준비 완료
  socket.on('player_ready', (roleNumber) => {
    if (roles[roleNumber] !== socket.id) return;
    readyStatus[roleNumber] = !readyStatus[roleNumber];
    broadcastLobby();

    // 둘 다 준비되면 게임 시작
    if (roles[1] && roles[2] && readyStatus[1] && readyStatus[2]) {
      isGameStarted = true;
      // 게임 상태 초기화 후 시작
      gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
      
      io.emit('game_start', true);
      io.emit('init_state', gameState); // 클라이언트에게 초기화 명령
      broadcastLobby();
    }
  });

  // 4. 게임 액션
  socket.on('game_action', (newState) => {
    gameState = newState;
    socket.broadcast.emit('update_state', gameState);
  });

  // 5. 초기화 요청
  socket.on('reset_game', () => {
    isGameStarted = false;
    readyStatus = { 1: false, 2: false };
    gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
    
    io.emit('game_start', false);
    broadcastLobby();
  });

  socket.on('disconnect', () => {
    if (roles[1] === socket.id) { roles[1] = null; readyStatus[1] = false; }
    if (roles[2] === socket.id) { roles[2] = null; readyStatus[2] = false; }
    if (isGameStarted) {
      isGameStarted = false;
      io.emit('game_start', false);
    }
    broadcastLobby();
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});