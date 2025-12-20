/**
 * 게임 로직 유틸리티 함수들
 * BFS 경로 탐색, 이동/벽 검증 등
 */

import { BOARD_SIZE, DIRECTIONS } from './constants';

/**
 * 두 셀 사이에 벽이 있는지 확인
 * @param {number} cx - 현재 x 좌표
 * @param {number} cy - 현재 y 좌표
 * @param {number} tx - 목표 x 좌표
 * @param {number} ty - 목표 y 좌표
 * @param {Array} walls - 벽 배열
 * @returns {boolean} 벽이 있으면 true
 */
export const isBlocked = (cx, cy, tx, ty, walls) => {
    // 위로 이동
    if (ty < cy) {
        return walls.some(w => w.orientation === 'h' && w.y === ty && (w.x === cx || w.x === cx - 1));
    }
    // 아래로 이동
    if (ty > cy) {
        return walls.some(w => w.orientation === 'h' && w.y === cy && (w.x === cx || w.x === cx - 1));
    }
    // 왼쪽으로 이동
    if (tx < cx) {
        return walls.some(w => w.orientation === 'v' && w.x === tx && (w.y === cy || w.y === cy - 1));
    }
    // 오른쪽으로 이동
    if (tx > cx) {
        return walls.some(w => w.orientation === 'v' && w.x === cx && (w.y === cy || w.y === cy - 1));
    }
    return false;
};

/**
 * BFS로 목표 행까지 경로가 있는지 확인
 * @param {Object} startNode - 시작 위치 {x, y}
 * @param {number} targetRow - 목표 행 (P1: 8, P2: 0)
 * @param {Array} currentWalls - 현재 벽 배열
 * @returns {boolean} 경로가 있으면 true
 */
export const hasPath = (startNode, targetRow, currentWalls) => {
    const queue = [{ x: startNode.x, y: startNode.y }];
    const visited = new Set();
    visited.add(`${startNode.x},${startNode.y}`);

    while (queue.length > 0) {
        const current = queue.shift();
        if (current.y === targetRow) return true;

        for (let dir of DIRECTIONS) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;

            if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
                if (!visited.has(`${nx},${ny}`) && !isBlocked(current.x, current.y, nx, ny, currentWalls)) {
                    visited.add(`${nx},${ny}`);
                    queue.push({ x: nx, y: ny });
                }
            }
        }
    }
    return false;
};

/**
 * 한 칸 이동이 유효한지 확인 (점프 제외)
 * @param {number} x1 - 시작 x
 * @param {number} y1 - 시작 y
 * @param {number} x2 - 목표 x
 * @param {number} y2 - 목표 y
 * @param {Array} currentWalls - 현재 벽 배열
 * @returns {boolean} 유효하면 true
 */
export const isValidStep = (x1, y1, x2, y2, currentWalls) => {
    // 보드 범위 체크
    if (x2 < 0 || x2 >= BOARD_SIZE || y2 < 0 || y2 >= BOARD_SIZE) return false;
    // 한 칸 이동인지 확인
    if (Math.abs(x1 - x2) + Math.abs(y1 - y2) !== 1) return false;
    // 벽 체크
    return !isBlocked(x1, y1, x2, y2, currentWalls);
};

/**
 * 특정 셀로 이동 가능한지 확인 (점프 포함)
 * @param {number} targetX - 목표 x
 * @param {number} targetY - 목표 y
 * @param {Object} current - 현재 플레이어 위치
 * @param {Object} opponent - 상대 플레이어 위치
 * @param {Array} walls - 벽 배열
 * @returns {boolean} 이동 가능하면 true
 */
export const isMoveable = (targetX, targetY, current, opponent, walls) => {
    // 기본 한 칸 이동
    if (isValidStep(current.x, current.y, targetX, targetY, walls)) {
        // 상대방 위치가 아니면 이동 가능
        if (!(targetX === opponent.x && targetY === opponent.y)) return true;
    }

    // 상대방에게 인접한 경우의 점프 이동
    if (isValidStep(current.x, current.y, opponent.x, opponent.y, walls)) {
        const dx = opponent.x - current.x;
        const dy = opponent.y - current.y;
        const jumpX = opponent.x + dx;
        const jumpY = opponent.y + dy;

        // 직선 점프
        if (targetX === jumpX && targetY === jumpY) {
            return isValidStep(opponent.x, opponent.y, jumpX, jumpY, walls);
        }

        // 대각선 점프 (직선 점프가 막혔을 때)
        if (isValidStep(opponent.x, opponent.y, targetX, targetY, walls)) {
            const isJumpBlocked = jumpX < 0 || jumpX >= BOARD_SIZE ||
                jumpY < 0 || jumpY >= BOARD_SIZE ||
                isBlocked(opponent.x, opponent.y, jumpX, jumpY, walls);
            if (isJumpBlocked && Math.abs(targetX - current.x) === 1 && Math.abs(targetY - current.y) === 1) {
                return true;
            }
        }
    }

    return false;
};

/**
 * 벽 설치가 가능한지 확인
 * @param {number} x - 벽 x 좌표
 * @param {number} y - 벽 y 좌표
 * @param {string} orientation - 벽 방향 ('h' 또는 'v')
 * @param {Array} walls - 현재 벽 배열
 * @param {Object} player1 - 플레이어1 위치
 * @param {Object} player2 - 플레이어2 위치
 * @returns {boolean} 설치 가능하면 true
 */
export const canPlaceWall = (x, y, orientation, walls, player1, player2) => {
    // 벽 겹침 확인
    const isOverlap = walls.some(w => {
        // 같은 위치, 같은 방향
        if (w.x === x && w.y === y && w.orientation === orientation) return true;
        // 같은 방향, 인접 위치
        if (w.orientation === orientation) {
            if (orientation === 'h' && w.y === y && Math.abs(w.x - x) === 1) return true;
            if (orientation === 'v' && w.x === x && Math.abs(w.y - y) === 1) return true;
        }
        // 같은 위치, 다른 방향 (교차)
        if (w.x === x && w.y === y && w.orientation !== orientation) return true;
        return false;
    });

    if (isOverlap) return false;

    // 경로 막힘 확인 (BFS)
    const simulatedWalls = [...walls, { x, y, orientation }];
    const p1CanReach = hasPath(player1, 8, simulatedWalls);
    const p2CanReach = hasPath(player2, 0, simulatedWalls);

    return p1CanReach && p2CanReach;
};

/**
 * 벽 스타일 계산 (위치)
 * @param {Object} wall - 벽 객체 {x, y, orientation}
 * @returns {Object} CSS 스타일 객체
 */
export const getWallStyle = (wall) => {
    if (wall.orientation === 'v') {
        return {
            left: `calc(${wall.x} * var(--unit-size) + var(--cell-size))`,
            top: `calc(${wall.y} * var(--unit-size))`
        };
    } else {
        return {
            left: `calc(${wall.x} * var(--unit-size))`,
            top: `calc(${wall.y} * var(--unit-size) + var(--cell-size))`
        };
    }
};

/**
 * 벽 타겟 스타일 계산
 */
export const getVWallStyle = (x, y) => ({
    left: `calc(${x} * var(--unit-size) + var(--cell-size))`,
    top: `calc(${y} * var(--unit-size))`
});

export const getHWallStyle = (x, y) => ({
    left: `calc(${x} * var(--unit-size))`,
    top: `calc(${y} * var(--unit-size) + var(--cell-size))`
});
