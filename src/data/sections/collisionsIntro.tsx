import React, { useEffect, useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import {
    EditableH1,
    EditableParagraph,
    InlineScrubbleNumber,
    InlineTrigger,
    InteractionHintSequence,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, useRafLoop, useSpring, type Vec2 } from "@/lib/motion";
import { getVariableInfo, numberPropsFromDefinition } from "../variables";
import {
    HEAVY_EDGE,
    HEAVY_FILL,
    INK_QUIET,
    INK_STRUCTURE,
    LIGHT_EDGE,
    LIGHT_FILL,
    VELOCITY,
} from "./collisionPalette";
import { HeavyWord, LightWord, LivePill } from "./lessonWords";

// ── The opening scene: heavy trolley into a light one, springy bumpers ───────
const HEAVY_MASS = 2;
const LIGHT_MASS = 1;
const SPEED_PER_METRE = 1.2; // pulling back further means arriving faster
const AFTER_SECONDS = 0.9;

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 160;
const TRACK_Y = 100;
const PX_PER_METRE = 60;
const HEAVY_CONTACT_X = 250;
const LIGHT_REST_X = 306;

const formatSpeed = (value: number) => `${value.toFixed(1)} m/s`;
const formatPullback = (value: number) => `${value.toFixed(2)} m`;

const speedFor = (pullback: number) => pullback * SPEED_PER_METRE;
const approachSecondsFor = (pullback: number) => pullback / speedFor(pullback); // constant

function Trolley({ centerX, width, height, label, stroke, strokeWidth, fill }: {
    centerX: number;
    width: number;
    height: number;
    label: string;
    stroke: string;
    strokeWidth: number;
    fill: string;
}) {
    const bodyTop = TRACK_Y - 10 - height;
    return (
        <g>
            <rect x={centerX - width / 2} y={bodyTop} width={width} height={height} rx="4" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <circle cx={centerX - width / 2 + 12} cy={TRACK_Y - 8} r="7" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <circle cx={centerX + width / 2 - 12} cy={TRACK_Y - 8} r="7" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <text x={centerX} y={bodyTop + height / 2 + 4} fill={stroke} fontSize="11" fontWeight="600" textAnchor="middle">
                {label}
            </text>
        </g>
    );
}

function OpeningCrashDrawing() {
    const setVar = useSetVar();
    const pullback = useVar<number>("introPullback", 1);
    const time = useVar<number>("introTime", 0);
    const playing = useVar<boolean>("introPlaying", false);

    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const timeRef = useRef(0);
    const heavyScale = useSpring(dragging || hovered ? 1.06 : 1, { stiffness: 400, damping: 26 });

    const speed = speedFor(pullback);
    const approachSeconds = approachSecondsFor(pullback);
    const totalSeconds = approachSeconds + AFTER_SECONDS;

    const heavyAfter = ((HEAVY_MASS - LIGHT_MASS) / (HEAVY_MASS + LIGHT_MASS)) * speed;
    const lightAfter = ((2 * HEAVY_MASS) / (HEAVY_MASS + LIGHT_MASS)) * speed;

    const startX = HEAVY_CONTACT_X - pullback * PX_PER_METRE;

    const positionsAt = (t: number) => {
        const clamped = clamp(t, 0, totalSeconds);
        if (clamped <= approachSeconds) {
            return {
                heavy: startX + speed * PX_PER_METRE * clamped,
                light: LIGHT_REST_X,
            };
        }
        const since = clamped - approachSeconds;
        return {
            heavy: HEAVY_CONTACT_X + heavyAfter * PX_PER_METRE * since,
            light: LIGHT_REST_X + lightAfter * PX_PER_METRE * since,
        };
    };

    // Changing the pull-back rewinds the scene.
    useEffect(() => {
        timeRef.current = 0;
        setVar("introTime", 0);
        setVar("introPlaying", false);
    }, [pullback, setVar]);

    // A second push starts it over.
    useEffect(() => {
        if (playing && timeRef.current >= totalSeconds) {
            timeRef.current = 0;
            setVar("introTime", 0);
        }
    }, [playing, totalSeconds, setVar]);

    useRafLoop(
        (dt) => {
            timeRef.current = Math.min(timeRef.current + dt, totalSeconds);
            setVar("introTime", Math.round(timeRef.current * 100) / 100);
            if (timeRef.current >= totalSeconds) setVar("introPlaying", false);
        },
        { paused: !playing },
    );

    const now = positionsAt(time);
    const trail = [1, 2, 3, 4, 5]
        .map((step) => time - step * 0.14)
        .filter((t) => t > 0)
        .map((t, index) => ({ ...positionsAt(t), opacity: 0.32 - index * 0.05 }));

    const handlePointerMove = (event: React.PointerEvent<SVGRectElement>) => {
        if (!draggingRef.current) return;
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const point: Vec2 = {
            x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
            y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
        };
        const metres = (HEAVY_CONTACT_X - point.x) / PX_PER_METRE;
        setVar("introPullback", clamp(Math.round(metres * 20) / 20, 0.4, 2));
    };

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="A heavy trolley that can be pulled back along a track and pushed into a lighter trolley waiting further along"
        >
            <defs>
                <filter id="intro-trolley-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <line x1="24" y1={TRACK_Y} x2={VIEW_WIDTH - 24} y2={TRACK_Y} stroke={INK_QUIET} strokeWidth="1.5" />

            {/* Where the push began — the before-state stays on screen */}
            <line x1={startX} y1={TRACK_Y - 48} x2={startX} y2={TRACK_Y + 4} stroke={INK_QUIET} strokeWidth="1.5" strokeDasharray="4 5" />
            <text x={clamp(startX, 45, 515)} y={TRACK_Y + 26} fill={INK_STRUCTURE} fontSize="11" textAnchor="middle">
                pushed from here
            </text>

            {/* The speed the push will give it — an indigo arrow, the lesson's velocity hue */}
            {time === 0 && (
                <g>
                    <line x1={startX} y1={TRACK_Y - 52} x2={startX + speed * 22} y2={TRACK_Y - 52} stroke={VELOCITY} strokeWidth="3" strokeLinecap="round" />
                    <polygon points={`${startX + speed * 22 + 9},${TRACK_Y - 52} ${startX + speed * 22 - 2},${TRACK_Y - 58} ${startX + speed * 22 - 2},${TRACK_Y - 46}`} fill={VELOCITY} />
                    <text x={startX + speed * 11} y={TRACK_Y - 60} fill={VELOCITY} fontSize="11" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatSpeed(speed)}
                    </text>
                </g>
            )}

            {/* Where each trolley has been */}
            {trail.map((mark, index) => (
                <g key={index} opacity={Math.max(mark.opacity, 0.06)}>
                    <circle cx={mark.heavy} cy={TRACK_Y + 12} r="3" fill={HEAVY_EDGE} />
                    <circle cx={mark.light} cy={TRACK_Y + 12} r="3" fill={LIGHT_EDGE} />
                </g>
            ))}

            <Trolley centerX={now.light} width={48} height={26} label="light" stroke={LIGHT_EDGE} strokeWidth={1.5} fill={LIGHT_FILL} />

            <g transform={`translate(${now.heavy} ${TRACK_Y}) scale(${heavyScale}) translate(${-now.heavy} ${-TRACK_Y})`}>
                <g filter="url(#intro-trolley-shadow)">
                    <Trolley centerX={now.heavy} width={64} height={30} label="heavy" stroke={HEAVY_EDGE} strokeWidth={2.5} fill={HEAVY_FILL} />
                </g>
            </g>
            <rect
                x={now.heavy - 40}
                y={TRACK_Y - 44}
                width="80"
                height="48"
                fill="transparent"
                style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    draggingRef.current = true;
                    setDragging(true);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={() => { draggingRef.current = false; setDragging(false); }}
                onPointerCancel={() => { draggingRef.current = false; setDragging(false); }}
                onPointerEnter={() => setHovered(true)}
                onPointerLeave={() => setHovered(false)}
            />
        </svg>
    );
}

function OpeningCrashFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="collisions-opening-crash"
            playable
            playVarName="introPlaying"
            onReset={() => {
                setVar("introPullback", 1);
                setVar("introTime", 0);
                setVar("introPlaying", false);
            }}
            caption="Drag the blue heavy trolley back along the track to load a harder push, then send it in and watch where the two of them end up."
        >
            <OpeningCrashDrawing />
            <InteractionHintSequence
                hintKey="collisions-opening-drag"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Drag the heavy trolley back along the track",
                        position: { x: "34%", y: "50%" },
                        dragPath: { type: "line", startOffset: { x: 26, y: 0 }, endOffset: { x: -26, y: 0 } },
                    },
                ]}
            />
        </Figure>
    );
}

/** The speed the current pull-back gives the heavy trolley, live in the prose. */
function ArrivalSpeed() {
    const pullback = useVar<number>("introPullback", 1);
    return <LivePill color={VELOCITY}>{formatSpeed(speedFor(pullback))}</LivePill>;
}

export const collisionsIntroBlocks: ReactElement[] = [
    <StackLayout key="layout-collisions-intro-title" maxWidth="xl">
        <Block id="collisions-intro-title" padding="md">
            <EditableH1 id="h1-collisions-intro-title" blockId="collisions-intro-title">
                Collisions
            </EditableH1>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-collisions-intro-hook" maxWidth="xl">
        <Block id="collisions-intro-hook" padding="sm">
            <EditableParagraph id="para-collisions-intro-hook" blockId="collisions-intro-hook">
                Two trolleys sit on a low-friction track in the lab, a <HeavyWord /> and a{" "}
                <LightWord />. Pull the heavy one back{" "}
                <InlineScrubbleNumber
                    varName="introPullback"
                    {...numberPropsFromDefinition(getVariableInfo("introPullback"))}
                    formatValue={formatPullback}
                />{" "}
                along the track, so that it arrives at <ArrivalSpeed />, give it{" "}
                <InlineTrigger id="trigger-collisions-push" varName="introPlaying" value={true} icon="play">
                    a push
                </InlineTrigger>
                , and half a second later both are moving in ways nobody in the room called out. Physics
                can call them, and with surprisingly little information.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-collisions-opening-crash" maxWidth="xl">
        <Block id="block-1787708572562" padding="sm" hasVisualization>
            <OpeningCrashFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-collisions-intro-promise" maxWidth="xl">
        <Block id="collisions-intro-promise" padding="sm">
            <EditableParagraph id="para-collisions-intro-promise" blockId="collisions-intro-promise">
                The reason is that a colliding pair carries something through the crash untouched. By the
                end of this lesson you will be able to take two objects, their masses and their speeds,
                and work out how fast each one moves once they have hit. All you need to bring is the
                everyday sense of how heavy something is and how fast it is going; we build the rest here.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
