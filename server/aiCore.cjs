// --- Helper Functions ---
const inBoard = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 9;

const isBlocked = (cx, cy, tx, ty, walls) => {
    if (ty < cy) return walls.some(w => w.orientation === 'h' && w.y === ty && (w.x === cx || w.x === cx - 1));
    if (ty > cy) return walls.some(w => w.orientation === 'h' && w.y === cy && (w.x === cx || w.x === cx - 1));
    if (tx < cx) return walls.some(w => w.orientation === 'v' && w.x === tx && (w.y === cy || w.y === cy - 1));
    if (tx > cx) return walls.some(w => w.orientation === 'v' && w.x === cx && (w.y === cy || w.y === cy - 1));
    return false;
};

const getPathData = (startNode, targetRow, currentWalls, opponentPos = null) => {
    const queue = [{ x: startNode.x, y: startNode.y, dist: 0, parent: null }];
    const visited = new Set();
    visited.add(`${startNode.x},${startNode.y}`);
    const directions = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];

    while (queue.length > 0) {
        const current = queue.shift();
        if (current.y === targetRow) {
            let path = [];
            let temp = current;
            while (temp) {
                path.unshift({ x: temp.x, y: temp.y });
                temp = temp.parent;
            }
            return { distance: current.dist, nextStep: path.length > 1 ? path[1] : null, fullPath: path };
        }
        for (let dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;
            if (inBoard(nx, ny)) {
                // 상대방 위치 체크 - 상대가 있으면 점프 고려
                const isOpponentHere = opponentPos && nx === opponentPos.x && ny === opponentPos.y;

                if (!visited.has(`${nx},${ny}`) && !isBlocked(current.x, current.y, nx, ny, currentWalls)) {
                    if (isOpponentHere) {
                        // 상대방이 있는 경우: 점프 시도
                        const jumpX = nx + dir.dx;
                        const jumpY = ny + dir.dy;

                        // 직선 점프 가능한지 확인
                        if (inBoard(jumpX, jumpY) && !isBlocked(nx, ny, jumpX, jumpY, currentWalls)) {
                            if (!visited.has(`${jumpX},${jumpY}`)) {
                                visited.add(`${jumpX},${jumpY}`);
                                queue.push({ x: jumpX, y: jumpY, dist: current.dist + 1, parent: current });
                            }
                        } else {
                            // 직선 점프 불가 시 대각선 이동 시도
                            const diagonals = [
                                { dx: dir.dy, dy: dir.dx },  // 90도 회전
                                { dx: -dir.dy, dy: -dir.dx } // -90도 회전
                            ];
                            for (let diag of diagonals) {
                                const diagX = nx + diag.dx;
                                const diagY = ny + diag.dy;
                                if (inBoard(diagX, diagY) && !isBlocked(nx, ny, diagX, diagY, currentWalls)) {
                                    if (!visited.has(`${diagX},${diagY}`)) {
                                        visited.add(`${diagX},${diagY}`);
                                        queue.push({ x: diagX, y: diagY, dist: current.dist + 1, parent: current });
                                    }
                                }
                            }
                        }
                    } else {
                        visited.add(`${nx},${ny}`);
                        queue.push({ x: nx, y: ny, dist: current.dist + 1, parent: current });
                    }
                }
            }
        }
    }
    return null;
};

const isValidWall = (x, y, orientation, currentWalls, p1Pos, p2Pos) => {
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
    const p1Path = getPathData(p1Pos, 8, simulatedWalls);
    const p2Path = getPathData(p2Pos, 0, simulatedWalls);

    return p1Path !== null && p2Path !== null;
};

// 폰의 유효한 이동 목록 반환 (점프, 대각선 이동 포함)
const getValidMovesForPawn = (pawnPos, opponentPos, walls) => {
    const validMoves = [];
    const directions = [
        { dx: 0, dy: -1 }, // 위
        { dx: 0, dy: 1 },  // 아래
        { dx: -1, dy: 0 }, // 왼쪽
        { dx: 1, dy: 0 }   // 오른쪽
    ];

    for (let dir of directions) {
        const nx = pawnPos.x + dir.dx;
        const ny = pawnPos.y + dir.dy;

        if (!inBoard(nx, ny)) continue;
        if (isBlocked(pawnPos.x, pawnPos.y, nx, ny, walls)) continue;

        // 상대방이 해당 칸에 있는지 확인
        const isOpponentHere = nx === opponentPos.x && ny === opponentPos.y;

        if (isOpponentHere) {
            // 점프 시도: 상대방 너머로 이동
            const jumpX = nx + dir.dx;
            const jumpY = ny + dir.dy;

            if (inBoard(jumpX, jumpY) && !isBlocked(nx, ny, jumpX, jumpY, walls)) {
                // 직선 점프 가능
                validMoves.push({ x: jumpX, y: jumpY });
            } else {
                // 직선 점프 불가 시 대각선 이동
                const diagonals = [
                    { dx: dir.dy, dy: dir.dx },   // 90도 회전
                    { dx: -dir.dy, dy: -dir.dx }  // -90도 회전
                ];
                for (let diag of diagonals) {
                    const diagX = nx + diag.dx;
                    const diagY = ny + diag.dy;
                    if (inBoard(diagX, diagY) && !isBlocked(nx, ny, diagX, diagY, walls)) {
                        validMoves.push({ x: diagX, y: diagY });
                    }
                }
            }
        } else {
            // 빈 칸으로 이동
            validMoves.push({ x: nx, y: ny });
        }
    }

    return validMoves;
};


// --- Minimax AI Implementation ---

// 상태 평가 함수
const evaluateState = (state, player) => {
    const p1Pos = state.p1;
    const p2Pos = state.p2;

    // 패스파인딩을 위해 현재 벽 상태 사용
    const walls = state.walls;

    // 목표 지점 (P1: y=8, P2: y=0)
    // AI는 P2(Bot) 기준

    const p1Path = getPathData(p1Pos, 8, walls, p2Pos);
    const p2Path = getPathData(p2Pos, 0, walls, p1Pos);

    // 1. 승리 조건: 내 거리가 0이면 승리
    if (p2Path && p2Path.distance === 0) return 10000;
    // 2. 패배 조건: 상대 거리가 0이면 패배
    if (p1Path && p1Path.distance === 0) return -10000;

    // 3. 갇힘 조건 (길이 없음)
    if (!p2Path) return -5000; // 내가 갇힘
    if (!p1Path) return 5000;  // 상대가 갇힘

    const myDist = p2Path.distance;
    const oppDist = p1Path.distance;

    // 기본 점수: (상대 거리 - 내 거리) * 10
    // 내가 목표에 가까울수록, 상대가 멀수록 유리
    let score = (oppDist - myDist) * 10;

    // 4. 벽 개수 가중치 (벽을 아끼면 가산점)
    // 너무 빨리 다 쓰는 것을 방지 (후반 도모)
    if (state.p2.wallCount > 0) {
        score += state.p2.wallCount * 2;
    }

    // 5. 플레이어 관점에 따른 점수 반환
    // Maximize Player(P2, AI) 입장에서 계산된 점수이므로
    // player === 2이면 그대로, player === 1이면 반대로 반환 (Minimax 구조상)
    return player === 2 ? score : -score;
};

// 간단한 상태 복제 (필요한 속성만)
const cloneGameState = (state) => ({
    p1: { ...state.p1 },
    p2: { ...state.p2 },
    walls: [...state.walls],
    turn: state.turn
});

// 가능한 모든 수 생성 (이동 + 유망한 벽 설치)
const getPossibleMoves = (state, player) => {
    const moves = [];
    const myPos = player === 1 ? state.p1 : state.p2;
    const oppPos = player === 1 ? state.p2 : state.p1;
    const walls = state.walls;
    const wallCount = player === 1 ? state.p1.wallCount : state.p2.wallCount;

    // 1. 이동 (Pawn Moves)
    const validPawnMoves = getValidMovesForPawn(myPos, oppPos, walls);
    validPawnMoves.forEach(pos => {
        moves.push({ type: 'move', x: pos.x, y: pos.y });
    });

    // 2. 벽 설치 (Wall Placements) - 휴리스틱 적용 (성능 최적화)
    // 모든 위치를 다 보면 너무 느림.
    // "상대방의 최단 경로" 주변, "내 위치" 주변 위주로 탐색하되 범위를 제한
    if (wallCount > 0) {
        const oppTargetY = player === 1 ? 0 : 8;

        // 상대방 최단 경로 계산
        const oppPathData = getPathData(oppPos, oppTargetY, walls, myPos);

        // 관심 좌표 집합 (Set으로 중복 제거)
        const candidates = new Set();

        // 상대방 경로상 좌표들 추가 (경로 방해)
        if (oppPathData && oppPathData.fullPath) {
            // [최적화] 전체 경로가 아닌 앞쪽 3~4칸만 고려하여 연산량 대폭 감소
            const lookAhead = 4;
            oppPathData.fullPath.slice(0, lookAhead).forEach(pos => {
                candidates.add(`${pos.x},${pos.y}`);
                // 경로 주변 1칸도 추가
                [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
                    candidates.add(`${pos.x + dx},${pos.y + dy}`);
                });
            });
        }

        // 내 주변 방어용 (선택적)
        [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
            candidates.add(`${myPos.x + dx},${myPos.y + dy}`);
        });

        // 후보 좌표들에 대해 가로/세로 벽 유효성 검사
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
    }

    // [Move Ordering 최적화]
    // '이동'을 먼저 탐색해야 Alpha-Beta 가지치기가 더 효율적으로 일어남 (점수 변화가 확실하므로)
    // 같은 타입 내에서는 랜덤하게 섞어서 매번 다른 플레이 유도
    const pawnMoves = moves.filter(m => m.type === 'move').sort(() => Math.random() - 0.5);
    const wallMoves = moves.filter(m => m.type === 'wall').sort(() => Math.random() - 0.5);

    return [...pawnMoves, ...wallMoves];
};

// 가상 이동 적용
const applyMove = (state, move) => {
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

    newState.turn = player === 1 ? 2 : 1;
    return newState;
};

// Minimax Algorithm
const minimax = (state, depth, alpha, beta, isMaximizingPlayer) => {
    // 기저 조건: 깊이 도달 or 게임 종료
    const score = evaluateState(state, 2); // 항상 AI(P2) 입장 점수
    if (depth === 0 || score > 5000 || score < -5000) {
        return { score };
    }

    const player = isMaximizingPlayer ? 2 : 1; // AI is P2 (Maximizing)
    const possibleMoves = getPossibleMoves(state, player);

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        let bestMove = null;

        for (let move of possibleMoves) {
            const newState = applyMove(state, move);
            const evalResult = minimax(newState, depth - 1, alpha, beta, false);

            if (evalResult.score > maxEval) {
                maxEval = evalResult.score;
                bestMove = move;
            }
            alpha = Math.max(alpha, evalResult.score);
            if (beta <= alpha) break; // Pruning
        }
        return { score: maxEval, move: bestMove || possibleMoves[0] };
    } else {
        let minEval = Infinity;
        let bestMove = null;

        for (let move of possibleMoves) {
            const newState = applyMove(state, move);
            const evalResult = minimax(newState, depth - 1, alpha, beta, true);

            if (evalResult.score < minEval) {
                minEval = evalResult.score;
                bestMove = move;
            }
            beta = Math.min(beta, evalResult.score);
            if (beta <= alpha) break; // Pruning
        }
        return { score: minEval, move: bestMove || possibleMoves[0] };
    }
};

module.exports = {
    minimax,
    inBoard,
    isBlocked,
    getPathData,
    isValidWall
};
