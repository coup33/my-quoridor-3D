/**
 * 3D 보드 컴포넌트
 * Three.js를 사용한 실제 3D 렌더링
 * 리팩토링: 서브컴포넌트들을 별도 파일로 분리
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';

// 분리된 3D 컴포넌트들
import Cell3D from './Cell3D';
import Pawn3D from './Pawn3D';
import BoardBase from './BoardBase';
import { Wall3D, WallTarget3D, WallHitbox3D } from './Wall3D';

// 상수: 3D 보드 및 카메라 설정
const BOARD_WIDTH = 11;        // 보드의 3D 너비 (단위: -5.5 ~ +5.5)
const FOV = 50;                // 고정 화각 (도)
const CAMERA_Z = 5;            // 카메라 Z 위치 (고정)
const BOARD_NEAR_Z = 4 * 1.15; // 보드 밑변 Z 위치 (카메라에서 가장 가까운 변)
const BOARD_FAR_Z = -4;        // 보드 윗변 Z 위치

/**
 * 메인 3D 보드 컴포넌트
 * @param {boolean} isMobileLayout - 모바일 레이아웃 여부
 * @param {function} onBoardBoundsChange - 보드 경계 변경 콜백 (보드 상단 Y 픽셀 위치)
 */
const Board3D = ({
    player1,
    player2,
    walls,
    lastWall,
    isFlipped,
    isMyTurn,
    actionMode,
    previewWall,
    onCellClick,
    onWallClick,
    isMoveableCheck,
    canPlaceWallCheck,
    isMobileLayout = false,
    onBoardBoundsChange = null
}) => {
    // 벽 모드인지 확인
    const isWallMode = actionMode === 'wall';

    // 호버 중인 벽 위치
    const [hoverWall, setHoverWall] = useState(null);

    // 호버 핸들러
    const handleWallHover = (x, y, orientation) => {
        if (x === null) {
            setHoverWall(null);
        } else {
            setHoverWall({ x, y, orientation });
        }
    };

    // 81개 셀 생성
    const cells = useMemo(() => {
        const result = [];
        for (let y = 0; y < 9; y++) {
            for (let x = 0; x < 9; x++) {
                const canMove = isMoveableCheck ? isMoveableCheck(x, y) : false;
                result.push(
                    <Cell3D
                        key={`cell-${x}-${y}`}
                        x={x}
                        y={y}
                        canMove={canMove}
                        onClick={onCellClick}
                    />
                );
            }
        }
        return result;
    }, [isMoveableCheck, onCellClick]);

    // 벽 히트박스 생성 (마우스 감지용, 항상 렌더링)
    const wallHitboxes = useMemo(() => {
        if (!isWallMode || !isMyTurn || !onWallClick) return [];

        const result = [];
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                // 가로 벽 히트박스
                result.push(
                    <WallHitbox3D
                        key={`hitbox-h-${x}-${y}`}
                        x={x}
                        y={y}
                        orientation="h"
                        onHover={handleWallHover}
                        onClick={onWallClick}
                    />
                );
                // 세로 벽 히트박스
                result.push(
                    <WallHitbox3D
                        key={`hitbox-v-${x}-${y}`}
                        x={x}
                        y={y}
                        orientation="v"
                        onHover={handleWallHover}
                        onClick={onWallClick}
                    />
                );
            }
        }
        return result;
    }, [isWallMode, isMyTurn, onWallClick]);

    // 호버 홀로그램 (마우스가 올라간 곳에만 표시, 설치 가능한 경우만)
    const hoverHologram = useMemo(() => {
        if (!isWallMode || !isMyTurn || !canPlaceWallCheck) return null;
        if (!hoverWall) return null;

        const { x, y, orientation } = hoverWall;
        const canPlace = canPlaceWallCheck(x, y, orientation);

        // 설치 불가능하면 표시 안함
        if (!canPlace) return null;

        // 이미 프리뷰(고정됨)가 있으면 호버 홀로그램 표시 안함
        if (previewWall) return null;

        return (
            <WallTarget3D
                key={`hover-wall`}
                x={x}
                y={y}
                orientation={orientation}
                isPreview={false}
                canPlace={true}
                onClick={onWallClick}
            />
        );
    }, [isWallMode, isMyTurn, canPlaceWallCheck, hoverWall, previewWall, onWallClick]);

    // 프리뷰 벽 (클릭으로 고정된 홀로그램)
    const previewHologram = useMemo(() => {
        if (!previewWall) return null;

        const { x, y, orientation } = previewWall;

        return (
            <WallTarget3D
                key={`preview-wall`}
                x={x}
                y={y}
                orientation={orientation}
                isPreview={true}
                canPlace={true}
                onClick={onWallClick}
            />
        );
    }, [previewWall, onWallClick]);

    // 화면 크기에 따른 카메라 설정
    const [cameraSettings, setCameraSettings] = useState({ fov: FOV, position: [0, 14, CAMERA_Z] });

    /**
     * 보드 밑변이 화면에서 몇 픽셀 너비로 보이는지 계산
     * @param {number} cameraY - 카메라 Y 높이
     * @param {number} screenWidth - 화면 너비
     * @returns {number} 보드 밑변의 화면 픽셀 너비
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
     * @param {number} cameraY - 카메라 Y 높이
     * @param {number} screenHeight - 화면 높이
     * @returns {number} 보드 상단의 화면 Y 픽셀 위치 (위에서부터)
     */
    const calculateBoardTopPixelY = useCallback((cameraY, screenHeight) => {
        // 보드 윗변은 BOARD_FAR_Z에 위치
        // 카메라는 [0, cameraY, CAMERA_Z]에서 [0, 0, 0] 방향을 바라봄
        // 수직 FOV를 사용하여 보드 윗변의 Y 좌표 계산

        const distanceToFarEdge = Math.sqrt(cameraY * cameraY + (BOARD_FAR_Z - CAMERA_Z) ** 2);
        const angleToFarEdge = Math.atan2(cameraY, CAMERA_Z - BOARD_FAR_Z); // 카메라에서 보드 윗변까지의 각도

        const fovRad = (FOV * Math.PI) / 180;
        const halfFov = fovRad / 2;

        // 화면 중앙에서 보드 윗변까지의 각도 비율
        // lookAt은 (0, 0, 0)을 바라보므로, 보드 윗변은 화면 위쪽에 위치
        const cameraLookAngle = Math.atan2(cameraY, -CAMERA_Z); // 카메라가 바라보는 방향의 각도
        const topEdgeAngle = Math.atan2(cameraY, CAMERA_Z - BOARD_FAR_Z);

        // 화면에서의 상대적 위치 (0 = 중앙, -1 = 상단, 1 = 하단)
        const relativeY = (topEdgeAngle - cameraLookAngle) / halfFov;

        // 화면 픽셀 좌표로 변환
        const pixelY = screenHeight / 2 - (relativeY * screenHeight / 2);

        return Math.max(0, pixelY);
    }, []);

    // 화면 크기 변경 감지 - 모바일/데스크탑 분기 처리
    useEffect(() => {
        const updateCamera = () => {
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;

            // 모바일 레이아웃: 보드가 화면 가로를 넘지 않도록 제한
            if (isMobileLayout) {
                // 모바일 UI 영역 정의
                const UI_TOP_HEIGHT = 80;      // 상단 UI (상대 정보 + 타임바)
                const UI_BOTTOM_HEIGHT = 130;  // 하단 UI (내 타임바 + 버튼)
                const PADDING = 20;            // 좌우 여백

                // 보드가 차지할 수 있는 최대 가로 크기 (화면 가로 - 여백)
                const maxBoardWidth = screenWidth - PADDING * 2;

                // 보드가 차지할 수 있는 최대 세로 크기
                const availableHeight = screenHeight - UI_TOP_HEIGHT - UI_BOTTOM_HEIGHT;

                // 목표 보드 픽셀 너비: 화면 가로의 95%를 넘지 않음
                const targetPixelWidth = Math.min(maxBoardWidth, screenWidth * 0.95);

                const fovRad = (FOV * Math.PI) / 180;
                const halfFovTan = Math.tan(fovRad / 2);
                const distanceZ = BOARD_NEAR_Z - CAMERA_Z;

                // 보드가 targetPixelWidth로 보이려면 필요한 카메라 거리
                const requiredDistance = (BOARD_WIDTH / (2 * halfFovTan)) * (screenWidth / targetPixelWidth);

                // 카메라 Y 높이 계산 (피타고라스)
                let cameraY = Math.sqrt(Math.max(requiredDistance * requiredDistance - distanceZ * distanceZ, 100));

                // 모바일에서는 카메라를 더 높이 올려서 보드를 작게 보이게 할 수 있음
                // 최소 높이는 보드가 화면 가로를 넘지 않도록
                const minCameraY = cameraY;  // 이 높이 이하로 내려가면 보드가 넘침

                // 실제 카메라 높이: 최소값 이상 유지
                const clampedY = Math.max(minCameraY, Math.min(30, cameraY));

                setCameraSettings({ fov: FOV, position: [0, clampedY, CAMERA_Z] });

                // 보드 상단 위치를 부모에게 알림
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
                // 데스크탑: 기존 로직 유지
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

    return (
        <div style={{ width: '100%', height: '100%', minHeight: '500px' }}>
            <Canvas
                camera={{ position: cameraSettings.position, fov: cameraSettings.fov }}
                shadows
                style={{ background: 'transparent' }}
            >
                {/* 조명 - 더 밝게 */}
                <ambientLight intensity={0.6} />
                <directionalLight
                    position={[5, 10, 5]}
                    intensity={1.2}
                    castShadow
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                />
                <pointLight position={[-5, 8, -5]} intensity={0.6} color="#00d4ff" />
                <pointLight position={[5, 8, 5]} intensity={0.4} color="#7c3aed" />

                {/* 환경 반사 */}
                <Environment preset="night" />

                {/* 보드 베이스 */}
                <BoardBase />

                {/* 셀들 */}
                <group rotation={isFlipped ? [0, Math.PI, 0] : [0, 0, 0]}>
                    {cells}

                    {/* 벽 히트박스 (보이지 않는 마우스 감지 영역) */}
                    {wallHitboxes}

                    {/* 호버 홀로그램 */}
                    {hoverHologram}

                    {/* 프리뷰 홀로그램 (클릭으로 고정된 것) */}
                    {previewHologram}

                    {/* 플레이어 1 (백) */}
                    <Pawn3D position={[player1.x, player1.y]} isWhite={true} />

                    {/* 플레이어 2 (흑) */}
                    <Pawn3D position={[player2.x, player2.y]} isWhite={false} />

                    {/* 설치된 벽들 */}
                    {walls.map((wall, idx) => (
                        <Wall3D
                            key={`wall-${idx}`}
                            wall={wall}
                            isLatest={lastWall && wall.x === lastWall.x && wall.y === lastWall.y && wall.orientation === lastWall.orientation}
                        />
                    ))}
                </group>
            </Canvas>
        </div>
    );
};

export default Board3D;
