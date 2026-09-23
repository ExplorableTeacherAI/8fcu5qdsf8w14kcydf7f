import React, { useEffect, useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { SplitLayout, StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeInput,
    InlineFeedback,
    InlineFormula,
    InlineLinkedHighlight,
    InlineScrubbleNumber,
    InlineTooltip,
    InlineTrigger,
    InteractionHintSequence,
    InlineSpotColor,
} from "@/components/atoms";
import { Figure, FigureSlider, FormulaBlock } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, useSpring, type Vec2 } from "@/lib/motion";
import {
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
    numberPropsFromDefinition,
    scrubVarsFromDefinitions,
} from "../variables";
import {
    FORMULA_COLORS,
    INK_QUIET,
    INK_STRUCTURE,
    MASS,
    MASS_BG,
    MASS_FILL,
    MASS_TEXT,
    MOMENTUM,
    MOMENTUM_BG,
    MOMENTUM_TEXT,
    PAPER,
    VELOCITY,
    VELOCITY_BG,
    VELOCITY_TEXT,
} from "./collisionPalette";
import { LivePill, MassWord, MomentumWord, VelocityWord } from "./lessonWords";

// ── Shared view geometry — THE VISIBLE TIE ───────────────────────────────────
// Both figures use the same viewBox and the same pixels per kg m/s, and both
// anchor momentum at the same x. The shaded strip under the trolley is
// therefore exactly as long as the bar beside it.

const VIEW_WIDTH = 380;
const VIEW_HEIGHT = 300;
const MOMENTUM_ANCHOR_X = 180; // x of momentum = 0 in BOTH views
const PX_PER_MOMENTUM = 6; // pixels per kg m/s in BOTH views

const DEFAULT_MASS = 3;
const DEFAULT_VELOCITY = 2;

// Trolley geometry (view A)
const TROLLEY_CX = MOMENTUM_ANCHOR_X;
const BED_Y = 194;
const BLOCK_HEIGHT = 16;
const BLOCK_PITCH = 18;
const TRACK_Y = 236;
const ARROW_Y = 207;
const PX_PER_VELOCITY = 36;
const STRIP_Y = 270;

// ── One formatter per quantity, used by both figures and the prose ───────────
const formatMass = (value: number) => `${Math.round(value)} kg`;
const formatVelocity = (value: number) => `${value.toFixed(1)} m/s`;
const formatMomentum = (value: number) => `${value.toFixed(1)} kg m/s`;

// ── Shared highlight helpers (the linked-highlight contract) ─────────────────
const EASE_150 = { transition: "opacity 150ms ease, stroke-width 150ms ease" } as const;

const useHighlightState = () => {
    const highlight = useVar<string>("momentumHighlight", "");
    const setVar = useSetVar();
    return {
        opacity: (id: string) => (highlight && highlight !== id ? 0.35 : 1),
        weight: (id: string, resting: number) => (highlight === id ? resting * 1.6 : resting),
        isActive: (id: string) => highlight === id,
        hoverProps: (id: string) => ({
            onPointerEnter: () => setVar("momentumHighlight", id),
            onPointerLeave: () => setVar("momentumHighlight", ""),
        }),
    };
};

const Halo = ({ active, children }: { active: boolean; children: React.ReactNode }) =>
    active ? <g opacity={0.28}>{children}</g> : null;

const svgPointFromEvent = (event: React.PointerEvent, svg: SVGSVGElement | null): Vec2 => {
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
        x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
    };
};

// ── Shared readout strip — identical in both figures ─────────────────────────
function SharedReadouts({ mass, momentum }: { mass: number; momentum: number }) {
    const { opacity } = useHighlightState();
    return (
        <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}>
            <text x="24" y="34" fill={MASS_TEXT} opacity={opacity("massStack")}>
                {`m = ${formatMass(mass)}`}
            </text>
            <text
                x={VIEW_WIDTH - 24}
                y="34"
                fill={MOMENTUM_TEXT}
                textAnchor="end"
                opacity={opacity("momentumBar")}
            >
                {`p = ${formatMomentum(momentum)}`}
            </text>
        </g>
    );
}

// ── VIEW A: the trolley itself ───────────────────────────────────────────────
function TrolleyDrawing() {
    const setVar = useSetVar();
    const mass = useVar<number>("momentumMass", DEFAULT_MASS);
    const velocity = useVar<number>("momentumVelocity", DEFAULT_VELOCITY);
    const { opacity, weight, isActive, hoverProps } = useHighlightState();

    const [draggingArrow, setDraggingArrow] = useState(false);
    const [hoveredArrow, setHoveredArrow] = useState(false);
    const draggingArrowRef = useRef(false);
    const draggingStackRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const arrowScale = useSpring(draggingArrow || hoveredArrow ? 1.15 : 1, {
        stiffness: 400,
        damping: 26,
    });

    const momentum = mass * velocity;
    useEffect(() => {
        setVar("momentumProduct", Number(momentum.toFixed(1)));
    }, [momentum, setVar]);
    const topBlockY = BED_Y - mass * BLOCK_PITCH;
    const tipX = TROLLEY_CX + velocity * PX_PER_VELOCITY;
    const stripEndX = MOMENTUM_ANCHOR_X + momentum * PX_PER_MOMENTUM;

    const handleStackMove = (event: React.PointerEvent<SVGRectElement>) => {
        if (!draggingStackRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        setVar("momentumMass", clamp(Math.round((BED_Y - point.y) / BLOCK_PITCH), 1, 5));
    };

    const handleArrowMove = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!draggingArrowRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        const raw = (point.x - TROLLEY_CX) / PX_PER_VELOCITY;
        setVar("momentumVelocity", clamp(Math.round(raw * 10) / 10, -3, 3));
    };

    const arrowHeadDirection = velocity >= 0 ? 1 : -1;
    const arrowVisible = Math.abs(velocity) > 0.05;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="A trolley on a track carrying a stack of one kilogram blocks, with a draggable velocity arrow and a shaded momentum strip beneath"
        >
            <defs>
                <filter id="momentum-trolley-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <SharedReadouts mass={mass} momentum={momentum} />

            {/* Track — ambient structure */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <line x1="40" y1={TRACK_Y} x2="340" y2={TRACK_Y} stroke={INK_QUIET} strokeWidth="1.5" />
            </g>

            {/* Trolley body and wheels — plain ink, not a coloured quantity */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <rect x={TROLLEY_CX - 42} y="194" width="84" height="26" rx="4" fill={PAPER} stroke={INK_STRUCTURE} strokeWidth="1.5" />
                <circle cx={TROLLEY_CX - 26} cy="228" r="8" fill={PAPER} stroke={INK_STRUCTURE} strokeWidth="1.5" />
                <circle cx={TROLLEY_CX + 26} cy="228" r="8" fill={PAPER} stroke={INK_STRUCTURE} strokeWidth="1.5" />
            </g>

            {/* MASS group — the stack of 1 kg blocks, draggable up and down */}
            <g {...hoverProps("massStack")} opacity={opacity("massStack")} style={EASE_150}>
                {Array.from({ length: mass }, (_, index) => (
                    <rect
                        key={index}
                        x={TROLLEY_CX - 26}
                        y={BED_Y - (index + 1) * BLOCK_PITCH}
                        width="52"
                        height={BLOCK_HEIGHT}
                        rx="3"
                        fill={MASS_FILL}
                        stroke={MASS}
                        strokeWidth={weight("massStack", 1.5)}
                    />
                ))}
                <text x={TROLLEY_CX - 34} y={topBlockY + 12} fill={MASS_TEXT} fontSize="12" textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatMass(mass)}
                </text>
                <rect
                    x={TROLLEY_CX - 34}
                    y={topBlockY - 14}
                    width="68"
                    height="30"
                    fill="transparent"
                    style={{ cursor: "ns-resize", touchAction: "none" }}
                    onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        draggingStackRef.current = true;
                    }}
                    onPointerMove={handleStackMove}
                    onPointerUp={() => { draggingStackRef.current = false; }}
                    onPointerCancel={() => { draggingStackRef.current = false; }}
                />
            </g>

            {/* VELOCITY group — the arrow students pull */}
            <g {...hoverProps("velocityArrow")} opacity={opacity("velocityArrow")} style={EASE_150}>
                {arrowVisible && (
                    <>
                        <Halo active={isActive("velocityArrow")}>
                            <line x1={TROLLEY_CX} y1={ARROW_Y} x2={tipX} y2={ARROW_Y} stroke={VELOCITY} strokeWidth={weight("velocityArrow", 3) + 6} strokeLinecap="round" />
                        </Halo>
                        <line x1={TROLLEY_CX} y1={ARROW_Y} x2={tipX} y2={ARROW_Y} stroke={VELOCITY} strokeWidth={weight("velocityArrow", 3)} strokeLinecap="round" />
                        <polygon
                            points={`${tipX + arrowHeadDirection * 11},${ARROW_Y} ${tipX - arrowHeadDirection * 3},${ARROW_Y - 7} ${tipX - arrowHeadDirection * 3},${ARROW_Y + 7}`}
                            fill={VELOCITY}
                        />
                    </>
                )}
                <text
                    x={clamp(tipX, 60, 320)}
                    y="254"
                    fill={VELOCITY_TEXT}
                    fontSize="12"
                    textAnchor="middle"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {formatVelocity(velocity)}
                </text>
            </g>

            {/* MOMENTUM group — same anchor, same pixels per unit as the bar */}
            <g {...hoverProps("momentumBar")} opacity={opacity("momentumBar")} style={EASE_150}>
                <line x1={MOMENTUM_ANCHOR_X} y1={STRIP_Y - 12} x2={MOMENTUM_ANCHOR_X} y2={STRIP_Y + 12} stroke={INK_QUIET} strokeWidth="1.5" />
                <Halo active={isActive("momentumBar")}>
                    <line x1={MOMENTUM_ANCHOR_X} y1={STRIP_Y} x2={stripEndX} y2={STRIP_Y} stroke={MOMENTUM} strokeWidth={weight("momentumBar", 8) + 6} strokeLinecap="round" />
                </Halo>
                <line x1={MOMENTUM_ANCHOR_X} y1={STRIP_Y} x2={stripEndX} y2={STRIP_Y} stroke={MOMENTUM} strokeWidth={weight("momentumBar", 8)} strokeLinecap="round" />
            </g>

            {/* Draggable arrow tip — the only handle with a shadow in this view */}
            <g transform={`translate(${tipX} ${ARROW_Y}) scale(${arrowScale})`}>
                <circle r="7" fill={VELOCITY} filter="url(#momentum-trolley-shadow)" />
            </g>
            <circle
                cx={tipX}
                cy={ARROW_Y}
                r="24"
                fill="transparent"
                style={{ cursor: draggingArrow ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    draggingArrowRef.current = true;
                    setDraggingArrow(true);
                }}
                onPointerMove={handleArrowMove}
                onPointerUp={() => { draggingArrowRef.current = false; setDraggingArrow(false); }}
                onPointerCancel={() => { draggingArrowRef.current = false; setDraggingArrow(false); }}
                onPointerEnter={() => setHoveredArrow(true)}
                onPointerLeave={() => setHoveredArrow(false)}
            />
        </svg>
    );
}

// ── VIEW B: momentum against velocity — the same quantity, graphed ───────────
// Same 36 px per m/s as the velocity arrow (horizontal) and the same 6 px per
// kg m/s as the momentum strip (vertical), so the point sits exactly one arrow
// to the right of the origin and one strip above it.
const ORIGIN_X = 200;
const ORIGIN_Y = 150;
const MAX_VELOCITY = 3;
const MAX_MOMENTUM = 15;
const PLOT_HALF_WIDTH = MAX_VELOCITY * PX_PER_VELOCITY; // 108
const PLOT_HALF_HEIGHT = MAX_MOMENTUM * PX_PER_MOMENTUM; // 90
const MASS_FAMILY = [1, 2, 3, 4, 5];

const plotX = (velocity: number) => ORIGIN_X + velocity * PX_PER_VELOCITY;
const plotY = (momentum: number) => ORIGIN_Y - momentum * PX_PER_MOMENTUM;

/** The line p = m·v, clipped to the plot: it leaves through the top for heavy masses. */
const lineEnds = (massValue: number) => {
    const reach = Math.min(MAX_VELOCITY, MAX_MOMENTUM / massValue);
    return { x1: plotX(-reach), y1: plotY(-massValue * reach), x2: plotX(reach), y2: plotY(massValue * reach) };
};

function MomentumGraphDrawing() {
    const setVar = useSetVar();
    const mass = useVar<number>("momentumMass", DEFAULT_MASS);
    const velocity = useVar<number>("momentumVelocity", DEFAULT_VELOCITY);
    const { opacity, weight, isActive, hoverProps } = useHighlightState();

    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const handleScale = useSpring(dragging || hovered ? 1.15 : 1, { stiffness: 400, damping: 26 });

    const momentum = mass * velocity;
    const pointX = plotX(velocity);
    const pointY = plotY(momentum);
    const line = lineEnds(mass);

    // Bidirectional: the point is tied to the line, so only its x (the velocity) is read.
    const handlePointerMove = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!draggingRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        const raw = (point.x - ORIGIN_X) / PX_PER_VELOCITY;
        setVar("momentumVelocity", clamp(Math.round(raw * 10) / 10, -MAX_VELOCITY, MAX_VELOCITY));
    };

    const momentumTicks = [-15, -10, -5, 5, 10, 15];
    const velocityTicks = [-3, -2, -1, 1, 2, 3];

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="A graph of momentum against velocity. A straight line through the origin has the trolley's mass as its slope, and a draggable teal point on it marks the current velocity and momentum"
        >
            <defs>
                <filter id="momentum-graph-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <SharedReadouts mass={mass} momentum={momentum} />

            {/* Axes and ticks — ambient structure */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <line x1={ORIGIN_X - PLOT_HALF_WIDTH - 12} y1={ORIGIN_Y} x2={ORIGIN_X + PLOT_HALF_WIDTH + 12} y2={ORIGIN_Y} stroke={INK_QUIET} strokeWidth="1.5" />
                <line x1={ORIGIN_X} y1={ORIGIN_Y - PLOT_HALF_HEIGHT - 12} x2={ORIGIN_X} y2={ORIGIN_Y + PLOT_HALF_HEIGHT + 12} stroke={INK_QUIET} strokeWidth="1.5" />
                <g fontSize="10" fill={INK_STRUCTURE} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {velocityTicks.map((tick) => (
                        <g key={`v${tick}`}>
                            <line x1={plotX(tick)} y1={ORIGIN_Y - 3} x2={plotX(tick)} y2={ORIGIN_Y + 3} stroke={INK_QUIET} strokeWidth="1.5" />
                            <text x={plotX(tick)} y={ORIGIN_Y + 15} textAnchor="middle">{tick < 0 ? `−${-tick}` : tick}</text>
                        </g>
                    ))}
                    {momentumTicks.map((tick) => (
                        <g key={`p${tick}`}>
                            <line x1={ORIGIN_X - 3} y1={plotY(tick)} x2={ORIGIN_X + 3} y2={plotY(tick)} stroke={INK_QUIET} strokeWidth="1.5" />
                            <text x={ORIGIN_X - 7} y={plotY(tick) + 3.5} textAnchor="end">{tick < 0 ? `−${-tick}` : tick}</text>
                        </g>
                    ))}
                </g>
                <text x={ORIGIN_X + PLOT_HALF_WIDTH + 12} y={ORIGIN_Y + PLOT_HALF_HEIGHT + 10} fill={VELOCITY_TEXT} fontSize="11" textAnchor="end">
                    velocity, m/s
                </text>
                <text x={ORIGIN_X + 8} y={ORIGIN_Y - PLOT_HALF_HEIGHT - 10} fill={MOMENTUM_TEXT} fontSize="11">
                    momentum, kg m/s
                </text>

                {/* The whole family: one line per possible mass, so steeper reads as heavier */}
                {MASS_FAMILY.filter((candidate) => candidate !== mass).map((candidate) => {
                    const ends = lineEnds(candidate);
                    return (
                        <g key={candidate}>
                            <line {...ends} stroke={INK_QUIET} strokeWidth="1" />
                            <text x={ends.x2 + 4} y={ends.y2 + 3} fill={INK_QUIET} fontSize="9">{`${candidate} kg`}</text>
                        </g>
                    );
                })}
            </g>

            {/* MASS group — the active line: its steepness is the mass */}
            <g {...hoverProps("massStack")} opacity={opacity("massStack")} style={EASE_150}>
                <Halo active={isActive("massStack")}>
                    <line {...line} stroke={MASS} strokeWidth={weight("massStack", 2.5) + 6} strokeLinecap="round" />
                </Halo>
                <line {...line} stroke={MASS} strokeWidth={weight("massStack", 2.5)} strokeLinecap="round" />
                <text x={line.x2 + 4} y={line.y2 + 3} fill={MASS_TEXT} fontSize="11" fontWeight="600" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {`${mass} kg`}
                </text>
            </g>

            {/* VELOCITY group — how far along the bottom the point sits */}
            <g {...hoverProps("velocityArrow")} opacity={opacity("velocityArrow")} style={EASE_150}>
                <Halo active={isActive("velocityArrow")}>
                    <line x1={pointX} y1={pointY} x2={pointX} y2={ORIGIN_Y} stroke={VELOCITY} strokeWidth={weight("velocityArrow", 1.5) + 6} strokeLinecap="round" />
                </Halo>
                <line x1={pointX} y1={pointY} x2={pointX} y2={ORIGIN_Y} stroke={VELOCITY} strokeWidth={weight("velocityArrow", 1.5)} strokeDasharray="3 4" />
                <circle cx={pointX} cy={ORIGIN_Y} r="3.5" fill={VELOCITY} />
                <text x={clamp(pointX, 60, 320)} y={ORIGIN_Y + (momentum >= 0 ? 28 : -26)} fill={VELOCITY_TEXT} fontSize="12" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatVelocity(velocity)}
                </text>
            </g>

            {/* MOMENTUM group — how high up the side the point sits: counterpart of the strip */}
            <g {...hoverProps("momentumBar")} opacity={opacity("momentumBar")} style={EASE_150}>
                <Halo active={isActive("momentumBar")}>
                    <line x1={ORIGIN_X} y1={pointY} x2={pointX} y2={pointY} stroke={MOMENTUM} strokeWidth={weight("momentumBar", 1.5) + 6} strokeLinecap="round" />
                </Halo>
                <line x1={ORIGIN_X} y1={pointY} x2={pointX} y2={pointY} stroke={MOMENTUM} strokeWidth={weight("momentumBar", 1.5)} strokeDasharray="3 4" />
                <circle cx={ORIGIN_X} cy={pointY} r="3.5" fill={MOMENTUM} />
                {/* label on the side of the axis the point is NOT on */}
                <text x={velocity < 0 ? ORIGIN_X + 12 : ORIGIN_X - 28} y={clamp(pointY, 50, 258) + 4} fill={MOMENTUM_TEXT} fontSize="12" textAnchor={velocity < 0 ? "start" : "end"} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatMomentum(momentum)}
                </text>
                <g transform={`translate(${pointX} ${pointY}) scale(${handleScale})`}>
                    <circle r="8" fill={MOMENTUM} filter="url(#momentum-graph-shadow)" />
                </g>
            </g>

            {/* Draggable point — tied to the line */}
            <circle
                cx={pointX}
                cy={pointY}
                r="24"
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

// ── Figure shells ────────────────────────────────────────────────────────────
function TrolleyFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="momentum-trolley"
            onReset={() => {
                setVar("momentumMass", DEFAULT_MASS);
                setVar("momentumVelocity", DEFAULT_VELOCITY);
                setVar("momentumHighlight", "");
            }}
            caption="Drag the top of the block stack to add or remove blocks, and pull the indigo arrow to change the speed."
        >
            <TrolleyDrawing />
            <div className="px-6 pb-5">
                <FigureSlider
                    varName="momentumVelocity"
                    label="Velocity"
                    {...numberPropsFromDefinition(getVariableInfo("momentumVelocity"))}
                    formatValue={formatVelocity}
                />
            </div>
            <InteractionHintSequence
                hintKey="momentum-trolley-controls"
                steps={[
                    {
                        gesture: "drag-vertical",
                        label: "Drag the top of the block stack to load the trolley",
                        position: { x: "47%", y: "48%" },
                        dragPath: { type: "line", startOffset: { x: 0, y: 14 }, endOffset: { x: 0, y: -14 } },
                    },
                    {
                        gesture: "drag-horizontal",
                        label: "Pull the indigo arrow to change the velocity",
                        position: { x: "66%", y: "69%" },
                        dragPath: { type: "line", startOffset: { x: -28, y: 0 }, endOffset: { x: 28, y: 0 } },
                    },
                ]}
            />
        </Figure>
    );
}

function MomentumGraphFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="momentum-bar"
            onReset={() => {
                setVar("momentumMass", DEFAULT_MASS);
                setVar("momentumVelocity", DEFAULT_VELOCITY);
                setVar("momentumHighlight", "");
            }}
            caption="The same momentum on a graph: velocity along the bottom, momentum up the side. The steepness of the amber line is the mass. Drag the teal point along the line and the trolley changes speed to match."
        >
            <MomentumGraphDrawing />
            <InteractionHintSequence
                hintKey="momentum-graph-drag"
                steps={[
                    {
                        gesture: "drag",
                        label: "Drag the teal point along the line",
                        position: { x: "71%", y: "34%" },
                        dragPath: { type: "line", startOffset: { x: -24, y: 12 }, endOffset: { x: 24, y: -12 } },
                    },
                ]}
            />
        </Figure>
    );
}

/** The momentum the current trolley would carry if it rolled left at its current speed. */
function NegativeMomentum() {
    const mass = useVar<number>("momentumMass", DEFAULT_MASS);
    const velocity = useVar<number>("momentumVelocity", DEFAULT_VELOCITY);
    const leftward = -Math.abs(mass * velocity);
    return (
        <>
            a momentum of{" "}
            <LivePill color={MOMENTUM}>{formatMomentum(leftward).replace("-", "\u2212")}</LivePill>
        </>
    );
}

export const momentumIntroBlocks: ReactElement[] = [
    <StackLayout key="layout-momentum-heading" maxWidth="xl">
        <Block id="momentum-heading" padding="md">
            <EditableH2 id="h2-momentum-heading" blockId="momentum-heading">
                Mass and Speed Together
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-momentum-setup" maxWidth="xl">
        <Block id="momentum-setup" padding="sm">
            <EditableParagraph id="para-momentum-setup" blockId="momentum-setup">
                A heavy trolley moving slowly and a light trolley moving fast can be just as hard to
                stop. So neither <MassWord /> nor <VelocityWord /> on its own tells you how much push an
                object brings to a crash. What does is the two multiplied together. This is called{" "}
                <InlineTooltip id="tooltip-momentum-definition" color={MOMENTUM_TEXT} bgColor={MOMENTUM_BG} tooltip="Momentum is mass times velocity. It says how much motion an object has, and which way it is going.">
                    momentum
                </InlineTooltip>
                , written <InlineFormula latex="\clr{p}{p}" colorMap={FORMULA_COLORS} />. Stack{" "}
                <InlineLinkedHighlight
                    varName="momentumHighlight"
                    highlightId="massStack"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("momentumHighlight"))}
                    color={MASS_TEXT}
                    bgColor={MASS_BG}
                >
                    amber blocks
                </InlineLinkedHighlight>{" "}
                on the trolley or pull its{" "}
                <InlineLinkedHighlight
                    varName="momentumHighlight"
                    highlightId="velocityArrow"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("momentumHighlight"))}
                    color={VELOCITY_TEXT}
                    bgColor={VELOCITY_BG}
                >
                    indigo arrow
                </InlineLinkedHighlight>
                , and the{" "}
                <InlineLinkedHighlight
                    varName="momentumHighlight"
                    highlightId="momentumBar"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("momentumHighlight"))}
                >
                    teal point
                </InlineLinkedHighlight>{" "}
                on the graph beside it moves.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-momentum-formula" maxWidth="xl">
        <Block id="momentum-formula" padding="lg">
            <FormulaBlock
                latex="\highlight{momentumBar}{p} = \highlight{massStack}{m} \times \highlight{velocityArrow}{v} = \scrub{momentumMass} \times \scrub{momentumVelocity} = \val{momentumProduct}\,\text{kg m/s}"
                colorMap={FORMULA_COLORS}
                variables={scrubVarsFromDefinitions(["momentumMass", "momentumVelocity", "momentumProduct"])}
                linkedHighlights={{
                    momentumBar: { varName: "momentumHighlight", color: MOMENTUM_TEXT, bgColor: MOMENTUM_BG },
                    massStack: { varName: "momentumHighlight", color: MASS_TEXT, bgColor: MASS_BG },
                    velocityArrow: { varName: "momentumHighlight", color: VELOCITY_TEXT, bgColor: VELOCITY_BG },
                }}
            />
        </Block>
    </StackLayout>,

    <SplitLayout key="layout-momentum-pair" ratio="1:1" gap="lg" align="start">
        <Block id="momentum-visual" padding="sm" hasVisualization>
            <TrolleyFigure />
        </Block>
        <Block id="momentum-bar-visual" padding="sm" hasVisualization>
            <MomentumGraphFigure />
        </Block>
    </SplitLayout>,

    <StackLayout key="layout-momentum-direction" maxWidth="xl">
        <Block id="momentum-direction" padding="sm">
            <EditableParagraph id="para-momentum-direction" blockId="momentum-direction">Direction matters as much as size. On a straight track we call rolling to the right <InlineTrigger varName={"momentumVelocity"} value={2} color={"#10B981"} bgColor={"rgba(16, 185, 129, 0.15)"} id={"trigger-momentum-positive"}>positive</InlineTrigger> and rolling to the left <InlineTrigger varName={"momentumVelocity"} value={-2} color={"#10B981"} bgColor={"rgba(16, 185, 129, 0.15)"} id={"trigger-momentum-negative"}>negative</InlineTrigger>. So <InlineSpotColor varName={"quantityMomentum"} color={"#62D0AD"} id={"spotColor-1790154217087-0dpj0"}>momentum</InlineSpotColor> can be negative: a <InlineScrubbleNumber varName={"momentumMass"} defaultValue={3} min={1} max={5} step={1} color={"#F7B23B"} id={"scrubble-1790154217087-z1594"} /> kg trolley rolling to the left has a momentum of −6.0 kg m/s, even though its mass and speed are ordinary positive numbers. Add the two trolleys' momenta, minus signs and all, and you get the total they bring into the crash.</EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-momentum-question-product" maxWidth="xl">
        <Block id="momentum-question-product" padding="md">
            <EditableParagraph id="para-momentum-question-product" blockId="momentum-question-product">
                So a 4 kg trolley rolling to the right at 2.5 m/s has a momentum of{" "}
                <InlineFeedback
                    varName="answerMomentumProduct"
                    correctValue="10"
                    position="terminal"
                    successMessage="— yes, 4 times 2.5 is 10, and it is positive because the trolley is going right"
                    failureMessage="— not quite."
                    hint="Multiply the mass and the velocity, do not add them"
                >
                    <InlineClozeInput
                        varName="answerMomentumProduct"
                        correctAnswer="10"
                        {...clozePropsFromDefinition(getVariableInfo("answerMomentumProduct"))}
                    />
                </InlineFeedback>{" "}
                kg m/s.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-momentum-question-direction" maxWidth="xl">
        <Block id="momentum-question-direction" padding="md">
            <EditableParagraph id="para-momentum-question-direction" blockId="momentum-question-direction">
                Now turn the same trolley around so it rolls to the left at 2.5 m/s. Its momentum
                becomes{" "}
                <InlineFeedback
                    varName="answerMomentumDirection"
                    correctValue={["-10", "−10"]}
                    position="terminal"
                    successMessage="— right, the size stays 10 and only the sign flips, because only the direction changed"
                    failureMessage="— almost."
                    hint="The mass and speed have not changed, so only one thing about the answer can"
                    visualizationHint={{
                        blockId: "momentum-visual",
                        hintKey: "feedback-momentum-negative-hint",
                        label: "Discover it yourself",
                        resetVars: { momentumMass: 3, momentumVelocity: 2 },
                        steps: [
                            {
                                gesture: "drag-vertical",
                                label: "Drag the top of the block stack up until the trolley has 4 kg",
                                position: { x: "47%", y: "48%" },
                                completionVar: "momentumMass",
                                completionValue: 4,
                                completionTolerance: 0.4,
                            },
                            {
                                gesture: "drag-horizontal",
                                label: "Now pull the indigo arrow to the left, past zero, to 2.5 m/s, and read the bar",
                                position: { x: "66%", y: "69%" },
                                completionVar: "momentumVelocity",
                                completionValue: -2.5,
                                completionTolerance: 0.4,
                            },
                        ],
                    }}
                >
                    <InlineClozeInput
                        varName="answerMomentumDirection"
                        correctAnswer={["-10", "−10"]}
                        {...clozePropsFromDefinition(getVariableInfo("answerMomentumDirection"))}
                    />
                </InlineFeedback>{" "}
                kg m/s.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
