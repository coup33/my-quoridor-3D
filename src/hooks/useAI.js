import { useEffect, useRef, useState } from 'react';

const AI_DIFFICULTY_DEPTH = {
    1: 1, // Easy
    2: 2, // Medium
    3: 3, // Hard
    4: 4  // Expert
};

export const useAI = (gameState, isVsAI, aiDifficulty, onAIMove) => {
    const workerRef = useRef(null);
    const [isThinking, setIsThinking] = useState(false);

    // 최신 onAIMove 함수를 유지하기 위한 Ref
    const onAIMoveRef = useRef(onAIMove);

    useEffect(() => {
        onAIMoveRef.current = onAIMove;
    }, [onAIMove]);

    // Worker 초기화
    useEffect(() => {
        if (!isVsAI) return;

        workerRef.current = new Worker(new URL('../ai/aiWorker.js', import.meta.url), {
            type: 'module'
        });

        const worker = workerRef.current;

        worker.onmessage = (e) => {
            const { success, result, error } = e.data;
            setIsThinking(false);

            if (success) {
                if (result.move) {
                    // Ref를 통해 항상 최신 onAIMove 호출
                    if (onAIMoveRef.current) {
                        onAIMoveRef.current(result.move);
                    }
                } else {
                    console.warn("[ClientAI] No move found");
                }
            } else {
                console.error("[ClientAI] Worker Error:", error);
            }
        };

        return () => {
            worker.terminate();
        };
    }, [isVsAI]);

    // 이번 턴에 AI가 이미 요청을 보냈는지 추적
    const lastAiTurn = useRef(null);

    // AI의 방문 기록 추적 (Loop 방지 및 턴 계산용)
    const aiHistoryRef = useRef([]);

    // AI Personality (매 게임마다 랜덤 생성)
    const [aiPersonality, setAiPersonality] = useState(null);

    // 성격 생성 함수 (난이도별 조정)
    const generatePersonality = (difficulty) => {
        let noiseLevel = 0.4;
        let wallChance = 0.7;

        if (difficulty === 1) { // Easy
            noiseLevel = 0.6; // 매우 큰 변동
            wallChance = 0.5; // 벽 사용 확률 낮음
        } else if (difficulty === 4) { // Expert
            noiseLevel = 0.2; // 정교하지만 예측 불가능한 수준
            wallChance = 0.8; // 벽 사용 확률 높음
        }

        const p = {
            w_offense: 0.9 + Math.random() * noiseLevel,
            w_defense: 0.8 + Math.random() * noiseLevel,
            w_wall: Math.random() * 5.0,
            // 오프닝 벽 전략: 1, 2, 3턴 중 하나에 벽을 강제로 세울 확률
            earlyWallTurn: Math.random() < wallChance ? Math.floor(Math.random() * 3) + 1 : null
        };
        console.log(`[Game Start] New AI Personality Generated (Diff: ${difficulty}):`, p);
        return p;
    };

    // 게임 시작/변경 시 AI 성격 생성
    useEffect(() => {
        if (!isVsAI) return;
        setAiPersonality(generatePersonality(aiDifficulty));
    }, [isVsAI, aiDifficulty]);

    // 게임 리셋 감지 (winner가 null로 바뀔 때 성격 재생성)
    useEffect(() => {
        if (!gameState.winner) {
            setAiPersonality(generatePersonality(aiDifficulty));
            // 기록 초기화
            aiHistoryRef.current = [];
        }
    }, [gameState.winner, aiDifficulty]);

    // AI 턴 감지 및 연산 요청
    useEffect(() => {
        if (!isVsAI || !gameState) return;

        // 내 턴이나 게임 종료 시에는 AI 처리 상태 초기화 (다음 AI 턴을 위해)
        if (gameState.turn !== 2 || gameState.winner) {
            lastAiTurn.current = null;
            return;
        }

        if (isThinking) return;

        // 이미 이번 턴(P2의 현재 상태)에 대해 AI를 돌렸다면 스킵
        if (lastAiTurn.current === gameState.turn) return;

        const depth = AI_DIFFICULTY_DEPTH[aiDifficulty] || 2;
        setIsThinking(true);
        lastAiTurn.current = gameState.turn; // 이번 턴 처리 시작 표시

        // 현재 AI 위치 (이동 전)
        const currentAiPos = { ...gameState.p2 };

        // 딜레이를 주어 UI가 먼저 렌더링되게 함 (AI가 너무 빠르면 턴 전환이 안 보임)
        setTimeout(() => {
            if (workerRef.current) {
                // History 전달
                // [DEBUG] AI 요청 로그
                console.log(`[ClientAI] Requesting Move. Turn: ${gameState.turn}, AI Turn: ${aiHistoryRef.current.length + 1}`);
                console.log(`[ClientAI] Personality:`, aiPersonality);

                workerRef.current.postMessage({
                    gameState,
                    depth,
                    history: aiHistoryRef.current,
                    personality: aiPersonality
                });

                // 요청 후 현재 위치를 History에 추가 (다음 턴에 사용)
                // 최대 10개까지만 저장 (Loop 방지 + 초반 턴 계산용)
                const newHistory = [...aiHistoryRef.current, currentAiPos];
                if (newHistory.length > 10) newHistory.shift();
                aiHistoryRef.current = newHistory;
            }
        }, 500);

    }, [gameState, isVsAI, aiDifficulty, isThinking, aiPersonality]);

    return { isThinking };
};
