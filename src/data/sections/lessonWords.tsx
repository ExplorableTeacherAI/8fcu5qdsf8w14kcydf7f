/**
 * The key words of the lesson as coloured pills, each in the one hue that word
 * owns everywhere: the two trolleys (sky, rose) and the four quantities
 * (momentum teal, mass amber, velocity indigo, kinetic energy violet). The
 * figures use the same hues for the matching bodies, bars and arrows.
 */
import { type ReactNode } from "react";
import { InlineSpotColor } from "@/components/atoms";
import { getVariableInfo, spotColorPropsFromDefinition } from "../variables";

const word = (varName: string, fallback: string) =>
    ({ children = fallback }: { children?: ReactNode }) => (
        <InlineSpotColor varName={varName} {...spotColorPropsFromDefinition(getVariableInfo(varName))}>
            {children}
        </InlineSpotColor>
    );

export const HeavyWord = word("actorHeavy", "heavy trolley");
export const LightWord = word("actorLight", "light trolley");
export const MomentumWord = word("quantityMomentum", "momentum");
export const MassWord = word("quantityMass", "mass");
export const VelocityWord = word("quantityVelocity", "velocity");
export const EnergyWord = word("quantityEnergy", "kinetic energy");

/**
 * A live number in prose, styled like an InlineSpotColor pill but deliberately
 * NOT the editable component: the editor serialises a spot colour's text for
 * round-tripping, which would freeze a value that changes with the figures.
 * Colour comes from the lesson palette so it matches the quantity it reports.
 */
export const LivePill = ({ color, children }: { color: string; children: ReactNode }) => (
    <span
        className="inline-flex items-center rounded-md font-semibold leading-tight"
        style={{
            backgroundColor: color,
            color: "#1a1a2e",
            padding: "1px 6px",
            fontSize: "0.92em",
            letterSpacing: "0.01em",
            boxShadow: `0 1px 3px ${color}44`,
            fontVariantNumeric: "tabular-nums",
        }}
    >
        {children}
    </span>
);
