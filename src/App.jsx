/**
 * Quoridor 메인 앱 컴포넌트
 * 리팩토링된 버전 - 3D 모드 전용, 모듈화된 컴포넌트와 훅 사용
 */

import React from 'react';

// 스타일은 main.jsx에서 index.css로 import됨

// 컴포넌트
import { Board3D } from './components/Board';
import { TimeBar, TurnIndicator, GameTitle, PlayerInfo, ActionButtons } from './components/UI';
import { LobbyOverlay } from './components/Lobby';
import { GameOverModal, MenuModal, ResignConfirmModal } from './components/Modal';

// 훅 (통합 로직)
import { useAppLogic } from './hooks/useAppLogic';

function App() {
  // 모든 비즈니스 로직을 커스텀 훅으로 위임
  const { state, actions } = useAppLogic();

  // 상태 구조 분해
  const {
    myRole, takenRoles, readyStatus, isGameStarted, showMenu, showResignConfirm, isMobileLayout,
    gameState: { player1, player2, turn, walls, lastWall, winner, winReason, actionMode, previewWall, isMyTurn },
    derived: { isSpectator, isFlipped, topTime, bottomTime, currentPlayer, myPlayerNumber, opponentPlayerNumber, myWallCount, opponentWallCount }
  } = state;

  // 액션 구조 분해
  const {
    setBoardBounds, setShowMenu: setShowMenuAction,
    isMoveableCheck, canPlaceWallCheck, handleCellClick, handleWallClick, confirmWallPlacement,
    handleSelectRole, handleToggleReady, handleStartAiGame, handleLeaveRole, handleResetGame,
    openResignConfirm, confirmResign, cancelResign
  } = actions;

  // 상단 배지
  const topBadge = !isGameStarted ? null : (
    isSpectator
      ? <div className="status-badge badge-spectator">관전 모드</div>
      : <div className="status-badge badge-ingame">게임 중</div>
  );

  // 기권 버튼
  const resignButton = (isSpectator || winner || !isGameStarted) ? null : (
    <button className="status-badge badge-resign" onClick={openResignConfirm}>
      항복
    </button>
  );

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
    <div className={`container ${isMobileLayout ? 'mobile-mode' : 'desktop-mode'}`}>
      <GameTitle />

      {/* 메뉴 버튼 */}
      {isGameStarted && !isSpectator && (
        <button className="menu-float" onClick={() => setShowMenuAction(true)}>
          MENU
        </button>
      )}

      {/* 메뉴 모달 */}
      {showMenu && (
        <MenuModal
          onExit={handleResetGame}
          onClose={() => setShowMenuAction(false)}
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
        <main className={`main-content-3d ${isMobileLayout ? 'mobile-mode' : 'desktop-mode'}`}>
          {/* 3D 보드 컨테이너 */}
          <div className="board-fullscreen-3d">
            {/* 상단 영역 (모바일) - 배지, 턴, 항복 + 타임바 */}
            <div className="mobile-top-bar">
              <div className="mobile-status-row">
                <div className="mobile-status-left">
                  {topBadge}
                </div>
                <div className="mobile-status-center">
                  {turnIndicator}
                </div>
                <div className="mobile-status-right">
                  {resignButton}
                </div>
              </div>
              <TimeBar time={topTime} />
            </div>


            {/* 3D 보드 */}
            <div className="board-3d-inner">
              <Board3D
                player1={player1}
                player2={player2}
                walls={walls}
                lastWall={lastWall}
                isFlipped={isFlipped}
                isMyTurn={isMyTurn}
                actionMode={actionMode}
                previewWall={previewWall}
                onCellClick={handleCellClick}
                onWallClick={handleWallClick}
                isMoveableCheck={isMoveableCheck}
                canPlaceWallCheck={canPlaceWallCheck}
                isMobileLayout={isMobileLayout}
                onBoardBoundsChange={setBoardBounds}
              />
            </div>

            {/* 하단 타임바 영역 (모바일) */}
            <div className="mobile-bottom-bar">
              <TimeBar time={bottomTime} />
              <div className="mobile-my-controls">
                <PlayerInfo
                  playerNumber={myPlayerNumber}
                  wallCount={myWallCount}
                  isActive={turn === myRole}
                  className="mobile-my-info"
                />
                {myRole && (
                  <ActionButtons
                    actionMode={actionMode}
                    onActionModeChange={(mode) => {
                      actions.setActionMode(mode);
                      if (mode !== 'wall') actions.setPreviewWall(null);
                    }}
                    isMyTurn={isMyTurn}
                    winner={winner}
                    wallCount={currentPlayer.wallCount}
                    className="mobile-action-buttons"
                    previewWall={previewWall}
                    onConfirmWall={confirmWallPlacement}
                    isMobile={isMobileLayout}
                  />
                )}
              </div>
            </div>
          </div>

          {/* 플로팅 UI - 좌측 (데스크탑) */}
          <div className="floating-panel floating-left desktop-only">
            <PlayerInfo
              playerNumber={opponentPlayerNumber}
              wallCount={opponentWallCount}
              isActive={myRole ? turn !== myRole : turn === 2}
              className="floating-player-info"
            />
          </div>

          {/* 플로팅 UI - 상단 (데스크탑) */}
          <div className="floating-timebar-top desktop-only">
            <div className="floating-turn-indicator">{turnIndicator}</div>
            <TimeBar time={topTime} />
          </div>

          {/* 플로팅 UI - 하단 (데스크탑) */}
          <div className="floating-timebar-bottom desktop-only">
            <TimeBar time={bottomTime} />
          </div>

          {/* 플로팅 UI - 우측 (데스크탑) */}
          <div className="floating-panel floating-right desktop-only">
            {myRole ? (
              <>
                <PlayerInfo
                  playerNumber={myPlayerNumber}
                  wallCount={myWallCount}
                  isActive={turn === myRole}
                  className="floating-player-info my-info"
                />
                <ActionButtons
                  actionMode={actionMode}
                  onActionModeChange={actions.setActionMode}
                  isMyTurn={isMyTurn}
                  winner={winner}
                  wallCount={currentPlayer.wallCount}
                  className="floating-action-row"
                />
              </>
            ) : (
              <PlayerInfo
                playerNumber={1}
                wallCount={player1.wallCount}
                isActive={turn === 1}
                className="floating-player-info"
              />
            )}
          </div>

          {/* 플로팅 UI - 좌측 하단 배지 */}
          <div className="floating-panel floating-bottom-left-badge">
            {topBadge}
            {resignButton}
          </div>
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

      {/* 항복 확인 모달 */}
      {showResignConfirm && (
        <ResignConfirmModal
          onConfirm={confirmResign}
          onCancel={cancelResign}
        />
      )}
    </div>
  );
}

export default App;