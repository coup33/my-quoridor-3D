/**
 * 벽 설치 타겟 컴포넌트
 * 벽을 놓을 수 있는 위치 표시
 */

import React from 'react';
import { ACTION_MODES } from '../../utils/constants';
import { getHWallStyle, getVWallStyle } from '../../utils/gameLogic';

const WallTargets = ({
    actionMode,
    isMyTurn,
    previewWall,
    onWallClick,
    canPlaceWallCheck
}) => {
    const isWallMode = actionMode === ACTION_MODES.WALL && isMyTurn;

    // 64개의 벽 타겟 생성 (8x8)
    const targets = Array.from({ length: 64 }).map((_, i) => {
        const x = i % 8;
        const y = Math.floor(i / 8);

        const canH = isWallMode && canPlaceWallCheck ? canPlaceWallCheck(x, y, 'h') : false;
        const canV = isWallMode && canPlaceWallCheck ? canPlaceWallCheck(x, y, 'v') : false;

        const isPreviewH = previewWall?.x === x && previewWall?.y === y && previewWall?.orientation === 'h';
        const isPreviewV = previewWall?.x === x && previewWall?.y === y && previewWall?.orientation === 'v';

        return (
            <React.Fragment key={`wall-target-${x}-${y}`}>
                <div
                    className={`wall-target h ${isWallMode ? 'in-wall-mode' : ''} ${canH ? 'placeable' : ''} ${isPreviewH ? 'preview' : ''}`}
                    style={getHWallStyle(x, y)}
                    onClick={() => onWallClick(x, y, 'h')}
                />
                <div
                    className={`wall-target v ${isWallMode ? 'in-wall-mode' : ''} ${canV ? 'placeable' : ''} ${isPreviewV ? 'preview' : ''}`}
                    style={getVWallStyle(x, y)}
                    onClick={() => onWallClick(x, y, 'v')}
                />
            </React.Fragment>
        );
    });

    return <>{targets}</>;
};

export default React.memo(WallTargets);
