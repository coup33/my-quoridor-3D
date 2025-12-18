import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('https://my-quoridor.onrender.com');

function App() {
  const initialState = {
    p1: { x: 4, y: 0, wallCount: 10 },
    p2: { x: 4, y: 8, wallCount: 10 },
    turn: 1,
    walls: [],
    actionMode: null,
    winner: null
  };

  const [player1, setPlayer1] = useState(initialState.p1);
  const [player2, setPlayer2] = useState(initialState.p2);
  const [turn, setTurn] = useState(initialState.turn);
  const [walls, setWalls] = useState(initialState.walls);
  const [actionMode, setActionMode] = useState(initialState.actionMode);
  const [winner, setWinner] = useState(initialState.winner);
  
  // 내 역할 저장 (1: P1, 2: P2, 0: 관전자)
  const [myRole, setMyRole] = useState(null);

  useEffect(() => {
    socket.on('assign_role', (role) => {
      setMyRole(role);
    });

    socket.on('init_state', (state) => syncWithServer(state));
    socket.on('update_state', (state) => syncWithServer(state));

    return () => {
      socket.off('assign_role');
      socket.off('init_state');
      socket.off('update_state');
    };
  }, []);

  const syncWithServer = (state) => {
    setPlayer1(state.p1);
    setPlayer2(state.p2);
    setTurn(state.turn);
    setWalls(state.walls);
    setWinner(state.winner);
    setActionMode(null);
  };

  const emitAction = (newState) => {
    socket.emit('game_action', newState);
  };

  const resetGame = () => {
    socket.emit('reset_game', initialState);
    setActionMode(null);
  };

  // --- 중요: 내 차례인지 확인하는 변수 ---
  const isMyTurn = turn === myRole;

  const isMoveable = (targetX, targetY) => {
    if (!isMyTurn || actionMode !== 'move' || winner) return false;
    const current = turn === 1 ? player1 : player2;
    const opponent = turn === 1 ? player2 : player1;
    const diffX = Math.abs(current.x - targetX);
    const diffY = Math.abs(current.y - targetY);
    const isAdjacent = (diffX === 1 && diffY === 0) || (diffX === 0 && diffY === 1);
    const isOccupied = targetX === opponent.x && targetY === opponent.y;
    return isAdjacent && !isOccupied;
  };

  const canPlaceWall = (x, y, orientation) => {
    if (winner || !isMyTurn) return false; // 내 차례 아니면 설치 불가
    return !walls.some(w => {
      if (w.x === x && w.y === y && w.orientation === orientation) return true;
      if (w.orientation === orientation) {
        if (orientation === 'h' && w.y === y && Math.abs(w.x - x) === 1) return true;
        if (orientation === 'v' && w.x === x && Math.abs(w.y - y) === 1) return true;
      }
      if (w.x === x && w.y === y && w.orientation !== orientation) return true;
      return false;
    });
  };

  const handleCellClick = (x, y) => {
    if (!isMoveable(x, y)) return;
    let nextState = { p1: player1, p2: player2, turn: turn === 1 ? 2 : 1, walls, winner: null };
    if (turn === 1) {
      nextState.p1 = { ...player1, x, y };
      if (nextState.p1.y === 8) nextState.winner = 1;
    } else {
      nextState.p2 = { ...player2, x, y };
      if (nextState.p2.y === 0) nextState.winner = 2;
    }
    syncWithServer(nextState);
    emitAction(nextState);
  };

  const handleWallClick = (x, y, orientation) => {
    if (actionMode !== 'wall' || !isMyTurn) return;
    const current = turn === 1 ? player1 : player2;
    if (current.wallCount <= 0) return;
    if (!canPlaceWall(x, y, orientation)) return;

    const nextWalls = [...walls, { x, y, orientation }];
    let nextState = { 
      p1: turn === 1 ? { ...player1, wallCount: player1.wallCount - 1 } : player1,
      p2: turn === 2 ? { ...player2, wallCount: player2.wallCount - 1 } : player2,
      turn: turn === 1 ? 2 : 1,
      walls: nextWalls,
      winner: null
    };
    syncWithServer(nextState);
    emitAction(nextState);
  };

  return (
    <div className="container">
      <header className="header">
        <h1 className="game-title">QUORIDOR ONLINE</h1>
        <div className="role-badge">
          {myRole === 1 ? "당신은 백색(P1)입니다" : myRole === 2 ? "당신은 흑색(P2)입니다" : "관전 중..."}
        </div>
      </header>

      <main className="main-content">
        {/* P1 패널: 내 역할이 1일 때만 버튼 활성화 */}
        <aside className={`side-panel white-area ${turn === 1 && !winner ? 'active' : ''}`}>
          <h2 className="player-label">백색 (P1)</h2>
          <div className="wall-counter white-box"><small>남은 벽</small><div className="count">{player1.wallCount}</div></div>
          <div className="button-group">
            <button className={`btn p1-btn ${actionMode === 'move' ? 'selected' : ''}`} 
              onClick={() => setActionMode('move')} 
              disabled={myRole !== 1 || turn !== 1 || winner}>말 이동</button>
            <button className={`btn p1-btn ${actionMode === 'wall' ? 'selected' : ''}`} 
              onClick={() => setActionMode('wall')} 
              disabled={myRole !== 1 || turn !== 1 || winner}>벽 설치</button>
          </div>
        </aside>

        <section className="board-section">
          <div className="turn-display">
            {winner ? <span className="win-text">{winner === 1 ? '백색 승리!' : '흑색 승리!'}</span> : 
            <span className={turn === 1 ? 't-white' : 't-black'}>
              {turn === 1 ? '● 백색 차례' : '● 흑색 차례'} {isMyTurn && "(당신)"}
            </span>}
          </div>
          <div className="board-container">
            <div className="board">
              {Array.from({ length: 81 }).map((_, i) => {
                const x = i % 9, y = Math.floor(i / 9);
                const canMove = isMoveable(x, y);
                return (
                  <div key={`c-${x}-${y}`} className={`cell ${canMove ? 'highlight' : ''}`} onClick={() => handleCellClick(x, y)}>
                    {player1.x === x && player1.y === y && <div className="pawn white-pawn" />}
                    {player2.x === x && player2.y === y && <div className="pawn black-pawn" />}
                    {canMove && <div className="move-dot" />}
                  </div>
                );
              })}
              {Array.from({ length: 64 }).map((_, i) => {
                const x = i % 8, y = Math.floor(i / 8);
                const isWallMode = actionMode === 'wall' && isMyTurn;
                const canH = isWallMode && canPlaceWall(x, y, 'h');
                const canV = isWallMode && canPlaceWall(x, y, 'v');
                return (
                  <React.Fragment key={`wp-${x}-${y}`}>
                    <div className={`wall-target h ${isWallMode ? 'in-wall-mode' : ''} ${canH ? 'placeable' : ''}`} style={{ left: x * 68, top: y * 68 + 60 }} onClick={() => handleWallClick(x, y, 'h')} />
                    <div className={`wall-target v ${isWallMode ? 'in-wall-mode' : ''} ${canV ? 'placeable' : ''}`} style={{ left: x * 68 + 60, top: y * 68 }} onClick={() => handleWallClick(x, y, 'v')} />
                  </React.Fragment>
                );
              })}
              {walls.map((wall, i) => (
                <div key={i} className={`placed-wall ${wall.orientation}`} style={{ left: wall.x * 68 + (wall.orientation === 'v' ? 60 : 0), top: wall.y * 68 + (wall.orientation === 'h' ? 60 : 0) }} />
              ))}
            </div>
          </div>
        </section>

        {/* P2 패널: 내 역할이 2일 때만 버튼 활성화 */}
        <aside className={`side-panel black-area ${turn === 2 && !winner ? 'active' : ''}`}>
          <h2 className="player-label">흑색 (P2)</h2>
          <div className="wall-counter black-box"><small>남은 벽</small><div className="count">{player2.wallCount}</div></div>
          <div className="button-group">
            <button className={`btn p2-btn ${actionMode === 'move' ? 'selected' : ''}`} 
              onClick={() => setActionMode('move')} 
              disabled={myRole !== 2 || turn !== 2 || winner}>말 이동</button>
            <button className={`btn p2-btn ${actionMode === 'wall' ? 'selected' : ''}`} 
              onClick={() => setActionMode('wall')} 
              disabled={myRole !== 2 || turn !== 2 || winner}>벽 설치</button>
          </div>
        </aside>
      </main>
      {winner && <div className="overlay"><div className="modal"><h2>🎉 {winner === 1 ? '백색' : '흑색'} 승리! 🎉</h2><button className="reset-large" onClick={resetGame}>다시 시작</button></div></div>}
      <button className="reset-float" onClick={resetGame}>🔄 초기화</button>
    </div>
  );
}

export default App;