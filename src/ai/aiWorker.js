import { minimax } from './aiCore.js';

self.onmessage = ({ data }) => {
    const { gameState, depth, prevPos } = data;

    try {
        // console.log(`[ClientWorker] AI Thinking... Depth: ${depth}`);
        const startTime = performance.now();

        // Minimax 실행 (prevPos 전달)
        const result = minimax(gameState, depth, -Infinity, Infinity, true, prevPos);

        const endTime = performance.now();
        // console.log(`[ClientWorker] Finished in ${(endTime - startTime).toFixed(0)}ms`);

        self.postMessage({ success: true, result });
    } catch (error) {
        console.error("[ClientWorker] Error:", error);
        self.postMessage({ success: false, error: error.message });
    }
};
