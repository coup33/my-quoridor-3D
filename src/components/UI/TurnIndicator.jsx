/**
 * 턴 표시 컴포넌트
 */

import React from 'react';

const TurnIndicator = ({ turn, winner, myRole, isSpectator }) => {
    // 승리 시
    if (winner) {
        let resultTitle = '';
        if (isSpectator) {
            resultTitle = winner === 1 ? '백색 승리!' : '흑색 승리!';
        } else {
            resultTitle = winner === myRole ? '승리!' : '패배...';
        }
        return <span className="win-text">{resultTitle}</span>;
    }

    // 턴 표시 (제거 요청: 플레이어 정보창 강조로 대체)
    return null;
};

export default React.memo(TurnIndicator);
