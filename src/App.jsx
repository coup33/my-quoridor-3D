import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// 본인의 Render 주소 확인!
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
  
  // 로비 상태
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
    socket.on('init_state', (state) => syncWithServer(state));
    socket.on('update_state', (state) => syncWithServer(state));

    return () => {
      socket.off('lobby_update');
      socket.off('game_start');
      socket.off('init_state');
      socket.off('update_state');
    };
  }, []);

  const syncWithServer = (state) => {
    // 서버 데이터가 비정상적일 경우 방어 코드
    if (!state || !state.p1 || !state.p2) return;
    setPlayer1(state.p1);
    setPlayer2(state.p2);
    setTurn(state.turn);
    setWalls(state.walls || []);
    setWinner(state.winner);
    setActionMode(null);
  };

  const emitAction = (newState) => {
    socket.emit('game_action', newState);
  };

  const selectRole = (role) => {
    socket.emit('select_role', role);
  };

  const toggleReady = () => {
    if (myRole) socket.emit('player_ready', myRole);
  };

  const resetGame = () => {
    socket.emit('reset_game');
  };

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
    if (!isGameStarted || winner || !isMyTurn) return false;
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
      {/* 로비 오버레이 */}
      {!isGameStarted && (
        <div className="lobby-overlay">
          <div className="lobby-card">
            <h2 className="lobby-title">QUORIDOR ONLINE</h2>
            
            {/* 1. 역할 선택 */}
            {!myRole && (
              <div className="role-selection">
                <p>플레이할 색상을 선택하세요</p>
                <div className="role-buttons">
                  <button className="role-btn white" disabled={takenRoles[1] !== null} onClick={() => selectRole(1)}>
                    백색 (P1) {takenRoles[1] ? <span className="taken-badge">사용 중</span> : <span className="free-badge">선택 가능</span>}
                  </button>
                  <button className="role-btn black" disabled={takenRoles[2] !== null} onClick={() => selectRole(2)}>
                    흑색 (P2) {takenRoles[2] ? <span className="taken-badge">사용 중</span> : <span className="free-badge">선택 가능</span>}
                  </button>
                </div>
              </div>
            )}

            {/* 2. 대기 화면 */}
            {myRole && (
              <div className="ready-section">
                <p className="my-role-text">당신은 <span className={myRole===1?'t-white':'t-black'}>{myRole===1?'백색(P1)':'흑색(P2)'}</span> 입니다</p>
                <div className="status-box">
                  <div className={`player-status ${readyStatus[1]?'ready':''}`}>P1: {takenRoles[1]?(readyStatus[1]?'준비 완료!':'대기 중...'):'접속 대기...'}</div>
                  <div className={`player-status ${readyStatus[2]?'ready':''}`}>P2: {takenRoles[2]?(readyStatus[2]?'준비 완료!':'대기 중...'):'접속 대기...'}</div>
                </div>
                <div className="action-buttons">
                  {!readyStatus[myRole] ? <button className="start-btn" onClick={toggleReady}>준비 완료</button> : <button className="start-btn waiting">대기 중...</button>}
                  <button className="cancel-btn" onClick={() => socket.emit('select_role', 0)}>나가기</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 게임 화면 (블러 처리 및 레이아웃 수정) */}
      <div className={`game-wrapper ${!isGameStarted ? 'blurred' : ''}`}>
        <header className="header">
          <h1 className="game-title">QUORIDOR</h1>
          <div className="role-badge">{myRole === 1 ? "나: 백색(P1)" : myRole === 2 ? "나: 흑색(P2)" : "관전"}</div>
        </header>

        <main className="main-content">
          <aside className={`side-panel white-area ${turn === 1 && !winner ? 'active' : ''}`}>
            <h2 className="player-label">백색 (P1)</h2>
            <div className="wall-counter white-box"><div className="count">{player1.wallCount}</div></div>
            <div className="button-group">
              <button className={`btn p1-btn ${actionMode==='move'?'selected':''}`} onClick={()=>setActionMode('move')} disabled={!isMyTurn||winner}>이동</button>
              <button className={`btn p1-btn ${actionMode==='wall'?'selected':''}`} onClick={()=>setActionMode('wall')} disabled={!isMyTurn||winner}>벽</button>
            </div>
          </aside>

          <section className="board-section">
            <div className="turn-display">
              {winner ? <span className="win-text">{winner===1?'백색 승리!':'흑색 승리!'}</span> : <span className={turn===1?'t-white':'t-black'}>{turn===1?'● 백색 차례':'● 흑색 차례'}</span>}
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
                      <div className={`wall-target h ${isWallMode?'in-wall-mode':''} ${canH?'placeable':''}`} style={{left:x*68,top:y*68+60}} onClick={()=>handleWallClick(x,y,'h')}/>
                      <div className={`wall-target v ${isWallMode?'in-wall-mode':''} ${canV?'placeable':''}`} style={{left:x*68+60,top:y*68}} onClick={()=>handleWallClick(x,y,'v')}/>
                    </React.Fragment>
                  );
                })}
                {(walls || []).map((wall,i)=>(<div key={i} className={`placed-wall ${wall.orientation}`} style={{left:wall.x*68+(wall.orientation==='v'?60:0),top:wall.y*68+(wall.orientation==='h'?60:0)}}/>))}
              </div>
            </div>
          </section>

          <aside className={`side-panel black-area ${turn === 2 && !winner ? 'active' : ''}`}>
            <h2 className="player-label">흑색 (P2)</h2>
            <div className="wall-counter black-box"><div className="count">{player2.wallCount}</div></div>
            <div className="button-group">
              <button className={`btn p2-btn ${actionMode==='move'?'selected':''}`} onClick={()=>setActionMode('move')} disabled={!isMyTurn||winner}>이동</button>
              <button className={`btn p2-btn ${actionMode==='wall'?'selected':''}`} onClick={()=>setActionMode('wall')} disabled={!isMyTurn||winner}>벽</button>
            </div>
          </aside>
        </main>
        {isGameStarted && <button className="reset-float" onClick={resetGame}>🔄 중단</button>}
        {winner && <div className="overlay"><div className="modal"><h2>{winner===1?'백색':'흑색'} 승리!</h2><button className="reset-large" onClick={resetGame}>로비로</button></div></div>}
      </div>
    </div>
  );
}

export default App;