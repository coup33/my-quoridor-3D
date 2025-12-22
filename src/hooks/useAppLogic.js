import { useState, useEffect, useMemo } from 'react';
import { useSocket } from './useSocket';
import { useGameState } from './useGameState';
import { useSound } from './useSound';
import { useGameHandlers } from './useGameHandlers';
import { useAI } from './useAI'; // [ClientAI]
import { applyMove } from '../ai/aiCore'; // [ClientAI] applyMove import

export const useAppLogic = () => {
    // 로비 상태
    const [myRole, setMyRole] = useState(null);
    const [takenRoles, setTakenRoles] = useState({ 1: null, 2: null });
    const [readyStatus, setReadyStatus] = useState({ 1: false, 2: false });
    const [isGameStarted, setIsGameStarted] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showResignConfirm, setShowResignConfirm] = useState(false);

    // 모바일 레이아웃 감지
    const [isMobileLayout, setIsMobileLayout] = useState(false);

    // 보드 경계 정보
    const [boardBounds, setBoardBounds] = useState({ topY: 0, width: 0, cameraY: 14 });

    useEffect(() => {
        const checkMobileLayout = () => {
            const boardSize = Math.min(window.innerWidth, window.innerHeight);
            const leftPanelLeft = window.innerWidth / 2 - boardSize / 2 - 100;
            const titleRight = 80;
            setIsMobileLayout(leftPanelLeft < titleRight);
        };

        checkMobileLayout();
        window.addEventListener('resize', checkMobileLayout);
        return () => window.removeEventListener('resize', checkMobileLayout);
    }, []);

    // 게임 상태 훅
    const gameState = useGameState(myRole);
    const {
        player1, player2, turn, walls, winner, winReason,
        p1Time, p2Time, lastWall, isVsAI, aiDifficulty, // [ClientAI]
        actionMode, setActionMode, previewWall, setPreviewWall,
        syncWithServer, resetState, isMyTurn
    } = gameState;

    // 사운드 훅
    const { playSound } = useSound();

    // 소켓 핸들러
    const socketHandlers = useMemo(() => ({
        onLobbyUpdate: (data, socketId) => {
            setTakenRoles(data.roles);
            setReadyStatus(data.readyStatus);
            setIsGameStarted(data.isGameStarted);

            if (data.roles[1] !== socketId && data.roles[2] !== socketId) {
                setMyRole(null);
            } else {
                if (data.roles[1] === socketId) setMyRole(1);
                else if (data.roles[2] === socketId) setMyRole(2);
            }
        },
        onGameStart: (started) => {
            setIsGameStarted(started);
            if (started) {
                playSound('start');
                resetState();
                setShowMenu(false);
            } else {
                resetState();
                setShowMenu(false);
            }
        },
        onUpdateState: syncWithServer,
        onInitState: syncWithServer
    }), [playSound, resetState, syncWithServer]);

    // 소켓 훅
    const {
        selectRole: socketSelectRole,
        toggleReady: socketToggleReady,
        emitAction,
        resetGame: socketResetGame,
        resignGame: socketResignGame,
        startAiGame: socketStartAiGame
    } = useSocket(socketHandlers);

    // 파생 상태 계산
    const isSpectator = isGameStarted && myRole !== 1 && myRole !== 2;
    const isFlipped = myRole === 1;
    const topTime = isFlipped ? p2Time : p1Time;
    const bottomTime = isFlipped ? p1Time : p2Time;
    const currentPlayer = turn === 1 ? player1 : player2;

    const myPlayerNumber = myRole || 1;
    const opponentPlayerNumber = myRole === 1 ? 2 : myRole === 2 ? 1 : 2;
    const myWallCount = myRole === 1 ? player1.wallCount : myRole === 2 ? player2.wallCount : player1.wallCount;
    const opponentWallCount = myRole === 1 ? player2.wallCount : myRole === 2 ? player1.wallCount : player2.wallCount;

    // 게임 핸들러 훅
    const handlers = useGameHandlers({
        player1, player2, turn, walls, winner, isMyTurn, actionMode, previewWall,
        currentPlayer,
        opponentPlayer: turn === 1 ? player2 : player1,
        isGameStarted, myRole,
        isMobile: isMobileLayout,
        setPreviewWall, setActionMode, setMyRole, setShowMenu, setShowResignConfirm,
        emitAction, socketSelectRole, socketToggleReady, socketResetGame, socketResignGame, socketStartAiGame
    });

    // [ClientAI] AI 통합
    const fullGameState = useMemo(() => ({
        p1: player1,
        p2: player2,
        walls,
        turn,
        p1Time,
        p2Time,
        winner,
        winReason,
        lastMove,
        lastWall,
        wallCount: { 1: player1.wallCount, 2: player2.wallCount } // aiCore에서 필요할 수도 있음 (직접 참조하긴 함)
    }), [player1, player2, walls, turn, p1Time, p2Time, winner, winReason, lastMove, lastWall]);

    const { isThinking } = useAI(fullGameState, isVsAI, aiDifficulty, (move) => {
        // AI가 수를 두면 서버로 전송
        // move: { type: 'move'|'wall', ... }

        // 현재 상태에 AI의 수를 적용하여 새로운 상태 생성
        const newState = applyMove(fullGameState, move);

        // 서버로 전송 (마치 P2가 둔 것처럼)
        emitAction(newState);
    });

    return {
        state: {
            isThinking, // AI 생각 중 표시용
            myRole, takenRoles, readyStatus, isGameStarted, showMenu, showResignConfirm,
            isMobileLayout, boardBounds,
            gameState,
            derived: {
                isSpectator, isFlipped, topTime, bottomTime, currentPlayer,
                myPlayerNumber, opponentPlayerNumber, myWallCount, opponentWallCount
            }
        },
        actions: {
            setBoardBounds,
            setShowMenu,
            setActionMode,
            setPreviewWall,
            setMyRole,
            setShowResignConfirm,
            ...handlers
        }
    };
};
