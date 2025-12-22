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
import { useCameraControl } from '../../hooks/useCameraControl';



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

    // 카메라 및 반응형 설정 (커스텀 훅 사용)
    const cameraSettings = useCameraControl({ isMobileLayout, onBoardBoundsChange });

    return (
        <div style={{ width: '100%', height: '100%' }}>
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
