/**
 * 게임 상수 정의
 * 서버와 클라이언트에서 공통으로 사용되는 설정값들
 */

// 서버 연결 주소
export const SOCKET_URL = 'https://my-quoridor.onrender.com';

// 보드 설정
export const BOARD_SIZE = 9;
export const MAX_WALLS = 10;

// 타이머 설정 (테스트용 300초)
export const MAX_TIME = 300;
export const START_TIME = 300;
export const TIME_INCREMENT = 6;

// 초기 게임 상태
export const INITIAL_STATE = {
  p1: { x: 4, y: 0, wallCount: MAX_WALLS },
  p2: { x: 4, y: 8, wallCount: MAX_WALLS },
  turn: 1,
  walls: [],
  winner: null,
  p1Time: START_TIME,
  p2Time: START_TIME,
  lastMove: null,
  lastWall: null,
  winReason: null
};

// 이동 방향 (BFS용)
export const DIRECTIONS = [
  { dx: 0, dy: -1 },  // 위
  { dx: 0, dy: 1 },   // 아래
  { dx: -1, dy: 0 },  // 왼쪽
  { dx: 1, dy: 0 }    // 오른쪽
];

// 사운드 이름
export const SOUND_NAMES = {
  MOVE: 'move',
  WALL: 'wall',
  START: 'start',
  WIN: 'win',
  LOSE: 'lose'
};

// 승리 이유
export const WIN_REASONS = {
  GOAL: 'goal',
  TIMEOUT: 'timeout',
  RESIGN: 'resign'
};

// 액션 모드
export const ACTION_MODES = {
  MOVE: 'move',
  WALL: 'wall'
};

// 벽 방향
export const WALL_ORIENTATIONS = {
  HORIZONTAL: 'h',
  VERTICAL: 'v'
};
