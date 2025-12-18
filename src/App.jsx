import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// ✅ 사용자님이 알려주신 Render 서버 주소 적용 완료
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
    // 1. 서버 접속 시 로비 정보 요청
    socket.emit('request_lobby');

    // 2. 로비 정보 수신 (여기가 핵심!)
    socket.on('lobby_update', (data) => {
      // (1) 누가 자리를 먹었는지 업데이트
      setTakenRoles(data.roles);
      setReadyStatus(data.readyStatus);
      setIsGameStarted(data.isGameStarted);

      // (2) 서버 명단을 보고 "내 역할" 확정 짓기 (Source of Truth)
      // socket.id가 서버 명단에 있으면 자동으로 myRole을 설정해서 다음 화면으로 넘김
      if (data.roles[1] === socket.id) {
        setMyRole(1);
      } else if (data.roles[2] === socket.id) {
        setMyRole(2);
      } else {
        // 명단에 내 아이디가 없으면 관전 모드(null)로 리셋
        setMyRole(null);
      }
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

  // --- 로비 액션 ---
  const selectRole = (role) => {
    // ❗ 중요 수정: 여기서 setMyRole을 하지 않고 서버로 요청만 보냄
    // 서버가 "너 역할 배정됐어"라고 응답(lobby_update)을 주면 그때 useEffect에서 바뀜
    socket.emit('select_role', role);
  };

  const toggleReady = () => {
    if (myRole) socket.emit('player_ready', myRole);
  };

  const resetGame = () => {
    socket.emit('reset_game');
  };

  // --- 게임 로직 ---
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
            
            {/* 1. 역할 선택 단계 */}
            {!myRole && (
              <div className="role-selection">
                <p>플레이할 색상을 선택하세요</p>
                <div className="role-buttons">
                  <button 
                    className="role-btn white" 
                    // takenRoles[1]이 있으면(null이 아니면) 버튼 비활성화
                    disabled={takenRoles[1] !== null} 
                    onClick={() => selectRole(1)}
                  >
                    백색 (P1)
                    {takenRoles[1] ? <span className="taken-badge">사용 중</span> : <span className="free-badge">선택 가능</span>}
                  </button>
                  <button 
                    className="role-btn black" 
                    disabled={takenRoles[2] !== null}
                    onClick={() => selectRole(2)}
                  >
                    흑색 (P2)
                    {takenRoles[2] ? <span className="taken-badge">사용 중</span> : <span className="free-badge">선택 가능</span>}
                  </button>
                </div>
              </div>
            )}

            {/* 2. 대기 및 시작 단계 */}
            {myRole && (
              <div className="ready-section">
                <p className="my-role-text">당신은 <span className={myRole===1?'t-white':'t-black'}>{myRole===1?'백색(P1)':'흑색(P2)'}</span> 입니다</p>
                
                <div className="status-box">
                  <div className={`player-status ${readyStatus[1]?'ready':''}`}>
                    백색(P1): {takenRoles[1] ? (readyStatus[1] ? '준비 완료!' : '준비 대기 중...') : '접속 대기 중...'}
                  </div>
                  <div className={`player-status ${readyStatus[2]?'ready':''}`}>
                    흑색(P2): {takenRoles[2] ? (readyStatus[2] ? '준비 완료!' : '준비 대기 중...') : '접속 대기 중...'}
                  </div>
                </div>

                <div className="action-buttons">
                  {!readyStatus[myRole] ? (
                    <button className="start-btn" onClick={toggleReady}>준비 완료 (Ready)</button>
                  ) : (
                    <button className="start-btn waiting">상대방 수락 대기 중...</button>
                  )}
                  <button className="cancel-btn" onClick={() => { socket.emit('select_role', 0); /* 0번 보내면 서버가 역할 삭제 */ }}>
                    역할 취소 / 다시 고르기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 게임 보드 */}
      <div className={`game-wrapper ${!isGameStarted ? 'blurred' : ''}`}>
        <header className="header">
          <h1 className="game-title">QUORIDOR</h1>
          <div className="role-badge">{myRole === 1 ? "나: 백색(P1)" : myRole === 2 ? "나: 흑색(P2)" : "관전 모드"}</div>
        </header>

        <main className="main-content">
          <aside className={`side-panel white-area ${turn === 1 && !winner ? 'active' : ''}`}>
            <h2 className="player-label">백색 (P1)</h2>
            <div className="wall-counter white-box"><small>남은 벽</small><div className="count">{player1.wallCount}</div></div>
            <div className="button-group">
              <button className={`btn p1-btn ${actionMode==='move'?'selected':''}`} onClick={()=>setActionMode('move')} disabled={!isMyTurn||winner}>말 이동</button>
              <button className={`btn p1-btn ${actionMode==='wall'?'selected':''}`} onClick={()=>setActionMode('wall')} disabled={!isMyTurn||winner}>벽 설치</button>
            </div>
          </aside>

          <section className="board-section">
            <div className="turn-display">
              {winner ? <span className="win-text">{winner===1?'백색 승리!':'흑색 승리!'}</span> : 
              <span className={turn===1?'t-white':'t-black'}>{turn===1?'● 백색 차례':'● 흑색 차례'} {isMyTurn && "(당신)"}</span>}
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
                {walls.map((wall,i)=>(<div key={i} className={`placed-wall ${wall.orientation}`} style={{left:wall.x*68+(wall.orientation==='v'?60:0),top:wall.y*68+(wall.orientation==='h'?60:0)}}/>))}
              </div>
            </div>
          </section>

          <aside className={`side-panel black-area ${turn === 2 && !winner ? 'active' : ''}`}>
            <h2 className="player-label">흑색 (P2)</h2>
            <div className="wall-counter black-box"><small>남은 벽</small><div className="count">{player2.wallCount}</div></div>
            <div className="button-group">
              <button className={`btn p2-btn ${actionMode==='move'?'selected':''}`} onClick={()=>setActionMode('move')} disabled={!isMyTurn||winner}>말 이동</button>
              <button className={`btn p2-btn ${actionMode==='wall'?'selected':''}`} onClick={()=>setActionMode('wall')} disabled={!isMyTurn||winner}>벽 설치</button>
            </div>
          </aside>
        </main>
        {isGameStarted && <button className="reset-float" onClick={resetGame}>🔄 게임 중단</button>}
        {winner && <div className="overlay"><div className="modal"><h2>🎉 {winner===1?'백색':'흑색'} 승리! 🎉</h2><button className="reset-large" onClick={resetGame}>로비로 돌아가기</button></div></div>}
      </div>
    </div>
  );
}

export default App;