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
    EASE_150,
    FORMULA_COLORS,
    GUESS,
    GUESS_TEXT,
    HEAVY_EDGE,
    HEAVY_FILL,
    INK,
    INK_QUIET,
    INK_STRUCTURE,
    LIGHT_EDGE,
    LIGHT_FILL,
    MOMENTUM_TEXT,
    VELOCITY,
    VELOCITY_TEXT,
} from "./collisionPalette";
import { HeavyWord, LightWord, LivePill } from "./lessonWords";
import { MomentumLedger } from "./momentumLedger";

// ── The model ────────────────────────────────────────────────────────────────
const HEAVY_MASS = 3; // kg, rolling right
const LIGHT_MASS = 1; // kg, rolling left
const LIGHT_VELOCITY = -3; // m/s
const PAIR_MASS = HEAVY_MASS + LIGHT_MASS;

const APPROACH_SECONDS = 0.6;
const AFTER_SECONDS = 1;
const TOTAL_SECONDS = APPROACH_SECONDS + AFTER_SECONDS;

const totalMomentum = (heavyVelocity: number) => HEAVY_MASS * heavyVelocity + LIGHT_MASS * LIGHT_VELOCITY;
const joinedVelocity = (heavyVelocity: number) => totalMomentum(heavyVelocity) / PAIR_MASS;

// ── View geometry ────────────────────────────────────────────────────────────
const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 330;
const TRACK_Y = 160;
const MEET_X = 230;
const PX_PER_METRE = 60;
const PX_PER_VELOCITY = 22;
const ARROW_Y = TRACK_Y - 52;

const HEAVY_CONTACT_X = MEET_X - 42;
const LIGHT_CONTACT_X = MEET_X + 28;
const PAIR_CONTACT_X = (HEAVY_CONTACT_X + LIGHT_CONTACT_X) / 2;

// Momentum ledger under the track — same zero mark whatever the speeds
const LEDGER_TOP = TRACK_Y + 66;
const LEDGER_ANCHOR_X = 150;
const LEDGER_PX_PER_UNIT = 28;

const formatVelocity = (value: number) => `${value.toFixed(2)} m/s`;
const formatSpeed = (value: number) => `${value.toFixed(1)} m/s`;
const formatDistance = (value: number) => `${value.toFixed(2)} m`;

// ── Shared highlight helpers ─────────────────────────────────────────────────
const useHighlightState = () => {
    const highlight = useVar<string>("stickHighlight", "");
    const setVar = useSetVar();
    return {
        opacity: (id: string) => (highlight && highlight !== id ? 0.35 : 1),
        weight: (id: string, resting: number) => (highlight === id ? resting * 1.6 : resting),
        isActive: (id: string) => highlight === id,
        hoverProps: (id: string) => ({
            onPointerEnter: () => setVar("stickHighlight", id),
            onPointerLeave: () => setVar("stickHighlight", ""),
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

// ── One trolley body, drawn from the model ───────────────────────────────────
function Trolley({
    centerX,
    width,
    height,
    label,
    stroke,
    fill,
    strokeWidth,
    ghost,
}: {
    centerX: number;
    width: number;
    height: number;
    label: string;
    stroke: string;
    fill: string;
    strokeWidth: number;
    ghost?: boolean;
}) {
    const bodyTop = TRACK_Y - 10 - height;
    return (
        <g>
            <rect
                x={centerX - width / 2}
                y={bodyTop}
                width={width}
                height={height}
                rx="4"
                fill={ghost ? "none" : fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={ghost ? "5 4" : undefined}
            />
            <circle cx={centerX - width / 2 + 14} cy={TRACK_Y - 8} r="8" fill={ghost ? "none" : fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={ghost ? "5 4" : undefined} />
            <circle cx={centerX + width / 2 - 14} cy={TRACK_Y - 8} r="8" fill={ghost ? "none" : fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={ghost ? "5 4" : undefined} />
            <text x={centerX} y={bodyTop + height / 2 + 4} fill={stroke} fontSize="12" fontWeight="600" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                {label}
            </text>
        </g>
    );
}

/** An indigo velocity arrow: the lesson's one hue for "how fast, which way". */
function VelocityArrow({ fromX, velocity, strokeWidth, label }: { fromX: number; velocity: number; strokeWidth: number; label?: string }) {
    if (Math.abs(velocity) < 0.05) return null;
    const tipX = fromX + velocity * PX_PER_VELOCITY;
    const direction = velocity >= 0 ? 1 : -1;
    return (
        <g>
            <line x1={fromX} y1={ARROW_Y} x2={tipX} y2={ARROW_Y} stroke={VELOCITY} strokeWidth={strokeWidth} strokeLinecap="round" />
            <polygon points={`${tipX + direction * 9},${ARROW_Y} ${tipX - direction * 2},${ARROW_Y - 6} ${tipX - direction * 2},${ARROW_Y + 6}`} fill={VELOCITY} />
            {label && (
                <text x={(fromX + tipX) / 2} y={ARROW_Y - 9} fill={VELOCITY_TEXT} fontSize="11" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {label}
                </text>
            )}
        </g>
    );
}

function StickDrawing() {
    const setVar = useSetVar();
    const heavyVelocity = useVar<number>("stickHeavyVelocity", 2);
    const ghostPosition = useVar<number>("stickGhostPosition", 1);
    const time = useVar<number>("stickTime", 0);
    const playing = useVar<boolean>("stickPlaying", false);
    const highlight = useHighlightState();
    const { opacity, weight, isActive, hoverProps } = highlight;

    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const draggingRef = useRef(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const timeRef = useRef(0);
    const handleScale = useSpring(dragging || hovered ? 1.15 : 1, { stiffness: 400, damping: 26 });

    // Changing the setup rewinds the run, so every release starts from the same
    // before-state.
    useEffect(() => {
        timeRef.current = 0;
        setVar("stickTime", 0);
        setVar("stickPlaying", false);
    }, [heavyVelocity, setVar]);

    // Pressing play again after a finished run starts it over.
    useEffect(() => {
        if (playing && timeRef.current >= TOTAL_SECONDS) {
            timeRef.current = 0;
            setVar("stickTime", 0);
        }
    }, [playing, setVar]);

    useRafLoop(
        (dt) => {
            timeRef.current = Math.min(timeRef.current + dt, TOTAL_SECONDS);
            setVar("stickTime", Math.round(timeRef.current * 100) / 100);
            if (timeRef.current >= TOTAL_SECONDS) setVar("stickPlaying", false);
        },
        { paused: !playing },
    );

    const afterVelocity = joinedVelocity(heavyVelocity);
    const heavyMomentum = HEAVY_MASS * heavyVelocity;
    const lightMomentum = LIGHT_MASS * LIGHT_VELOCITY;

    // The live formula reads these through \val{}
    useEffect(() => {
        setVar("stickTotalMomentum", Number(totalMomentum(heavyVelocity).toFixed(1)));
        setVar("stickAfterVelocity", Number(afterVelocity.toFixed(2)));
    }, [heavyVelocity, afterVelocity, setVar]);

    const locked = time >= APPROACH_SECONDS;
    const finished = time >= TOTAL_SECONDS - 0.001;

    const approachRemaining = Math.max(APPROACH_SECONDS - time, 0);
    const travelled = locked ? afterVelocity * PX_PER_METRE * (time - APPROACH_SECONDS) : 0;

    const heavyX = HEAVY_CONTACT_X - heavyVelocity * PX_PER_METRE * approachRemaining + travelled;
    const lightX = LIGHT_CONTACT_X - LIGHT_VELOCITY * PX_PER_METRE * approachRemaining + travelled;
    const pairX = (heavyX + lightX) / 2;

    const ghostOffset = ghostPosition * PX_PER_METRE;
    const ghostHandleX = PAIR_CONTACT_X + ghostOffset;
    const actualPosition = afterVelocity * AFTER_SECONDS;

    const handlePointerMove = (event: React.PointerEvent<SVGElement>) => {
        if (!draggingRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        const metres = (point.x - PAIR_CONTACT_X) / PX_PER_METRE;
        setVar("stickGhostPosition", clamp(Math.round(metres * 20) / 20, -2, 2.5));
    };

    const heavyId = locked ? "stickPair" : "stickHeavy";
    const lightId = locked ? "stickPair" : "stickLight";

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="A heavy trolley and a light trolley on a track with a faint joined pair the student can slide to predict where the locked pair ends up, and a ledger of momentum bars beneath"
        >
            <defs>
                <filter id="stick-handle-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Setup readouts — the after-speed stays hidden until they have locked */}
            <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}>
                <text x="24" y="28" fill={HEAVY_EDGE} opacity={opacity("stickHeavy")}>
                    {`heavy 3 kg · ${formatSpeed(heavyVelocity)}`}
                </text>
                <text x={VIEW_WIDTH - 24} y="28" fill={LIGHT_EDGE} textAnchor="end" opacity={opacity("stickLight")}>
                    light 1 kg · 3.0 m/s
                </text>
                {locked && (
                    <text x={VIEW_WIDTH / 2} y="28" fill={VELOCITY_TEXT} textAnchor="middle" opacity={opacity("stickPair")}>
                        {`together: ${formatVelocity(afterVelocity)}`}
                    </text>
                )}
            </g>

            {/* Track and the lock-up mark — the before-state reference */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <line x1="30" y1={TRACK_Y} x2={VIEW_WIDTH - 30} y2={TRACK_Y} stroke={INK_QUIET} strokeWidth="1.5" />
                <line x1={PAIR_CONTACT_X} y1={TRACK_Y - 112} x2={PAIR_CONTACT_X} y2={TRACK_Y + 10} stroke={INK_QUIET} strokeWidth="1.5" strokeDasharray="4 5" />
                <text x={PAIR_CONTACT_X} y={TRACK_Y + 26} fill={INK_STRUCTURE} fontSize="11" textAnchor="middle">
                    they stick here
                </text>
            </g>

            {/* The prediction — a faint coral copy of the joined pair, draggable along the track */}
            <g {...hoverProps("stickPair")} opacity={opacity("stickPair")} style={EASE_150}>
                {isActive("stickPair") && (
                    <g opacity={0.28}>
                        <Trolley centerX={HEAVY_CONTACT_X + ghostOffset} width={84} height={30} label="" stroke={GUESS} fill="none" strokeWidth={9} ghost />
                        <Trolley centerX={LIGHT_CONTACT_X + ghostOffset} width={56} height={26} label="" stroke={GUESS} fill="none" strokeWidth={9} ghost />
                    </g>
                )}
                <g opacity={0.85}>
                    <Trolley centerX={HEAVY_CONTACT_X + ghostOffset} width={84} height={30} label="" stroke={GUESS_TEXT} fill="none" strokeWidth={weight("stickPair", 1.75)} ghost />
                    <Trolley centerX={LIGHT_CONTACT_X + ghostOffset} width={56} height={26} label="" stroke={GUESS_TEXT} fill="none" strokeWidth={weight("stickPair", 1.75)} ghost />
                    <text x={ghostHandleX} y={TRACK_Y - 106} fill={GUESS_TEXT} fontSize="11" textAnchor="middle">your guess</text>
                </g>
                <rect
                    x={ghostHandleX - 78}
                    y={TRACK_Y - 46}
                    width="156"
                    height="46"
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
                <g transform={`translate(${ghostHandleX} ${TRACK_Y - 92}) scale(${handleScale})`}>
                    <circle r="8" fill={GUESS} filter="url(#stick-handle-shadow)" />
                </g>
                <circle
                    cx={ghostHandleX}
                    cy={TRACK_Y - 92}
                    r="20"
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

            {/* The two trolleys, drawn wherever the model puts them, each in its own hue */}
            <g {...hoverProps(heavyId)} opacity={opacity(heavyId)} style={EASE_150}>
                <Trolley
                    centerX={heavyX}
                    width={84}
                    height={30}
                    label="3 kg"
                    stroke={HEAVY_EDGE}
                    fill={HEAVY_FILL}
                    strokeWidth={weight(heavyId, 1.5)}
                />
                {!locked && <VelocityArrow fromX={heavyX} velocity={heavyVelocity} strokeWidth={weight(heavyId, 3)} label={formatSpeed(heavyVelocity)} />}
            </g>
            <g {...hoverProps(lightId)} opacity={opacity(lightId)} style={EASE_150}>
                <Trolley
                    centerX={lightX}
                    width={56}
                    height={26}
                    label="1 kg"
                    stroke={LIGHT_EDGE}
                    fill={LIGHT_FILL}
                    strokeWidth={weight(lightId, 1.5)}
                />
                {!locked && <VelocityArrow fromX={lightX} velocity={LIGHT_VELOCITY} strokeWidth={weight(lightId, 3)} label="3.0 m/s" />}
            </g>

            {/* Once locked: one lump, one velocity arrow */}
            {locked && (
                <g {...hoverProps("stickPair")} opacity={opacity("stickPair")} style={EASE_150}>
                    <line x1={heavyX - 42} y1={TRACK_Y - 46} x2={lightX + 28} y2={TRACK_Y - 46} stroke={INK_STRUCTURE} strokeWidth={weight("stickPair", 2.5)} strokeLinecap="round" />
                    <VelocityArrow fromX={pairX} velocity={afterVelocity} strokeWidth={weight("stickPair", 3)} label={formatVelocity(afterVelocity)} />
                </g>
            )}

            {/* The verdict, once the second is up */}
            {finished && (
                <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums" }}>
                    <text x={VIEW_WIDTH / 2 - 6} y={TRACK_Y + 46} fill={GUESS_TEXT} textAnchor="end">
                        {`your guess ${formatDistance(ghostPosition)}`}
                    </text>
                    <text x={VIEW_WIDTH / 2 + 6} y={TRACK_Y + 46} fill={INK} textAnchor="start">
                        {`· actually ${formatDistance(actualPosition)}`}
                    </text>
                </g>
            )}

            {/* Momentum ledger: heavy + light, tip to tail, and the total the pair must carry */}
            <MomentumLedger
                anchorX={LEDGER_ANCHOR_X}
                top={LEDGER_TOP}
                pxPerUnit={LEDGER_PX_PER_UNIT}
                heavyMomentum={heavyMomentum}
                lightMomentum={lightMomentum}
                locked={locked}
                pairMass={PAIR_MASS}
                pairVelocity={afterVelocity}
                highlight={highlight}
                ids={{ heavy: "stickHeavy", light: "stickLight", total: locked ? "stickPair" : "stickTotal" }}
            />
        </svg>
    );
}

function StickFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="stick-collision"
            playable
            playVarName="stickPlaying"
            onReset={() => {
                setVar("stickHeavyVelocity", 2);
                setVar("stickGhostPosition", 1);
                setVar("stickTime", 0);
                setVar("stickPlaying", false);
                setVar("stickHighlight", "");
            }}
            caption="Slide the faint coral pair to where you think the stuck-together trolleys will be one second after they meet, then press play. The bars below add the two momenta end to end. Watch what happens to the teal total when they stick."
        >
            <StickDrawing />
            <div className="px-6 pb-5">
                <FigureSlider
                    varName="stickHeavyVelocity"
                    label="Heavy trolley speed"
                    {...numberPropsFromDefinition(getVariableInfo("stickHeavyVelocity"))}
                    formatValue={formatSpeed}
                />
            </div>
            <InteractionHintSequence
                hintKey="stick-collision-predict"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Slide the faint coral pair to your guess",
                        position: { x: "52%", y: "28%" },
                        dragPath: { type: "line", startOffset: { x: -30, y: 0 }, endOffset: { x: 30, y: 0 } },
                    },
                    {
                        gesture: "click",
                        label: "Press play to release the trolleys",
                        position: { x: "90%", y: "8%" },
                    },
                ]}
            />
        </Figure>
    );
}

/** The locked pair's velocity, live in the prose. */
function PairVelocity() {
    const heavyVelocity = useVar<number>("stickHeavyVelocity", 2);
    return <LivePill color={VELOCITY}>{formatVelocity(joinedVelocity(heavyVelocity))}</LivePill>;
}

export const stickTogetherBlocks: ReactElement[] = [
    <StackLayout key="layout-stick-heading" maxWidth="xl">
        <Block id="stick-heading" padding="md">
            <EditableH2 id="h2-stick-heading" blockId="stick-heading">
                When Things Stick Together
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-stick-setup" maxWidth="xl">
        <Block id="stick-setup" padding="sm">
            <EditableParagraph id="para-stick-setup" blockId="stick-setup">
                Put magnets on the front of the <HeavyWord /> and the <LightWord />. When they hit,
                they stick, and leave the crash as one lump with one mass and one speed. Before you press
                play, slide the{" "}
                <InlineLinkedHighlight
                    varName="stickHighlight"
                    highlightId="stickPair"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("stickHighlight"))}
                    color={GUESS_TEXT}
                    bgColor="rgba(244, 168, 154, 0.25)"
                >
                    faint copy of the joined pair
                </InlineLinkedHighlight>{" "}
                to where you think it will be one second after they stick.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-stick-formula" maxWidth="xl">
        <Block id="stick-formula" padding="lg">
            <FormulaBlock
                latex="\clr{heavy}{m_1 v_1} + \clr{light}{m_2 v_2} = \clr{m}{(m_1 + m_2)}\,\clr{v}{v}"
                colorMap={FORMULA_COLORS}
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-stick-formula-live" maxWidth="xl">
        <Block id="stick-formula-live" padding="sm">
            <FormulaBlock
                latex="\clr{heavy}{3 \times} \scrub{stickHeavyVelocity} + \clr{light}{1 \times (-3.0)} = \val{stickTotalMomentum}\,\text{kg m/s} = \clr{m}{4} \times \val{stickAfterVelocity}\,\text{m/s}"
                colorMap={FORMULA_COLORS}
                variables={scrubVarsFromDefinitions(["stickHeavyVelocity", "stickTotalMomentum", "stickAfterVelocity"])}
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-stick-visual" maxWidth="xl">
        <Block id="stick-visual" padding="sm" hasVisualization>
            <StickFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-stick-reflect" maxWidth="xl">
        <Block id="stick-reflect" padding="sm">
            <EditableParagraph id="para-stick-reflect" blockId="stick-reflect">
                Many people think the heavier object wins. But once the pair is stuck there is only one
                speed, so the heavy trolley cannot come out faster than the light one. The light trolley
                comes in at 3 m/s and the heavy one at{" "}
                <InlineScrubbleNumber
                    varName="stickHeavyVelocity"
                    {...numberPropsFromDefinition(getVariableInfo("stickHeavyVelocity"))}
                    formatValue={(value) => `${value.toFixed(1)}`}
                />{" "}
                m/s, so the{" "}
                <InlineLinkedHighlight
                    varName="stickHighlight"
                    highlightId="stickPair"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("stickHighlight"))}
                    color={MOMENTUM_TEXT}
                >
                    joined pair
                </InlineLinkedHighlight>{" "}
                moves off at <PairVelocity />. If the heavy one is slower than 1 m/s, the pair goes left
                instead, pulled back by the lighter trolley.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-stick-question-shared" maxWidth="xl">
        <Block id="stick-question-shared" padding="md">
            <EditableParagraph id="para-stick-question-shared" blockId="stick-question-shared">
                Once the magnets have caught, the heavy trolley travels{" "}
                <InlineFeedback
                    varName="answerStickSameSpeed"
                    correctValue="at exactly the same speed as"
                    position="mid"
                    successMessage="✓"
                    failureMessage="✗"
                    hint="They are one object now. Can one object have two speeds?"
                    visualizationHint={{
                        blockId: "stick-visual",
                        hintKey: "feedback-stick-shared-speed",
                        label: "Discover it yourself",
                        resetVars: { stickHeavyVelocity: 2, stickGhostPosition: 1, stickTime: 0, stickPlaying: false },
                        steps: [
                            {
                                gesture: "click",
                                label: "Press play and watch the gap between the two trolleys after they stick",
                                position: { x: "90%", y: "8%" },
                                completionVar: "stickTime",
                                completionValue: 1.6,
                                completionTolerance: 0.3,
                            },
                        ],
                    }}
                >
                    <InlineClozeChoice
                        varName="answerStickSameSpeed"
                        correctAnswer="at exactly the same speed as"
                        options={["faster than", "slower than", "at exactly the same speed as"]}
                        {...choicePropsFromDefinition(getVariableInfo("answerStickSameSpeed"))}
                    />
                </InlineFeedback>{" "}
                the light one.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-stick-question-speed" maxWidth="xl">
        <Block id="stick-question-speed" padding="md">
            <EditableParagraph id="para-stick-question-speed" blockId="stick-question-speed">
                A 2 kg trolley rolling right at 3 m/s sticks to a 4 kg trolley that is standing still.
                The joined pair moves off at{" "}
                <InlineFeedback
                    varName="answerStickPairSpeed"
                    correctValue={["1", "1.0", "1 m/s"]}
                    position="terminal"
                    successMessage="— yes, 6 kg m/s of momentum is now shared by 6 kg of trolley, so 6 ÷ 6 = 1"
                    failureMessage="— not yet."
                    hint="First work out the momentum going in, then divide it by the total mass"
                >
                    <InlineClozeInput
                        varName="answerStickPairSpeed"
                        correctAnswer={["1", "1.0", "1 m/s"]}
                        {...clozePropsFromDefinition(getVariableInfo("answerStickPairSpeed"))}
                    />
                </InlineFeedback>{" "}
                m/s.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
