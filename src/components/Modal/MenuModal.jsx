/**
 * 게임 메뉴 모달 컴포넌트
 */

import React from 'react';

const MenuModal = ({ onExit, onClose }) => {
    return (
        <div className="lobby-overlay" onClick={onClose}>
            <div className="lobby-card" onClick={(e) => e.stopPropagation()}>
                <div className="menu-title">GAME MENU</div>
                <button className="menu-btn btn-exit" onClick={onExit}>
                    나가기 (Exit Game)
                </button>
                <button className="menu-btn btn-close" onClick={onClose}>
                    닫기 (Close)
                </button>
            </div>
        </div>
    );
};

export default React.memo(MenuModal);
