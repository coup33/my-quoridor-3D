/**
 * 사운드 효과 관리 훅
 */

import { useEffect, useCallback } from 'react';
import { initSounds, playSound as playSoundUtil, preloadSounds } from '../utils/soundManager';
import { SOUND_NAMES } from '../utils/constants';

/**
 * 사운드 효과 관리
 * @returns {Object} 사운드 재생 함수들
 */
export const useSound = () => {
    // 컴포넌트 마운트 시 사운드 초기화
    useEffect(() => {
        initSounds();
        preloadSounds();
    }, []);

    // 일반 사운드 재생
    const playSound = useCallback((name) => {
        playSoundUtil(name);
    }, []);

    // 이동 사운드
    const playMoveSound = useCallback(() => {
        playSoundUtil(SOUND_NAMES.MOVE);
    }, []);

    // 벽 설치 사운드
    const playWallSound = useCallback(() => {
        playSoundUtil(SOUND_NAMES.WALL);
    }, []);

    // 게임 시작 사운드
    const playStartSound = useCallback(() => {
        playSoundUtil(SOUND_NAMES.START);
    }, []);

    // 승리 사운드
    const playWinSound = useCallback(() => {
        playSoundUtil(SOUND_NAMES.WIN);
    }, []);

    // 패배 사운드
    const playLoseSound = useCallback(() => {
        playSoundUtil(SOUND_NAMES.LOSE);
    }, []);

    return {
        playSound,
        playMoveSound,
        playWallSound,
        playStartSound,
        playWinSound,
        playLoseSound,
        SOUND_NAMES
    };
};

export default useSound;
