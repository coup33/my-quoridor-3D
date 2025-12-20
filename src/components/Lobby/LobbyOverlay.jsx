/**
 * 로비 오버레이 컴포넌트
 * 역할 선택, 난이도 선택, 준비 화면 통합
 */

import React, { useState } from 'react';
import RoleSelection from './RoleSelection';
import DifficultySelection from './DifficultySelection';
import ReadyScreen from './ReadyScreen';

const LobbyOverlay = ({
    myRole,
    takenRoles,
    readyStatus,
    onSelectRole,
    onToggleReady,
    onStartAiGame,
    onLeave
}) => {
    const [showDifficultySelect, setShowDifficultySelect] = useState(false);

    const handleShowDifficulty = () => {
        setShowDifficultySelect(true);
    };

    const handleSelectDifficulty = (difficulty) => {
        onStartAiGame(difficulty);
        setShowDifficultySelect(false);
    };

    const handleBack = () => {
        setShowDifficultySelect(false);
    };

    return (
        <div className="lobby-overlay">
            <div className="lobby-card">
                <h2 style={{ marginBottom: '20px' }}>QUORIDOR ONLINE</h2>

                {showDifficultySelect ? (
                    <DifficultySelection
                        onSelectDifficulty={handleSelectDifficulty}
                        onBack={handleBack}
                    />
                ) : (
                    <>
                        {!myRole && (
                            <RoleSelection
                                takenRoles={takenRoles}
                                onSelectRole={onSelectRole}
                                onShowDifficulty={handleShowDifficulty}
                            />
                        )}

                        {myRole && (
                            <ReadyScreen
                                myRole={myRole}
                                readyStatus={readyStatus}
                                onToggleReady={onToggleReady}
                                onLeave={onLeave}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default React.memo(LobbyOverlay);
