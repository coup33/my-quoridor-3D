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


module.exports = {
    inBoard,
    isBlocked,
    getPathData,
    isValidWall
};
