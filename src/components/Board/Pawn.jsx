/**
 * 말(Pawn) 컴포넌트
 * 셀 자체가 회전하므로 말은 추가 회전 불필요
 */

import React from 'react';

const Pawn = ({ type }) => {
    // 타입에 따른 클래스 결정
    let className = 'pawn';

    switch (type) {
        case 'white':
            className += ' white-pawn';
            break;
        case 'black':
            className += ' black-pawn';
            break;
        case 'ghost-white':
            className = 'ghost-pawn ghost-white';
            break;
        case 'ghost-black':
            className = 'ghost-pawn ghost-black';
            break;
        default:
            break;
    }

    return <div className={className} />;
};

export default React.memo(Pawn);
