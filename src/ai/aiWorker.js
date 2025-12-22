import { getBestMove } from './aiCore.js';

self.onmessage = ({ data }) => {
    const { gameState, depth, history, personality } = data;

    try {
        console.log(`[ClientWorker] AI Thinking... Depth: ${depth}`);
        const startTime = performance.now();

        // Strategy Wrapper인 getBestMove 실행 (personality, history 전달)
        const result = getBestMove(gameState, depth, history, personality);

        const endTime = performance.now();
        console.log(`[ClientWorker] Finished in ${(endTime - startTime).toFixed(0)}ms`);

        self.postMessage({ success: true, result });
    } catch (error) {
        console.error("[ClientWorker] Error:", error);
        self.postMessage({ success: false, error: error.message });
    }
};
