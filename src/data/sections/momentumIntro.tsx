import React, { useEffect, useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { SplitLayout, StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InlineScrubbleNumber,
    InlineTooltip,
    InteractionHintSequence,
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
    ANSWER,
    ANSWER_BG,
    FORMULA_COLORS,
    INK,
    INK_QUIET,
    INK_STRUCTURE,
    MASS,
    MASS_BG,
    MASS_FILL,
    MASS_TEXT,
    MOMENTUM,
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

// Bar geometry (view B)
const BAR_TOP = 130;
const BAR_BOTTOM = 170;
const BAR_MID_Y = (BAR_TOP + BAR_BOTTOM) / 2;
const AXIS_Y = 200;

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

// ── VIEW B: the momentum bar (the same quantity, measured) ───────────────────
function MomentumBarDrawing() {
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
    const barEndX = MOMENTUM_ANCHOR_X + momentum * PX_PER_MOMENTUM;

    // Bidirectional: dragging the bar end sets the velocity that would give it.
    const handlePointerMove = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!draggingRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        const targetMomentum = (point.x - MOMENTUM_ANCHOR_X) / PX_PER_MOMENTUM;
        setVar("momentumVelocity", clamp(Math.round((targetMomentum / mass) * 10) / 10, -3, 3));
    };

    const ticks = [-15, -10, -5, 0, 5, 10, 15];

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="A horizontal bar showing the trolley's momentum against a scale in kilogram metres per second"
        >
            <defs>
                <filter id="momentum-bar-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <SharedReadouts mass={mass} momentum={momentum} />

            {/* Scale — same anchor and same pixels per unit as the strip in view A */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <line x1={MOMENTUM_ANCHOR_X} y1={BAR_TOP - 20} x2={MOMENTUM_ANCHOR_X} y2={AXIS_Y} stroke={INK_QUIET} strokeWidth="1.5" />
                <line x1="90" y1={AXIS_Y} x2="270" y2={AXIS_Y} stroke={INK_QUIET} strokeWidth="1.5" />
                <g fill={INK} fontSize="11" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {ticks.map((tick) => (
                        <g key={tick}>
                            <line
                                x1={MOMENTUM_ANCHOR_X + tick * PX_PER_MOMENTUM}
                                y1={AXIS_Y}
                                x2={MOMENTUM_ANCHOR_X + tick * PX_PER_MOMENTUM}
                                y2={AXIS_Y + 6}
                                stroke={INK_QUIET}
                                strokeWidth="1.5"
                            />
                            <text x={MOMENTUM_ANCHOR_X + tick * PX_PER_MOMENTUM} y={AXIS_Y + 20}>
                                {tick < 0 ? `−${Math.abs(tick)}` : `${tick}`}
                            </text>
                        </g>
                    ))}
                </g>
                <text x={MOMENTUM_ANCHOR_X} y={AXIS_Y + 44} fill={INK_STRUCTURE} fontSize="11" textAnchor="middle">
                    kg m/s
                </text>
            </g>

            {/* MOMENTUM group — counterpart of the strip under the trolley */}
            <g {...hoverProps("momentumBar")} opacity={opacity("momentumBar")} style={EASE_150}>
                <Halo active={isActive("momentumBar")}>
                    <rect
                        x={Math.min(MOMENTUM_ANCHOR_X, barEndX) - 4}
                        y={BAR_TOP - 4}
                        width={Math.abs(barEndX - MOMENTUM_ANCHOR_X) + 8}
                        height={BAR_BOTTOM - BAR_TOP + 8}
                        rx="6"
                        fill={MOMENTUM}
                    />
                </Halo>
                <rect
                    x={Math.min(MOMENTUM_ANCHOR_X, barEndX)}
                    y={BAR_TOP}
                    width={Math.abs(barEndX - MOMENTUM_ANCHOR_X)}
                    height={BAR_BOTTOM - BAR_TOP}
                    rx="3"
                    fill={MOMENTUM}
                    stroke={MOMENTUM}
                    strokeWidth={weight("momentumBar", 1.5)}
                />
                <text
                    x={clamp((MOMENTUM_ANCHOR_X + barEndX) / 2, 70, 310)}
                    y={BAR_TOP - 14}
                    fill={MOMENTUM_TEXT}
                    fontSize="12"
                    textAnchor="middle"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {formatMomentum(momentum)}
                </text>
            </g>

            {/* Draggable bar end */}
            <g transform={`translate(${barEndX} ${BAR_MID_Y}) scale(${handleScale})`}>
                <circle r="8" fill={MOMENTUM} filter="url(#momentum-bar-shadow)" />
            </g>
            <circle
                cx={barEndX}
                cy={BAR_MID_Y}
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
            caption="Drag the top of the block stack to load or unload the trolley, and pull the indigo arrow to change how fast it rolls."
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

function MomentumBarFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="momentum-bar"
            onReset={() => {
                setVar("momentumMass", DEFAULT_MASS);
                setVar("momentumVelocity", DEFAULT_VELOCITY);
                setVar("momentumHighlight", "");
            }}
            caption="The same momentum, measured against a scale. Drag the end of the bar instead and the trolley speeds up to match."
        >
            <MomentumBarDrawing />
            <InteractionHintSequence
                hintKey="momentum-bar-drag"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Drag the end of the teal bar",
                        position: { x: "57%", y: "50%" },
                        dragPath: { type: "line", startOffset: { x: -26, y: 0 }, endOffset: { x: 26, y: 0 } },
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
                A heavy trolley creeping along and a light trolley racing can be equally hard to stop.
                Neither <MassWord /> nor <VelocityWord /> on its own captures what an object brings
                into a collision. The quantity that does is the two multiplied together, and it is
                called{" "}
                <InlineTooltip id="tooltip-momentum-definition" color={ANSWER} bgColor={ANSWER_BG} tooltip="Momentum is mass multiplied by velocity. It measures how much motion an object carries, and it points in the direction the object is travelling.">
                    momentum
                </InlineTooltip>
                . Stack{" "}
                <InlineLinkedHighlight
                    varName="momentumHighlight"
                    highlightId="massStack"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("momentumHighlight"))}
                    color={MASS_TEXT}
                    bgColor={MASS_BG}
                >
                    amber blocks
                </InlineLinkedHighlight>{" "}
                on the trolley bed or pull its{" "}
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
                    teal bar
                </InlineLinkedHighlight>{" "}
                beside it answers.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-momentum-formula" maxWidth="xl">
        <Block id="momentum-formula" padding="lg">
            <FormulaBlock
                latex="\clr{p}{p} = \clr{m}{m} \times \clr{v}{v} = \scrub{momentumMass} \times \scrub{momentumVelocity} = \val{momentumProduct}\,\text{kg m/s}"
                colorMap={FORMULA_COLORS}
                variables={scrubVarsFromDefinitions(["momentumMass", "momentumVelocity", "momentumProduct"])}
            />
        </Block>
    </StackLayout>,

    <SplitLayout key="layout-momentum-pair" ratio="1:1" gap="lg" align="start">
        <Block id="momentum-visual" padding="sm" hasVisualization>
            <TrolleyFigure />
        </Block>
        <Block id="momentum-bar-visual" padding="sm" hasVisualization>
            <MomentumBarFigure />
        </Block>
    </SplitLayout>,

    <StackLayout key="layout-momentum-direction" maxWidth="xl">
        <Block id="momentum-direction" padding="sm">
            <EditableParagraph id="para-momentum-direction" blockId="momentum-direction">
                Direction counts as much as size. Along a straight track one direction is positive and
                the other negative, so <MomentumWord /> can be negative: a{" "}
                <InlineScrubbleNumber
                    varName="momentumMass"
                    {...numberPropsFromDefinition(getVariableInfo("momentumMass"))}
                />{" "}
                kg trolley rolling to the left carries <NegativeMomentum />, even though its mass and its
                speed are ordinary positive numbers. Add the two trolleys' signed momenta and you have
                the total the pair brings into the crash.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-momentum-question-product" maxWidth="xl">
        <Block id="momentum-question-product" padding="md">
            <EditableParagraph id="para-momentum-question-product" blockId="momentum-question-product">
                A 4 kg trolley rolling to the right at 2.5 m/s therefore carries a momentum of{" "}
                <InlineFeedback
                    varName="answerMomentumProduct"
                    correctValue="10"
                    position="terminal"
                    successMessage="— exactly, 4 multiplied by 2.5 gives 10, and the plus sign says it is heading right"
                    failureMessage="— not quite."
                    hint="Momentum is the mass and the velocity multiplied, not added"
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
                Turn that same trolley around so it rolls to the left at 2.5 m/s, and its momentum
                becomes{" "}
                <InlineFeedback
                    varName="answerMomentumDirection"
                    correctValue={["-10", "−10"]}
                    position="terminal"
                    successMessage="— right, the size is unchanged and only the sign flips, because only the direction changed"
                    failureMessage="— almost."
                    hint="The mass and the speed are the same as before, so only one thing about the answer can differ"
                    visualizationHint={{
                        blockId: "momentum-visual",
                        hintKey: "feedback-momentum-negative-hint",
                        label: "Discover it yourself",
                        resetVars: { momentumMass: 3, momentumVelocity: 2 },
                        steps: [
                            {
                                gesture: "drag-vertical",
                                label: "Drag the top of the block stack up until the trolley carries 4 kg",
                                position: { x: "47%", y: "48%" },
                                completionVar: "momentumMass",
                                completionValue: 4,
                                completionTolerance: 0.4,
                            },
                            {
                                gesture: "drag-horizontal",
                                label: "Now pull the indigo arrow left past zero to 2.5 m/s the other way, and read the bar",
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
