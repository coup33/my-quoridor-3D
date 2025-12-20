/**
 * 액션 버튼 컴포넌트 (이동/벽 모드 전환)
 */

import React from 'react';
import { ACTION_MODES } from '../../utils/constants';

function ActionButtons({
    actionMode,
    onActionModeChange,
    isMyTurn,
    winner,
    wallCount,
    className = ''
}) {
    return (
        <div className={className}>
            <button
                className={`floating-action-btn ${actionMode === ACTION_MODES.MOVE ? 'active' : ''}`}
                onClick={() => onActionModeChange(ACTION_MODES.MOVE)}
                disabled={!isMyTurn || winner}
            >
                이동
            </button>
            <button
                className={`floating-action-btn ${actionMode === ACTION_MODES.WALL ? 'active' : ''}`}
                onClick={() => onActionModeChange(ACTION_MODES.WALL)}
                disabled={!isMyTurn || winner || wallCount <= 0}
            >
                벽
            </button>
        </div>
    );
}

export default ActionButtons;
