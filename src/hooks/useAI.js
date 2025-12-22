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

    // Worker 초기화
    useEffect(() => {
        if (!isVsAI) return;

        // Vite/Webpack에서 Worker를 모듈로 불러오기 위한 문법
        workerRef.current = new Worker(new URL('../ai/aiWorker.js', import.meta.url), {
            type: 'module'
        });

        const worker = workerRef.current;

        worker.onmessage = (e) => {
            const { success, result, error } = e.data;
            setIsThinking(false);

            if (success) {
                if (result.move) {
                    onAIMove(result.move);
                } else {
                    console.warn("[ClientAI] No move found");
                    // 움직임이 없으면(항복?) 처리는 나중에 고민
                }
            } else {
                console.error("[ClientAI] Worker Error:", error);
            }
        };

        return () => {
            worker.terminate();
        };
    }, [isVsAI]);

    // AI 턴 감지 및 연산 요청
    useEffect(() => {
        if (!isVsAI || !gameState) return;
        if (gameState.turn !== 2 || gameState.winner) return;
        if (isThinking) return;

        const depth = AI_DIFFICULTY_DEPTH[aiDifficulty] || 2;
        setIsThinking(true);

        // 딜레이를 주어 UI가 먼저 렌더링되게 함 (AI가 너무 빠르면 턴 전환이 안 보임)
        setTimeout(() => {
            if (workerRef.current) {
                workerRef.current.postMessage({ gameState, depth });
            }
        }, 500);

    }, [gameState, isVsAI, aiDifficulty]);

    return { isThinking };
};
