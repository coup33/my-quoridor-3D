/**
 * 게임 보드 컴포넌트
 * 9x9 그리드, 셀, 말, 벽 렌더링
 */

import React from 'react';
import Cell from './Cell';
import WallTargets from './WallTargets';
import PlacedWalls from './PlacedWalls';

const Board = ({
    player1,
    player2,
    walls,
    lastMove,
    lastWall,
    isFlipped,
    isMyTurn,
    actionMode,
    previewWall,
    onCellClick,
    onWallClick,
    isMoveableCheck,
    canPlaceWallCheck
}) => {
    // 81개 셀 생성
    const cells = Array.from({ length: 81 }).map((_, i) => {
        const x = i % 9;
        const y = Math.floor(i / 9);

        const canMove = isMoveableCheck ? isMoveableCheck(x, y) : false;
        const isP1Here = player1.x === x && player1.y === y;
        const isP2Here = player2.x === x && player2.y === y;
        const isGhostP1 = lastMove?.player === 1 && lastMove.x === x && lastMove.y === y;
        const isGhostP2 = lastMove?.player === 2 && lastMove.x === x && lastMove.y === y;

        return (
            <Cell
                key={`cell-${x}-${y}`}
                x={x}
                y={y}
                canMove={canMove}
                isP1Here={isP1Here}
                isP2Here={isP2Here}
                isGhostP1={isGhostP1}
                isGhostP2={isGhostP2}
                isFlipped={isFlipped}
                onClick={onCellClick}
            />
        );
    });

    return (
        <div
            className="board"
            style={{ transform: isFlipped ? 'rotate(180deg)' : 'none' }}
        >
            {cells}

            <WallTargets
                actionMode={actionMode}
                isMyTurn={isMyTurn}
                previewWall={previewWall}
                onWallClick={onWallClick}
                canPlaceWallCheck={canPlaceWallCheck}
            />

            <PlacedWalls
                walls={walls}
                lastWall={lastWall}
            />
        </div>
    );
};

export default React.memo(Board);
