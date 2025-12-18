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

// 초기 상태 상수
const INITIAL_GAME_STATE = {
  p1: { x: 4, y: 0, wallCount: 10 },
  p2: { x: 4, y: 8, wallCount: 10 },
  turn: 1,
  walls: [],
  winner: null
};

// 현재 게임 상태 변수
let gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));

let roles = { 1: null, 2: null };
let readyStatus = { 1: false, 2: false };
let isGameStarted = false;

// 로비 상태 전송 함수
const broadcastLobby = () => {
  io.emit('lobby_update', { roles, readyStatus, isGameStarted });
};

io.on('connection', (socket) => {
  console.log(`[접속] ${socket.id}`);

  // 1. 접속 시 정보 전송
  socket.emit('lobby_update', { roles, readyStatus, isGameStarted });
  if (isGameStarted) socket.emit('update_state', gameState);

  // 2. 역할 선택
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

  // 3. 준비 완료
  socket.on('player_ready', (roleNumber) => {
    if (roles[roleNumber] !== socket.id) return;
    readyStatus[roleNumber] = !readyStatus[roleNumber];
    broadcastLobby();

    // 게임 시작 조건
    if (roles[1] && roles[2] && readyStatus[1] && readyStatus[2]) {
      isGameStarted = true;
      gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)); // 상태 리셋
      
      io.emit('game_start', true);
      io.emit('update_state', gameState); // 초기화된 상태 전송
      broadcastLobby();
    }
  });

  // 4. 게임 액션 (핵심 수정 부분)
  socket.on('game_action', (newState) => {
    // 서버의 상태를 클라이언트가 보낸 최신 상태로 갱신
    gameState = newState;
    
    // *** 중요: 모든 클라이언트에게 최신 상태를 강제로 동기화 ***
    // (보낸 사람 포함 모두가 서버 데이터를 바라보게 함으로써 불일치 해결)
    io.emit('update_state', gameState); 
  });

  // 5. 게임 초기화
  socket.on('reset_game', () => {
    isGameStarted = false;
    readyStatus = { 1: false, 2: false };
    gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
    
    io.emit('game_start', false);
    broadcastLobby();
  });

  // 6. 연결 종료
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