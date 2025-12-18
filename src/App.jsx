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
  
  const [myRole, setMyRole] = useState(null);
  const [takenRoles, setTakenRoles] = useState({ 1: null, 2: null });
  const [readyStatus, setReadyStatus] = useState({ 1: false, 2: false });
  const [isGameStarted, setIsGameStarted] = useState(false);

  useEffect(() => {
    socket.emit('request_lobby');
    socket.on('lobby_update', (data) => {
      setTakenRoles(data.roles);
      setReadyStatus(data.readyStatus);
      setIsGameStarted(data.isGameStarted);
      if (data.roles[1] === socket.id) setMyRole(1);
      else if (data.roles[2] === socket.id) setMyRole(2);
      else setMyRole(null);
    });
    socket.on('game_start', (started) => setIsGameStarted(started));
    socket.on('update_state', (state) => syncWithServer(state));
    socket.on('init_state', (state) => syncWithServer(state));

    return () => {
      socket.off('lobby_update');
      socket.off('game_start');
      socket.off('update_state');
      socket.off('init_state');
    };
  }, []);

  const syncWithServer = (state) => {
    if (!state) return;
    setPlayer1(state.p1);
    setPlayer2(state.p2);
    setTurn(state.turn);
    setWalls(state.walls || []);
    setWinner(state.winner);
    if (state.turn === myRole) setActionMode(null);
  };

  const emitAction = (newState) => {
    syncWithServer(newState);
    socket.emit('game_action', newState);
  };

  const selectRole = (role) => socket.emit('select_role', role);
  const toggleReady = () => myRole && socket.emit('player_ready', myRole);
  const resetGame = () => socket.emit('reset_game');

  const isMyTurn = turn === myRole;

  const isMoveable = (targetX, targetY) => {
    if (!isGameStarted || !isMyTurn || actionMode !== 'move' || winner) return false;
    const current = turn === 1 ? player1 : player2;
    const opponent = turn === 1 ? player2 : player1;
    const diffX = Math.abs(current.x - targetX);
    const diffY = Math.abs(current.y - targetY);
    const isAdjacent = (diffX === 1 && diffY === 0) || (diffX === 0 && diffY === 1);
    const isOccupied = targetX === opponent.x && targetY === opponent.y;
    return isAdjacent && !isOccupied;
  };

  const canPlaceWall = (x, y, orientation) => {
    if (!isGameStarted || !isMyTurn || winner) return false;
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
    if (!isMyTurn) return;
    if (!isMoveable(x, y)) return;
    let nextState = { p1: player1, p2: player2, turn: turn === 1 ? 2 : 1, walls, winner: null };
    if (turn === 1) {
      nextState.p1 = { ...player1, x, y };
      if (nextState.p1.y === 8) nextState.winner = 1;
    } else {
      nextState.p2 = { ...player2, x, y };
      if (nextState.p2.y === 0) nextState.winner = 2;
    }
    emitAction(nextState);
  };

  const handleWallClick = (x, y, orientation) => {
    if (!isMyTurn || actionMode !== 'wall') return;
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
    emitAction(nextState);
  };

  // --- 중요: 모바일 반응형을 위한 위치 계산 스타일 헬퍼 ---
  // calc(x * (cell + gap)) 방식을 사용하여 CSS 변수에 따라 자동 조절됨
  const getVWallStyle = (x, y) => ({
    left: `calc(${x} * var(--unit) + var(--cell))`,
    top: `calc(${y} * var(--unit))`
  });

  const getHWallStyle = (x, y) => ({
    left: `calc(${x} * var(--unit))`,
    top: `calc(${y} * var(--unit) + var(--cell))`
  });

  const getPlacedWallStyle = (wall) => {
    if (wall.orientation === 'v') {
      return {
        left: `calc(${wall.x} * var(--unit) + var(--cell))`,
        top: `calc(${wall.y} * var(--unit))`
      };
    } else {
      return {
        left: `calc(${wall.x} * var(--unit))`,
        top: `calc(${wall.y} * var(--unit) + var(--cell))`
      };
    }
  };

  return (
    <div className="container">
      {!isGameStarted && (
        <div className="lobby-overlay">
          <div className="lobby-card">
            <h2 className="lobby-title">QUORIDOR</h2>
            {!myRole && (
              <div className="role-selection">
                <div className="role-buttons">
                  <button className="role-btn white" disabled={takenRoles[1] !== null} onClick={() => selectRole(1)}>
                    백색 (P1) {takenRoles[1] && <span className="taken-badge">사용 중</span>}
                  </button>
                  <button className="role-btn black" disabled={takenRoles[2] !== null} onClick={() => selectRole(2)}>
                    흑색 (P2) {takenRoles[2] && <span className="taken-badge">사용 중</span>}
                  </button>
                </div>
              </div>
            )}
            {myRole && (
              <div className="ready-section">
                <div className="status-box">
                  <div className={`player-status ${readyStatus[1]?'ready':''}`}>P1: {readyStatus[1]?'준비 완료':'대기 중'}</div>
                  <div className={`player-status ${readyStatus[2]?'ready':''}`}>P2: {readyStatus[2]?'준비 완료':'대기 중'}</div>
                </div>
                {!readyStatus[myRole] ? <button className="start-btn" onClick={toggleReady}>준비 하기</button> : <button className="start-btn waiting">대기 중...</button>}
                <button className="cancel-btn" onClick={() => socket.emit('select_role', 0)}>나가기</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`game-wrapper ${!isGameStarted ? 'blurred' : ''}`}>
        <header className="header">
          <h1 className="game-title">QUORIDOR</h1>
          <div className="role-badge">{myRole===1 ? "P1(백)" : myRole===2 ? "P2(흑)" : "관전"}</div>
        </header>

        <main className="main-content">
          <aside className={`side-panel white-area ${turn === 1 && !winner ? 'active' : ''}`}>
            <div className="player-label">P1 (백색)</div>
            <div className="wall-counter white-box">남은 벽: <span className="count">{player1.wallCount}</span></div>
            {myRole === 1 ? (
              <div className="button-group">
                <button className={`btn p1-btn ${actionMode==='move'?'selected':''}`} onClick={()=>setActionMode('move')} disabled={!isMyTurn||winner}>이동</button>
                <button className={`btn p1-btn ${actionMode==='wall'?'selected':''}`} onClick={()=>setActionMode('wall')} disabled={!isMyTurn||winner}>벽</button>
              </div>
            ) : <div className="opponent-status">상대방</div>}
          </aside>

          <section className="board-section">
            <div className="turn-display">
              {winner ? <span className="win-text">승리!</span> : <span className={turn===1?'t-white':'t-black'}>{turn===1?'● 백색 턴':'● 흑색 턴'}</span>}
            </div>
            <div className="board-container">
              <div className="board">
                {Array.from({length:81}).map((_,i)=>{
                  const x=i%9, y=Math.floor(i/9);
                  const canMove=isMoveable(x,y);
                  return (
                    <div key={`c-${x}-${y}`} className={`cell ${canMove?'highlight':''}`} onClick={()=>handleCellClick(x,y)}>
                      {player1.x===x&&player1.y===y&&<div className="pawn white-pawn"/>}
                      {player2.x===x&&player2.y===y&&<div className="pawn black-pawn"/>}
                      {canMove&&<div className="move-dot"/>}
                    </div>
                  );
                })}
                {Array.from({length:64}).map((_,i)=>{
                  const x=i%8, y=Math.floor(i/8);
                  const isWallMode=actionMode==='wall'&&isMyTurn;
                  const canH=isWallMode&&canPlaceWall(x,y,'h');
                  const canV=isWallMode&&canPlaceWall(x,y,'v');
                  return (
                    <React.Fragment key={`wp-${x}-${y}`}>
                      <div className={`wall-target h ${isWallMode?'in-wall-mode':''} ${canH?'placeable':''}`} style={getHWallStyle(x,y)} onClick={()=>handleWallClick(x,y,'h')}/>
                      <div className={`wall-target v ${isWallMode?'in-wall-mode':''} ${canV?'placeable':''}`} style={getVWallStyle(x,y)} onClick={()=>handleWallClick(x,y,'v')}/>
                    </React.Fragment>
                  );
                })}
                {(walls || []).map((wall,i)=>(
                  <div key={i} className={`placed-wall ${wall.orientation}`} style={getPlacedWallStyle(wall)}/>
                ))}
              </div>
            </div>
          </section>

          <aside className={`side-panel black-area ${turn === 2 && !winner ? 'active' : ''}`}>
            <div className="player-label">P2 (흑색)</div>
            <div className="wall-counter black-box">남은 벽: <span className="count">{player2.wallCount}</span></div>
            {myRole === 2 ? (
              <div className="button-group">
                <button className={`btn p2-btn ${actionMode==='move'?'selected':''}`} onClick={()=>setActionMode('move')} disabled={!isMyTurn||winner}>이동</button>
                <button className={`btn p2-btn ${actionMode==='wall'?'selected':''}`} onClick={()=>setActionMode('wall')} disabled={!isMyTurn||winner}>벽</button>
              </div>
            ) : <div className="opponent-status">상대방</div>}
          </aside>
        </main>
        {isGameStarted && <button className="reset-float" onClick={resetGame}>🔄</button>}
        {winner && <div className="overlay"><div className="modal"><h2>{winner===1?'백색':'흑색'} 승리!</h2><button className="reset-large" onClick={resetGame}>로비로</button></div></div>}
      </div>
    </div>
  );
}

export default App;