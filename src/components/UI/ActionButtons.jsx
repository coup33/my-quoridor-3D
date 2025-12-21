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
    className = '',
    // 모바일 벽 설치 확인용
    previewWall = null,
    onConfirmWall = null,
    isMobile = false
}) {
    // 모바일에서 벽 프리뷰가 있으면 "설치" 버튼 표시
    const showConfirmButton = isMobile && previewWall && actionMode === ACTION_MODES.WALL;

    const handleWallButtonClick = () => {
        if (showConfirmButton && onConfirmWall) {
            // 설치 확인
            onConfirmWall();
        } else {
            // 벽 모드로 전환
            onActionModeChange(ACTION_MODES.WALL);
        }
    };

    const handleMoveButtonClick = () => {
        onActionModeChange(ACTION_MODES.MOVE);
    };

    return (
        <div className={className}>
            <button
                className={`floating-action-btn ${actionMode === ACTION_MODES.MOVE ? 'active' : ''}`}
                onClick={handleMoveButtonClick}
                disabled={!isMyTurn || winner}
            >
                이동
            </button>
            <button
                className={`floating-action-btn ${actionMode === ACTION_MODES.WALL ? 'active' : ''} ${showConfirmButton ? 'confirm-mode' : ''}`}
                onClick={handleWallButtonClick}
                disabled={!isMyTurn || winner || wallCount <= 0}
            >
                {showConfirmButton ? '설치' : '벽'}
            </button>
        </div>
    );
}

export default ActionButtons;
