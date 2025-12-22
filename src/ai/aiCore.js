/**
 * aiCore.js
 * Quoridor AI Logic - Core Functions
 * 
 * Sections:
 * 1. Helpers (Board, Walls, Neighbors)
 * 2. Pathfinding (BFS, Distance)
 * 3. Move Generation (Pawn, Wall, Ordering)
 * 4. Evaluation (Scoring, Heuristics)
 * 5. Minimax (Search Algorithm)
 * 6. High-Level Strategy (Move Selection, Personality)
 */

// ==========================================
// 1. Helper Functions
// ==========================================

export const inBoard = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 9;

export const isBlocked = (cx, cy, tx, ty, walls) => {
    // Horizontal check
    if (ty < cy) return walls.some(w => w.orientation === 'h' && w.y === ty && (w.x === cx || w.x === cx - 1));
    if (ty > cy) return walls.some(w => w.orientation === 'h' && w.y === cy && (w.x === cx || w.x === cx - 1));
    // Vertical check
    if (tx < cx) return walls.some(w => w.orientation === 'v' && w.x === tx && (w.y === cy || w.y === cy - 1));
    if (tx > cx) return walls.some(w => w.orientation === 'v' && w.x === cx && (w.y === cy || w.y === cy - 1));
    return false;
};

/**
 * Returns valid neighbor nodes, handling all Jump Rules internally.
 * Used by both Pathfinding (graph traversal) and Pawn Move Generation.
 */
export const getNeighbors = (node, walls, opponentPos = null) => {
    const neighbors = [];
    const directions = [
        { dx: 0, dy: -1 }, // Up
        { dx: 0, dy: 1 },  // Down
        { dx: -1, dy: 0 }, // Left
        { dx: 1, dy: 0 }   // Right
    ];

    for (let dir of directions) {
        const nx = node.x + dir.dx;
        const ny = node.y + dir.dy;

        // Basic boundary and wall check
        if (!inBoard(nx, ny)) continue;
        if (isBlocked(node.x, node.y, nx, ny, walls)) continue;

        // Opponent check for Jumps
        const isOpponentHere = opponentPos && nx === opponentPos.x && ny === opponentPos.y;

        if (isOpponentHere) {
            // --- JUMP LOGIC ---
            const jumpX = nx + dir.dx;
            const jumpY = ny + dir.dy;

            // 1. Straight Jump
            if (inBoard(jumpX, jumpY) && !isBlocked(nx, ny, jumpX, jumpY, walls)) {
                neighbors.push({ x: jumpX, y: jumpY });
            } else {
                // 2. Diagonal Jump (if straight is blocked)
                const diagonals = [
                    { dx: dir.dy, dy: dir.dx },   // 90 deg
                    { dx: -dir.dy, dy: -dir.dx }  // -90 deg
                ];
                for (let diag of diagonals) {
                    const diagX = nx + diag.dx;
                    const diagY = ny + diag.dy;
                    // Check diagonal movement feasibility
                    if (inBoard(diagX, diagY) && !isBlocked(nx, ny, diagX, diagY, walls)) {
                        neighbors.push({ x: diagX, y: diagY });
                    }
                }
            }
        } else {
            // Normal move
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

        // Opponent is ignored for pure path existence check (walls only)
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
    return -1; // No path
};

/**
 * Heavy pathfinding: Returns full path array.
 * Used for detailed heuristics (e.g. wall placement blocking).
 */
export const getPathData = (startNode, targetRow, currentWalls, opponentPos = null) => {
    const queue = [{ ...startNode, dist: 0, parent: null }];
    const visited = new Set([`${startNode.x},${startNode.y}`]);

    while (queue.length > 0) {
        const current = queue.shift();
        if (current.y === targetRow) {
            // Reconstruct path
            let path = [];
            let temp = current;
            while (temp) {
                path.unshift({ x: temp.x, y: temp.y });
                temp = temp.parent;
            }
            return { distance: current.dist, nextStep: path.length > 1 ? path[1] : null, fullPath: path };
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

    // 1. Intersect / Overlap Check
    const isOverlap = currentWalls.some(w => {
        if (w.x === x && w.y === y && w.orientation === orientation) return true;
        if (w.orientation === orientation) {
            // Cannot overlap linearly
            if (orientation === 'h' && w.y === y && Math.abs(w.x - x) === 1) return true;
            if (orientation === 'v' && w.x === x && Math.abs(w.y - y) === 1) return true;
        }
        // Cross intersection
        if (w.x === x && w.y === y && w.orientation !== orientation) return true;
        return false;
    });
    if (isOverlap) return false;

    // 2. Path Existence Check
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

    // Heuristic: Try to block opponent's path
    const oppTargetY = player === 1 ? 0 : 8;
    const oppPathData = getPathData(oppPos, oppTargetY, walls, myPos);

    if (oppPathData && oppPathData.fullPath) {
        // Look ahead N steps
        const lookAhead = 4;
        oppPathData.fullPath.slice(0, lookAhead).forEach(pos => {
            candidates.add(`${pos.x},${pos.y}`);
            // Add surroundings
            [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
                candidates.add(`${pos.x + dx},${pos.y + dy}`);
            });
        });
    }

    // Defensive: Add near self
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
        candidates.add(`${myPos.x + dx},${myPos.y + dy}`);
    });

    // Validate candidates
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

// Main generator used by Minimax
export const getPossibleMoves = (state, player) => {
    const pawnMoves = getPawnMoves(state, player);
    const wallMoves = getWallMoves(state, player);

    // --- Deterministic Sorting ---
    const myTargetY = player === 1 ? 8 : 0;
    const oppPos = player === 1 ? state.p2 : state.p1;

    // Sort Pawn Moves: Closet to Goal -> Closest to Center
    pawnMoves.sort((a, b) => {
        const distA = Math.abs(a.y - myTargetY);
        const distB = Math.abs(b.y - myTargetY);
        if (distA !== distB) return distA - distB;

        const centerDistA = Math.abs(a.x - 4);
        const centerDistB = Math.abs(b.x - 4);
        return centerDistA - centerDistB;
    });

    // Sort Wall Moves: Closest to Opponent
    wallMoves.sort((a, b) => {
        const distA = Math.abs(a.x - oppPos.x) + Math.abs(a.y - oppPos.y);
        const distB = Math.abs(b.x - oppPos.x) + Math.abs(b.y - oppPos.y);
        return distA - distB;
    });

    return [...pawnMoves, ...wallMoves];
};

// ==========================================
// 4. Evaluation & Utilities
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

const evaluateState = (state, player, history = [], personality = null) => {
    const p1Pos = state.p1;
    const p2Pos = state.p2;
    const walls = state.walls;

    // Distance calculation
    const p1Dist = getDistance(p1Pos, 8, walls);
    const p2Dist = getDistance(p2Pos, 0, walls);

    // 1. Win/Loss Check
    if (p2Dist === 0) return 10000;
    if (p1Dist === 0) return -10000;

    // 2. Stuck Check
    if (p2Dist === -1) return -5000;
    if (p1Dist === -1) return 5000;

    // 3. Score Calculation
    // Personality: Default to Balanced if null
    const w_offense = personality ? personality.w_offense : 1.0;
    const w_defense = personality ? personality.w_defense : 1.0;
    const w_wall = personality ? personality.w_wall : 2.0;

    let score = (p1Dist * w_offense - p2Dist * w_defense) * 10;

    // 4. Oscillation Penalty (History)
    if (history && history.length > 0) {
        const visitedCount = history.filter(pos => pos.x === p2Pos.x && pos.y === p2Pos.y).length;
        if (visitedCount > 0) {
            score -= 2.0 * visitedCount;
        }
    }

    // 5. Wall Preservation Bonus
    if (state.p2.wallCount > 0) {
        score += state.p2.wallCount * w_wall;
    }

    return player === 2 ? score : -score;
};

// ==========================================
// 5. Minimax Algorithm
// ==========================================

export const minimax = (state, depth, alpha, beta, isMaximizingPlayer, history = [], personality = null) => {
    const score = evaluateState(state, 2, history, personality);

    // Depth Adjustment for faster wins / slower losses
    if (score > 5000) return { score: score + depth };
    if (score < -5000) return { score: score - depth };

    if (depth === 0) {
        return { score };
    }

    const player = isMaximizingPlayer ? 2 : 1;
    const possibleMoves = getPossibleMoves(state, player);

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        let bestMove = possibleMoves[0]; // Default fallback

        for (let move of possibleMoves) {
            const newState = applyMove(state, move);
            const evalResult = minimax(newState, depth - 1, alpha, beta, false, history, personality);

            if (evalResult.score > maxEval) {
                maxEval = evalResult.score;
                bestMove = move;
            }
            alpha = Math.max(alpha, evalResult.score);
            if (beta <= alpha) break;
        }
        return { score: maxEval, move: bestMove };
    } else {
        let minEval = Infinity;
        let bestMove = possibleMoves[0];

        for (let move of possibleMoves) {
            const newState = applyMove(state, move);
            const evalResult = minimax(newState, depth - 1, alpha, beta, true, history, personality);

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
// 6. High-Level Strategy & API
// ==========================================

/**
 * Filter moves based on strategies (e.g., Early Wall)
 */
const filterMovesByStrategy = (possibleMoves, state, history, personality) => {
    const currentAiTurn = history.length + 1;

    // Debug Log
    if (personality) {
        if (personality.earlyWallTurn) {
            if (personality.earlyWallTurn === currentAiTurn) {
                console.log(`[AI Strategy] ⚔️ Executing Early Wall Strategy on turn ${currentAiTurn}!`);
            } else {
                console.log(`[AI Strategy] Waiting for Early Wall Strategy (Target: ${personality.earlyWallTurn}, Current: ${currentAiTurn})`);
            }
        } else {
            console.log(`[AI Strategy] No Early Wall Strategy planned for this game.`);
        }
    }

    // Apply Early Wall Strategy
    if (personality && personality.earlyWallTurn === currentAiTurn && state.p2.wallCount > 0) {
        const wallMoves = possibleMoves.filter(m => m.type === 'wall');
        if (wallMoves.length > 0) {
            console.log(`[AI Worker] 🧱 Strategy Triggered! Forcing Wall on Turn ${currentAiTurn}`);
            return wallMoves;
        }
    }

    return possibleMoves;
};

/**
 * Select final move from candidates (Handling Top-N Randomness and Critical Moments)
 */
const selectFinalMove = (candidates, bestScore, possibleMoves) => {
    // 1. Critical Actions (Win/Loss Imminent) - No Randomness
    if (Math.abs(bestScore) > 5000) {
        const bestCandidates = candidates.filter(c => c.score === bestScore);
        if (bestCandidates.length === 0) return { score: bestScore, move: possibleMoves[0] };

        // Pick any of the best (rarely multiple in critical, but safe to random)
        const choice = bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
        return { score: choice.score, move: choice.move };
    }

    // 2. Normal Play - Top N Randomness (Tolerance)
    const tolerance = 5;
    const finalCandidates = candidates.filter(c => c.score >= bestScore - tolerance);

    if (finalCandidates.length > 0) {
        const choice = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
        console.log(`[AI Worker] 🎲 Random Choice from ${finalCandidates.length} options (Score: ${choice.score})`);
        return { score: choice.score, move: choice.move };
    }

    // Fallback
    return { score: bestScore, move: possibleMoves[0] };
};

/**
 * Main Entry Point for AI Calculation
 */
export const getBestMove = (state, depth, history = [], personality = null) => {
    const player = 2; // AI is always Player 2

    // 1. Generate All Valid Moves
    let possibleMoves = getPossibleMoves(state, player);

    // 2. Apply Strategy Filters (e.g., Force Wall)
    possibleMoves = filterMovesByStrategy(possibleMoves, state, history, personality);

    // 3. Run Minimax for Valid Candidates
    let candidates = [];
    let bestScore = -Infinity;

    for (let move of possibleMoves) {
        const newState = applyMove(state, move);
        const result = minimax(newState, depth - 1, -Infinity, Infinity, false, history, personality);

        if (result.score > bestScore) {
            bestScore = result.score;
        }
        candidates.push({ move, score: result.score });
    }

    // Debug: Show top options
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        console.log(`[AI Worker] Best Score: ${bestScore}. Top 3 moves:`, candidates.slice(0, 3));
    }

    // 4. Final Selection (Top-N, Critical)
    return selectFinalMove(candidates, bestScore, possibleMoves);
};
