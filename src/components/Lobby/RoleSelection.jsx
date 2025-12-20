/**
 * 역할 선택 컴포넌트
 */

import React from 'react';

const RoleSelection = ({
    takenRoles,
    onSelectRole,
    onShowDifficulty
}) => {
    return (
        <div className="role-selection">
            <div className="role-buttons">
                <button
                    className="role-btn white"
                    disabled={takenRoles[1] !== null}
                    onClick={() => onSelectRole(1)}
                >
                    백색 (P1)
                    {takenRoles[1] && <span className="taken-badge">사용 중</span>}
                </button>
                <button
                    className="role-btn black"
                    disabled={takenRoles[2] !== null}
                    onClick={() => onSelectRole(2)}
                >
                    흑색 (P2)
                    {takenRoles[2] && <span className="taken-badge">사용 중</span>}
                </button>
            </div>

            <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                <button
                    className="start-btn"
                    style={{ backgroundColor: '#4c6ef5' }}
                    onClick={onShowDifficulty}
                >
                    🤖 AI와 연습하기 (싱글)
                </button>
            </div>
        </div>
    );
};

export default React.memo(RoleSelection);
