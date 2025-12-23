/**
 * aiCore.js
 * Quoridor AI - Iterative Deepening with Time Management
 * 
 * 핵심 설계:
 * - 반복 심화 탐색 (Iterative Deepening): 시간이 허락하는 한 깊이 계산
 * - 시간 제한: 3초 (3000ms)
 * - 순수 Minimax + Alpha-Beta Pruning
 */

// ==========================================
// 1. Helper Functions
// ==========================================

export const inBoard = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 9;

export const isBlocked = (cx, cy, tx, ty, walls) => {
    if (ty < cy) return walls.some(w => w.orientation === 'h' && w.y === ty && (w.x === cx || w.x === cx - 1));
    if (ty > cy) return walls.some(w => w.orientation === 'h' && w.y === cy && (w.x === cx || w.x === cx - 1));
    if (tx < cx) return walls.some(w => w.orientation === 'v' && w.x === tx && (w.y === cy || w.y === cy - 1));
    if (tx > cx) return walls.some(w => w.orientation === 'v' && w.x === cx && (w.y === cy || w.y === cy - 1));
    return false;
};

export const getNeighbors = (node, walls, opponentPos = null) => {
    const neighbors = [];
    const directions = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
    ];

    for (let dir of directions) {
        const nx = node.x + dir.dx;
        const ny = node.y + dir.dy;

        if (!inBoard(nx, ny)) continue;
        if (isBlocked(node.x, node.y, nx, ny, walls)) continue;

        const isOpponentHere = opponentPos && nx === opponentPos.x && ny === opponentPos.y;

        if (isOpponentHere) {
            const jumpX = nx + dir.dx;
            const jumpY = ny + dir.dy;

            if (inBoard(jumpX, jumpY) && !isBlocked(nx, ny, jumpX, jumpY, walls)) {
                neighbors.push({ x: jumpX, y: jumpY });
            } else {
                const diagonals = [{ dx: dir.dy, dy: dir.dx }, { dx: -dir.dy, dy: -dir.dx }];
                for (let diag of diagonals) {
                    const diagX = nx + diag.dx;
                    const diagY = ny + diag.dy;
                    if (inBoard(diagX, diagY) && !isBlocked(nx, ny, diagX, diagY, walls)) {
                        neighbors.push({ x: diagX, y: diagY });
                    }
                }
            }
        } else {
            neighbors.push({ x: nx, y: ny });
        }
    }
    return neighbors;
};

// ==========================================
// 2. Pathfinding
// ==========================================

export const hasPath = (startNode, targetRow, currentWalls) => {
    const queue = [startNode];
    const visited = new Set([`${startNode.x},${startNode.y}`]);

    while (queue.length > 0) {
        const current = queue.shift();
        if (current.y === targetRow) return true;

        const neighbors = getNeighbors(current, currentWalls, null);
        for (let next of neighbors) {
            if (!visited.has(`${next.x},${next.y}`)) {
                visited.add(`${next.x},${next.y}`);
                queue.push(next);
            }
        }
    }
    return false;
};

export const getDistance = (startNode, targetRow, currentWalls) => {
    const queue = [{ ...startNode, dist: 0 }];
    const visited = new Set([`${startNode.x},${startNode.y}`]);

    while (queue.length > 0) {
        const current = queue.shift();
        if (current.y === targetRow) return current.dist;

        const neighbors = getNeighbors(current, currentWalls, null);
        for (let next of neighbors) {
            if (!visited.has(`${next.x},${next.y}`)) {
                visited.add(`${next.x},${next.y}`);
                queue.push({ ...next, dist: current.dist + 1 });
            }
        }
    }
    return -1;
};

export const getPathData = (startNode, targetRow, currentWalls, opponentPos = null) => {
    const queue = [{ ...startNode, dist: 0, parent: null }];
    const visited = new Set([`${startNode.x},${startNode.y}`]);

    while (queue.length > 0) {
        const current = queue.shift();
        if (current.y === targetRow) {
            let path = [];
            let temp = current;
            while (temp) {
                path.unshift({ x: temp.x, y: temp.y });
                temp = temp.parent;
            }
            return { distance: current.dist, fullPath: path };
        }

        const neighbors = getNeighbors(current, currentWalls, opponentPos);
        for (let next of neighbors) {
            if (!visited.has(`${next.x},${next.y}`)) {
                visited.add(`${next.x},${next.y}`);
                queue.push({ ...next, dist: current.dist + 1, parent: current });
            }
        }
    }
    return null;
};

// ==========================================
// 3. Move Generation
// ==========================================

export const isValidWall = (x, y, orientation, currentWalls, p1Pos, p2Pos) => {
    if (x < 0 || x > 7 || y < 0 || y > 7) return false;
    const isOverlap = currentWalls.some(w => {
        if (w.x === x && w.y === y && w.orientation === orientation) return true;
        if (w.orientation === orientation) {
            if (orientation === 'h' && w.y === y && Math.abs(w.x - x) === 1) return true;
            if (orientation === 'v' && w.x === x && Math.abs(w.y - y) === 1) return true;
        }
        if (w.x === x && w.y === y && w.orientation !== orientation) return true;
        return false;
    });
    if (isOverlap) return false;

    const simulatedWalls = [...currentWalls, { x, y, orientation }];
    if (!hasPath(p1Pos, 8, simulatedWalls)) return false;
    if (!hasPath(p2Pos, 0, simulatedWalls)) return false;

    return true;
};

const getPawnMoves = (state, player) => {
    const myPos = player === 1 ? state.p1 : state.p2;
    const oppPos = player === 1 ? state.p2 : state.p1;
    const neighbors = getNeighbors(myPos, state.walls, oppPos);
    return neighbors.map(pos => ({ type: 'move', x: pos.x, y: pos.y }));
};

const getWallMoves = (state, player) => {
    const wallCount = player === 1 ? state.p1.wallCount : state.p2.wallCount;
    if (wallCount <= 0) return [];

    const moves = [];
    const candidates = new Set();
    const myPos = player === 1 ? state.p1 : state.p2;
    const oppPos = player === 1 ? state.p2 : state.p1;
    const walls = state.walls;

    const oppTargetY = player === 1 ? 0 : 8;
    const oppPathData = getPathData(oppPos, oppTargetY, walls, myPos);

    if (oppPathData && oppPathData.fullPath) {
        // [지능 복구] Lookahead 4로 설정 (시간 관리가 있으므로 OK)
        const lookAhead = 4;
        oppPathData.fullPath.slice(0, lookAhead).forEach(pos => {
            candidates.add(`${pos.x},${pos.y}`);
            [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
                candidates.add(`${pos.x + dx},${pos.y + dy}`);
            });
        });
    }

    // 수비형 벽 (내 주변)
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
        candidates.add(`${myPos.x + dx},${myPos.y + dy}`);
    });

    candidates.forEach(coord => {
        const [cx, cy] = coord.split(',').map(Number);
        if (inBoard(cx, cy)) {
            ['h', 'v'].forEach(orientation => {
                if (isValidWall(cx, cy, orientation, walls, state.p1, state.p2)) {
                    moves.push({ type: 'wall', x: cx, y: cy, orientation });
                }
            });
        }
    });
    return moves;
};

export const getPossibleMoves = (state, player) => {
    const pawnMoves = getPawnMoves(state, player);
    const wallMoves = getWallMoves(state, player);
    return [...pawnMoves, ...wallMoves];
};

// ==========================================
// 4. Evaluation & Minimax
// ==========================================

export const cloneGameState = (state) => ({
    p1: { ...state.p1 },
    p2: { ...state.p2 },
    walls: [...state.walls],
    turn: state.turn
});

export const applyMove = (state, move) => {
    const newState = cloneGameState(state);
    const player = newState.turn;

    if (move.type === 'move') {
        if (player === 1) newState.p1 = { ...newState.p1, x: move.x, y: move.y };
        else newState.p2 = { ...newState.p2, x: move.x, y: move.y };
    } else if (move.type === 'wall') {
        newState.walls.push({ x: move.x, y: move.y, orientation: move.orientation });
        if (player === 1) newState.p1.wallCount--;
        else newState.p2.wallCount--;
    }

    if (newState.p1.y === 8) newState.winner = 1;
    else if (newState.p2.y === 0) newState.winner = 2;

    newState.turn = player === 1 ? 2 : 1;
    return newState;
};

// 평가 함수: 승리 중심
const evaluateState = (state, player) => {
    const p1Pos = state.p1;
    const p2Pos = state.p2;
    const walls = state.walls;

    const p1Dist = getDistance(p1Pos, 8, walls);
    const p2Dist = getDistance(p2Pos, 0, walls);

    if (p2Dist === 0) return 10000;
    if (p1Dist === 0) return -10000;
    if (p2Dist === -1) return -9000;
    if (p1Dist === -1) return 9000;

    // 내 승리(전진)를 최우선시: 가중치 20
    // 상대 방해: 가중치 10
    // 벽 아끼기: 가중치 5
    let score = (1000 - p2Dist * 20) + (p1Dist * 10);
    score += state.p2.wallCount * 5;

    return player === 2 ? score : -score;
};

// 시간 초과 체크용 변수 (모듈 수준)
let searchStartTime = 0;
let timeLimit = 3000; // 3초
let isTimeout = false;

const checkTimeout = () => {
    if (performance.now() - searchStartTime > timeLimit) {
        isTimeout = true;
        return true;
    }
    return false;
};

export const minimax = (state, depth, alpha, beta, isMaximizingPlayer) => {
    // 시간 초과 시 즉시 반환
    if (isTimeout || checkTimeout()) {
        return { score: evaluateState(state, 2), timedOut: true };
    }

    const score = evaluateState(state, 2);

    if (score > 5000) return { score: score + depth };
    if (score < -5000) return { score: score - depth };

    if (depth === 0) {
        return { score };
    }

    const player = isMaximizingPlayer ? 2 : 1;
    const possibleMoves = getPossibleMoves(state, player);

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        let bestMoves = [];

        for (let move of possibleMoves) {
            if (isTimeout) break;

            const newState = applyMove(state, move);
            const evalResult = minimax(newState, depth - 1, alpha, beta, false);

            if (evalResult.timedOut) break;

            if (evalResult.score > maxEval) {
                maxEval = evalResult.score;
                bestMoves = [move];
            } else if (evalResult.score === maxEval) {
                bestMoves.push(move);
            }
            alpha = Math.max(alpha, evalResult.score);
            if (beta <= alpha) break;
        }

        const selected = bestMoves.length > 0
            ? bestMoves[Math.floor(Math.random() * bestMoves.length)]
            : possibleMoves[0];
        return { score: maxEval, move: selected };
    } else {
        let minEval = Infinity;
        let bestMove = possibleMoves[0];

        for (let move of possibleMoves) {
            if (isTimeout) break;

            const newState = applyMove(state, move);
            const evalResult = minimax(newState, depth - 1, alpha, beta, true);

            if (evalResult.timedOut) break;

            if (evalResult.score < minEval) {
                minEval = evalResult.score;
                bestMove = move;
            }
            beta = Math.min(beta, evalResult.score);
            if (beta <= alpha) break;
        }
        return { score: minEval, move: bestMove };
    }
};

// ==========================================
// 5. Iterative Deepening (반복 심화)
// ==========================================

export const getBestMove = (state, maxDepth) => {
    searchStartTime = performance.now();
    isTimeout = false;

    let bestResult = null;
    let completedDepth = 0;

    // Depth 1부터 시작, 시간이 허락하는 한 깊어짐
    for (let depth = 1; depth <= Math.max(maxDepth, 6); depth++) {
        if (isTimeout) break;

        const result = minimax(state, depth, -Infinity, Infinity, true);

        if (!isTimeout && result.move) {
            bestResult = result;
            completedDepth = depth;
            console.log(`[AI ID] Depth ${depth} 완료. Score: ${result.score}`);
        }

        // 승/패 확정 시 조기 종료
        if (result.score > 5000 || result.score < -5000) {
            console.log(`[AI ID] Critical Move Found at Depth ${depth}`);
            break;
        }
    }

    const elapsed = (performance.now() - searchStartTime).toFixed(0);
    console.log(`[AI ID] 최종: Depth ${completedDepth}, 시간 ${elapsed}ms`);

    if (!bestResult || !bestResult.move) {
        const moves = getPossibleMoves(state, 2);
        return { move: moves[0], score: 0 };
    }

    return { move: bestResult.move, score: bestResult.score };
};
