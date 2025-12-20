/**
 * 준비 화면 컴포넌트
 */

import React from 'react';

const ReadyScreen = ({
    myRole,
    readyStatus,
    onToggleReady,
    onLeave
}) => {
    const isReady = readyStatus[myRole];

    return (
        <div className="ready-section">
            <div className="status-box">
                <div className={`player-status ${readyStatus[1] ? 'ready' : ''}`}>
                    P1: {readyStatus[1] ? '준비 완료' : '대기 중'}
                </div>
                <div className={`player-status ${readyStatus[2] ? 'ready' : ''}`}>
                    P2: {readyStatus[2] ? '준비 완료' : '대기 중'}
                </div>
            </div>

            {!isReady ? (
                <button className="start-btn" onClick={onToggleReady}>
                    준비 하기
                </button>
            ) : (
                <button className="start-btn waiting">
                    대기 중...
                </button>
            )}

            <button className="cancel-btn" onClick={onLeave}>
                나가기
            </button>
        </div>
    );
};

export default React.memo(ReadyScreen);
