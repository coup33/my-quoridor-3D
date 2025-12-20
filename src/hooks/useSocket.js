/**
 * Socket.IO 연결 및 이벤트 관리 훅
 */

import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';

// 싱글톤 소켓 인스턴스
let socketInstance = null;

const getSocket = () => {
    if (!socketInstance) {
        socketInstance = io(SOCKET_URL);
    }
    return socketInstance;
};

/**
 * Socket.IO 연결 및 이벤트 관리
 * @param {Object} handlers - 이벤트 핸들러들
 * @returns {Object} 소켓 액션 함수들
 */
export const useSocket = (handlers = {}) => {
    const socketRef = useRef(null);
    const handlersRef = useRef(handlers);

    // 핸들러 최신 상태 유지
    useEffect(() => {
        handlersRef.current = handlers;
    }, [handlers]);

    useEffect(() => {
        const socket = getSocket();
        socketRef.current = socket;

        // 로비 요청
        socket.emit('request_lobby');

        // 이벤트 리스너 등록
        const onLobbyUpdate = (data) => {
            handlersRef.current.onLobbyUpdate?.(data, socket.id);
        };

        const onGameStart = (started) => {
            handlersRef.current.onGameStart?.(started);
        };

        const onUpdateState = (state) => {
            handlersRef.current.onUpdateState?.(state);
        };

        const onInitState = (state) => {
            handlersRef.current.onInitState?.(state);
        };

        socket.on('lobby_update', onLobbyUpdate);
        socket.on('game_start', onGameStart);
        socket.on('update_state', onUpdateState);
        socket.on('init_state', onInitState);

        return () => {
            socket.off('lobby_update', onLobbyUpdate);
            socket.off('game_start', onGameStart);
            socket.off('update_state', onUpdateState);
            socket.off('init_state', onInitState);
        };
    }, []);

    // 역할 선택
    const selectRole = useCallback((role) => {
        socketRef.current?.emit('select_role', role);
    }, []);

    // 준비 상태 토글
    const toggleReady = useCallback((role) => {
        if (role) {
            socketRef.current?.emit('player_ready', role);
        }
    }, []);

    // 게임 액션 전송
    const emitAction = useCallback((newState) => {
        socketRef.current?.emit('game_action', newState);
    }, []);

    // 게임 리셋
    const resetGame = useCallback(() => {
        socketRef.current?.emit('reset_game');
    }, []);

    // 기권
    const resignGame = useCallback(() => {
        socketRef.current?.emit('resign_game');
    }, []);

    // AI 게임 시작
    const startAiGame = useCallback((difficulty) => {
        socketRef.current?.emit('start_ai_game', difficulty);
    }, []);

    // 현재 소켓 ID 가져오기
    const getSocketId = useCallback(() => {
        return socketRef.current?.id;
    }, []);

    return {
        selectRole,
        toggleReady,
        emitAction,
        resetGame,
        resignGame,
        startAiGame,
        getSocketId
    };
};

export default useSocket;
