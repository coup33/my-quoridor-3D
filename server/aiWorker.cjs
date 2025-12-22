const { parentPort } = require('worker_threads');
const { minimax } = require('./aiCore.cjs');

// 메인 스레드로부터 메시지 수신
parentPort.on('message', ({ gameState, depth }) => {
    try {
        // Minimax 연산 수행 (CPU Intensive)
        const result = minimax(gameState, depth, -Infinity, Infinity, true);

        // 결과 전송
        parentPort.postMessage({ success: true, result });
    } catch (error) {
        // 에러 전송
        parentPort.postMessage({ success: false, error: error.message });
    }
});
