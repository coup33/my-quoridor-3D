/**
 * 게임 상태 관리 훅
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { INITIAL_STATE } from '../utils/constants';
import { playSound } from '../utils/soundManager';

/**
 * 게임 상태 관리
 * @param {number|null} myRole - 내 역할 (1 또는 2)
 * @returns {Object} 게임 상태 및 업데이트 함수들
 */
export const useGameState = (myRole) => {
    // 플레이어 상태
    const [player1, setPlayer1] = useState(INITIAL_STATE.p1);
    const [player2, setPlayer2] = useState(INITIAL_STATE.p2);

    // 게임 상태
    const [turn, setTurn] = useState(INITIAL_STATE.turn);
    const [walls, setWalls] = useState(INITIAL_STATE.walls);
    const [winner, setWinner] = useState(INITIAL_STATE.winner);
    const [winReason, setWinReason] = useState(INITIAL_STATE.winReason);

    // AI 상태
    const [isVsAI, setIsVsAI] = useState(false);
    const [aiDifficulty, setAiDifficulty] = useState(1);

    // 타이머
    const [p1Time, setP1Time] = useState(INITIAL_STATE.p1Time);
    const [p2Time, setP2Time] = useState(INITIAL_STATE.p2Time);

    // 마지막 움직임/벽
    const [lastMove, setLastMove] = useState(null);
    const [lastWall, setLastWall] = useState(null);

    // UI 상태
    const [actionMode, setActionModeInternal] = useState(null);
    const [previewWall, setPreviewWall] = useState(null);

    // 액션 모드 변경 시 프리뷰 초기화
    const setActionMode = useCallback((mode) => {
        setActionModeInternal(mode);
        setPreviewWall(null);
    }, []);

    // 이전 상태 추적 (사운드 재생용)
    const prevStateRef = useRef(INITIAL_STATE);

    /**
     * 서버 상태와 동기화
     */
    const syncWithServer = useCallback((state) => {
        if (!state) return;

        const prev = prevStateRef.current;

        // 이동 사운드
        if (prev.p1.x !== state.p1.x || prev.p1.y !== state.p1.y ||
            prev.p2.x !== state.p2.x || prev.p2.y !== state.p2.y) {
            playSound('move');
        }

        // 벽 설치 사운드
        if ((state.walls || []).length > (prev.walls || []).length) {
            playSound('wall');
        }

        // 승리/패배 사운드
        if (state.winner && !prev.winner) {
            if (myRole === 1 || myRole === 2) {
                playSound(state.winner === myRole ? 'win' : 'lose');
            } else {
                playSound('win');
            }
        }

        // 턴 변경 시 프리뷰 초기화
        if (prev.turn !== state.turn) {
            setPreviewWall(null);
            setActionMode(null);
        }

        // 상태 저장
        prevStateRef.current = state;

        // 상태 업데이트
        setPlayer1(state.p1);
        setPlayer2(state.p2);
        setTurn(state.turn);
        setWalls(state.walls || []);
        setWinner(state.winner);
        setWinReason(state.winReason);
        setP1Time(state.p1Time);
        setP2Time(state.p2Time);
        setLastMove(state.lastMove);
        setP2Time(state.p2Time);
        setLastMove(state.lastMove);
        setLastWall(state.lastWall);

        // AI 상태 동기화 (서버에서 보내준다고 가정)
        if (state.isVsAI !== undefined) setIsVsAI(state.isVsAI);
        if (state.aiDifficulty !== undefined) setAiDifficulty(state.aiDifficulty);
    }, [myRole]);

    /**
     * 게임 상태 초기화
     */
    const resetState = useCallback(() => {
        prevStateRef.current = JSON.parse(JSON.stringify(INITIAL_STATE));

        // 모든 상태 완전 초기화
        setPlayer1(INITIAL_STATE.p1);
        setPlayer2(INITIAL_STATE.p2);
        setTurn(INITIAL_STATE.turn);
        setWalls(INITIAL_STATE.walls);
        setWinner(INITIAL_STATE.winner);
        setWinReason(INITIAL_STATE.winReason);
        setP1Time(INITIAL_STATE.p1Time);
        setP2Time(INITIAL_STATE.p2Time);
        setLastMove(null);
        setLastWall(null);
        setPreviewWall(null);
        setPreviewWall(null);
        setActionMode(null);
        // AI 상태는 여기서 초기화하면 안 될 수도 있음 (재시작 시 유지?). 
        // 하지만 INITIAL_STATE에는 없으므로 false로 초기화됨.
        setIsVsAI(false);
        setAiDifficulty(1);
    }, []);

    // 파생 상태
    const isMyTurn = useMemo(() => turn === myRole, [turn, myRole]);

    const currentPlayer = useMemo(() =>
        turn === 1 ? player1 : player2,
        [turn, player1, player2]
    );

    const opponentPlayer = useMemo(() =>
        turn === 1 ? player2 : player1,
        [turn, player1, player2]
    );

    return {
        // 플레이어 상태
        player1,
        player2,

        // 게임 상태
        turn,
        walls,
        winner,
        winReason,
        isVsAI,
        aiDifficulty,

        // 타이머
        p1Time,
        p2Time,

        // 마지막 움직임
        lastMove,
        lastWall,

        // UI 상태
        actionMode,
        setActionMode,
        previewWall,
        setPreviewWall,

        // 함수들
        syncWithServer,
        resetState,

        // 파생 상태
        isMyTurn,
        currentPlayer,
        opponentPlayer
    };
};

export default useGameState;
