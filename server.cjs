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

// [설정] 시간 규칙
const MAX_TIME = 120; // 최대 시간 (100% 게이지)
const START_TIME = 90; // 시작 시간
const INCREMENT = 7;   // 한 수 둘 때마다 추가되는 시간

const INITIAL_GAME_STATE = {
  p1: { x: 4, y: 0, wallCount: 10 },
  p2: { x: 4, y: 8, wallCount: 10 },
  turn: 1,
  walls: [],
  winner: null,
  // ★ 시간 상태 추가
  p1Time: START_TIME,
  p2Time: START_TIME
};

let gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
let roles = { 1: null, 2: null };
let readyStatus = { 1: false, 2: false };
let isGameStarted = false;

// ★ 타이머 변수
let gameInterval = null;

const broadcastLobby = () => {
  io.emit('lobby_update', { roles, readyStatus, isGameStarted });
};

// ★ 타이머 시작 함수
const startGameTimer = () => {
  if (gameInterval) clearInterval(gameInterval);
  
  gameInterval = setInterval(() => {
    if (!isGameStarted || gameState.winner) {
      clearInterval(gameInterval);
      return;
    }

    // 현재 턴인 플레이어의 시간 차감
    if (gameState.turn === 1) {
      gameState.p1Time -= 1;
      if (gameState.p1Time <= 0) {
        gameState.p1Time = 0;
        gameState.winner = 2; // P1 시간초과 -> P2 승리
        io.emit('update_state', gameState);
        clearInterval(gameInterval);
      }
    } else {
      gameState.p2Time -= 1;
      if (gameState.p2Time <= 0) {
        gameState.p2Time = 0;
        gameState.winner = 1; // P2 시간초과 -> P1 승리
        io.emit('update_state', gameState);
        clearInterval(gameInterval);
      }
    }
    
    // 1초마다 시간 업데이트 전송 (너무 잦으면 부하가 걸릴 수 있으나, 이 정도 규모엔 괜찮음)
    // 최적화를 위해 시간이 변했을 때만 보내지만, 여기선 단순화
    // (단, 'game_action' 이벤트와 겹치지 않게 주의 필요하지만, 소켓IO가 순서 보장함)
    if (!gameState.winner) {
        // 전체 상태를 다 보내기보단 시간만 보내는게 좋지만, 구조 유지를 위해 전체 전송
        // (클라이언트 렌더링 최적화는 리액트가 알아서 함)
        // 단, 너무 빈번한 전송을 막으려면 클라이언트 추측+동기화를 써야하지만
        // 여기선 1초마다 broadcast 방식을 사용합니다.
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
      // ★ 게임 시작 시 타이머 가동
      startGameTimer();
    }
  });

  // 게임 액션 (말 이동, 벽 설치)
  socket.on('game_action', (newState) => {
    if (roles[1] !== socket.id && roles[2] !== socket.id) return;
    if (gameState.winner) return; // 게임 끝났으면 무시

    // ★ 시간 추가 로직 (Server Authority)
    // 클라이언트가 보낸 newState의 시간은 무시하고, 서버가 직접 계산해서 덮어씌움
    // 방금 턴을 마친 사람에게 시간을 더해줌
    const previousTurn = gameState.turn;
    
    // 상태 업데이트
    gameState = {
        ...newState,
        // 시간은 서버가 관리하는 현재 시간 값을 유지하되, 턴 넘긴 사람에게 보너스 부여
        p1Time: gameState.p1Time, 
        p2Time: gameState.p2Time
    };

    // 턴을 넘긴 플레이어에게 시간 충전 (+7초, 최대 120초)
    if (previousTurn === 1) {
        gameState.p1Time = Math.min(MAX_TIME, gameState.p1Time + INCREMENT);
    } else {
        gameState.p2Time = Math.min(MAX_TIME, gameState.p2Time + INCREMENT);
    }

    io.emit('update_state', gameState);
  });

  socket.on('reset_game', () => {
    if (roles[1] !== socket.id && roles[2] !== socket.id) return;

    if (gameInterval) clearInterval(gameInterval); // 타이머 정지
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
        if (gameInterval) clearInterval(gameInterval); // 타이머 정지
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