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

  const [previewWall, setPreviewWall] = useState(null); 

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
    setPreviewWall(null); 
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

  // --- 🔥 [이동/벽 로직] (규칙 완벽 적용됨) ---
  const isBlockedByWall = (currentX, currentY, targetX, targetY, currentWalls) => {
    if (targetY < currentY) return currentWalls.some(w => w.orientation === 'h' && w.y === targetY && (w.x === currentX || w.x === currentX - 1));
    if (targetY > currentY) return currentWalls.some(w => w.orientation === 'h' && w.y === currentY && (w.x === currentX || w.x === currentX - 1));
    if (targetX < currentX) return currentWalls.some(w => w.orientation === 'v' && w.x === targetX && (w.y === currentY || w.y === currentY - 1));
    if (targetX > currentX) return currentWalls.some(w => w.orientation === 'v' && w.x === currentX && (w.y === currentY || w.y === currentY - 1));
    return false;
  };

  const isValidStep = (x1, y1, x2, y2, currentWalls) => {
    if (x2 < 0 || x2 > 8 || y2 < 0 || y2 > 8) return false;
    if (Math.abs(x1 - x2) + Math.abs(y1 - y2) !== 1) return false;
    return !isBlockedByWall(x1, y1, x2, y2, currentWalls);
  };

  const isMoveable = (targetX, targetY) => {
    if (!isGameStarted || !isMyTurn || actionMode !== 'move' || winner) return false;
    const current = turn === 1 ? player1 : player2;
    const opponent = turn === 1 ? player2 : player1;
    
    // 1. 일반 이동
    if (isValidStep(current.x, current.y, targetX, targetY, walls)) {
      if (!(targetX === opponent.x && targetY === opponent.y)) return true;
    }
    // 2. 점프 & 대각선
    if (isValidStep(current.x, current.y, opponent.x, opponent.y, walls)) {
      const dx = opponent.x - current.x;
      const dy = opponent.y - current.y;
      const jumpX = opponent.x + dx;
      const jumpY = opponent.y + dy;

      if (targetX === jumpX && targetY === jumpY) {
        return isValidStep(opponent.x, opponent.y, jumpX, jumpY, walls);
      }
      if (isValidStep(opponent.x, opponent.y, targetX, targetY, walls)) {
        const isJumpBlocked = jumpX < 0 || jumpX > 8 || jumpY < 0 || jumpY > 8 || isBlockedByWall(opponent.x, opponent.y, jumpX, jumpY, walls);
        if (isJumpBlocked) {
          if (Math.abs(targetX - current.x) === 1 && Math.abs(targetY - current.y) === 1) return true;
        }
      }
    }
    return false;
  };

  const hasValidPath = (startNode, targetRow, simulatedWalls) => {
    const queue = [startNode]; 
    const visited = new Set();
    visited.add(`${startNode.x},${startNode.y}`);
    const directions = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];

    while (queue.length > 0) {
      const { x, y } = queue.shift();
      if (y === targetRow) return true;
      for (let dir of directions) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        if (nx >= 0 && nx < 9 && ny >= 0 && ny < 9) {
          const key = `${nx},${ny}`;
          if (!visited.has(key) && !isBlockedByWall(x, y, nx, ny, simulatedWalls)) {
            visited.add(key);
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }
    return false; 
  };

  const canPlaceWall = (x, y, orientation) => {
    if (!isGameStarted || !isMyTurn || winner) return false;
    const isOverlap = walls.some(w => {
      if (w.x === x && w.y === y && w.orientation === orientation) return true;
      if (w.orientation === orientation) {
        if (orientation === 'h' && w.y === y && Math.abs(w.x - x) === 1) return true;
        if (orientation === 'v' && w.x === x && Math.abs(w.y - y) === 1) return true;
      }
      if (w.x === x && w.y === y && w.orientation !== orientation) return true;
      return false;
    });
    if (isOverlap) return false;
    const simulatedWalls = [...walls, { x, y, orientation }];
    return hasValidPath({ x: player1.x, y: player1.y }, 8, simulatedWalls) && hasValidPath({ x: player2.x, y: player2.y }, 0, simulatedWalls);
  };

  const handleCellClick = (x, y) => {
    setPreviewWall(null); 
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
    if (!canPlaceWall(x, y, orientation)) { setPreviewWall(null); return; }

    if (previewWall && previewWall.x === x && previewWall.y === y && previewWall.orientation === orientation) {
      const nextWalls = [...walls, { x, y, orientation }];
      let nextState = { 
        p1: turn === 1 ? { ...player1, wallCount: player1.wallCount - 1 } : player1,
        p2: turn === 2 ? { ...player2, wallCount: player2.wallCount - 1 } : player2,
        turn: turn === 1 ? 2 : 1,
        walls: nextWalls,
        winner: null
      };
      emitAction(nextState);
      setPreviewWall(null);
    } else {
      setPreviewWall({ x, y, orientation });
    }
  };

  // 스타일 헬퍼 (기존 유지)
  const getVWallStyle = (x, y) => ({ left: `calc(${x} * var(--unit) + var(--cell))`, top: `calc(${y} * var(--unit))` });
  const getHWallStyle = (x, y) => ({ left: `calc(${x} * var(--unit))`, top: `calc(${y} * var(--unit) + var(--cell))` });
  const getPlacedWallStyle = (wall) => {
    if (wall.orientation === 'v') return { left: `calc(${wall.x} * var(--unit) + var(--cell))`, top: `calc(${wall.y} * var(--unit))` };
    else return { left: `calc(${wall.x} * var(--unit))`, top: `calc(${wall.y} * var(--unit) + var(--cell))` };
  };

  // --- 🔥 [화면 회전 및 배치 로직] ---
  const isSpectator = isGameStarted && myRole !== 1 && myRole !== 2;
  
  // 내가 P1(백색)이면 화면을 180도 뒤집어서 내가 아래에 보이게 함
  const isFlipped = myRole === 1; 

  return (
    <div className="container">
      <div className="game-title">QUORIDOR</div>

      {!isGameStarted && (
        <div className="lobby-overlay">
          <div className="lobby-card">
            <h2 style={{marginBottom: '20px'}}>QUORIDOR ONLINE</h2>
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
          {isSpectator && <div className="spectator-badge">관전 모드</div>}
        </header>

        <main className="main-content">
          {/* [모바일 배치] order 속성을 동적으로 변경하여
            '내가 선택한 역할'의 패널이 항상 하단(order: 3)에 오도록 함.
            상대방 패널은 상단(order: 1)에 위치.
          */}

          {/* 백색(P1) 패널 */}
          <aside 
            className={`side-panel white-area ${turn === 1 && !winner ? 'active' : ''}`}
            style={{ order: isFlipped ? 3 : 1 }} // P1이면 내꺼니까 하단(3), 아니면 상단(1)
          >
            <div className="wall-counter white-box">남은 벽: <span className="count">{player1.wallCount}</span></div>
            {myRole === 1 ? (
              <div className="button-group">
                <button className={`btn p1-btn ${actionMode==='move'?'selected':''}`} onClick={()=>setActionMode('move')} disabled={!isMyTurn||winner}>이동</button>
                <button className={`btn p1-btn ${actionMode==='wall'?'selected':''}`} onClick={()=>setActionMode('wall')} disabled={!isMyTurn||winner}>벽</button>
              </div>
            ) : null}
          </aside>

          {/* 보드 섹션 */}
          <section className="board-section" style={{ order: 2 }}>
            <div className="turn-display">
              {winner ? <span className="win-text">승리!</span> : <span className={turn===1?'t-white':'t-black'}>{turn===1?'● 백색 턴':'● 흑색 턴'}</span>}
            </div>
            <div className="board-container">
              {/* P1(백색)일 때만 보드를 180도 회전시켜서 내 말이 아래에 보이게 함 */}
              <div className="board" style={{ transform: isFlipped ? 'rotate(180deg)' : 'none' }}>
                {Array.from({length:81}).map((_,i)=>{
                  const x=i%9, y=Math.floor(i/9);
                  const canMove=isMoveable(x,y);
                  return (
                    <div key={`c-${x}-${y}`} className={`cell ${canMove?'highlight':''}`} onClick={()=>handleCellClick(x,y)}>
                      {/* 말도 같이 회전되므로 다시 180도 돌릴 필요는 없음 (원은 회전해도 원이니까) */}
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
                  const isPreviewH = previewWall && previewWall.x===x && previewWall.y===y && previewWall.orientation==='h';
                  const isPreviewV = previewWall && previewWall.x===x && previewWall.y===y && previewWall.orientation==='v';
                  return (
                    <React.Fragment key={`wp-${x}-${y}`}>
                      <div className={`wall-target h ${isWallMode?'in-wall-mode':''} ${canH?'placeable':''} ${isPreviewH?'preview':''}`} style={getHWallStyle(x,y)} onClick={()=>handleWallClick(x,y,'h')}/>
                      <div className={`wall-target v ${isWallMode?'in-wall-mode':''} ${canV?'placeable':''} ${isPreviewV?'preview':''}`} style={getVWallStyle(x,y)} onClick={()=>handleWallClick(x,y,'v')}/>
                    </React.Fragment>
                  );
                })}
                {(walls || []).map((wall,i)=>(
                  <div key={i} className={`placed-wall ${wall.orientation}`} style={getPlacedWallStyle(wall)}/>
                ))}
              </div>
            </div>
          </section>

          {/* 흑색(P2) 패널 */}
          <aside 
            className={`side-panel black-area ${turn === 2 && !winner ? 'active' : ''}`}
            style={{ order: isFlipped ? 1 : 3 }} // P1 입장에선 P2가 상단(1), P2 입장에선 내가 하단(3)
          >
            <div className="wall-counter black-box">남은 벽: <span className="count">{player2.wallCount}</span></div>
            {myRole === 2 ? (
              <div className="button-group">
                <button className={`btn p2-btn ${actionMode==='move'?'selected':''}`} onClick={()=>setActionMode('move')} disabled={!isMyTurn||winner}>이동</button>
                <button className={`btn p2-btn ${actionMode==='wall'?'selected':''}`} onClick={()=>setActionMode('wall')} disabled={!isMyTurn||winner}>벽</button>
              </div>
            ) : null}
          </aside>

        </main>
        
        {isGameStarted && !isSpectator && <button className="reset-float" onClick={resetGame}>🔄</button>}
        {winner && <div className="overlay"><div className="modal"><h2>{winner===1?'백색':'흑색'} 승리!</h2><button className="reset-large" onClick={resetGame}>로비로</button></div></div>}
      </div>
    </div>
  );
}

export default App;