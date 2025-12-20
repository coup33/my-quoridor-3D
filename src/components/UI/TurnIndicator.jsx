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

    // 턴 표시
    const dotClass = turn === 1 ? 'dot-white' : 'dot-black';
    const turnText = turn === 1 ? '백색 턴' : '흑색 턴';

    return (
        <div className="turn-indicator-box">
            <div className={`turn-dot ${dotClass}`}></div>
            <span className="turn-text">{turnText}</span>
        </div>
    );
};

export default React.memo(TurnIndicator);
