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
const VIEW_HEIGHT = 260;
const TRACK_Y = 170;
const RAIL_Y = 214;
const RAIL_LEFT = 60;
const RAIL_RIGHT = 320;
const PX_PER_VELOCITY = 22;

const HEAVY_CONTACT_X = 160;
const LIGHT_CONTACT_X = 220;
const HEAVY_START_X = 70;
const LIGHT_START_X = 265;
const JOINED_TRAVEL = 90;

const INK = "#334155";
const INK_STRUCTURE = "#64748B";
const INK_QUIET = "#CBD5E1";
const PAPER = "#F1F5F9";
const ACCENT = "#62D0AD";
const VELOCITY_HUE = "#8E90F5";

const STAGE_LABELS = ["approach", "contact", "one lump", "moving off"];

const formatVelocity = (value: number) => `${value.toFixed(1)} m/s`;

// ── Shared highlight helpers — used by BOTH views ────────────────────────────
const EASE_150 = { transition: "opacity 150ms ease, stroke-width 150ms ease" } as const;

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
    fill = PAPER,
}: {
    centerX: number;
    width: number;
    height: number;
    label: string;
    stroke: string;
    strokeWidth: number;
    fill?: string;
}) {
    const bodyTop = TRACK_Y - 10 - height;
    return (
        <g>
            <rect x={centerX - width / 2} y={bodyTop} width={width} height={height} rx="4" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <circle cx={centerX - width / 2 + 12} cy={TRACK_Y - 8} r="7" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <circle cx={centerX + width / 2 - 12} cy={TRACK_Y - 8} r="7" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <text x={centerX} y={bodyTop + height / 2 + 4} fill={INK} fontSize="12" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                {label}
            </text>
        </g>
    );
}

// ── VIEW A: the crash, frozen wherever the handle sits ───────────────────────
function CrashStageDrawing() {
    const setVar = useSetVar();
    const stage = useVar<number>("workedStage", 0);
    const { opacity, weight, isActive, hoverProps } = useHighlightState();

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
    const armY = TRACK_Y - 24;

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
                <text x="24" y="30" fill={INK} opacity={opacity("heavy")}>
                    2 kg · 3.0 m/s right
                </text>
                <text x={VIEW_WIDTH - 24} y="30" fill={INK} textAnchor="end" opacity={opacity("light")}>
                    1 kg · 1.2 m/s left
                </text>
            </g>

            <g opacity={opacity("__structure")} style={EASE_150}>
                <line x1="24" y1={TRACK_Y} x2={VIEW_WIDTH - 24} y2={TRACK_Y} stroke={INK_QUIET} strokeWidth="1.5" />
            </g>

            {/* HEAVY — its counterpart is the 2 × 3 term in the working */}
            <g {...hoverProps("heavy")} opacity={opacity("heavy")} style={EASE_150}>
                {isActive("heavy") && (
                    <g opacity={0.28}>
                        <Trolley centerX={heavyX} width={70} height={28} label="" stroke={ACCENT} strokeWidth={9} fill="none" />
                    </g>
                )}
                <Trolley centerX={heavyX} width={70} height={28} label="2 kg" stroke={locked ? ACCENT : INK_STRUCTURE} strokeWidth={weight("heavy", 1.5)} />
                {incomingArrows > 0.02 && (
                    <g opacity={incomingArrows}>
                        <line x1={heavyX} y1={armY} x2={heavyX + HEAVY_VELOCITY * PX_PER_VELOCITY} y2={armY} stroke={VELOCITY_HUE} strokeWidth={weight("heavy", 2.5)} strokeLinecap="round" />
                        <polygon points={`${heavyX + HEAVY_VELOCITY * PX_PER_VELOCITY + 9},${armY} ${heavyX + HEAVY_VELOCITY * PX_PER_VELOCITY - 2},${armY - 6} ${heavyX + HEAVY_VELOCITY * PX_PER_VELOCITY - 2},${armY + 6}`} fill={VELOCITY_HUE} />
                    </g>
                )}
            </g>

            {/* LIGHT — its counterpart is the 1 × (−1.2) term */}
            <g {...hoverProps("light")} opacity={opacity("light")} style={EASE_150}>
                {isActive("light") && (
                    <g opacity={0.28}>
                        <Trolley centerX={lightX} width={50} height={24} label="" stroke={ACCENT} strokeWidth={9} fill="none" />
                    </g>
                )}
                <Trolley centerX={lightX} width={50} height={24} label="1 kg" stroke={locked ? ACCENT : INK_STRUCTURE} strokeWidth={weight("light", 1.5)} />
                {incomingArrows > 0.02 && (
                    <g opacity={incomingArrows}>
                        <line x1={lightX} y1={armY} x2={lightX + LIGHT_VELOCITY * PX_PER_VELOCITY} y2={armY} stroke={VELOCITY_HUE} strokeWidth={weight("light", 2.5)} strokeLinecap="round" />
                        <polygon points={`${lightX + LIGHT_VELOCITY * PX_PER_VELOCITY - 9},${armY} ${lightX + LIGHT_VELOCITY * PX_PER_VELOCITY + 2},${armY - 6} ${lightX + LIGHT_VELOCITY * PX_PER_VELOCITY + 2},${armY + 6}`} fill={VELOCITY_HUE} />
                    </g>
                )}
            </g>

            {/* PAIR — one lump of 3 kg, counterpart of the (2 + 1) and 1.6 terms */}
            {stage >= 1.5 && (
                <g {...hoverProps("pair")} opacity={opacity("pair")} style={EASE_150}>
                    {isActive("pair") && (
                        <line x1={heavyX - 35} y1={TRACK_Y - 52} x2={lightX + 25} y2={TRACK_Y - 52} stroke={ACCENT} strokeWidth="9" opacity={0.28} strokeLinecap="round" />
                    )}
                    <line x1={heavyX - 35} y1={TRACK_Y - 52} x2={lightX + 25} y2={TRACK_Y - 52} stroke={ACCENT} strokeWidth={weight("pair", 2.5)} strokeLinecap="round" />
                    <text x={pairX} y={TRACK_Y - 60} fill={ACCENT} fontSize="12" textAnchor="middle">
                        3 kg
                    </text>
                    {departure > 0.02 && (
                        <g opacity={departure}>
                            <line x1={pairX} y1={armY} x2={pairX + FINAL_VELOCITY * PX_PER_VELOCITY} y2={armY} stroke={ACCENT} strokeWidth={weight("pair", 3)} strokeLinecap="round" />
                            <polygon points={`${pairX + FINAL_VELOCITY * PX_PER_VELOCITY + 9},${armY} ${pairX + FINAL_VELOCITY * PX_PER_VELOCITY - 2},${armY - 6} ${pairX + FINAL_VELOCITY * PX_PER_VELOCITY - 2},${armY + 6}`} fill={ACCENT} />
                            <text x={clamp(pairX, 80, 300)} y={TRACK_Y + 26} fill={ACCENT} fontSize="12" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                                {formatVelocity(FINAL_VELOCITY)}
                            </text>
                        </g>
                    )}
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
                            <circle cx={x} cy={RAIL_Y} r="4" fill={active ? ACCENT : INK_QUIET} />
                            <text x={clamp(x, 50, 330)} y={RAIL_Y + 20} fill={active ? INK : INK_STRUCTURE} fontSize="10" textAnchor="middle">
                                {label}
                            </text>
                        </g>
                    );
                })}
            </g>

            <g transform={`translate(${handleX} ${RAIL_Y}) scale(${handleScale})`}>
                <circle r="8" fill={ACCENT} filter="url(#worked-handle-shadow)" />
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
        </svg>
    );
}

// ── VIEW B: the four lines of working, lit one at a time ─────────────────────
function WorkingTerm({ id, children }: { id: string; children: React.ReactNode }) {
    const { opacity, isActive, hoverProps } = useHighlightState();
    return (
        <span
            {...hoverProps(id)}
            style={{
                opacity: opacity(id),
                color: isActive(id) ? ACCENT : "inherit",
                fontWeight: isActive(id) ? 600 : 400,
                backgroundColor: isActive(id) ? "rgba(98, 208, 173, 0.22)" : "transparent",
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
                    <WorkingTerm id="heavy">2 × 3</WorkingTerm>
                    <PlainText> + </PlainText>
                    <WorkingTerm id="light">1 × (−1.2)</WorkingTerm>
                </>
            ),
        },
        {
            key: "total",
            content: <PlainText>momentum in = 6 − 1.2 = 4.8 kg m/s</PlainText>,
        },
        {
            key: "share",
            content: (
                <>
                    <PlainText>4.8 = </PlainText>
                    <WorkingTerm id="pair">(2 + 1)</WorkingTerm>
                    <PlainText> × v</PlainText>
                </>
            ),
        },
        {
            key: "solve",
            content: (
                <>
                    <PlainText>v = 4.8 ÷ 3 = </PlainText>
                    <WorkingTerm id="pair">1.6 m/s</WorkingTerm>
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
                                backgroundColor: active ? ACCENT : "transparent",
                            }}
                        />
                        <span
                            aria-hidden
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                backgroundColor: active ? ACCENT : INK_QUIET,
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
            caption="Drag the handle along the rail to walk the crash from approach to lock-up and back again."
        >
            <CrashStageDrawing />
            <InteractionHintSequence
                hintKey="worked-stage-drag"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Drag the handle to move through the crash",
                        position: { x: "16%", y: "82%" },
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
            caption="The same four moments, written out. Click a line to jump the trolleys to it, or hover a term to find it on the track."
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
                Here is the whole method on one case. A 2 kg trolley moving right at 3 m/s meets a 1 kg
                trolley moving left at 1.2 m/s, and the magnets catch. Drag the handle under the track
                from approach to lock-up, and the line of working that belongs to each moment lights up
                beside it.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-worked-formula" maxWidth="xl">
        <Block id="worked-formula" padding="lg">
            <FormulaBlock latex="v = \frac{m_1 v_1 + m_2 v_2}{m_1 + m_2}" />
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
                The pattern never changes. Add the signed momenta before the crash, divide by the total
                mass, and keep the sign that comes out. That sign is the part worth checking: the 1.2 m/s
                the{" "}
                <InlineLinkedHighlight
                    varName="workedHighlight"
                    highlightId="light"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("workedHighlight"))}
                >
                    light trolley
                </InlineLinkedHighlight>{" "}
                brings in counts as negative, which is why the total falls to 4.8 instead of climbing to
                7.2.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-worked-question-pair" maxWidth="xl">
        <Block id="worked-question-pair" padding="md">
            <EditableParagraph id="para-worked-question-pair" blockId="worked-question-pair">
                Now a fresh pair. A 5 kg trolley rolling right at 2 m/s locks onto a 3 kg trolley coming
                the other way at 2 m/s, so the joined pair leaves at{" "}
                <InlineFeedback
                    varName="answerWorkedPairSpeed"
                    correctValue={["0.5", ".5", "0.50"]}
                    position="terminal"
                    successMessage="— exactly, 10 going right and 6 going left leave 4 kg m/s for 8 kg to carry"
                    failureMessage="— not quite."
                    hint="Work out each trolley's momentum first, and give the one coming the other way a minus sign"
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
                Send that same 3 kg trolley in at 6 m/s instead, and the pair's velocity becomes{" "}
                <InlineFeedback
                    varName="answerWorkedNegative"
                    correctValue={["-1", "−1", "-1.0"]}
                    position="terminal"
                    successMessage="— right, 10 minus 18 is negative, so the whole pair reverses and heads left"
                    failureMessage="— close."
                    hint="This time the momentum coming the other way is the larger of the two"
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
