/**
 * 플레이어 정보 표시 컴포넌트
 * 플레이어 아이콘과 남은 벽 개수를 표시
 */

import React from 'react';

function PlayerInfo({ playerNumber, wallCount, isActive, className = '' }) {
    const icon = playerNumber === 1 ? '⬜' : '⬛';

    return (
        <div className={`${className} ${isActive ? 'active' : ''}`}>
            <span className="player-icon">{icon}</span>
            <span className="player-walls">{wallCount}개</span>
        </div>
    );
}

export default PlayerInfo;
