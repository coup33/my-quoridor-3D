import { minimax } from './aiCore.js';

self.onmessage = ({ data }) => {
    const { gameState, depth, history } = data;

    try {
        // console.log(`[ClientWorker] AI Thinking... Depth: ${depth}`);
        const startTime = performance.now();

        // Minimax 실행 (history 전달)
        const result = minimax(gameState, depth, -Infinity, Infinity, true, history);

        const endTime = performance.now();
        // console.log(`[ClientWorker] Finished in ${(endTime - startTime).toFixed(0)}ms`);

        self.postMessage({ success: true, result });
    } catch (error) {
        console.error("[ClientWorker] Error:", error);
        self.postMessage({ success: false, error: error.message });
    }
};
