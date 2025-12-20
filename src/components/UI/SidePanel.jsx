/**
 * 사이드 패널 컴포넌트
 * 플레이어 정보 및 액션 버튼
 */

import React from 'react';
import { ACTION_MODES } from '../../utils/constants';

const SidePanel = ({
    player,        // 플레이어 정보 { wallCount, ... }
    playerNumber,  // 플레이어 번호 (1 또는 2)
    isActive,      // 현재 턴인지
    isMyRole,      // 내 역할인지
    isMyTurn,      // 내 턴인지
    winner,        // 승자
    actionMode,    // 현재 액션 모드
    onActionModeChange,  // 액션 모드 변경 핸들러
    style          // 스타일 (order 등)
}) => {
    const isWhite = playerNumber === 1;
    const areaClass = isWhite ? 'white-area' : 'black-area';
    const boxClass = isWhite ? 'white-box' : 'black-box';
    const btnClass = isWhite ? 'p1-btn' : 'p2-btn';

    return (
        <aside className={`side-panel ${areaClass} ${isActive && !winner ? 'active' : ''}`} style={style}>
            <div className={`wall-counter ${boxClass}`}>
                벽: <span className="count">{player.wallCount}</span>
            </div>

            {isMyRole && (
                <div className="button-group">
                    <button
                        className={`btn ${btnClass} ${actionMode === ACTION_MODES.MOVE ? 'selected' : ''}`}
                        onClick={() => onActionModeChange(ACTION_MODES.MOVE)}
                        disabled={!isMyTurn || winner}
                    >
                        이동
                    </button>
                    <button
                        className={`btn ${btnClass} ${actionMode === ACTION_MODES.WALL ? 'selected' : ''}`}
                        onClick={() => onActionModeChange(ACTION_MODES.WALL)}
                        disabled={!isMyTurn || winner}
                    >
                        벽
                    </button>
                </div>
            )}
        </aside>
    );
};

export default React.memo(SidePanel);
