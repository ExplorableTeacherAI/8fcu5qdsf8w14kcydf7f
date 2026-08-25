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
} from "../variables";

// ── The model ────────────────────────────────────────────────────────────────
const HEAVY_MASS = 3; // kg, rolling right
const LIGHT_MASS = 1; // kg, rolling left
const LIGHT_VELOCITY = -3; // m/s

const APPROACH_SECONDS = 0.6;
const AFTER_SECONDS = 1;
const TOTAL_SECONDS = APPROACH_SECONDS + AFTER_SECONDS;

const joinedVelocity = (heavyVelocity: number) =>
    (HEAVY_MASS * heavyVelocity + LIGHT_MASS * LIGHT_VELOCITY) / (HEAVY_MASS + LIGHT_MASS);

// ── View geometry ────────────────────────────────────────────────────────────
const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 240;
const TRACK_Y = 160;
const MEET_X = 230;
const PX_PER_METRE = 60;

const HEAVY_CONTACT_X = MEET_X - 42;
const LIGHT_CONTACT_X = MEET_X + 28;
const PAIR_CONTACT_X = (HEAVY_CONTACT_X + LIGHT_CONTACT_X) / 2;

const INK = "#334155";
const INK_STRUCTURE = "#64748B";
const INK_QUIET = "#CBD5E1";
const PAPER = "#F1F5F9";
const ACCENT = "#62D0AD";

const formatVelocity = (value: number) => `${value.toFixed(2)} m/s`;
const formatDistance = (value: number) => `${value.toFixed(2)} m`;

// ── Shared highlight helpers ─────────────────────────────────────────────────
const EASE_150 = { transition: "opacity 150ms ease, stroke-width 150ms ease" } as const;

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
            <text x={centerX} y={bodyTop + height / 2 + 4} fill={ghost ? ACCENT : INK} fontSize="12" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                {label}
            </text>
        </g>
    );
}

function StickDrawing() {
    const setVar = useSetVar();
    const heavyVelocity = useVar<number>("stickHeavyVelocity", 2);
    const ghostPosition = useVar<number>("stickGhostPosition", 1);
    const time = useVar<number>("stickTime", 0);
    const playing = useVar<boolean>("stickPlaying", false);
    const { opacity, weight, isActive, hoverProps } = useHighlightState();

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
    const locked = time >= APPROACH_SECONDS;
    const finished = time >= TOTAL_SECONDS - 0.001;

    const approachRemaining = Math.max(APPROACH_SECONDS - time, 0);
    const travelled = locked ? afterVelocity * PX_PER_METRE * (time - APPROACH_SECONDS) : 0;

    const heavyX = HEAVY_CONTACT_X - heavyVelocity * PX_PER_METRE * approachRemaining + travelled;
    const lightX = LIGHT_CONTACT_X - LIGHT_VELOCITY * PX_PER_METRE * approachRemaining + travelled;

    const ghostOffset = ghostPosition * PX_PER_METRE;
    const ghostHandleX = PAIR_CONTACT_X + ghostOffset;
    const actualPosition = afterVelocity * AFTER_SECONDS;

    const handlePointerMove = (event: React.PointerEvent<SVGRectElement>) => {
        if (!draggingRef.current) return;
        const point = svgPointFromEvent(event, svgRef.current);
        const metres = (point.x - PAIR_CONTACT_X) / PX_PER_METRE;
        setVar("stickGhostPosition", clamp(Math.round(metres * 20) / 20, -2, 2.5));
    };

    const pairId = locked ? "pair" : null;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full select-none"
            role="img"
            aria-label="A heavy trolley and a light trolley on a track, with a faint joined pair the student can slide to predict where the locked pair ends up"
        >
            <defs>
                <filter id="stick-handle-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Setup readouts — the after-speed stays hidden until they have locked */}
            <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums", ...EASE_150 }}>
                <text x="24" y="28" fill={INK} opacity={opacity("heavy")}>
                    {`heavy 3 kg · ${heavyVelocity.toFixed(1)} m/s`}
                </text>
                <text x={VIEW_WIDTH - 24} y="28" fill={INK} textAnchor="end" opacity={opacity("light")}>
                    light 1 kg · 3.0 m/s
                </text>
                {locked && (
                    <text x={VIEW_WIDTH / 2} y="28" fill={ACCENT} textAnchor="middle" opacity={opacity("pair")}>
                        {`together: ${formatVelocity(afterVelocity)}`}
                    </text>
                )}
            </g>

            {/* Track and the lock-up mark — the before-state reference */}
            <g opacity={opacity("__structure")} style={EASE_150}>
                <line x1="30" y1={TRACK_Y} x2={VIEW_WIDTH - 30} y2={TRACK_Y} stroke={INK_QUIET} strokeWidth="1.5" />
                <line x1={PAIR_CONTACT_X} y1={TRACK_Y - 78} x2={PAIR_CONTACT_X} y2={TRACK_Y + 10} stroke={INK_QUIET} strokeWidth="1.5" strokeDasharray="4 5" />
                <text x={PAIR_CONTACT_X} y={TRACK_Y + 26} fill={INK_STRUCTURE} fontSize="11" textAnchor="middle">
                    they lock here
                </text>
            </g>

            {/* The prediction — a faint copy of the joined pair, draggable along the track */}
            <g {...hoverProps("pair")} opacity={opacity("pair")} style={EASE_150}>
                {isActive("pair") && (
                    <g opacity={0.28}>
                        <Trolley centerX={HEAVY_CONTACT_X + ghostOffset} width={84} height={30} label="" stroke={ACCENT} fill="none" strokeWidth={9} ghost />
                        <Trolley centerX={LIGHT_CONTACT_X + ghostOffset} width={56} height={26} label="" stroke={ACCENT} fill="none" strokeWidth={9} ghost />
                    </g>
                )}
                <g opacity={0.75}>
                    <Trolley centerX={HEAVY_CONTACT_X + ghostOffset} width={84} height={30} label="" stroke={ACCENT} fill="none" strokeWidth={weight("pair", 2)} ghost />
                    <Trolley centerX={LIGHT_CONTACT_X + ghostOffset} width={56} height={26} label="" stroke={ACCENT} fill="none" strokeWidth={weight("pair", 2)} ghost />
                    <text x={ghostHandleX} y={TRACK_Y - 70} fill={ACCENT} fontSize="11" textAnchor="middle">your guess</text>
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
                <g transform={`translate(${ghostHandleX} ${TRACK_Y - 56}) scale(${handleScale})`}>
                    <circle r="8" fill={ACCENT} filter="url(#stick-handle-shadow)" />
                </g>
            </g>

            {/* The two trolleys, drawn wherever the model puts them */}
            <g {...hoverProps(pairId ?? "heavy")} opacity={opacity(pairId ?? "heavy")} style={EASE_150}>
                <Trolley
                    centerX={heavyX}
                    width={84}
                    height={30}
                    label="3 kg"
                    stroke={locked ? ACCENT : INK_STRUCTURE}
                    fill={PAPER}
                    strokeWidth={weight(pairId ?? "heavy", locked ? 2.5 : 1.5)}
                />
            </g>
            <g {...hoverProps(pairId ?? "light")} opacity={opacity(pairId ?? "light")} style={EASE_150}>
                <Trolley
                    centerX={lightX}
                    width={56}
                    height={26}
                    label="1 kg"
                    stroke={locked ? ACCENT : INK_STRUCTURE}
                    fill={PAPER}
                    strokeWidth={weight(pairId ?? "light", locked ? 2.5 : 1.5)}
                />
            </g>

            {/* The verdict, once the second is up */}
            {finished && (
                <text x={VIEW_WIDTH / 2} y={TRACK_Y + 50} fill={INK} fontSize="12" textAnchor="middle" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {`your guess ${formatDistance(ghostPosition)}   ·   actually ${formatDistance(actualPosition)}`}
                </text>
            )}
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
            caption="Slide the faint joined pair to where you think it will be one second after the magnets catch, then press play."
        >
            <StickDrawing />
            <div className="px-6 pb-5">
                <FigureSlider
                    varName="stickHeavyVelocity"
                    label="Heavy trolley speed"
                    {...numberPropsFromDefinition(getVariableInfo("stickHeavyVelocity"))}
                    formatValue={(value) => `${value.toFixed(1)} m/s`}
                />
            </div>
            <InteractionHintSequence
                hintKey="stick-collision-predict"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Slide the faint joined pair to your prediction",
                        position: { x: "52%", y: "52%" },
                        dragPath: { type: "line", startOffset: { x: -30, y: 0 }, endOffset: { x: 30, y: 0 } },
                    },
                    {
                        gesture: "click",
                        label: "Press play to release the trolleys",
                        position: { x: "90%", y: "10%" },
                    },
                ]}
            />
        </Figure>
    );
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
                Fit magnets to the facing ends of the trolleys and they stop being two objects. They
                leave the collision locked together as a single lump, with the combined mass and one
                shared velocity. Before releasing them, slide the faint copy of the joined pair to where
                you think it will be one second after they lock, then press play and see how close you
                were.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-stick-formula" maxWidth="xl">
        <Block id="stick-formula" padding="lg">
            <FormulaBlock latex="m_1 v_1 + m_2 v_2 = (m_1 + m_2) v" />
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
                This is where the idea that the heavier object wins runs into trouble. Once the pair is
                locked there is only one speed, so the heavy trolley cannot come off faster than the
                light one. Against the light trolley's 3 m/s the heavy one brings{" "}
                <InlineScrubbleNumber
                    varName="stickHeavyVelocity"
                    {...numberPropsFromDefinition(getVariableInfo("stickHeavyVelocity"))}
                    formatValue={(value) => `${value.toFixed(1)}`}
                />{" "}
                m/s, and below 1 m/s the{" "}
                <InlineLinkedHighlight
                    varName="stickHighlight"
                    highlightId="pair"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("stickHighlight"))}
                >
                    joined pair
                </InlineLinkedHighlight>{" "}
                leaves to the left instead, dragged backwards by the lighter one.
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
                    hint="They are one object now, so ask what a single object can do"
                    visualizationHint={{
                        blockId: "stick-visual",
                        hintKey: "feedback-stick-shared-speed",
                        label: "Discover it yourself",
                        resetVars: { stickHeavyVelocity: 2, stickGhostPosition: 1, stickTime: 0, stickPlaying: false },
                        steps: [
                            {
                                gesture: "click",
                                label: "Press play and watch the gap between the two trolleys after they lock",
                                position: { x: "90%", y: "10%" },
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
                A 2 kg trolley rolling right at 3 m/s locks onto a 4 kg trolley standing still, so the
                joined pair moves off at{" "}
                <InlineFeedback
                    varName="answerStickPairSpeed"
                    correctValue={["1", "1.0", "1 m/s"]}
                    position="terminal"
                    successMessage="— yes, 6 kg m/s of momentum now has to be carried by 6 kg of trolley"
                    failureMessage="— not yet."
                    hint="Work out the momentum going in first, then share it over the mass that has to carry it"
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
