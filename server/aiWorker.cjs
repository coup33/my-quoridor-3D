const { parentPort } = require('worker_threads');
const { minimax } = require('./aiCore.cjs');

// 메인 스레드로부터 메시지 수신
parentPort.on('message', ({ gameState, depth }) => {
    try {
        parentPort.postMessage({ type: 'log', message: `[Worker] Starting Minimax with depth ${depth}...` });
        const startTime = Date.now();

        // Minimax 연산 수행 (CPU Intensive)
        const result = minimax(gameState, depth, -Infinity, Infinity, true);

        const endTime = Date.now();
        parentPort.postMessage({ type: 'log', message: `[Worker] Minimax finished in ${endTime - startTime}ms` });

        // 결과 전송
        parentPort.postMessage({ type: 'result', success: true, result });
    } catch (error) {
        const errorMsg = error.message || String(error);
        parentPort.postMessage({ type: 'log', message: `[Worker] Error: ${errorMsg}` });
        // 에러 전송
        parentPort.postMessage({ type: 'result', success: false, error: errorMsg });
    }
});
