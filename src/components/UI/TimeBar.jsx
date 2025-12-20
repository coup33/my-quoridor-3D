/**
 * 타임바 컴포넌트
 * 게임 시간 표시 및 상태 정보
 */

import React from 'react';

const TimeBar = ({
    time,
    maxTime = 90,
    left = null,
    center = null,
    right = null
}) => {
    const percentage = Math.min(100, Math.max(0, (time / maxTime) * 100));

    // 시간에 따른 상태 클래스
    let statusClass = '';
    if (time < 10) statusClass = 'danger';
    else if (time < 30) statusClass = 'warning';

    const hasHeader = left || center || right;

    return (
        <div className="time-bar-container">
            {hasHeader && (
                <div className="time-info-row">
                    <div className="info-left">{left}</div>
                    <div className="info-center">{center}</div>
                    <div className="info-right">{right}</div>
                </div>
            )}
            <div className="time-bar-track">
                <div
                    className={`time-bar-fill ${statusClass}`}
                    style={{ width: `${percentage}%` }}
                />
                <div className="time-text">{time}s</div>
            </div>
        </div>
    );
};

export default React.memo(TimeBar);
