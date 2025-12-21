/**
 * 게임 핸들러 훅
 * App.jsx에서 게임 관련 핸들러 로직을 분리
 */

import { useCallback } from 'react';
import { isMoveable as checkIsMoveable, canPlaceWall } from '../utils/gameLogic';
import { ACTION_MODES } from '../utils/constants';

/**
 * 게임 핸들러들을 관리하는 훅
 * @param {Object} params - 핸들러에 필요한 파라미터들
 * @returns {Object} 게임 핸들러 함수들
 */
export const useGameHandlers = ({
    // 게임 상태
    player1,
    player2,
    turn,
    walls,
    winner,
    isMyTurn,
    actionMode,
    previewWall,
    currentPlayer,
    opponentPlayer,
    isGameStarted,
    myRole,
    isMobile,
    // 상태 업데이트 함수
    setPreviewWall,
    setActionMode,
    setMyRole,
    setShowMenu,
    setShowResignConfirm,
    // 소켓 함수
    emitAction,
    socketSelectRole,
    socketToggleReady,
    socketResetGame,
    socketResignGame,
    socketStartAiGame
}) => {
    // 이동 가능 여부 체크
    const isMoveableCheck = useCallback((targetX, targetY) => {
        if (!isGameStarted || !isMyTurn || actionMode !== ACTION_MODES.MOVE || winner) {
            return false;
        }
        return checkIsMoveable(targetX, targetY, currentPlayer, opponentPlayer, walls);
    }, [isGameStarted, isMyTurn, actionMode, winner, currentPlayer, opponentPlayer, walls]);

    // 벽 설치 가능 여부 체크
    const canPlaceWallCheck = useCallback((x, y, orientation) => {
        if (!isGameStarted || !isMyTurn || winner) return false;
        return canPlaceWall(x, y, orientation, walls, player1, player2);
    }, [isGameStarted, isMyTurn, winner, walls, player1, player2]);

    // 셀 클릭 핸들러
    const handleCellClick = useCallback((x, y) => {
        setPreviewWall(null);
        if (!isMyTurn) return;
        if (!isMoveableCheck(x, y)) return;

        let nextState = {
            p1: player1,
            p2: player2,
            turn: turn === 1 ? 2 : 1,
            walls,
            winner: null
        };

        if (turn === 1) {
            nextState.p1 = { ...player1, x, y };
            if (nextState.p1.y === 8) {
                nextState.winner = 1;
                nextState.winReason = 'goal';
            }
        } else {
            nextState.p2 = { ...player2, x, y };
            if (nextState.p2.y === 0) {
                nextState.winner = 2;
                nextState.winReason = 'goal';
            }
        }

        emitAction(nextState);
    }, [isMyTurn, isMoveableCheck, player1, player2, turn, walls, emitAction, setPreviewWall]);

    // 벽 클릭 핸들러
    const handleWallClick = useCallback((x, y, orientation) => {
        if (!isMyTurn || actionMode !== ACTION_MODES.WALL) return;

        if (currentPlayer.wallCount <= 0) return;

        if (!canPlaceWallCheck(x, y, orientation)) {
            setPreviewWall(null);
            return;
        }

        // 같은 위치 클릭 시 설치 (모바일에서는 비활성화 - 설치 버튼으로만 가능)
        if (!isMobile && previewWall?.x === x && previewWall?.y === y && previewWall?.orientation === orientation) {
            const nextWalls = [...walls, { x, y, orientation }];
            const nextState = {
                p1: turn === 1 ? { ...player1, wallCount: player1.wallCount - 1 } : player1,
                p2: turn === 2 ? { ...player2, wallCount: player2.wallCount - 1 } : player2,
                turn: turn === 1 ? 2 : 1,
                walls: nextWalls,
                winner: null
            };
            emitAction(nextState);
            setPreviewWall(null);
        } else {
            // 프리뷰 표시 (모바일: 항상 프리뷰, 데스크탑: 새 위치일 때만)
            setPreviewWall({ x, y, orientation });
        }
    }, [isMyTurn, actionMode, currentPlayer.wallCount, canPlaceWallCheck, previewWall, walls, turn, player1, player2, emitAction, setPreviewWall, isMobile]);

    // 벽 설치 확인 (모바일 설치 버튼용 - 프리뷰 상태에서 직접 설치)
    const confirmWallPlacement = useCallback(() => {
        if (!previewWall) return;
        if (!isMyTurn || actionMode !== ACTION_MODES.WALL) return;
        if (currentPlayer.wallCount <= 0) return;

        const { x, y, orientation } = previewWall;

        if (!canPlaceWallCheck(x, y, orientation)) {
            setPreviewWall(null);
            return;
        }

        const nextWalls = [...walls, { x, y, orientation }];
        const nextState = {
            p1: turn === 1 ? { ...player1, wallCount: player1.wallCount - 1 } : player1,
            p2: turn === 2 ? { ...player2, wallCount: player2.wallCount - 1 } : player2,
            turn: turn === 1 ? 2 : 1,
            walls: nextWalls,
            winner: null
        };
        emitAction(nextState);
        setPreviewWall(null);
    }, [previewWall, isMyTurn, actionMode, currentPlayer.wallCount, canPlaceWallCheck, walls, turn, player1, player2, emitAction, setPreviewWall]);

    // 역할 선택
    const handleSelectRole = useCallback((role) => {
        socketSelectRole(role);
    }, [socketSelectRole]);

    // 준비 토글
    const handleToggleReady = useCallback(() => {
        if (myRole) {
            socketToggleReady(myRole);
        }
    }, [myRole, socketToggleReady]);

    // 게임 리셋
    const handleResetGame = useCallback(() => {
        socketResetGame();
        setMyRole(null);
        setShowMenu(false);
    }, [socketResetGame, setMyRole, setShowMenu]);

    // 기권 확인 모달 열기
    const openResignConfirm = useCallback(() => {
        setShowResignConfirm(true);
    }, [setShowResignConfirm]);

    // 기권 확인
    const confirmResign = useCallback(() => {
        socketResignGame();
        setShowResignConfirm(false);
    }, [socketResignGame, setShowResignConfirm]);

    // 기권 취소
    const cancelResign = useCallback(() => {
        setShowResignConfirm(false);
    }, [setShowResignConfirm]);

    // AI 게임 시작
    const handleStartAiGame = useCallback((difficulty) => {
        socketStartAiGame(difficulty);
    }, [socketStartAiGame]);

    // 역할 나가기 (로비에서)
    const handleLeaveRole = useCallback(() => {
        socketSelectRole(0);
    }, [socketSelectRole]);

    return {
        // 이동/벽 체크
        isMoveableCheck,
        canPlaceWallCheck,
        // 게임 핸들러
        handleCellClick,
        handleWallClick,
        confirmWallPlacement,
        // 로비 핸들러
        handleSelectRole,
        handleToggleReady,
        handleStartAiGame,
        handleLeaveRole,
        // 게임 제어 핸들러
        handleResetGame,
        openResignConfirm,
        confirmResign,
        cancelResign
    };
};

export default useGameHandlers;
