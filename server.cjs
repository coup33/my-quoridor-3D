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

// --- 전역 상태 ---
let gameState = {
  p1: { x: 4, y: 0, wallCount: 10 },
  p2: { x: 4, y: 8, wallCount: 10 },
  turn: 1,
  walls: [],
  winner: null
};

// 역할: { 1: socketId, 2: socketId }
let roles = { 1: null, 2: null };
// 준비: { 1: boolean, 2: boolean }
let readyStatus = { 1: false, 2: false };
let isGameStarted = false;

// 상태 전송 도우미 함수 (코드를 깔끔하게)
const broadcastLobby = () => {
  io.emit('lobby_update', { roles, readyStatus, isGameStarted });
};

io.on('connection', (socket) => {
  console.log(`[접속] ${socket.id}`);

  // 1. 접속 시 현재 상태 즉시 전송
  socket.emit('lobby_update', { roles, readyStatus, isGameStarted });
  if (isGameStarted) socket.emit('init_state', gameState);

  // 2. 역할 선택
  socket.on('select_role', (roleNumber) => {
    roleNumber = parseInt(roleNumber); // 숫자로 변환

    // 역할 취소 (0번)
    if (roleNumber === 0) {
      if (roles[1] === socket.id) { roles[1] = null; readyStatus[1] = false; }
      if (roles[2] === socket.id) { roles[2] = null; readyStatus[2] = false; }
    } else {
      // 이미 누가 차지했으면 무시
      if (roles[roleNumber] && roles[roleNumber] !== socket.id) return;

      // 기존 자리 비우기 (자리 이동 시)
      if (roles[1] === socket.id) { roles[1] = null; readyStatus[1] = false; }
      if (roles[2] === socket.id) { roles[2] = null; readyStatus[2] = false; }

      // 새 자리 차지
      roles[roleNumber] = socket.id;
    }

    // *** 중요: 변경 사항을 즉시 모두에게 알림 ***
    broadcastLobby();
  });

  // 3. 준비 완료
  socket.on('player_ready', (roleNumber) => {
    if (roles[roleNumber] !== socket.id) return;

    readyStatus[roleNumber] = !readyStatus[roleNumber]; // 토글
    broadcastLobby();

    // 게임 시작 체크
    if (roles[1] && roles[2] && readyStatus[1] && readyStatus[2]) {
      isGameStarted = true;
      io.emit('game_start', true);
      io.emit('init_state', gameState);
      broadcastLobby();
    }
  });

  // 4. 게임 동작
  socket.on('game_action', (newState) => {
    gameState = newState;
    socket.broadcast.emit('update_state', gameState); // 나 제외 전송
  });

  // 5. 초기화
  socket.on('reset_game', () => {
    gameState = {
      p1: { x: 4, y: 0, wallCount: 10 },
      p2: { x: 4, y: 8, wallCount: 10 },
      turn: 1,
      walls: [],
      winner: null
    };
    isGameStarted = false;
    readyStatus = { 1: false, 2: false };
    
    io.emit('game_start', false);
    io.emit('update_state', gameState);
    broadcastLobby();
  });

  // 6. 연결 종료
  socket.on('disconnect', () => {
    console.log(`[퇴장] ${socket.id}`);
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
  console.log(`서버 실행 중 (${PORT})`);
});