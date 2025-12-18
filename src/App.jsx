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

  // --- 🔥 [핵심 로직 1] 벽에 의한 이동 차단 확인 ---
  const isBlockedByWall = (currentX, currentY, targetX, targetY, currentWalls) => {
    // 1. 위로 이동 (y가 줄어듦): (x, y-1)의 H벽 또는 (x-1, y-1)의 H벽 체크
    if (targetY < currentY) {
      return currentWalls.some(w => w.orientation === 'h' && w.y === targetY && (w.x === currentX || w.x === currentX - 1));
    }
    // 2. 아래로 이동 (y가 늘어남): (x, y)의 H벽 또는 (x-1, y)의 H벽 체크
    if (targetY > currentY) {
      return currentWalls.some(w => w.orientation === 'h' && w.y === currentY && (w.x === currentX || w.x === currentX - 1));
    }
    // 3. 왼쪽으로 이동 (x가 줄어듦): (x-1, y)의 V벽 또는 (x-1, y-1)의 V벽 체크
    if (targetX < currentX) {
      return currentWalls.some(w => w.orientation === 'v' && w.x === targetX && (w.y === currentY || w.y === currentY - 1));
    }
    // 4. 오른쪽으로 이동 (x가 늘어남): (x, y)의 V벽 또는 (x, y-1)의 V벽 체크
    if (targetX > currentX) {
      return currentWalls.some(w => w.orientation === 'v' && w.x === currentX && (w.y === currentY || w.y === currentY - 1));
    }
    return false;
  };

  // --- 🔥 [핵심 로직 2] 길 찾기 알고리즘 (BFS) ---
  // 벽을 설치했을 때 목표 지점까지 갈 수 있는지 확인
  const hasValidPath = (startNode, targetRow, simulatedWalls) => {
    const queue = [startNode]; // {x, y}
    const visited = new Set();
    visited.add(`${startNode.x},${startNode.y}`);

    const directions = [
      { dx: 0, dy: -1 }, // 상
      { dx: 0, dy: 1 },  // 하
      { dx: -1, dy: 0 }, // 좌
      { dx: 1, dy: 0 }   // 우
    ];

    while (queue.length > 0) {
      const { x, y } = queue.shift();

      // 목표 지점(행)에 도달했으면 성공
      if (y === targetRow) return true;

      for (let dir of directions) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;

        // 보드 범위 체크
        if (nx >= 0 && nx < 9 && ny >= 0 && ny < 9) {
          const key = `${nx},${ny}`;
          if (!visited.has(key)) {
            // 벽에 막혀있지 않아야 이동 가능
            if (!isBlockedByWall(x, y, nx, ny, simulatedWalls)) {
              visited.add(key);
              queue.push({ x: nx, y: ny });
            }
          }
        }
      }
    }
    return false; // 큐가 빌 때까지 목표에 못 가면 길이 막힌 것
  };

  const isMoveable = (targetX, targetY) => {
    if (!isGameStarted || !isMyTurn || actionMode !== 'move' || winner) return false;
    
    const current = turn === 1 ? player1 : player2;
    const opponent = turn === 1 ? player2 : player1;
    
    // 1. 인접성 체크 (상하좌우 1칸)
    const diffX = Math.abs(current.x - targetX);
    const diffY = Math.abs(current.y - targetY);
    const isAdjacent = (diffX === 1 && diffY === 0) || (diffX === 0 && diffY === 1);
    
    // 2. 상대방이 있는지 체크 (간단한 버전: 상대방 있으면 못감. 정석 룰은 점프 가능하나 일단 기본만)
    const isOccupied = targetX === opponent.x && targetY === opponent.y;

    // 3. 벽 체크 (새로 추가된 로직)
    const isBlocked = isBlockedByWall(current.x, current.y, targetX, targetY, walls);

    return isAdjacent && !isOccupied && !isBlocked;
  };

  const canPlaceWall = (x, y, orientation) => {
    if (!isGameStarted || !isMyTurn || winner) return false;
    
    // 1. 벽 겹침/교차 체크
    const isOverlap = walls.some(w => {
      if (w.x === x && w.y === y && w.orientation === orientation) return true; // 완전 겹침
      if (w.orientation === orientation) {
         // 같은 방향일 때 일자로 겹침 (길이가 2칸이므로)
        if (orientation === 'h' && w.y === y && Math.abs(w.x - x) === 1) return true;
        if (orientation === 'v' && w.x === x && Math.abs(w.y - y) === 1) return true;
      }
      // 교차 (+) 형태 체크
      if (w.x === x && w.y === y && w.orientation !== orientation) return true;
      return false;
    });

    if (isOverlap) return false;

    // 2. 길 막힘 체크 (Pathfinding)
    // 가상의 벽 목록 생성
    const simulatedWalls = [...walls, { x, y, orientation }];
    
    // P1이 Row 8(맨 아래)에 갈 수 있는가?
    const p1Path = hasValidPath({ x: player1.x, y: player1.y }, 8, simulatedWalls);
    // P2가 Row 0(맨 위)에 갈 수 있는가?
    const p2Path = hasValidPath({ x: player2.x, y: player2.y }, 0, simulatedWalls);

    // 둘 다 갈 수 있어야 설치 가능
    return p1Path && p2Path;
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
    
    // 여기서 유효성 체크 (길막힘 포함)
    if (!canPlaceWall(x, y, orientation)) {
        // 불가능하면 프리뷰도 해제하고 리턴
        setPreviewWall(null);
        return; 
    }

    // 모바일 터치 2번 로직
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

  const isSpectator = isGameStarted && myRole !== 1 && myRole !== 2;

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
          <aside className={`side-panel white-area ${turn === 1 && !winner ? 'active' : ''}`}>
            <div className="wall-counter white-box">남은 벽: <span className="count">{player1.wallCount}</span></div>
            {myRole === 1 ? (
              <div className="button-group">
                <button className={`btn p1-btn ${actionMode==='move'?'selected':''}`} onClick={()=>setActionMode('move')} disabled={!isMyTurn||winner}>이동</button>
                <button className={`btn p1-btn ${actionMode==='wall'?'selected':''}`} onClick={()=>setActionMode('wall')} disabled={!isMyTurn||winner}>벽</button>
              </div>
            ) : null}
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
                  
                  const isPreviewH = previewWall && previewWall.x===x && previewWall.y===y && previewWall.orientation==='h';
                  const isPreviewV = previewWall && previewWall.x===x && previewWall.y===y && previewWall.orientation==='v';

                  return (
                    <React.Fragment key={`wp-${x}-${y}`}>
                      <div 
                        className={`wall-target h ${isWallMode?'in-wall-mode':''} ${canH?'placeable':''} ${isPreviewH?'preview':''}`} 
                        style={getHWallStyle(x,y)} 
                        onClick={()=>handleWallClick(x,y,'h')}
                      />
                      <div 
                        className={`wall-target v ${isWallMode?'in-wall-mode':''} ${canV?'placeable':''} ${isPreviewV?'preview':''}`} 
                        style={getVWallStyle(x,y)} 
                        onClick={()=>handleWallClick(x,y,'v')}
                      />
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