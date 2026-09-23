/**
 * The momentum ledger — three bars drawn tip to tail inside a collision figure.
 *
 *   heavy  ──────────▶            sky, its signed momentum from the zero mark
 *   light         ◀──             rose, starting where the heavy bar ends
 *   total  ───────▶               teal, zero mark to where the light bar ends
 *
 * Signed momenta add like arrows, so the total bar ends exactly under the
 * light bar's tip. Once the pair has locked the total bar is relabelled as what
 * the pair carries out, and it does not change length — that is conservation.
 */
import { type ReactNode } from "react";
import {
    EASE_150,
    HEAVY,
    HEAVY_EDGE,
    INK_QUIET,
    INK_STRUCTURE,
    LIGHT,
    LIGHT_EDGE,
    MOMENTUM,
    MOMENTUM_TEXT,
} from "./collisionPalette";

export const LEDGER_ROW = 17;
export const LEDGER_BAR = 10;
export const LEDGER_HEIGHT = 3 * LEDGER_ROW + 18; // title row + three bars

export type HighlightState = {
    opacity: (id: string) => number;
    weight: (id: string, resting: number) => number;
    isActive: (id: string) => boolean;
    hoverProps: (id: string) => {
        onPointerEnter: () => void;
        onPointerLeave: () => void;
    };
};

export const formatMomentum = (value: number) => `${value.toFixed(1)} kg m/s`;
const formatSigned = (value: number) =>
    value < 0 ? `−${Math.abs(value).toFixed(1)}` : `+${value.toFixed(1)}`;

function LedgerBar({
    startX,
    y,
    momentum,
    pxPerUnit,
    fill,
    edge,
    id,
    label,
    highlight,
    dashed,
}: {
    startX: number;
    y: number;
    momentum: number;
    pxPerUnit: number;
    fill: string;
    edge: string;
    id: string;
    label: ReactNode;
    highlight: HighlightState;
    dashed?: boolean;
}) {
    const { opacity, weight, isActive, hoverProps } = highlight;
    const length = Math.abs(momentum) * pxPerUnit;
    const tipX = startX + momentum * pxPerUnit;
    const x = Math.min(startX, tipX);
    const labelX = Math.max(startX, tipX) + 8; // always on the right, so it never leaves the view
    return (
        <g {...hoverProps(id)} opacity={opacity(id)} style={EASE_150}>
            {isActive(id) && (
                <rect x={x - 4} y={y - 4} width={length + 8} height={LEDGER_BAR + 8} rx="6" fill={fill} opacity={0.4} />
            )}
            <rect
                x={x}
                y={y}
                width={Math.max(length, 0)}
                height={LEDGER_BAR}
                rx="3"
                fill={dashed ? "none" : fill}
                stroke={edge}
                strokeWidth={weight(id, 1.5)}
                strokeDasharray={dashed ? "4 4" : undefined}
            />
            <text
                x={labelX}
                y={y + LEDGER_BAR - 1}
                fill={edge}
                fontSize="11"
                textAnchor="start"
                style={{ fontVariantNumeric: "tabular-nums" }}
            >
                {label}
            </text>
        </g>
    );
}

export function MomentumLedger({
    anchorX,
    top,
    pxPerUnit,
    heavyMomentum,
    lightMomentum,
    locked,
    pairMass,
    pairVelocity,
    highlight,
    ids,
}: {
    /** x of momentum = 0 */
    anchorX: number;
    /** y of the title row; the bars hang below it */
    top: number;
    pxPerUnit: number;
    heavyMomentum: number;
    lightMomentum: number;
    /** once true the total bar is relabelled as what the locked pair carries */
    locked: boolean;
    pairMass: number;
    pairVelocity: number;
    highlight: HighlightState;
    ids: { heavy: string; light: string; total: string };
}) {
    const total = heavyMomentum + lightMomentum;
    const heavyY = top + 18;
    const lightY = heavyY + LEDGER_ROW;
    const totalY = lightY + LEDGER_ROW;
    const heavyTipX = anchorX + heavyMomentum * pxPerUnit;
    const { opacity } = highlight;

    return (
        <g>
            <text x="24" y={top + 4} fill={INK_STRUCTURE} fontSize="11" opacity={opacity("__structure")} style={EASE_150}>
                momentum, kg m/s
            </text>
            {/* the zero mark every bar is measured from */}
            <line
                x1={anchorX}
                y1={heavyY - 6}
                x2={anchorX}
                y2={totalY + LEDGER_BAR + 6}
                stroke={INK_QUIET}
                strokeWidth="1.5"
                opacity={opacity("__structure")}
                style={EASE_150}
            />
            <text x={anchorX} y={totalY + LEDGER_BAR + 18} fill={INK_STRUCTURE} fontSize="10" textAnchor="middle" opacity={opacity("__structure")} style={EASE_150}>
                0
            </text>

            <g opacity={locked ? 0.45 : 1} style={EASE_150}>
                <LedgerBar
                    startX={anchorX}
                    y={heavyY}
                    momentum={heavyMomentum}
                    pxPerUnit={pxPerUnit}
                    fill={HEAVY}
                    edge={HEAVY_EDGE}
                    id={ids.heavy}
                    label={`heavy ${formatSigned(heavyMomentum)}`}
                    highlight={highlight}
                />
                <LedgerBar
                    startX={heavyTipX}
                    y={lightY}
                    momentum={lightMomentum}
                    pxPerUnit={pxPerUnit}
                    fill={LIGHT}
                    edge={LIGHT_EDGE}
                    id={ids.light}
                    label={`light ${formatSigned(lightMomentum)}`}
                    highlight={highlight}
                />
            </g>
            <LedgerBar
                startX={anchorX}
                y={totalY}
                momentum={total}
                pxPerUnit={pxPerUnit}
                fill={MOMENTUM}
                edge={MOMENTUM_TEXT}
                id={ids.total}
                label={
                    locked
                        ? `pair ${pairMass} × ${pairVelocity.toFixed(2)} = ${formatSigned(total)}`
                        : `total in ${formatSigned(total)}`
                }
                highlight={highlight}
            />
        </g>
    );
}
