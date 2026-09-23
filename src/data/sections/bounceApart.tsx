import React, { useEffect, useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeChoice,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InlineScrubbleNumber,
    InlineTooltip,
    InteractionHintSequence,
} from "@/components/atoms";
import { Figure, FigureSlider, FormulaBlock } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, useRafLoop, useSpring, type Vec2 } from "@/lib/motion";
import {
    choicePropsFromDefinition,
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
    numberPropsFromDefinition,
    scrubVarsFromDefinitions,
} from "../variables";
import {
    ANSWER,
    ANSWER_BG,
    EASE_150,
    ENERGY,
    ENERGY_BG,
    ENERGY_TEXT,
    FORMULA_COLORS,
    HEAVY_EDGE,
    HEAVY_FILL,
    INK,
    INK_QUIET,
    INK_STRUCTURE,
    LIGHT_EDGE,
    LIGHT_FILL,
    MOMENTUM,
    MOMENTUM_BG,
    MOMENTUM_TEXT,
    VELOCITY,
    VELOCITY_TEXT,
} from "./collisionPalette";
import { EnergyWord, HeavyWord, LightWord, LivePill, MomentumWord } from "./lessonWords";

// ── The model: 2 kg into a stationary 1 kg, run two ways ─────────────────────
const MOVING_MASS = 2;
const RESTING_MASS = 1;
const APPROACH_SECONDS = 0.6;
const AFTER_SECONDS = 1;
const TOTAL_SECONDS = APPROACH_SECONDS + AFTER_SECONDS;
const ENERGY_KEPT_WHEN_LOCKED = MOVING_MASS / (MOVING_MASS + RESTING_MASS); // 2/3

const momentumBefore = (speed: number) => MOVING_MASS * speed;
const energyBefore = (speed: number) => 0.5 * MOVING_MASS * speed * speed;

// ── View geometry ────────────────────────────────────────────────────────────
const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 360;
const PX_PER_METRE = 40;
const PX_PER_VELOCITY = 22;
const MOVING_CONTACT_X = 218;
const RESTING_CONTACT_X = 274;
const ARROW_Y = 96 - 44; // just above the top trolley's body, never through its label

const BAR_LEFT = 120;
const BAR_HEIGHT = 13;
const SCALE_MOMENTUM = 45; // px per kg m/s
const SCALE_ENERGY = 26; // px per joule

const formatMomentum = (value: number) => `${value.toFixed(1)} kg m/s`;
const formatEnergy = (value: number) => `${value.toFixed(1)} J`;
const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
const formatSpeed = (value: number) => `${value.toFixed(1)} m/s`;

const useHighlightState = () => {
    const highlight = useVar<string>("bounceHighlight", "");
    const setVar = useSetVar();
    return {
        opacity: (id: string) => (highlight && highlight !== id ? 0.35 : 1),
        weight: (id: string, resting: number) => (highlight === id ? resting * 1.6 : resting),
        isActive: (id: string) => highlight === id,
        hoverProps: (id: string) => ({
            onPointerEnter: () => setVar("bounceHighlight", id),
            onPointerLeave: () => setVar("bounceHighlight", ""),
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

function Trolley({ centerX, trackY, width, height, label, stroke, strokeWidth, fill }: {
    centerX: number;
    trackY: number;
    width: number;
    height: number;
    label: string;
    stroke: string;
    strokeWidth: number;
    fill: string;
}) {
    const bodyTop = trackY - 10 - height;
    return (
        <g>
            <rect x={centerX - width / 2} y={bodyTop} width={width} height={height} rx="4" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <circle cx={centerX - width / 2 + 12} cy={trackY - 8} r="7" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <circle cx={centerX + width / 2 - 12} cy={trackY - 8} r="7" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <text x={centerX} y={bodyTop + height / 2 + 4} fill={stroke} fontSize="12" fontWeight="600" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                {label}
            </text>
        </g>
    );
}

/** One quantity bar: the value before the crash stays as a dashed outline. */
function QuantityBar({ y, label, hue, textHue, id, before, after, scale, format, suffix }: {
    y: number;
    label: string;
    hue: string;
    textHue: string;
    id: string;
    before: number;
    after: number;
    scale: number;
    format: (value: number) => string;
    suffix?: string;
}) {
    const { opacity, weight, isActive, hoverProps } = useHighlightState();
    const beforeWidth = before * scale;
    const afterWidth = after * scale;
    return (
        <g {...hoverProps(id)} opacity={opacity(id)} style={EASE_150}>
            <text x={BAR_LEFT - 10} y={y + BAR_HEIGHT - 2} fill={INK_STRUCTURE} fontSize="11" textAnchor="end">
                {label}
            </text>
            {isActive(id) && (
                <rect x={BAR_LEFT - 4} y={y - 4} width={Math.max(beforeWidth, afterWidth) + 8} height={BAR_HEIGHT + 8} rx="6" fill={hue} opacity={0.28} />
            )}
            <rect x={BAR_LEFT} y={y} width={beforeWidth} height={BAR_HEIGHT} rx="3" fill="none" stroke={hue} strokeWidth="1.5" strokeDasharray="4 4" />
            <rect x={BAR_LEFT} y={y} width={afterWidth} height={BAR_HEIGHT} rx="3" fill={hue} stroke={hue} strokeWidth={weight(id, 1.5)} />
            <text x={BAR_LEFT + Math.max(beforeWidth, afterWidth) + 10} y={y + BAR_HEIGHT - 1} fill={textHue} fontSize="12" style={{ fontVariantNumeric: "tabular-nums" }}>
                {`${format(after)}${suffix ?? ""}`}
            </text>
        </g>
    );
}

function ComparisonDrawing() {
    const setVar = useSetVar();
    const speed = useVar<number>("bounceSpeed", 2);
    const time = useVar<number>("bounceTime", 0);
    const playing = useVar<boolean>("bouncePlaying", false);
    const { opacity, weight, hoverProps } = useHighlightState();

    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const timeRef = useRef(0);
    const handleScale = useSpring(dragging || hovered ? 1.15 : 1, { stiffness: 400, damping: 26 });

    useEffect(() => {
        timeRef.current = 0;
        setVar("bounceTime", 0);
        setVar("bouncePlaying", false);
    }, [speed, setVar]);

    useEffect(() => {
        if (playing && timeRef.current >= TOTAL_SECONDS) {
            timeRef.current = 0;
            setVar("bounceTime", 0);
        }
    }, [playing, setVar]);

    useRafLoop(
        (dt) => {
            timeRef.current = Math.min(timeRef.current + dt, TOTAL_SECONDS);
            setVar("bounceTime", Math.round(timeRef.current * 100) / 100);
            if (timeRef.current >= TOTAL_SECONDS) setVar("bouncePlaying", false);
        },
        { paused: !playing },
    );

    const collided = time >= APPROACH_SECONDS;
    const approachRemaining = Math.max(APPROACH_SECONDS - time, 0);
    const sinceImpact = collided ? time - APPROACH_SECONDS : 0;

    const before = { momentum: momentumBefore(speed), energy: energyBefore(speed) };
    useEffect(() => {
        setVar("bounceEnergyBefore", Number(before.energy.toFixed(1)));
        setVar("bounceEnergyLocked", Number((before.energy * ENERGY_KEPT_WHEN_LOCKED).toFixed(1)));
    }, [before.energy, setVar]);

    // Elastic: the classic 1D result for 2 kg into a stationary 1 kg.
    const elasticMoving = ((MOVING_MASS - RESTING_MASS) / (MOVING_MASS + RESTING_MASS)) * speed;
    const elasticResting = ((2 * MOVING_MASS) / (MOVING_MASS + RESTING_MASS)) * speed;
    // Locked: one lump, one velocity.
    const lockedVelocity = (MOVING_MASS * speed) / (MOVING_MASS + RESTING_MASS);

    const arrowTipX = MOVING_CONTACT_X - speed * PX_PER_METRE * approachRemaining + speed * PX_PER_VELOCITY;

    const handlePointerMove = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!draggingRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        const raw = (point.x - MOVING_CONTACT_X) / PX_PER_VELOCITY;
        setVar("bounceSpeed", clamp(Math.round(raw * 10) / 10, 1, 3));
    };

    const rows = [
        {
            id: "bounceRowBounce",
            trackY: 96,
            title: "springy bumpers: they bounce apart",
            movingAfter: elasticMoving,
            restingAfter: elasticResting,
            energyAfter: before.energy,
            joined: false,
        },
        {
            id: "bounceRowStick",
            trackY: 256,
            title: "magnets: they lock together",
            movingAfter: lockedVelocity,
            restingAfter: lockedVelocity,
            energyAfter: before.energy * ENERGY_KEPT_WHEN_LOCKED,
            joined: true,
        },
    ];

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="The same collision run on two tracks, one with springy bumpers and one with magnets, each with a momentum bar and an energy bar"
        >
            <defs>
                <filter id="bounce-handle-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {rows.map((row) => {
                const movingX =
                    MOVING_CONTACT_X - speed * PX_PER_METRE * approachRemaining + row.movingAfter * PX_PER_METRE * sinceImpact;
                const restingX = RESTING_CONTACT_X + row.restingAfter * PX_PER_METRE * sinceImpact;
                return (
                    <g key={row.id}>
                        <text x="24" y={row.trackY - 66} fill={INK} fontSize="12" opacity={opacity(row.id)} style={EASE_150}>
                            {row.title}
                        </text>

                        <g opacity={opacity("__structure")} style={EASE_150}>
                            <line x1="24" y1={row.trackY} x2={VIEW_WIDTH - 24} y2={row.trackY} stroke={INK_QUIET} strokeWidth="1.5" />
                        </g>

                        <g {...hoverProps(row.id)} opacity={opacity(row.id)} style={EASE_150}>
                            {row.joined && collided && (
                                <line x1={movingX - 32} y1={row.trackY - 46} x2={restingX + 24} y2={row.trackY - 46} stroke={INK_STRUCTURE} strokeWidth={weight(row.id, 2.5)} strokeLinecap="round" />
                            )}
                            <Trolley centerX={movingX} trackY={row.trackY} width={64} height={28} label="2 kg" stroke={HEAVY_EDGE} fill={HEAVY_FILL} strokeWidth={weight(row.id, 1.5)} />
                            <Trolley centerX={restingX} trackY={row.trackY} width={48} height={24} label="1 kg" stroke={LIGHT_EDGE} fill={LIGHT_FILL} strokeWidth={weight(row.id, 1.5)} />
                            {collided && (
                                <text x={clamp(restingX, 60, 460)} y={row.trackY + 22} fill={VELOCITY_TEXT} fontSize="11" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                                    {row.joined ? `both leave at ${formatSpeed(row.restingAfter)}` : `1 kg leaves at ${formatSpeed(row.restingAfter)}`}
                                </text>
                            )}
                        </g>

                        <QuantityBar
                            y={row.trackY + 34}
                            label="momentum"
                            hue={MOMENTUM}
                            textHue={MOMENTUM_TEXT}
                            id="bounceMomentum"
                            before={before.momentum}
                            after={before.momentum}
                            scale={SCALE_MOMENTUM}
                            format={formatMomentum}
                        />
                        <QuantityBar
                            y={row.trackY + 58}
                            label="energy"
                            hue={ENERGY}
                            textHue={ENERGY_TEXT}
                            id="bounceEnergy"
                            before={before.energy}
                            after={collided ? row.energyAfter : before.energy}
                            scale={SCALE_ENERGY}
                            format={formatEnergy}
                            suffix={collided ? ` · ${formatPercent(row.energyAfter / before.energy)} kept` : ""}
                        />
                    </g>
                );
            })}

            {/* The one control inside the picture: the incoming speed, shared by both rows */}
            <g {...hoverProps("bounceRowBounce")} opacity={opacity("bounceRowBounce")} style={EASE_150}>
                <line
                    x1={MOVING_CONTACT_X - speed * PX_PER_METRE * approachRemaining}
                    y1={ARROW_Y}
                    x2={arrowTipX}
                    y2={ARROW_Y}
                    stroke={VELOCITY}
                    strokeWidth={weight("bounceRowBounce", 3)}
                    strokeLinecap="round"
                />
                <polygon points={`${arrowTipX + 9},${ARROW_Y} ${arrowTipX - 2},${ARROW_Y - 6} ${arrowTipX - 2},${ARROW_Y + 6}`} fill={VELOCITY} />
                <text x={clamp(arrowTipX + 16, 60, 480)} y={ARROW_Y + 4} fill={VELOCITY_TEXT} fontSize="12" textAnchor="start" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatSpeed(speed)}
                </text>
            </g>
            <g transform={`translate(${arrowTipX} ${ARROW_Y}) scale(${handleScale})`}>
                <circle r="7" fill={VELOCITY} filter="url(#bounce-handle-shadow)" />
            </g>
            <circle
                cx={arrowTipX}
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
        </svg>
    );
}

function ComparisonFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="bounce-versus-stick"
            playable
            playVarName="bouncePlaying"
            onReset={() => {
                setVar("bounceSpeed", 2);
                setVar("bounceTime", 0);
                setVar("bouncePlaying", false);
                setVar("bounceHighlight", "");
            }}
            caption="Pull the indigo arrow on the top trolley to choose the incoming speed, then press play to run both crashes at once. The dashed outline on each bar is the value before the crash: the teal momentum bar never changes, the violet energy bar sometimes does."
        >
            <ComparisonDrawing />
            <div className="px-6 pb-5">
                <FigureSlider
                    varName="bounceSpeed"
                    label="Incoming speed"
                    {...numberPropsFromDefinition(getVariableInfo("bounceSpeed"))}
                    formatValue={formatSpeed}
                />
            </div>
            <InteractionHintSequence
                hintKey="bounce-versus-stick-controls"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Pull the arrow to set the incoming speed",
                        position: { x: "46%", y: "13%" },
                        dragPath: { type: "line", startOffset: { x: -26, y: 0 }, endOffset: { x: 26, y: 0 } },
                    },
                    {
                        gesture: "click",
                        label: "Press play to run both crashes",
                        position: { x: "90%", y: "7%" },
                    },
                ]}
            />
        </Figure>
    );
}

/** The incoming kinetic energy and what the locked pair keeps of it, live in the prose. */
function EnergyGoingIn() {
    const speed = useVar<number>("bounceSpeed", 2);
    return <LivePill color={ENERGY}>{formatEnergy(energyBefore(speed))}</LivePill>;
}

function EnergyKept() {
    const speed = useVar<number>("bounceSpeed", 2);
    return <LivePill color={ENERGY}>{formatEnergy(energyBefore(speed) * ENERGY_KEPT_WHEN_LOCKED)}</LivePill>;
}

export const bounceApartBlocks: ReactElement[] = [
    <StackLayout key="layout-bounce-heading" maxWidth="xl">
        <Block id="bounce-heading" padding="md">
            <EditableH2 id="h2-bounce-heading" blockId="bounce-heading">
                When Things Bounce Apart
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-bounce-setup" maxWidth="xl">
        <Block id="bounce-setup" padding="sm">
            <EditableParagraph id="para-bounce-setup" blockId="bounce-setup">
                Swap the magnets for springy bumpers and the <HeavyWord /> and <LightWord /> leave
                separately, each with its own velocity. <MomentumWord /> still balances exactly as before,
                so what really separates the two kinds of crash has to be a second quantity, the{" "}
                <InlineTooltip id="tooltip-kinetic-energy-definition" color={ANSWER} bgColor={ANSWER_BG} tooltip="Kinetic energy is the energy an object has because it is moving: one half times its mass times its speed squared. Unlike momentum it has no direction, so it is never negative.">
                    kinetic energy
                </InlineTooltip>
                . Pull the indigo arrow on the top trolley to choose a speed, then press play and watch
                both crashes run at once.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-bounce-formula" maxWidth="xl">
        <Block id="bounce-formula" padding="lg">
            <FormulaBlock latex="\clr{e}{E_k} = \tfrac{1}{2}\,\clr{m}{m}\,\clr{v}{v}^2" colorMap={FORMULA_COLORS} />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-bounce-formula-live" maxWidth="xl">
        <Block id="bounce-formula-live" padding="sm">
            <FormulaBlock
                latex="\clr{e}{E_k} = \tfrac{1}{2} \times \clr{m}{2} \times (\scrub{bounceSpeed})^2 = \val{bounceEnergyBefore}\,\text{J going in}"
                colorMap={FORMULA_COLORS}
                variables={scrubVarsFromDefinitions(["bounceSpeed", "bounceEnergyBefore"])}
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-bounce-visual" maxWidth="xl">
        <Block id="bounce-visual" padding="sm" hasVisualization>
            <ComparisonFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-bounce-reflect" maxWidth="xl">
        <Block id="bounce-reflect" padding="sm">
            <EditableParagraph id="para-bounce-reflect" blockId="bounce-reflect">
                Here is the catch.{" "}
                <InlineLinkedHighlight
                    varName="bounceHighlight"
                    highlightId="bounceMomentum"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("bounceHighlight"))}
                    color={MOMENTUM_TEXT}
                    bgColor={MOMENTUM_BG}
                >
                    Momentum
                </InlineLinkedHighlight>{" "}
                comes out the same on both tracks, but the{" "}
                <InlineLinkedHighlight
                    varName="bounceHighlight"
                    highlightId="bounceEnergy"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("bounceHighlight"))}
                    color={ENERGY_TEXT}
                    bgColor={ENERGY_BG}
                >
                    energy
                </InlineLinkedHighlight>{" "}
                does not: at{" "}
                <InlineScrubbleNumber
                    varName="bounceSpeed"
                    {...numberPropsFromDefinition(getVariableInfo("bounceSpeed"))}
                    formatValue={(value) => `${value.toFixed(1)}`}
                />{" "}
                m/s the springy bounce hands back all <EnergyGoingIn /> of it, while the locked pair
                keeps only <EnergyKept />, two thirds. The rest went into bending metal, into sound and
                into heat.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-bounce-question-energy" maxWidth="xl">
        <Block id="bounce-question-energy" padding="md">
            <EditableParagraph id="para-bounce-question-energy" blockId="bounce-question-energy">
                When two trolleys lock together, the <EnergyWord /> afterwards is{" "}
                <InlineFeedback
                    varName="answerBounceEnergy"
                    correctValue="smaller than"
                    position="mid"
                    successMessage="✓"
                    failureMessage="✗"
                    hint="Momentum is the quantity that always survives, and energy is not the same thing"
                    visualizationHint={{
                        blockId: "bounce-visual",
                        hintKey: "feedback-bounce-energy-hint",
                        label: "Discover it yourself",
                        resetVars: { bounceSpeed: 2, bounceTime: 0, bouncePlaying: false },
                        steps: [
                            {
                                gesture: "click",
                                label: "Press play, then compare the lower energy bar with its dashed outline",
                                position: { x: "90%", y: "7%" },
                                completionVar: "bounceTime",
                                completionValue: 1.6,
                                completionTolerance: 0.3,
                            },
                        ],
                    }}
                >
                    <InlineClozeChoice
                        varName="answerBounceEnergy"
                        correctAnswer="smaller than"
                        options={["smaller than", "the same as", "larger than"]}
                        {...choicePropsFromDefinition(getVariableInfo("answerBounceEnergy"))}
                    />
                </InlineFeedback>{" "}
                the energy before.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-bounce-question-joules" maxWidth="xl">
        <Block id="bounce-question-joules" padding="md">
            <EditableParagraph id="para-bounce-question-joules" blockId="bounce-question-joules">
                A 4 kg trolley moving at 2 m/s carries 8 J. It locks onto a stationary 4 kg trolley and
                the pair moves off at 1 m/s, so the kinetic energy is now{" "}
                <InlineFeedback
                    varName="answerBounceJoules"
                    correctValue={["4", "4 J", "4.0"]}
                    position="terminal"
                    successMessage="— yes, half of 8 kg times 1 squared is 4 J, so half the energy has gone"
                    failureMessage="— not quite."
                    hint="The moving mass is now 8 kg and the speed is 1 m/s, so put those into one half m v squared"
                >
                    <InlineClozeInput
                        varName="answerBounceJoules"
                        correctAnswer={["4", "4 J", "4.0"]}
                        {...clozePropsFromDefinition(getVariableInfo("answerBounceJoules"))}
                    />
                </InlineFeedback>{" "}
                J.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
