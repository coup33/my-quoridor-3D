import { getBestMove } from './aiCore.js';

self.onmessage = ({ data }) => {
    const { gameState, depth } = data;

    try {
        console.log(`[ClientWorker] AI Thinking... Max Depth: ${depth}`);
        const startTime = performance.now();

        // AI 계산 수행 (반복 심화 + 시간 관리)
        const result = getBestMove(gameState, depth);

        const endTime = performance.now();
        console.log(`[ClientWorker] Finished in ${(endTime - startTime).toFixed(0)}ms`);

        self.postMessage({ success: true, result });
    } catch (error) {
        console.error("[ClientWorker] Error:", error);
        self.postMessage({ success: false, error: error.message });
    }
};
