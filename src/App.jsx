/**
 * Quoridor 메인 앱 컴포넌트
 * 리팩토링된 버전 - 모듈화된 컴포넌트와 훅 사용
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

// 스타일
import './styles/index.css';

// 컴포넌트
import { Board } from './components/Board';
import { TimeBar, TurnIndicator, SidePanel, GameTitle } from './components/UI';
import { LobbyOverlay } from './components/Lobby';
import { GameOverModal, MenuModal } from './components/Modal';

// 훅
import { useSocket } from './hooks/useSocket';
import { useGameState } from './hooks/useGameState';
import { useSound } from './hooks/useSound';

// 유틸리티
import { isMoveable as checkIsMoveable, canPlaceWall } from './utils/gameLogic';
import { INITIAL_STATE, ACTION_MODES } from './utils/constants';

function App() {
  // 로비 상태
  const [myRole, setMyRole] = useState(null);
  const [takenRoles, setTakenRoles] = useState({ 1: null, 2: null });
  const [readyStatus, setReadyStatus] = useState({ 1: false, 2: false });
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // 게임 상태 훅
  const gameState = useGameState(myRole);
  const {
    player1, player2, turn, walls, winner, winReason,
    p1Time, p2Time, lastMove, lastWall,
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

      // 역할 설정
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

  // 파생 상태
  const isSpectator = isGameStarted && myRole !== 1 && myRole !== 2;
  const isFlipped = myRole === 1;
  const topTime = isFlipped ? p2Time : p1Time;
  const bottomTime = isFlipped ? p1Time : p2Time;

  const currentPlayer = turn === 1 ? player1 : player2;
  const opponentPlayer = turn === 1 ? player2 : player1;

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

    // 같은 위치 클릭 시 설치
    if (previewWall?.x === x && previewWall?.y === y && previewWall?.orientation === orientation) {
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
      // 프리뷰 표시
      setPreviewWall({ x, y, orientation });
    }
  }, [isMyTurn, actionMode, currentPlayer.wallCount, canPlaceWallCheck, previewWall, walls, turn, player1, player2, emitAction, setPreviewWall]);

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
    setMyRole(null);
    setShowMenu(false);
    socketResetGame();
  }, [socketResetGame]);

  // 기권
  const handleResignGame = useCallback(() => {
    if (window.confirm('정말 기권하시겠습니까?')) {
      socketResignGame();
    }
  }, [socketResignGame]);

  // AI 게임 시작
  const handleStartAiGame = useCallback((difficulty) => {
    socketStartAiGame(difficulty);
  }, [socketStartAiGame]);

  // 역할 나가기 (로비에서)
  const handleLeaveRole = useCallback(() => {
    socketSelectRole(0);
  }, [socketSelectRole]);

  // 상단 배지
  const topBadge = useMemo(() => {
    if (!isGameStarted) return null;
    if (isSpectator) {
      return <div className="status-badge badge-spectator">관전 모드</div>;
    }
    return <div className="status-badge badge-ingame">게임 중</div>;
  }, [isGameStarted, isSpectator]);

  // 기권 버튼
  const resignButton = useMemo(() => {
    if (isSpectator || winner || !isGameStarted) return null;
    return (
      <button className="status-badge badge-resign" onClick={handleResignGame}>
        항복
      </button>
    );
  }, [isSpectator, winner, isGameStarted, handleResignGame]);

  // 턴 표시
  const turnIndicator = (
    <TurnIndicator
      turn={turn}
      winner={winner}
      myRole={myRole}
      isSpectator={isSpectator}
    />
  );

  return (
    <div className="container">
      <GameTitle />

      {/* 메뉴 버튼 */}
      {isGameStarted && !isSpectator && (
        <button className="menu-float" onClick={() => setShowMenu(true)}>
          MENU
        </button>
      )}

      {/* 메뉴 모달 */}
      {showMenu && (
        <MenuModal
          onExit={handleResetGame}
          onClose={() => setShowMenu(false)}
        />
      )}

      {/* 로비 오버레이 */}
      {!isGameStarted && (
        <LobbyOverlay
          myRole={myRole}
          takenRoles={takenRoles}
          readyStatus={readyStatus}
          onSelectRole={handleSelectRole}
          onToggleReady={handleToggleReady}
          onStartAiGame={handleStartAiGame}
          onLeave={handleLeaveRole}
        />
      )}

      {/* 게임 영역 */}
      <div className={`game-wrapper ${!isGameStarted || winner ? 'blurred' : ''}`}>
        <main className="main-content">
          {/* 플레이어 1 패널 */}
          <SidePanel
            player={player1}
            playerNumber={1}
            isActive={turn === 1}
            isMyRole={myRole === 1}
            isMyTurn={isMyTurn && turn === 1}
            winner={winner}
            actionMode={actionMode}
            onActionModeChange={setActionMode}
            style={{ order: isFlipped ? 3 : 1 }}
          />

          {/* 보드 섹션 */}
          <section className="board-section" style={{ order: 2 }}>
            <TimeBar
              time={topTime}
              left={topBadge}
              center={turnIndicator}
              right={resignButton}
            />

            <div className="board-container">
              <Board
                player1={player1}
                player2={player2}
                walls={walls}
                lastMove={lastMove}
                lastWall={lastWall}
                isFlipped={isFlipped}
                isMyTurn={isMyTurn}
                actionMode={actionMode}
                previewWall={previewWall}
                onCellClick={handleCellClick}
                onWallClick={handleWallClick}
                isMoveableCheck={isMoveableCheck}
                canPlaceWallCheck={canPlaceWallCheck}
              />
            </div>

            <TimeBar time={bottomTime} />
          </section>

          {/* 플레이어 2 패널 */}
          <SidePanel
            player={player2}
            playerNumber={2}
            isActive={turn === 2}
            isMyRole={myRole === 2}
            isMyTurn={isMyTurn && turn === 2}
            winner={winner}
            actionMode={actionMode}
            onActionModeChange={setActionMode}
            style={{ order: isFlipped ? 1 : 3 }}
          />
        </main>
      </div>

      {/* 게임 종료 모달 */}
      {winner && (
        <GameOverModal
          winner={winner}
          winReason={winReason}
          myRole={myRole}
          isSpectator={isSpectator}
          onReturnToLobby={handleResetGame}
        />
      )}
    </div>
  );
}

export default App;