import React, { useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { SplitLayout, StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InteractionHintSequence,
} from "@/components/atoms";
import { Figure, FormulaBlock } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, lerp, remap, useSpring, type Vec2 } from "@/lib/motion";
import {
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
} from "../variables";
import {
    EASE_150,
    FORMULA_COLORS,
    HEAVY_BG,
    HEAVY_EDGE,
    HEAVY_FILL,
    INK,
    INK_QUIET,
    INK_STRUCTURE,
    LIGHT_BG,
    LIGHT_EDGE,
    LIGHT_FILL,
    MASS_BG,
    MASS_TEXT,
    MOMENTUM_BG,
    MOMENTUM_TEXT,
    VELOCITY,
    VELOCITY_BG,
    VELOCITY_TEXT,
} from "./collisionPalette";
import { HeavyWord, LightWord } from "./lessonWords";
import { MomentumLedger } from "./momentumLedger";

// ── The worked case ──────────────────────────────────────────────────────────
const HEAVY_MASS = 2;
const HEAVY_VELOCITY = 3;
const LIGHT_MASS = 1;
const LIGHT_VELOCITY = -1.2;
const TOTAL_MOMENTUM = HEAVY_MASS * HEAVY_VELOCITY + LIGHT_MASS * LIGHT_VELOCITY; // 4.8
const TOTAL_MASS = HEAVY_MASS + LIGHT_MASS; // 3
const FINAL_VELOCITY = TOTAL_MOMENTUM / TOTAL_MASS; // 1.6

// ── View geometry (view A) ───────────────────────────────────────────────────
const VIEW_WIDTH = 380;
const VIEW_HEIGHT = 340;
const TRACK_Y = 170;
const RAIL_Y = 206;
const RAIL_LEFT = 60;
const RAIL_RIGHT = 320;
const PX_PER_VELOCITY = 22;
const ARROW_Y = TRACK_Y - 70;

// Momentum ledger under the rail — same zero mark at every stage
const LEDGER_TOP = 246;
const LEDGER_ANCHOR_X = 70;
const LEDGER_PX_PER_UNIT = 28;

const HEAVY_CONTACT_X = 160;
const LIGHT_CONTACT_X = 220;
const HEAVY_START_X = 70;
const LIGHT_START_X = 265;
const JOINED_TRAVEL = 90;

const STAGE_LABELS = ["approach", "contact", "one lump", "moving off"];

const formatVelocity = (value: number) => `${value.toFixed(1)} m/s`;

// ── Shared highlight helpers — used by BOTH views ────────────────────────────
const useHighlightState = () => {
    const highlight = useVar<string>("workedHighlight", "");
    const setVar = useSetVar();
    return {
        opacity: (id: string) => (highlight && highlight !== id ? 0.35 : 1),
        weight: (id: string, resting: number) => (highlight === id ? resting * 1.6 : resting),
        isActive: (id: string) => highlight === id,
        hoverProps: (id: string) => ({
            onPointerEnter: () => setVar("workedHighlight", id),
            onPointerLeave: () => setVar("workedHighlight", ""),
        }),
    };
};

const svgPointFromEvent = (event: React.PointerEvent, svg: SVGSVGElement | null): Vec2 => {
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
        x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
    };
};

function Trolley({
    centerX,
    width,
    height,
    label,
    stroke,
    strokeWidth,
    fill,
}: {
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
            {label && (
                <text x={centerX} y={bodyTop + height / 2 + 4} fill={stroke} fontSize="12" fontWeight="600" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {label}
                </text>
            )}
        </g>
    );
}

/** An indigo velocity arrow with its size written above it. */
function VelocityArrow({ fromX, velocity, strokeWidth, opacity }: { fromX: number; velocity: number; strokeWidth: number; opacity: number }) {
    if (opacity < 0.02) return null;
    const tipX = fromX + velocity * PX_PER_VELOCITY;
    const direction = velocity >= 0 ? 1 : -1;
    return (
        <g opacity={opacity}>
            <line x1={fromX} y1={ARROW_Y} x2={tipX} y2={ARROW_Y} stroke={VELOCITY} strokeWidth={strokeWidth} strokeLinecap="round" />
            <polygon points={`${tipX + direction * 9},${ARROW_Y} ${tipX - direction * 2},${ARROW_Y - 6} ${tipX - direction * 2},${ARROW_Y + 6}`} fill={VELOCITY} />
            <text x={(fromX + tipX) / 2} y={ARROW_Y - 9} fill={VELOCITY_TEXT} fontSize="11" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatVelocity(Math.abs(velocity))}
            </text>
        </g>
    );
}

// ── VIEW A: the crash, frozen wherever the handle sits ───────────────────────
function CrashStageDrawing() {
    const setVar = useSetVar();
    const stage = useVar<number>("workedStage", 0);
    const highlight = useHighlightState();
    const { opacity, weight, isActive, hoverProps } = highlight;

    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const handleScale = useSpring(dragging || hovered ? 1.15 : 1, { stiffness: 400, damping: 26 });

    const approach = clamp(stage, 0, 1);
    const departure = clamp(stage - 2, 0, 1);
    const travel = departure * JOINED_TRAVEL;

    const heavyX = lerp(HEAVY_START_X, HEAVY_CONTACT_X, approach) + travel;
    const lightX = lerp(LIGHT_START_X, LIGHT_CONTACT_X, approach) + travel;
    const pairX = (heavyX + lightX) / 2;

    const incomingArrows = 1 - approach;
    const locked = stage >= 1.98;
    const heavyId = locked ? "workedPair" : "workedHeavy";
    const lightId = locked ? "workedPair" : "workedLight";

    const handleX = remap(clamp(stage, 0, 3), 0, 3, RAIL_LEFT, RAIL_RIGHT);

    const handlePointerMove = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!draggingRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        setVar("workedStage", clamp(remap(point.x, RAIL_LEFT, RAIL_RIGHT, 0, 3), 0, 3));
    };

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="A 2 kg trolley and a 1 kg trolley frozen at a chosen moment of their collision, with a handle to move through the stages"
        >
            <defs>
                <filter id="worked-handle-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}>
                <text x="24" y="30" fill={HEAVY_EDGE} opacity={opacity("workedHeavy")}>
                    heavy 2 kg · 3.0 m/s
                </text>
                <text x={VIEW_WIDTH - 24} y="30" fill={LIGHT_EDGE} textAnchor="end" opacity={opacity("workedLight")}>
                    light 1 kg · 1.2 m/s
                </text>
            </g>

            <g opacity={opacity("__structure")} style={EASE_150}>
                <line x1="24" y1={TRACK_Y} x2={VIEW_WIDTH - 24} y2={TRACK_Y} stroke={INK_QUIET} strokeWidth="1.5" />
            </g>

            {/* HEAVY — its counterpart is the 2 × 3 term in the working */}
            <g {...hoverProps(heavyId)} opacity={opacity(heavyId)} style={EASE_150}>
                {isActive(heavyId) && (
                    <g opacity={0.28}>
                        <Trolley centerX={heavyX} width={70} height={28} label="" stroke={HEAVY_EDGE} strokeWidth={9} fill="none" />
                    </g>
                )}
                <Trolley centerX={heavyX} width={70} height={28} label="2 kg" stroke={HEAVY_EDGE} fill={HEAVY_FILL} strokeWidth={weight(heavyId, 1.5)} />
                <VelocityArrow fromX={heavyX} velocity={HEAVY_VELOCITY} strokeWidth={weight(heavyId, 2.5)} opacity={incomingArrows} />
            </g>

            {/* LIGHT — its counterpart is the 1 × (−1.2) term */}
            <g {...hoverProps(lightId)} opacity={opacity(lightId)} style={EASE_150}>
                {isActive(lightId) && (
                    <g opacity={0.28}>
                        <Trolley centerX={lightX} width={50} height={24} label="" stroke={LIGHT_EDGE} strokeWidth={9} fill="none" />
                    </g>
                )}
                <Trolley centerX={lightX} width={50} height={24} label="1 kg" stroke={LIGHT_EDGE} fill={LIGHT_FILL} strokeWidth={weight(lightId, 1.5)} />
                <VelocityArrow fromX={lightX} velocity={LIGHT_VELOCITY} strokeWidth={weight(lightId, 2.5)} opacity={incomingArrows} />
            </g>

            {/* PAIR — one lump of 3 kg, counterpart of the (2 + 1) and 1.6 terms */}
            {stage >= 1.5 && (
                <g {...hoverProps("workedPair")} opacity={opacity("workedPair")} style={EASE_150}>
                    {isActive("workedPair") && (
                        <line x1={heavyX - 35} y1={TRACK_Y - 46} x2={lightX + 25} y2={TRACK_Y - 46} stroke={MASS_TEXT} strokeWidth="9" opacity={0.28} strokeLinecap="round" />
                    )}
                    <line x1={heavyX - 35} y1={TRACK_Y - 46} x2={lightX + 25} y2={TRACK_Y - 46} stroke={INK_STRUCTURE} strokeWidth={weight("workedPair", 2.5)} strokeLinecap="round" />
                    <text x={pairX} y={TRACK_Y - 52} fill={MASS_TEXT} fontSize="12" fontWeight="600" textAnchor="middle">
                        3 kg
                    </text>
                    <VelocityArrow fromX={pairX} velocity={FINAL_VELOCITY} strokeWidth={weight("workedPair", 3)} opacity={departure} />
                </g>
            )}

            {/* The stage rail — four ticks, the same four the working shows */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <line x1={RAIL_LEFT} y1={RAIL_Y} x2={RAIL_RIGHT} y2={RAIL_Y} stroke={INK_QUIET} strokeWidth="1.5" strokeLinecap="round" />
                {STAGE_LABELS.map((label, index) => {
                    const x = remap(index, 0, 3, RAIL_LEFT, RAIL_RIGHT);
                    const active = Math.round(clamp(stage, 0, 3)) === index;
                    return (
                        <g key={label}>
                            <circle cx={x} cy={RAIL_Y} r="4" fill={active ? INK_STRUCTURE : INK_QUIET} />
                            <text x={clamp(x, 50, 330)} y={RAIL_Y + 20} fill={active ? INK : INK_STRUCTURE} fontSize="10" textAnchor="middle">
                                {label}
                            </text>
                        </g>
                    );
                })}
            </g>

            <g transform={`translate(${handleX} ${RAIL_Y}) scale(${handleScale})`}>
                <circle r="8" fill={INK_STRUCTURE} filter="url(#worked-handle-shadow)" />
            </g>
            <circle
                cx={handleX}
                cy={RAIL_Y}
                r="22"
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

            {/* Momentum ledger: the two terms tip to tail, and the total the lump carries away */}
            <MomentumLedger
                anchorX={LEDGER_ANCHOR_X}
                top={LEDGER_TOP}
                pxPerUnit={LEDGER_PX_PER_UNIT}
                heavyMomentum={HEAVY_MASS * HEAVY_VELOCITY}
                lightMomentum={LIGHT_MASS * LIGHT_VELOCITY}
                locked={locked}
                pairMass={TOTAL_MASS}
                pairVelocity={FINAL_VELOCITY}
                highlight={highlight}
                ids={{ heavy: "workedHeavy", light: "workedLight", total: locked ? "workedPair" : "workedTotal" }}
            />
        </svg>
    );
}

// ── VIEW B: the four lines of working, lit one at a time ─────────────────────
function WorkingTerm({ id, hue, bg, children }: { id: string; hue: string; bg: string; children: React.ReactNode }) {
    const { opacity, isActive, hoverProps } = useHighlightState();
    return (
        <span
            {...hoverProps(id)}
            style={{
                opacity: opacity(id),
                color: hue,
                fontWeight: isActive(id) ? 600 : 500,
                backgroundColor: isActive(id) ? bg : "transparent",
                borderRadius: 4,
                padding: "1px 3px",
                transition: "opacity 150ms ease, color 150ms ease, background-color 150ms ease",
                cursor: "default",
            }}
        >
            {children}
        </span>
    );
}

function PlainText({ children }: { children: React.ReactNode }) {
    const highlight = useVar<string>("workedHighlight", "");
    return (
        <span style={{ opacity: highlight ? 0.35 : 1, transition: "opacity 150ms ease" }}>
            {children}
        </span>
    );
}

function WorkingLines() {
    const setVar = useSetVar();
    const stage = useVar<number>("workedStage", 0);
    const activeRow = Math.round(clamp(stage, 0, 3));

    const rows: { key: string; content: React.ReactNode }[] = [
        {
            key: "before",
            content: (
                <>
                    <PlainText>momentum in = </PlainText>
                    <WorkingTerm id="workedHeavy" hue={HEAVY_EDGE} bg={HEAVY_BG}>2 × 3</WorkingTerm>
                    <PlainText> + </PlainText>
                    <WorkingTerm id="workedLight" hue={LIGHT_EDGE} bg={LIGHT_BG}>1 × (−1.2)</WorkingTerm>
                </>
            ),
        },
        {
            key: "total",
            content: (
                <>
                    <PlainText>momentum in = </PlainText>
                    <WorkingTerm id="workedHeavy" hue={HEAVY_EDGE} bg={HEAVY_BG}>6</WorkingTerm>
                    <PlainText> − </PlainText>
                    <WorkingTerm id="workedLight" hue={LIGHT_EDGE} bg={LIGHT_BG}>1.2</WorkingTerm>
                    <PlainText> = </PlainText>
                    <WorkingTerm id="workedTotal" hue={MOMENTUM_TEXT} bg={MOMENTUM_BG}>4.8 kg m/s</WorkingTerm>
                </>
            ),
        },
        {
            key: "share",
            content: (
                <>
                    <WorkingTerm id="workedPair" hue={MOMENTUM_TEXT} bg={MOMENTUM_BG}>4.8</WorkingTerm>
                    <PlainText> = </PlainText>
                    <WorkingTerm id="workedPair" hue={MASS_TEXT} bg={MASS_BG}>(2 + 1)</WorkingTerm>
                    <PlainText> × </PlainText>
                    <WorkingTerm id="workedPair" hue={VELOCITY_TEXT} bg={VELOCITY_BG}>v</WorkingTerm>
                </>
            ),
        },
        {
            key: "solve",
            content: (
                <>
                    <WorkingTerm id="workedPair" hue={VELOCITY_TEXT} bg={VELOCITY_BG}>v</WorkingTerm>
                    <PlainText> = </PlainText>
                    <WorkingTerm id="workedPair" hue={MOMENTUM_TEXT} bg={MOMENTUM_BG}>4.8</WorkingTerm>
                    <PlainText> ÷ </PlainText>
                    <WorkingTerm id="workedPair" hue={MASS_TEXT} bg={MASS_BG}>3</WorkingTerm>
                    <PlainText> = </PlainText>
                    <WorkingTerm id="workedPair" hue={VELOCITY_TEXT} bg={VELOCITY_BG}>1.6 m/s</WorkingTerm>
                </>
            ),
        },
    ];

    return (
        <div className="px-6 py-6 space-y-3">
            {rows.map((row, index) => {
                const active = index === activeRow;
                return (
                    <button
                        key={row.key}
                        type="button"
                        onClick={() => setVar("workedStage", index)}
                        className="w-full text-left flex items-center gap-3 py-2"
                        style={{ opacity: active ? 1 : 0.38, transition: "opacity 150ms ease" }}
                    >
                        <span
                            aria-hidden
                            style={{
                                width: 3,
                                alignSelf: "stretch",
                                borderRadius: 2,
                                backgroundColor: active ? INK_STRUCTURE : "transparent",
                            }}
                        />
                        <span
                            aria-hidden
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                backgroundColor: active ? INK_STRUCTURE : INK_QUIET,
                                flexShrink: 0,
                            }}
                        />
                        <span
                            style={{
                                color: INK,
                                fontSize: 15,
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {row.content}
                        </span>
                    </button>
                );
            })}
            <div style={{ color: INK_STRUCTURE, fontSize: 12, paddingLeft: 22 }}>
                {STAGE_LABELS[activeRow]}
            </div>
        </div>
    );
}

// ── Figure shells ────────────────────────────────────────────────────────────
function CrashStageFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="worked-crash-stages"
            onReset={() => {
                setVar("workedStage", 0);
                setVar("workedHighlight", "");
            }}
            caption="Drag the handle along the rail to step through the crash and back. The bars below add the blue and pink momenta end to end. The teal total is what the lump carries away."
        >
            <CrashStageDrawing />
            <InteractionHintSequence
                hintKey="worked-stage-drag"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Drag the handle to step through the crash",
                        position: { x: "16%", y: "50%" },
                        dragPath: { type: "line", startOffset: { x: -26, y: 0 }, endOffset: { x: 26, y: 0 } },
                    },
                ]}
            />
        </Figure>
    );
}

function WorkingLinesFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="worked-working-lines"
            onReset={() => {
                setVar("workedStage", 0);
                setVar("workedHighlight", "");
            }}
            caption="The same four moments, written out. Click a line to jump the trolleys to that moment, or hover over a number to find it on the track."
        >
            <WorkingLines />
            <InteractionHintSequence
                hintKey="worked-lines-click"
                steps={[
                    {
                        gesture: "click",
                        label: "Click a line to jump to that moment",
                        position: { x: "45%", y: "40%" },
                    },
                ]}
            />
        </Figure>
    );
}

export const workedExampleBlocks: ReactElement[] = [
    <StackLayout key="layout-worked-heading" maxWidth="xl">
        <Block id="worked-heading" padding="md">
            <EditableH2 id="h2-worked-heading" blockId="worked-heading">
                Working It Out Step by Step
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-worked-example" maxWidth="xl">
        <Block id="worked-example" padding="sm">
            <EditableParagraph id="para-worked-example" blockId="worked-example">
                Here is the whole method on one example. A 2 kg <HeavyWord /> moving right at 3 m/s
                meets a 1 kg <LightWord /> moving left at 1.2 m/s, and they stick. Drag the handle under
                the track through the crash, and the line of working for each moment lights up beside it.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-worked-formula" maxWidth="xl">
        <Block id="worked-formula" padding="lg">
            <FormulaBlock
                latex="\clr{v}{v} = \frac{\clr{heavy}{m_1 u_1} + \clr{light}{m_2 u_2}}{\clr{m}{m_1 + m_2}}"
                colorMap={FORMULA_COLORS}
            />
        </Block>
    </StackLayout>,

    <SplitLayout key="layout-worked-pair" ratio="1:1" gap="lg" align="start">
        <Block id="worked-visual" padding="sm" hasVisualization>
            <CrashStageFigure />
        </Block>
        <Block id="worked-working-visual" padding="sm" hasVisualization>
            <WorkingLinesFigure />
        </Block>
    </SplitLayout>,

    <StackLayout key="layout-worked-pattern" maxWidth="xl">
        <Block id="worked-pattern" padding="sm">
            <EditableParagraph id="para-worked-pattern" blockId="worked-pattern">
                The steps are always the same. Add the momenta before the crash, keeping their plus and
                minus signs. Divide by the total mass. Keep the sign of the answer. The signs are the part
                to check: the{" "}
                <InlineLinkedHighlight
                    varName="workedHighlight"
                    highlightId="workedLight"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("workedHighlight"))}
                    color={LIGHT_EDGE}
                    bgColor={LIGHT_BG}
                >
                    light trolley
                </InlineLinkedHighlight>{" "}
                moves left, so its 1.2 m/s counts as negative. That is why the{" "}
                <InlineLinkedHighlight
                    varName="workedHighlight"
                    highlightId="workedTotal"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("workedHighlight"))}
                    color={MOMENTUM_TEXT}
                    bgColor={MOMENTUM_BG}
                >
                    total
                </InlineLinkedHighlight>{" "}
                is 4.8, not 7.2.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-worked-question-pair" maxWidth="xl">
        <Block id="worked-question-pair" padding="md">
            <EditableParagraph id="para-worked-question-pair" blockId="worked-question-pair">
                Now try a new pair. A 5 kg trolley rolling right at 2 m/s sticks to a 3 kg trolley
                coming the other way at 2 m/s. The joined pair leaves at{" "}
                <InlineFeedback
                    varName="answerWorkedPairSpeed"
                    correctValue={["0.5", ".5", "0.50"]}
                    position="terminal"
                    successMessage="— yes, 10 going right minus 6 going left leaves 4 kg m/s, shared by 8 kg, so 4 ÷ 8 = 0.5"
                    failureMessage="— not quite."
                    hint="Find each trolley's momentum first. Give the one moving left a minus sign"
                >
                    <InlineClozeInput
                        varName="answerWorkedPairSpeed"
                        correctAnswer={["0.5", ".5", "0.50"]}
                        {...clozePropsFromDefinition(getVariableInfo("answerWorkedPairSpeed"))}
                    />
                </InlineFeedback>{" "}
                m/s to the right.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-worked-question-negative" maxWidth="xl">
        <Block id="worked-question-negative" padding="md">
            <EditableParagraph id="para-worked-question-negative" blockId="worked-question-negative">
                Now send the same 3 kg trolley in at 6 m/s instead. The pair's velocity becomes{" "}
                <InlineFeedback
                    varName="answerWorkedNegative"
                    correctValue={["-1", "−1", "-1.0"]}
                    position="terminal"
                    successMessage="— right, 10 minus 18 is −8, and −8 ÷ 8 = −1, so the pair heads left"
                    failureMessage="— close."
                    hint="This time the momentum going left is bigger than the momentum going right"
                >
                    <InlineClozeInput
                        varName="answerWorkedNegative"
                        correctAnswer={["-1", "−1", "-1.0"]}
                        {...clozePropsFromDefinition(getVariableInfo("answerWorkedNegative"))}
                    />
                </InlineFeedback>{" "}
                m/s.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
