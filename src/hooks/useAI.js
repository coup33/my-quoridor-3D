import { useEffect, useRef, useState } from 'react';

/**
 * useAI Hook - AI 게임 로직 관리
 * 
 * Clean Slate Version:
 * - Web Worker를 통한 AI 연산 (메인 스레드 블로킹 방지)
 * - 반복 심화 탐색 (Iterative Deepening) 지원
 * - 난이도별 탐색 깊이 조절
 */

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

        // 내 턴이나 게임 종료 시에는 AI 처리 상태 초기화
        if (gameState.turn !== 2 || gameState.winner) {
            lastAiTurn.current = null;
            return;
        }

        if (isThinking) return;

        // 이미 이번 턴에 대해 AI를 돌렸다면 스킵
        if (lastAiTurn.current === gameState.turn) return;

        const depth = AI_DIFFICULTY_DEPTH[aiDifficulty] || 2;
        setIsThinking(true);
        lastAiTurn.current = gameState.turn;

        // 딜레이를 주어 UI가 먼저 렌더링되게 함
        setTimeout(() => {
            if (workerRef.current) {
                console.log(`[ClientAI] Requesting Move. Depth: ${depth}`);

                workerRef.current.postMessage({
                    gameState,
                    depth
                });
            }
        }, 500);

    }, [gameState, isVsAI, aiDifficulty, isThinking]);

    return { isThinking };
};
