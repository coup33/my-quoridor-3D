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
        // 상태가 변하지 않았는데 또 돌리면 안됨.
        // 단순히 turn 번호만 보면 안되고, lastMove가 바뀌었는지 등을 봐야 함.
        // 하지만 간단하게는 "Turn 2가 된 직후 한 번만" 실행하면 됨.
        if (lastAiTurn.current === gameState.turn) return;

        const depth = AI_DIFFICULTY_DEPTH[aiDifficulty] || 2;
        setIsThinking(true);
        lastAiTurn.current = gameState.turn; // 이번 턴 처리 시작 표시

        // 딜레이를 주어 UI가 먼저 렌더링되게 함 (AI가 너무 빠르면 턴 전환이 안 보임)
        setTimeout(() => {
            if (workerRef.current) {
                workerRef.current.postMessage({ gameState, depth });
            }
        }, 500);

    }, [gameState, isVsAI, aiDifficulty, isThinking]);

    return { isThinking };
};
