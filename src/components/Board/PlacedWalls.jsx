/**
 * 설치된 벽 컴포넌트
 */

import React from 'react';
import { getWallStyle } from '../../utils/gameLogic';

const PlacedWalls = ({ walls, lastWall }) => {
    return (
        <>
            {(walls || []).map((wall, i) => {
                const isLatest = lastWall?.x === wall.x &&
                    lastWall?.y === wall.y &&
                    lastWall?.orientation === wall.orientation;

                return (
                    <div
                        key={`placed-wall-${i}`}
                        className={`placed-wall ${wall.orientation} ${isLatest ? 'latest' : ''}`}
                        style={getWallStyle(wall)}
                    />
                );
            })}
        </>
    );
};

export default React.memo(PlacedWalls);
