/**
 * AI 난이도 선택 컴포넌트
 */

import React from 'react';

const DifficultySelection = ({ onSelectDifficulty, onBack }) => {
    const difficulties = [
        { level: 1, emoji: '🌱', label: '매우 쉬움 (Very Easy)', className: 'diff-1' },
        { level: 2, emoji: '🐣', label: '쉬움 (Easy)', className: 'diff-2' },
        { level: 3, emoji: '🛡️', label: '보통 (Normal)', className: 'diff-3' },
        { level: 4, emoji: '🔥', label: '어려움 (Hard)', className: 'diff-4' },
    ];

    return (
        <div className="difficulty-overlay">
            <h3 style={{ marginBottom: '10px' }}>난이도 선택</h3>

            {difficulties.map(({ level, emoji, label, className }) => (
                <button
                    key={level}
                    className={`diff-btn ${className}`}
                    onClick={() => onSelectDifficulty(level)}
                >
                    {emoji} {label}
                </button>
            ))}

            <button
                className="diff-btn btn-back"
                onClick={onBack}
            >
                취소
            </button>
        </div>
    );
};

export default React.memo(DifficultySelection);
