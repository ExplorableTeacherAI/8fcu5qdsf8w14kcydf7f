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
} from "../variables";

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

const BAR_LEFT = 120;
const BAR_HEIGHT = 13;
const SCALE_MOMENTUM = 45; // px per kg m/s
const SCALE_ENERGY = 26; // px per joule

const INK = "#334155";
const INK_STRUCTURE = "#64748B";
const INK_QUIET = "#CBD5E1";
const PAPER = "#F1F5F9";
const MOMENTUM_HUE = "#62D0AD";
const ENERGY_HUE = "#AC8BF9";
const VELOCITY_HUE = "#8E90F5";

const formatMomentum = (value: number) => `${value.toFixed(1)} kg m/s`;
const formatEnergy = (value: number) => `${value.toFixed(1)} J`;
const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
const formatSpeed = (value: number) => `${value.toFixed(1)} m/s`;

const EASE_150 = { transition: "opacity 150ms ease, stroke-width 150ms ease" } as const;

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

function Trolley({ centerX, trackY, width, height, label, stroke, strokeWidth, fill = PAPER }: {
    centerX: number;
    trackY: number;
    width: number;
    height: number;
    label: string;
    stroke: string;
    strokeWidth: number;
    fill?: string;
}) {
    const bodyTop = trackY - 10 - height;
    return (
        <g>
            <rect x={centerX - width / 2} y={bodyTop} width={width} height={height} rx="4" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <circle cx={centerX - width / 2 + 12} cy={trackY - 8} r="7" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <circle cx={centerX + width / 2 - 12} cy={trackY - 8} r="7" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <text x={centerX} y={bodyTop + height / 2 + 4} fill={INK} fontSize="12" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                {label}
            </text>
        </g>
    );
}

/** One quantity bar: the value before the crash stays as a dashed outline. */
function QuantityBar({ y, label, hue, id, before, after, scale, format, suffix }: {
    y: number;
    label: string;
    hue: string;
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
            <text x={BAR_LEFT + Math.max(beforeWidth, afterWidth) + 10} y={y + BAR_HEIGHT - 1} fill={hue} fontSize="12" style={{ fontVariantNumeric: "tabular-nums" }}>
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
            id: "bounce",
            trackY: 96,
            title: "springy bumpers: they bounce apart",
            movingAfter: elasticMoving,
            restingAfter: elasticResting,
            energyAfter: before.energy,
            joined: false,
        },
        {
            id: "stick",
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
                                <line x1={movingX - 32} y1={row.trackY - 46} x2={restingX + 24} y2={row.trackY - 46} stroke={MOMENTUM_HUE} strokeWidth={weight(row.id, 2.5)} strokeLinecap="round" />
                            )}
                            <Trolley centerX={movingX} trackY={row.trackY} width={64} height={28} label="2 kg" stroke={INK_STRUCTURE} strokeWidth={weight(row.id, 1.5)} />
                            <Trolley centerX={restingX} trackY={row.trackY} width={48} height={24} label="1 kg" stroke={INK_STRUCTURE} strokeWidth={weight(row.id, 1.5)} />
                            {collided && (
                                <text x={clamp(restingX, 60, 460)} y={row.trackY + 22} fill={INK_STRUCTURE} fontSize="11" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                                    {`1 kg leaves at ${formatSpeed(row.restingAfter)}`}
                                </text>
                            )}
                        </g>

                        <QuantityBar
                            y={row.trackY + 34}
                            label="momentum"
                            hue={MOMENTUM_HUE}
                            id="momentum"
                            before={before.momentum}
                            after={before.momentum}
                            scale={SCALE_MOMENTUM}
                            format={formatMomentum}
                        />
                        <QuantityBar
                            y={row.trackY + 58}
                            label="energy"
                            hue={ENERGY_HUE}
                            id="energy"
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
            <g {...hoverProps("bounce")} opacity={opacity("bounce")} style={EASE_150}>
                <line
                    x1={MOVING_CONTACT_X - speed * PX_PER_METRE * approachRemaining}
                    y1={96 - 24}
                    x2={arrowTipX}
                    y2={96 - 24}
                    stroke={VELOCITY_HUE}
                    strokeWidth={weight("bounce", 3)}
                    strokeLinecap="round"
                />
                <polygon points={`${arrowTipX + 9},${96 - 24} ${arrowTipX - 2},${96 - 30} ${arrowTipX - 2},${96 - 18}`} fill={VELOCITY_HUE} />
                <text x={clamp(arrowTipX, 60, 480)} y={96 - 48} fill={VELOCITY_HUE} fontSize="12" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatSpeed(speed)}
                </text>
            </g>
            <g transform={`translate(${arrowTipX} ${96 - 24}) scale(${handleScale})`}>
                <circle r="7" fill={VELOCITY_HUE} filter="url(#bounce-handle-shadow)" />
            </g>
            <circle
                cx={arrowTipX}
                cy={96 - 24}
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
            caption="Pull the arrow on the top trolley to choose the incoming speed, then press play to run both crashes at once. The dashed outline on each bar is the value before the crash."
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
                        position: { x: "44%", y: "20%" },
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
                Swap the magnets for springy bumpers and the trolleys leave separately, each with its own
                velocity. Momentum still balances exactly as before, so what really separates the two
                kinds of crash has to be a second quantity, the{" "}
                <InlineTooltip id="tooltip-kinetic-energy-definition" tooltip="Kinetic energy is the energy an object has because it is moving: one half times its mass times its speed squared. Unlike momentum it has no direction, so it is never negative.">
                    kinetic energy
                </InlineTooltip>
                . Pull the arrow on the top trolley to choose a speed, then press play and watch both
                crashes run at once.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-bounce-formula" maxWidth="xl">
        <Block id="bounce-formula" padding="lg">
            <FormulaBlock latex="E_k = \tfrac{1}{2} m v^2" />
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
                Here is the catch. Momentum comes out the same on both tracks, but the{" "}
                <InlineLinkedHighlight
                    varName="bounceHighlight"
                    highlightId="energy"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("bounceHighlight"))}
                >
                    energy
                </InlineLinkedHighlight>{" "}
                does not: at{" "}
                <InlineScrubbleNumber
                    varName="bounceSpeed"
                    {...numberPropsFromDefinition(getVariableInfo("bounceSpeed"))}
                    formatValue={(value) => `${value.toFixed(1)}`}
                />{" "}
                m/s the springy bounce hands every joule back, while the locked pair keeps only two
                thirds. The rest went into bending metal, into sound and into heat.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-bounce-question-energy" maxWidth="xl">
        <Block id="bounce-question-energy" padding="md">
            <EditableParagraph id="para-bounce-question-energy" blockId="bounce-question-energy">
                When two trolleys lock together, the kinetic energy afterwards is{" "}
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
