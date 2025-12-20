/**
 * 사운드 관리 유틸리티
 */

import { SOUND_NAMES } from './constants';

// 사운드 객체 저장
let sounds = null;

/**
 * 사운드 초기화
 * @returns {Object} 사운드 객체들
 */
export const initSounds = () => {
    if (sounds) return sounds;

    sounds = {
        [SOUND_NAMES.MOVE]: new Audio('/sounds/move.mp3'),
        [SOUND_NAMES.WALL]: new Audio('/sounds/wall.mp3'),
        [SOUND_NAMES.START]: new Audio('/sounds/start.mp3'),
        [SOUND_NAMES.WIN]: new Audio('/sounds/win.mp3'),
        [SOUND_NAMES.LOSE]: new Audio('/sounds/lose.mp3'),
    };

    return sounds;
};

/**
 * 사운드 재생
 * @param {string} name - 사운드 이름 (SOUND_NAMES 참조)
 */
export const playSound = (name) => {
    try {
        if (!sounds) initSounds();

        const audio = sounds[name];
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.log("Audio play failed:", e));
        }
    } catch (err) {
        console.error('Sound error:', err);
    }
};

/**
 * 모든 사운드 프리로드
 */
export const preloadSounds = () => {
    if (!sounds) initSounds();

    Object.values(sounds).forEach(audio => {
        audio.load();
    });
};

export default {
    initSounds,
    playSound,
    preloadSounds,
    SOUND_NAMES
};
