import { useState, useCallback, useEffect } from 'react';

// 상수: 3D 보드 및 카메라 설정
export const BOARD_WIDTH = 11;        // 보드의 3D 너비 (단위: -5.5 ~ +5.5)
export const FOV = 50;                // 고정 화각 (도)
export const CAMERA_Z = 5;            // 카메라 Z 위치 (고정)
export const BOARD_NEAR_Z = 4 * 1.15; // 보드 밑변 Z 위치 (카메라에서 가장 가까운 변)
export const BOARD_FAR_Z = -4;        // 보드 윗변 Z 위치

/**
 * 카메라 제어 및 화면 크기에 따른 반응형 줌 처리를 담당하는 훅
 * @param {Object} params
 * @param {boolean} params.isMobileLayout - 모바일 레이아웃 여부
 * @param {function} params.onBoardBoundsChange - 보드 경계 변경 콜백
 * @returns {Object} cameraSettings { fov, position }
 */
export const useCameraControl = ({ isMobileLayout, onBoardBoundsChange }) => {
    const [cameraSettings, setCameraSettings] = useState({ fov: FOV, position: [0, 14, CAMERA_Z] });

    /**
     * 보드 밑변이 화면에서 몇 픽셀 너비로 보이는지 계산
     */
    const calculateBoardPixelWidth = useCallback((cameraY, screenWidth) => {
        const distanceZ = BOARD_NEAR_Z - CAMERA_Z;
        const distance = Math.sqrt(cameraY * cameraY + distanceZ * distanceZ);
        const fovRad = (FOV * Math.PI) / 180;
        const halfFovTan = Math.tan(fovRad / 2);
        return (BOARD_WIDTH / (2 * distance * halfFovTan)) * screenWidth;
    }, []);

    /**
     * 보드 상단(윗변)이 화면에서 Y 좌표 몇 픽셀에 위치하는지 계산
     */
    const calculateBoardTopPixelY = useCallback((cameraY, screenHeight) => {
        const fovRad = (FOV * Math.PI) / 180;
        const halfFov = fovRad / 2;

        const cameraLookAngle = Math.atan2(cameraY, -CAMERA_Z);
        const topEdgeAngle = Math.atan2(cameraY, CAMERA_Z - BOARD_FAR_Z);

        const relativeY = (topEdgeAngle - cameraLookAngle) / halfFov;
        const pixelY = screenHeight / 2 - (relativeY * screenHeight / 2);

        return Math.max(0, pixelY);
    }, []);

    // 화면 크기 변경 감지 및 카메라 업데이트
    useEffect(() => {
        const updateCamera = () => {
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;

            if (isMobileLayout) {
                // 모바일 레이아웃
                const UI_TOP_HEIGHT = 80;
                const UI_BOTTOM_HEIGHT = 130;
                const PADDING = 20;

                const maxBoardWidth = screenWidth - PADDING * 2;
                const targetPixelWidth = Math.min(maxBoardWidth, screenWidth * 0.95);

                const fovRad = (FOV * Math.PI) / 180;
                const halfFovTan = Math.tan(fovRad / 2);
                const distanceZ = BOARD_NEAR_Z - CAMERA_Z;

                // Vertical FOV 기준이므로 Height 사용
                const requiredDistance = (BOARD_WIDTH / (2 * halfFovTan)) * (screenHeight / targetPixelWidth);
                let cameraY = Math.sqrt(Math.max(requiredDistance * requiredDistance - distanceZ * distanceZ, 100));

                const minCameraY = cameraY;
                const clampedY = Math.max(minCameraY, Math.min(30, cameraY));

                setCameraSettings({ fov: FOV, position: [0, clampedY, CAMERA_Z] });

                if (onBoardBoundsChange) {
                    const boardTopY = calculateBoardTopPixelY(clampedY, screenHeight);
                    const actualBoardWidth = calculateBoardPixelWidth(clampedY, screenWidth);
                    onBoardBoundsChange({
                        topY: boardTopY,
                        width: actualBoardWidth,
                        cameraY: clampedY
                    });
                }
            } else {
                // 데스크탑 레이아웃
                const PADDING_RATIO = 0.9;
                const targetPixelWidth = screenWidth * PADDING_RATIO;

                const distanceZ = BOARD_NEAR_Z - CAMERA_Z;
                const fovRad = (FOV * Math.PI) / 180;
                const halfFovTan = Math.tan(fovRad / 2);

                const requiredDistance = (BOARD_WIDTH / (2 * halfFovTan)) * (screenWidth / targetPixelWidth);
                const cameraY = Math.sqrt(Math.max(requiredDistance * requiredDistance - distanceZ * distanceZ, 100));
                const clampedY = Math.max(12, Math.min(25, cameraY));

                setCameraSettings({ fov: FOV, position: [0, clampedY, CAMERA_Z] });
            }
        };

        updateCamera();
        window.addEventListener('resize', updateCamera);
        return () => window.removeEventListener('resize', updateCamera);
    }, [isMobileLayout, onBoardBoundsChange, calculateBoardPixelWidth, calculateBoardTopPixelY]);

    return cameraSettings;
};
