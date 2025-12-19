import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('https://my-quoridor.onrender.com');

const sounds = {
  move: new Audio('/sounds/move.mp3'),
  wall: new Audio('/sounds/wall.mp3'),
  start: new Audio('/sounds/start.mp3'),
  win: new Audio('/sounds/win.mp3'),
  lose: new Audio('/sounds/lose.mp3'),
};

const playSound = (name) => {
  try {
    const audio = sounds[name];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => console.log("Audio play failed:", e));
    }
  } catch (err) {
    console.error(err);
  }
};

const TimeBar = ({ time, maxTime = 90, left, center, right }) => {
  const percentage = Math.min(100, Math.max(0, (time / maxTime) * 100));
  let statusClass = '';
  if (time < 10) statusClass = 'danger';
  else if (time < 30) statusClass = 'warning';

  const hasHeader = left || center || right;

  return (
    <div className="time-bar-container">
      {hasHeader && (
        <div className="time-info-row">
          <div className="info-left">{left}</div>
          <div className="info-center">{center}</div>
          <div className="info-right">{right}</div>
        </div>
      )}
      <div className="time-bar-track">
        <div className={`time-bar-fill ${statusClass}`} style={{ width: `${percentage}%` }}/>
        <div className="time-text">{time}s</div>
      </div>
    </div>
  );
};

function App() {
  const initialState = {
    p1: { x: 4, y: 0, wallCount: 10 },
    p2: { x: 4, y: 8, wallCount: 10 },
    turn: 1,
    walls: [],
    winner: null,
    p1Time: 60,
    p2Time: 60,
    lastMove: null, 
    lastWall: null,
    winReason: null
  };

  const [player1, setPlayer1] = useState(initialState.p1);
  const [player2, setPlayer2] = useState(initialState.p2);
  const [turn, setTurn] = useState(initialState.turn);
  const [walls, setWalls] = useState(initialState.walls);
  const [winner, setWinner] = useState(initialState.winner);
  const [winReason, setWinReason] = useState(initialState.winReason);
  
  const [p1Time, setP1Time] = useState(initialState.p1Time);
  const [p2Time, setP2Time] = useState(initialState.p2Time);
  
  const [lastMove, setLastMove] = useState(null);
  const [lastWall, setLastWall] = useState(null);
  
  const [actionMode, setActionMode] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [takenRoles, setTakenRoles] = useState({ 1: null, 2: null });
  const [readyStatus, setReadyStatus] = useState({ 1: false, 2: false });
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [previewWall, setPreviewWall] = useState(null); 

  const [showDifficultySelect, setShowDifficultySelect] = useState(false);
  const [showMenu, setShowMenu] = useState(false); 

  const prevStateRef = useRef(initialState);

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

    socket.on('game_start', (started) => {
      setIsGameStarted(started);
      if (started) {
        playSound('start');
        prevStateRef.current = JSON.parse(JSON.stringify(initialState));
        setLastMove(null);
        setLastWall(null);
        setShowDifficultySelect(false);
        setShowMenu(false);
      } else {
        setShowMenu(false); 
      }
    });

    socket.on('update_state', (state) => syncWithServer(state));
    socket.on('init_state', (state) => syncWithServer(state));

    return () => {
      socket.off('lobby_update');
      socket.off('game_start');
      socket.off('update_state');
      socket.off('init_state');
    };
  }, [myRole]);

  const syncWithServer = (state) => {
    if (!state) return;
    const prev = prevStateRef.current;
    
    if (prev.p1.x !== state.p1.x || prev.p1.y !== state.p1.y || 
        prev.p2.x !== state.p2.x || prev.p2.y !== state.p2.y) playSound('move');

    if ((state.walls || []).length > (prev.walls || []).length) playSound('wall');

    if (state.winner && !prev.winner) {
      if (myRole === 1 || myRole === 2) {
        if (state.winner === myRole) playSound('win');
        else playSound('lose');
      } else playSound('win');
    }

    if (prev.turn !== state.turn) {
      setPreviewWall(null);
      setActionMode(null);
    }

    prevStateRef.current = state;
    setPlayer1(state.p1);
    setPlayer2(state.p2);
    setTurn(state.turn);
    setWalls(state.walls || []);
    setWinner(state.winner);
    setWinReason(state.winReason);
    setP1Time(state.p1Time);
    setP2Time(state.p2Time);
    setLastMove(state.lastMove);
    setLastWall(state.lastWall);
  };

  const emitAction = (newState) => socket.emit('game_action', newState);
  const selectRole = (role) => socket.emit('select_role', role);
  const toggleReady = () => myRole && socket.emit('player_ready', myRole);
  const resetGame = () => { socket.emit('reset_game'); };
  const resignGame = () => { if(window.confirm("정말 기권하시겠습니까?")) socket.emit('resign_game'); };
  const startAiGame = (difficulty) => { socket.emit('start_ai_game', difficulty); };

  const isMyTurn = turn === myRole;

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
    if (isValidStep(current.x, current.y, targetX, targetY, walls)) {
      if (!(targetX === opponent.x && targetY === opponent.y)) return true;
    }
    if (isValidStep(current.x, current.y, opponent.x, opponent.y, walls)) {
      const dx = opponent.x - current.x;
      const dy = opponent.y - current.y;
      const jumpX = opponent.x + dx;
      const jumpY = opponent.y + dy;
      if (targetX === jumpX && targetY === jumpY) return isValidStep(opponent.x, opponent.y, jumpX, jumpY, walls);
      if (isValidStep(opponent.x, opponent.y, targetX, targetY, walls)) {
        const isJumpBlocked = jumpX < 0 || jumpX > 8 || jumpY < 0 || jumpY > 8 || isBlockedByWall(opponent.x, opponent.y, jumpX, jumpY, walls);
        if (isJumpBlocked && Math.abs(targetX - current.x) === 1 && Math.abs(targetY - current.y) === 1) return true;
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
    return true; 
  };
  const handleCellClick = (x, y) => {
    setPreviewWall(null); 
    if (!isMyTurn) return;
    if (!isMoveable(x, y)) return;
    let nextState = { p1: player1, p2: player2, turn: turn === 1 ? 2 : 1, walls, winner: null };
    if (turn === 1) { nextState.p1 = { ...player1, x, y }; if (nextState.p1.y === 8) { nextState.winner = 1; nextState.winReason='goal'; } } 
    else { nextState.p2 = { ...player2, x, y }; if (nextState.p2.y === 0) { nextState.winner = 2; nextState.winReason='goal'; } }
    emitAction(nextState);
  };
  const handleWallClick = (x, y, orientation) => {
    if (!isMyTurn || actionMode !== 'wall') return;
    const current = turn === 1 ? player1 : player2;
    if (current.wallCount <= 0) return;
    if (!canPlaceWall(x, y, orientation)) { setPreviewWall(null); return; }
    if (previewWall && previewWall.x === x && previewWall.y === y && previewWall.orientation === orientation) {
      const nextWalls = [...walls, { x, y, orientation }];
      let nextState = { p1: turn===1?{...player1,wallCount:player1.wallCount-1}:player1, p2: turn===2?{...player2,wallCount:player2.wallCount-1}:player2, turn: turn===1?2:1, walls: nextWalls, winner: null };
      emitAction(nextState); setPreviewWall(null);
    } else { setPreviewWall({ x, y, orientation }); }
  };
  
  const getVWallStyle = (x, y) => ({ left: `calc(${x} * var(--unit) + var(--cell))`, top: `calc(${y} * var(--unit))` });
  const getHWallStyle = (x, y) => ({ left: `calc(${x} * var(--unit))`, top: `calc(${y} * var(--unit) + var(--cell))` });
  const getPlacedWallStyle = (wall) => {
    if (wall.orientation === 'v') return { left: `calc(${wall.x} * var(--unit) + var(--cell))`, top: `calc(${wall.y} * var(--unit))` };
    else return { left: `calc(${wall.x} * var(--unit))`, top: `calc(${wall.y} * var(--unit) + var(--cell))` };
  };

  const isSpectator = isGameStarted && myRole !== 1 && myRole !== 2;
  const isFlipped = myRole === 1; 
  const topTime = isFlipped ? p2Time : p1Time;
  const bottomTime = isFlipped ? p1Time : p2Time;

  let topBadge = null;
  if (isGameStarted) {
    if (isSpectator) {
      topBadge = <div className="status-badge badge-spectator">관전 모드</div>;
    } else {
      topBadge = <div className="status-badge badge-ingame">게임 중</div>;
    }
  }

  let resignButton = null;
  if (!isSpectator && !winner && isGameStarted) {
    resignButton = (
      <button className="status-badge badge-resign" onClick={resignGame}>
        항복
      </button>
    );
  }

  let turnIndicator = null;
  if (winner) {
    let resultTitle = "";
    const isWin = winner === myRole;
    if (isSpectator) resultTitle = winner === 1 ? "백색 승리!" : "흑색 승리!";
    else resultTitle = isWin ? "승리!" : "패배...";
    turnIndicator = <span className="win-text">{resultTitle}</span>;
  } else {
    const dotClass = turn === 1 ? 'dot-white' : 'dot-black';
    const turnText = turn === 1 ? '백색 턴' : '흑색 턴';
    turnIndicator = (
      <div className="turn-indicator-box">
        <div className={`turn-dot ${dotClass}`}></div>
        <span className="turn-text">{turnText}</span>
      </div>
    );
  }

  let resultDesc = "";
  if (winner) {
    if (winReason === 'timeout') resultDesc = "(시간 초과)";
    else if (winReason === 'resign') resultDesc = "(기권)";
  }

  return (
    <div className="container">
      <div className="game-title">QUORIDOR</div>

      {!isGameStarted && (
        <div className="lobby-overlay">
          <div className="lobby-card">
            <h2 style={{marginBottom: '20px'}}>QUORIDOR ONLINE</h2>
            {showDifficultySelect ? (
               <div className="difficulty-overlay">
                  <h3 style={{marginBottom:'10px'}}>난이도 선택</h3>
                  <button className="diff-btn diff-1" onClick={() => startAiGame(1)}>🌱 매우 쉬움 (Very Easy)</button>
                  <button className="diff-btn diff-2" onClick={() => startAiGame(2)}>🐣 쉬움 (Easy)</button>
                  <button className="diff-btn diff-3" onClick={() => startAiGame(3)}>🛡️ 보통 (Normal)</button>
                  <button className="diff-btn diff-4" onClick={() => startAiGame(4)}>🔥 어려움 (Hard)</button>
                  <button className="diff-btn btn-back" onClick={() => setShowDifficultySelect(false)}>취소</button>
               </div>
            ) : (
              <>
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
                    <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                        <button className="start-btn" style={{ backgroundColor: '#4c6ef5' }} onClick={() => setShowDifficultySelect(true)}>
                            🤖 AI와 연습하기 (싱글)
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
              </>
            )}
          </div>
        </div>
      )}

      <div className={`game-wrapper ${!isGameStarted ? 'blurred' : ''}`}>
        <main className="main-content">
          {/* P1 패널 */}
          <aside className={`side-panel white-area ${turn === 1 && !winner ? 'active' : ''}`} style={{ order: isFlipped ? 3 : 1 }}>
            <div className="wall-counter white-box">벽: <span className="count">{player1.wallCount}</span></div>
            {myRole === 1 ? (
              <div className="button-group">
                <button className={`btn p1-btn ${actionMode==='move'?'selected':''}`} onClick={()=>setActionMode('move')} disabled={!isMyTurn||winner}>이동</button>
                <button className={`btn p1-btn ${actionMode==='wall'?'selected':''}`} onClick={()=>setActionMode('wall')} disabled={!isMyTurn||winner}>벽</button>
              </div>
            ) : null}
          </aside>
          
          <section className="board-section" style={{ order: 2 }}>
            <TimeBar time={topTime} left={topBadge} center={turnIndicator} right={resignButton} />
            
            <div className="board-container">
              <div className="board" style={{ transform: isFlipped ? 'rotate(180deg)' : 'none' }}>
                {Array.from({length:81}).map((_,i)=>{
                  const x=i%9, y=Math.floor(i/9);
                  const canMove=isMoveable(x,y);
                  const isGhostP1 = lastMove && lastMove.player === 1 && lastMove.x === x && lastMove.y === y;
                  const isGhostP2 = lastMove && lastMove.player === 2 && lastMove.x === x && lastMove.y === y;
                  return (
                    <div key={`c-${x}-${y}`} className={`cell ${canMove?'highlight':''}`} onClick={()=>handleCellClick(x,y)}>
                      {player1.x===x&&player1.y===y&&<div className="pawn white-pawn"/>}
                      {player2.x===x&&player2.y===y&&<div className="pawn black-pawn"/>}
                      {isGhostP1 && <div className="ghost-pawn ghost-white"/>}
                      {isGhostP2 && <div className="ghost-pawn ghost-black"/>}
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
                {(walls || []).map((wall,i)=>{
                  const isLatest = lastWall && lastWall.x === wall.x && lastWall.y === wall.y && lastWall.orientation === wall.orientation;
                  return (<div key={i} className={`placed-wall ${wall.orientation} ${isLatest?'latest':''}`} style={getPlacedWallStyle(wall)}/>);
                })}
              </div>
            </div>
            
            <TimeBar time={bottomTime} />
          </section>

          {/* P2 패널 */}
          <aside className={`side-panel black-area ${turn === 2 && !winner ? 'active' : ''}`} style={{ order: isFlipped ? 1 : 3 }}>
            <div className="wall-counter black-box">벽: <span className="count">{player2.wallCount}</span></div>
            {myRole === 2 ? (
              <div className="button-group">
                <button className={`btn p2-btn ${actionMode==='move'?'selected':''}`} onClick={()=>setActionMode('move')} disabled={!isMyTurn||winner}>이동</button>
                <button className={`btn p2-btn ${actionMode==='wall'?'selected':''}`} onClick={()=>setActionMode('wall')} disabled={!isMyTurn||winner}>벽</button>
              </div>
            ) : null}
          </aside>
        </main>
        
        {isGameStarted && !isSpectator && (
          <button className="menu-float" onClick={() => setShowMenu(true)}>MENU</button>
        )}
        
        {showMenu && (
          <div className="lobby-overlay" onClick={() => setShowMenu(false)}>
             <div className="lobby-card" onClick={(e) => e.stopPropagation()}>
               <div className="menu-title">GAME MENU</div>
               <button className="menu-btn btn-exit" onClick={resetGame}>나가기 (Exit Game)</button>
               <button className="menu-btn btn-close" onClick={() => setShowMenu(false)}>닫기 (Close)</button>
             </div>
          </div>
        )}

        {winner && (
          <div className="overlay">
            <div className="modal">
              <h2>{resultTitle}</h2>
              {resultDesc && <p style={{marginTop:'5px', color:'#666'}}>{resultDesc}</p>}
              <button className="reset-large" onClick={resetGame}>로비로</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;