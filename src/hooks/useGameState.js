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

    // 타이머
    const [p1Time, setP1Time] = useState(INITIAL_STATE.p1Time);
    const [p2Time, setP2Time] = useState(INITIAL_STATE.p2Time);

    // 마지막 움직임/벽
    const [lastMove, setLastMove] = useState(null);
    const [lastWall, setLastWall] = useState(null);

    // UI 상태
    const [actionMode, setActionMode] = useState(null);
    const [previewWall, setPreviewWall] = useState(null);

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
        setLastWall(state.lastWall);
    }, [myRole]);

    /**
     * 게임 상태 초기화
     */
    const resetState = useCallback(() => {
        prevStateRef.current = JSON.parse(JSON.stringify(INITIAL_STATE));
        setLastMove(null);
        setLastWall(null);
        setWinner(null);
        setPreviewWall(null);
        setActionMode(null);
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
