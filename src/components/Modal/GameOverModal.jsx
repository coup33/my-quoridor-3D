/**
 * 게임 종료 모달 컴포넌트
 */

import React from 'react';
import { WIN_REASONS } from '../../utils/constants';

const GameOverModal = ({
    winner,
    winReason,
    myRole,
    isSpectator,
    onReturnToLobby
}) => {
    // 결과 타이틀 결정
    let resultTitle = '';
    if (isSpectator) {
        resultTitle = winner === 1 ? '백색 승리!' : '흑색 승리!';
    } else {
        resultTitle = winner === myRole ? '승리!' : '패배...';
    }

    // 결과 설명
    let resultDesc = '';
    if (winReason === WIN_REASONS.TIMEOUT) {
        resultDesc = '(시간 초과)';
    } else if (winReason === WIN_REASONS.RESIGN) {
        resultDesc = '(기권)';
    }

    return (
        <div className="overlay" style={{ zIndex: 9999 }}>
            <div className="modal">
                <h2>{resultTitle}</h2>
                {resultDesc && (
                    <p style={{ marginTop: '5px', color: '#666' }}>{resultDesc}</p>
                )}
                <button className="reset-large" onClick={onReturnToLobby}>
                    로비로
                </button>
            </div>
        </div>
    );
};

export default React.memo(GameOverModal);
