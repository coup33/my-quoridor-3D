const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

let gameState = {
  p1: { x: 4, y: 0, wallCount: 10 },
  p2: { x: 4, y: 8, wallCount: 10 },
  turn: 1,
  walls: [],
  winner: null
};

// 현재 접속 중인 플레이어 관리
let players = {}; 

io.on('connection', (socket) => {
  console.log('유저 접속:', socket.id);

  // 1. 역할 부여 (빈 자리에 할당)
  let role = null;
  const currentRoles = Object.values(players);
  if (!currentRoles.includes(1)) role = 1;
  else if (!currentRoles.includes(2)) role = 2;
  else role = 0; // 관전자나 정원 초과

  players[socket.id] = role;

  // 접속한 유저에게 본인의 역할과 현재 게임 상태 전송
  socket.emit('assign_role', role);
  socket.emit('init_state', gameState);

  // 2. 행동 수신
  socket.on('game_action', (newState) => {
    // 보안을 위해 서버에서 현재 턴과 보낸 사람의 역할이 맞는지 체크할 수도 있음
    gameState = newState;
    socket.broadcast.emit('update_state', gameState);
  });

  // 3. 리셋
  socket.on('reset_game', (initialState) => {
    gameState = initialState;
    io.emit('update_state', gameState);
  });

  // 4. 접속 종료 시 역할 비우기
  socket.on('disconnect', () => {
    console.log('유저 나감:', socket.id);
    delete players[socket.id];
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});