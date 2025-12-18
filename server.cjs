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

const INITIAL_GAME_STATE = {
  p1: { x: 4, y: 0, wallCount: 10 },
  p2: { x: 4, y: 8, wallCount: 10 },
  turn: 1,
  walls: [],
  winner: null
};

let gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
let roles = { 1: null, 2: null };
let readyStatus = { 1: false, 2: false };
let isGameStarted = false;

const broadcastLobby = () => {
  io.emit('lobby_update', { roles, readyStatus, isGameStarted });
};

io.on('connection', (socket) => {
  console.log(`[접속] ${socket.id}`);

  socket.emit('lobby_update', { roles, readyStatus, isGameStarted });
  if (isGameStarted) socket.emit('update_state', gameState);

  // 역할 선택
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

  // 준비 완료
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
    }
  });

  // 게임 액션
  socket.on('game_action', (newState) => {
    // 보안: 실제 플레이어만 게임 상태를 바꿀 수 있음
    if (roles[1] !== socket.id && roles[2] !== socket.id) return;
    
    gameState = newState;
    io.emit('update_state', gameState);
  });

  // 게임 초기화 (리셋)
  socket.on('reset_game', () => {
    // 보안: 관전자는 리셋 버튼을 눌러도 서버가 무시함
    if (roles[1] !== socket.id && roles[2] !== socket.id) return;

    isGameStarted = false;
    readyStatus = { 1: false, 2: false };
    gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
    
    io.emit('game_start', false);
    broadcastLobby();
  });

  // *** 접속 종료 처리 (핵심 수정) ***
  socket.on('disconnect', () => {
    console.log(`[퇴장] ${socket.id}`);
    
    // 나간 사람이 P1 또는 P2인지 확인
    const isP1 = roles[1] === socket.id;
    const isP2 = roles[2] === socket.id;

    // 플레이어가 나간 경우에만 자리 비우기 및 게임 종료
    if (isP1 || isP2) {
      if (isP1) { roles[1] = null; readyStatus[1] = false; }
      if (isP2) { roles[2] = null; readyStatus[2] = false; }
      
      // 게임 중이었는데 선수가 나가면 게임 펑!
      if (isGameStarted) {
        isGameStarted = false;
        io.emit('game_start', false);
      }
      broadcastLobby();
    } 
    // 관전자가 나간 경우는 아무 일도 일어나지 않음 (로그만 찍힘)
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});