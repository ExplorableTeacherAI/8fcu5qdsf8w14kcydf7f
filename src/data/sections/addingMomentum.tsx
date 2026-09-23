import React, { useEffect, useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InlineScrubbleNumber,
    InteractionHintSequence,
} from "@/components/atoms";
import { Figure, FormulaBlock } from "@/components/molecules";
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
    EASE_150,
    FORMULA_COLORS,
    HEAVY_EDGE,
    HEAVY_FILL,
    INK_QUIET,
    LIGHT_EDGE,
    LIGHT_FILL,
    MOMENTUM,
    MOMENTUM_BG,
    MOMENTUM_TEXT,
    VELOCITY,
    VELOCITY_TEXT,
} from "./collisionPalette";
import { HeavyWord, LightWord, LivePill } from "./lessonWords";
import { MomentumLedger, formatMomentum } from "./momentumLedger";

// ── The model: two trolleys, still before the crash ──────────────────────────
const HEAVY_MASS = 3;
const LIGHT_MASS = 1;
const DEFAULT_HEAVY_VELOCITY = 2;
const DEFAULT_LIGHT_VELOCITY = -3;
const MAX_VELOCITY = 3;

const totalMomentum = (heavyVelocity: number, lightVelocity: number) =>
    HEAVY_MASS * heavyVelocity + LIGHT_MASS * lightVelocity;

// ── View geometry ────────────────────────────────────────────────────────────
const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 300;
const TRACK_Y = 156;
const HEAVY_X = 170;
const LIGHT_X = 390;
const PX_PER_VELOCITY = 22;
const ARROW_Y = TRACK_Y - 56;

const LEDGER_TOP = TRACK_Y + 42;
const LEDGER_ANCHOR_X = 280;
const LEDGER_PX_PER_UNIT = 16;

const formatSpeed = (value: number) => `${value.toFixed(1)} m/s`;

const useHighlightState = () => {
    const highlight = useVar<string>("addHighlight", "");
    const setVar = useSetVar();
    return {
        opacity: (id: string) => (highlight && highlight !== id ? 0.35 : 1),
        weight: (id: string, resting: number) => (highlight === id ? resting * 1.6 : resting),
        isActive: (id: string) => highlight === id,
        hoverProps: (id: string) => ({
            onPointerEnter: () => setVar("addHighlight", id),
            onPointerLeave: () => setVar("addHighlight", ""),
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

function Trolley({ centerX, width, height, label, stroke, fill, strokeWidth }: {
    centerX: number;
    width: number;
    height: number;
    label: string;
    stroke: string;
    fill: string;
    strokeWidth: number;
}) {
    const bodyTop = TRACK_Y - 10 - height;
    return (
        <g>
            <rect x={centerX - width / 2} y={bodyTop} width={width} height={height} rx="4" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <circle cx={centerX - width / 2 + 14} cy={TRACK_Y - 8} r="8" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <circle cx={centerX + width / 2 - 14} cy={TRACK_Y - 8} r="8" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <text x={centerX} y={bodyTop + height / 2 + 4} fill={stroke} fontSize="12" fontWeight="600" textAnchor="middle">
                {label}
            </text>
        </g>
    );
}

/** One draggable indigo velocity arrow above a trolley. */
function DraggableArrow({ fromX, varName, velocity, strokeWidth, svgRef }: {
    fromX: number;
    varName: string;
    velocity: number;
    strokeWidth: number;
    svgRef: React.RefObject<SVGSVGElement | null>;
}) {
    const setVar = useSetVar();
    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const handleScale = useSpring(dragging || hovered ? 1.15 : 1, { stiffness: 400, damping: 26 });

    const tipX = fromX + velocity * PX_PER_VELOCITY;
    const direction = velocity >= 0 ? 1 : -1;
    const visible = Math.abs(velocity) > 0.05;

    const handlePointerMove = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!draggingRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        const raw = (point.x - fromX) / PX_PER_VELOCITY;
        setVar(varName, clamp(Math.round(raw * 10) / 10, -MAX_VELOCITY, MAX_VELOCITY));
    };

    return (
        <g>
            {visible && (
                <>
                    <line x1={fromX} y1={ARROW_Y} x2={tipX} y2={ARROW_Y} stroke={VELOCITY} strokeWidth={strokeWidth} strokeLinecap="round" />
                    <polygon points={`${tipX + direction * 9},${ARROW_Y} ${tipX - direction * 2},${ARROW_Y - 6} ${tipX - direction * 2},${ARROW_Y + 6}`} fill={VELOCITY} />
                </>
            )}
            <text x={fromX} y={ARROW_Y - 12} fill={VELOCITY_TEXT} fontSize="11" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatSpeed(velocity)}
            </text>
            <g transform={`translate(${tipX} ${ARROW_Y}) scale(${handleScale})`}>
                <circle r="7" fill={VELOCITY} filter="url(#adding-handle-shadow)" />
            </g>
            <circle
                cx={tipX}
                cy={ARROW_Y}
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
        </g>
    );
}

function AddingDrawing() {
    const setVar = useSetVar();
    const heavyVelocity = useVar<number>("addHeavyVelocity", DEFAULT_HEAVY_VELOCITY);
    const lightVelocity = useVar<number>("addLightVelocity", DEFAULT_LIGHT_VELOCITY);
    const highlight = useHighlightState();
    const { opacity, weight, hoverProps } = highlight;
    const svgRef = useRef<SVGSVGElement>(null);

    const total = totalMomentum(heavyVelocity, lightVelocity);
    useEffect(() => {
        setVar("addTotalMomentum", Number(total.toFixed(1)));
    }, [total, setVar]);

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="A heavy and a light trolley on a track, each with a draggable velocity arrow, and a ledger beneath that adds their momenta tip to tail"
        >
            <defs>
                <filter id="adding-handle-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}>
                <text x="24" y="28" fill={HEAVY_EDGE} opacity={opacity("addHeavy")}>
                    {`heavy 3 kg · ${formatSpeed(heavyVelocity)}`}
                </text>
                <text x={VIEW_WIDTH - 24} y="28" fill={LIGHT_EDGE} textAnchor="end" opacity={opacity("addLight")}>
                    {`light 1 kg · ${formatSpeed(lightVelocity)}`}
                </text>
                <text x={VIEW_WIDTH / 2} y="28" fill={MOMENTUM_TEXT} textAnchor="middle" opacity={opacity("addTotal")}>
                    {`total ${formatMomentum(total)}`}
                </text>
            </g>

            <g opacity={opacity("__structure")} style={EASE_150}>
                <line x1="30" y1={TRACK_Y} x2={VIEW_WIDTH - 30} y2={TRACK_Y} stroke={INK_QUIET} strokeWidth="1.5" />
            </g>

            <g {...hoverProps("addHeavy")} opacity={opacity("addHeavy")} style={EASE_150}>
                <Trolley centerX={HEAVY_X} width={84} height={30} label="3 kg" stroke={HEAVY_EDGE} fill={HEAVY_FILL} strokeWidth={weight("addHeavy", 1.5)} />
                <DraggableArrow fromX={HEAVY_X} varName="addHeavyVelocity" velocity={heavyVelocity} strokeWidth={weight("addHeavy", 3)} svgRef={svgRef} />
            </g>
            <g {...hoverProps("addLight")} opacity={opacity("addLight")} style={EASE_150}>
                <Trolley centerX={LIGHT_X} width={56} height={26} label="1 kg" stroke={LIGHT_EDGE} fill={LIGHT_FILL} strokeWidth={weight("addLight", 1.5)} />
                <DraggableArrow fromX={LIGHT_X} varName="addLightVelocity" velocity={lightVelocity} strokeWidth={weight("addLight", 3)} svgRef={svgRef} />
            </g>

            <MomentumLedger
                anchorX={LEDGER_ANCHOR_X}
                top={LEDGER_TOP}
                pxPerUnit={LEDGER_PX_PER_UNIT}
                heavyMomentum={HEAVY_MASS * heavyVelocity}
                lightMomentum={LIGHT_MASS * lightVelocity}
                locked={false}
                pairMass={HEAVY_MASS + LIGHT_MASS}
                pairVelocity={0}
                highlight={highlight}
                ids={{ heavy: "addHeavy", light: "addLight", total: "addTotal" }}
            />
        </svg>
    );
}

function AddingFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="adding-momentum"
            onReset={() => {
                setVar("addHeavyVelocity", DEFAULT_HEAVY_VELOCITY);
                setVar("addLightVelocity", DEFAULT_LIGHT_VELOCITY);
                setVar("addHighlight", "");
            }}
            caption="Pull either indigo arrow to change that trolley's velocity. The bars below add the two momenta end to end: the blue bar is the heavy trolley's, the pink bar starts where the blue one ends, and the teal bar is the total."
        >
            <AddingDrawing />
            <InteractionHintSequence
                hintKey="adding-momentum-arrows"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Pull the light trolley's arrow to change its velocity",
                        position: { x: "58%", y: "26%" },
                        dragPath: { type: "line", startOffset: { x: -24, y: 0 }, endOffset: { x: 24, y: 0 } },
                    },
                ]}
            />
        </Figure>
    );
}

/** The current total, live in the prose. */
function TotalPill() {
    const heavyVelocity = useVar<number>("addHeavyVelocity", DEFAULT_HEAVY_VELOCITY);
    const lightVelocity = useVar<number>("addLightVelocity", DEFAULT_LIGHT_VELOCITY);
    return <LivePill color={MOMENTUM}>{formatMomentum(totalMomentum(heavyVelocity, lightVelocity)).replace("-", "−")}</LivePill>;
}

export const addingMomentumBlocks: ReactElement[] = [
    <StackLayout key="layout-adding-heading" maxWidth="xl">
        <Block id="adding-heading" padding="md">
            <EditableH2 id="h2-adding-heading" blockId="adding-heading">
                Adding Momentum
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-adding-setup" maxWidth="xl">
        <Block id="adding-setup" padding="sm">
            <EditableParagraph id="para-adding-setup" blockId="adding-setup">
                Now put two trolleys on the same track: a 3 kg <HeavyWord /> and a 1 kg <LightWord />.
                Each one has its own momentum. To find the total, add the two momenta, keeping their
                signs: momentum to the right counts as plus, momentum to the left counts as minus. The
                heavy trolley rolls at{" "}
                <InlineScrubbleNumber
                    varName="addHeavyVelocity"
                    {...numberPropsFromDefinition(getVariableInfo("addHeavyVelocity"))}
                    formatValue={(value) => `${value.toFixed(1)}`}
                />{" "}
                m/s and the light one at{" "}
                <InlineScrubbleNumber
                    varName="addLightVelocity"
                    {...numberPropsFromDefinition(getVariableInfo("addLightVelocity"))}
                    formatValue={(value) => `${value.toFixed(1)}`}
                />{" "}
                m/s, so the{" "}
                <InlineLinkedHighlight
                    varName="addHighlight"
                    highlightId="addTotal"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("addHighlight"))}
                    color={MOMENTUM_TEXT}
                    bgColor={MOMENTUM_BG}
                >
                    total
                </InlineLinkedHighlight>{" "}
                is <TotalPill />.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-adding-formula" maxWidth="xl">
        <Block id="adding-formula" padding="lg">
            <FormulaBlock
                latex="\clr{heavy}{p_1} + \clr{light}{p_2} = \clr{heavy}{m_1 v_1} + \clr{light}{m_2 v_2} = \clr{p}{p}"
                colorMap={FORMULA_COLORS}
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-adding-formula-live" maxWidth="xl">
        <Block id="adding-formula-live" padding="sm">
            <FormulaBlock
                latex="\clr{heavy}{3 \times} \scrub{addHeavyVelocity} + \clr{light}{1 \times} \scrub{addLightVelocity} = \val{addTotalMomentum}\,\text{kg m/s}"
                colorMap={FORMULA_COLORS}
                variables={scrubVarsFromDefinitions(["addHeavyVelocity", "addLightVelocity", "addTotalMomentum"])}
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-adding-visual" maxWidth="xl">
        <Block id="adding-visual" padding="sm" hasVisualization>
            <AddingFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-adding-rule" maxWidth="xl">
        <Block id="adding-rule" padding="sm">
            <EditableParagraph id="para-adding-rule" blockId="adding-rule">
                Here is the rule the whole lesson rests on. Whatever happens when the trolleys meet, the
                total momentum after the crash is the same as the total before it. The trolleys can push
                each other, bounce or stick. Momentum can move from one trolley to the other, but none of
                it is lost and none is made. With the arrows set as they are, the total going in is{" "}
                <TotalPill />, so after the crash the two trolleys must still add up to <TotalPill />.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-adding-question-total" maxWidth="xl">
        <Block id="adding-question-total" padding="md">
            <EditableParagraph id="para-adding-question-total" blockId="adding-question-total">
                A 2 kg trolley rolling right at 3 m/s meets a 1 kg trolley rolling left at 2 m/s. The total
                momentum is{" "}
                <InlineFeedback
                    varName="answerAddTotal"
                    correctValue={["4", "4.0", "+4"]}
                    position="terminal"
                    successMessage="— yes, 6 going right and 2 going left, so 6 − 2 = 4"
                    failureMessage="— not quite."
                    hint="Give the trolley going left a minus sign, then add"
                >
                    <InlineClozeInput
                        varName="answerAddTotal"
                        correctAnswer={["4", "4.0", "+4"]}
                        {...clozePropsFromDefinition(getVariableInfo("answerAddTotal"))}
                    />
                </InlineFeedback>{" "}
                kg m/s.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-adding-question-cancel" maxWidth="xl">
        <Block id="adding-question-cancel" padding="md">
            <EditableParagraph id="para-adding-question-cancel" blockId="adding-question-cancel">
                Same trolleys, but now the 1 kg one rolls left at 6 m/s instead. The total momentum is{" "}
                <InlineFeedback
                    varName="answerAddCancel"
                    correctValue={["0", "0.0"]}
                    position="terminal"
                    successMessage="— right, 6 − 6 = 0, the two momenta cancel out"
                    failureMessage="— almost."
                    hint="Momentum going right and momentum going left can cancel each other"
                >
                    <InlineClozeInput
                        varName="answerAddCancel"
                        correctAnswer={["0", "0.0"]}
                        {...clozePropsFromDefinition(getVariableInfo("answerAddCancel"))}
                    />
                </InlineFeedback>{" "}
                kg m/s.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-adding-forward" maxWidth="xl">
        <Block id="adding-forward" padding="sm">
            <EditableParagraph id="para-adding-forward" blockId="adding-forward">
                So the total is fixed. That leaves one question: how is it shared out between the two
                trolleys after the crash? That depends on what happens when they meet. The next two
                sections look at the two simplest cases. First the trolleys stick together and move as one
                lump. Then they bounce apart and each keeps its own speed.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
