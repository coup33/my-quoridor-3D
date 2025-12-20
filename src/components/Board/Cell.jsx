/**
 * 셀 컴포넌트
 * 개별 보드 칸
 * 보드가 뒤집혔을 때 셀과 말의 3D 효과를 보정
 */

import React from 'react';
import Pawn from './Pawn';

const Cell = ({
    x,
    y,
    canMove,
    isP1Here,
    isP2Here,
    isGhostP1,
    isGhostP2,
    isFlipped,
    onClick
}) => {
    const handleClick = () => {
        onClick(x, y);
    };

    // 보드가 뒤집혔을 때 셀을 180도 회전하여 3D 효과 보정
    const cellStyle = isFlipped ? { transform: 'rotate(180deg)' } : {};

    return (
        <div
            className={`cell ${canMove ? 'highlight' : ''}`}
            style={cellStyle}
            onClick={handleClick}
        >
            {isP1Here && <Pawn type="white" isFlipped={isFlipped} />}
            {isP2Here && <Pawn type="black" isFlipped={isFlipped} />}
            {isGhostP1 && <Pawn type="ghost-white" isFlipped={isFlipped} />}
            {isGhostP2 && <Pawn type="ghost-black" isFlipped={isFlipped} />}
            {canMove && <div className="move-dot" />}
        </div>
    );
};

export default React.memo(Cell);
