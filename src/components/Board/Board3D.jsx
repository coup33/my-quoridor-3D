/**
 * 3D 보드 컴포넌트
 * Three.js를 사용한 실제 3D 렌더링
 * 리팩토링: 서브컴포넌트들을 별도 파일로 분리
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';

// 분리된 3D 컴포넌트들
import Cell3D from './Cell3D';
import Pawn3D from './Pawn3D';
import BoardBase from './BoardBase';
import { Wall3D, WallTarget3D, WallHitbox3D } from './Wall3D';

/**
 * 메인 3D 보드 컴포넌트
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
    canPlaceWallCheck
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
    const [cameraSettings, setCameraSettings] = useState({ fov: 50, position: [0, 14, 5] });

    // 화면 크기 변경 감지 - 수학적 계산으로 카메라 높이 결정
    useEffect(() => {
        const updateCamera = () => {
            const screenWidth = window.innerWidth;

            // 상수 정의
            const BOARD_WIDTH = 11;        // 보드의 3D 너비 (단위)
            const FOV = 50;                // 고정 화각 (도)
            const CAMERA_Z = 5;            // 카메라 Z 위치 (고정)
            const BOARD_NEAR_Z = 4 * 1.15; // 보드 밑변 Z 위치 (카메라에서 가장 가까운 변)
            const PADDING_RATIO = 0.9;     // 화면의 90%를 보드가 차지하도록 (여백 10%)

            // 목표: 보드가 화면 너비의 PADDING_RATIO만큼 차지하도록 카메라 높이 계산
            const targetPixelWidth = screenWidth * PADDING_RATIO;

            /**
             * 3D → 2D 투영 공식:
             * 
             * 카메라에서 보드 밑변까지의 수평 거리: distanceZ = BOARD_NEAR_Z - CAMERA_Z
             * 카메라에서 보드까지의 3D 거리 (대략): distance = sqrt(cameraY² + distanceZ²)
             * 
             * FOV를 사용한 투영:
             * 보드의 화면상 너비(px) = (BOARD_WIDTH / (2 * distance * tan(FOV/2))) * screenWidth
             * 
             * 역산:
             * distance = (BOARD_WIDTH * screenWidth) / (2 * targetPixelWidth * tan(FOV/2))
             * cameraY = sqrt(distance² - distanceZ²)
             */

            const distanceZ = BOARD_NEAR_Z - CAMERA_Z; // 카메라 Z에서 보드 밑변까지 거리
            const fovRad = (FOV * Math.PI) / 180;       // FOV를 라디안으로 변환
            const halfFovTan = Math.tan(fovRad / 2);

            // 필요한 3D 거리 계산
            // 화면에서 보드가 targetPixelWidth 픽셀로 보이려면 필요한 거리
            const requiredDistance = (BOARD_WIDTH / (2 * halfFovTan)) * (screenWidth / targetPixelWidth);

            // 카메라 Y 높이 계산 (피타고라스)
            const cameraY = Math.sqrt(Math.max(requiredDistance * requiredDistance - distanceZ * distanceZ, 100));

            // 최소/최대 높이 제한
            const clampedY = Math.max(12, Math.min(25, cameraY));

            setCameraSettings({ fov: FOV, position: [0, clampedY, CAMERA_Z] });
        };

        updateCamera();
        window.addEventListener('resize', updateCamera);
        return () => window.removeEventListener('resize', updateCamera);
    }, []);

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
