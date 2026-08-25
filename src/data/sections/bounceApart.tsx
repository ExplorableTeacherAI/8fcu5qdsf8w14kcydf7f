import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph, InlineTooltip } from "@/components/atoms";
import { FormulaBlock } from "@/components/molecules";
import { VisualOptionCards } from "@/components/organisms";

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
                velocity. Momentum still balances exactly as before, but now there are two unknowns
                instead of one, so the momentum total alone no longer pins the answer down. The quantity
                that fills the gap is{" "}
                <InlineTooltip id="tooltip-kinetic-energy-definition" tooltip="Kinetic energy is the energy an object has because it is moving: one half times its mass times its speed squared. Unlike momentum it has no direction, so it is never negative.">
                    kinetic energy
                </InlineTooltip>.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-bounce-formula" maxWidth="xl">
        <Block id="bounce-formula" padding="lg">
            <FormulaBlock latex="E_k = \tfrac{1}{2} m v^2" />
        </Block>
    </StackLayout>,

    <Block key="layout-bounce-visual" id="bounce-visual">
        <VisualOptionCards
            blockId="bounce-visual"
            cards={[
                {
                    id: "bounce-versus-stick",
                    title: "The same crash on two tracks, bouncing above and sticking below, with a momentum and an energy bar for each",
                    looks: "Imagine two identical setups stacked one above the other. The top pair has springs on the bumpers and bounces apart; the bottom pair has magnets and locks together. Beside each track stand two bars, one for the total momentum and one for the total energy, filling up as each crash finishes.",
                    manipulate: "Drag the speed arrow on the incoming trolley, which launches both crashes at once, and compare the two pairs of bars",
                    reveals: "Momentum comes out the same on both tracks, but energy only survives on the bouncing one, and that difference is what elastic means.",
                    targetsMisconception: "Students think energy is always conserved in every collision",
                    paradigm: "comparison",
                    recommended: true,
                },
                {
                    id: "predict-energy-bar",
                    title: "Two trolleys about to collide, with an empty energy bar students fill in before it happens",
                    looks: "Imagine two trolleys closing on each other on a single track, and two bars standing beside it: one already full, showing the energy going in, and one empty beside it for the energy coming out. The empty bar can be dragged to any height, and the crash then plays and fills the real one right next to the guess.",
                    manipulate: "Drag the empty bar up to the height they think the energy will reach, then release the trolleys",
                    reveals: "Energy can drop sharply in a collision even when momentum comes out untouched.",
                    targetsMisconception: "Students think energy is always conserved in every collision",
                    paradigm: "prediction",
                },
                {
                    id: "set-the-outgoing-speeds",
                    title: "A finished collision whose two outgoing speeds students set themselves, with two meters judging the choice",
                    looks: "Imagine the crash already over, the two trolleys drifting apart with a stretchable arrow through each. Two meters stand beside the track, one for momentum and one for energy, and each fills in solid only when its total matches what went into the crash.",
                    manipulate: "Stretch the two outgoing arrows until both meters read solid at the same time",
                    reveals: "Only one pair of outgoing speeds keeps both totals at once, which is why a springy collision has a single answer.",
                    paradigm: "inversion",
                },
            ]}
        />
    </Block>,

    <StackLayout key="layout-bounce-reflect" maxWidth="xl">
        <Block id="bounce-reflect" padding="sm">
            <EditableParagraph id="para-bounce-reflect" blockId="bounce-reflect">
                Here is the catch. Momentum survives every collision, but kinetic energy does not. When
                the trolleys lock together, some of it goes into bending metal, into sound and into heat,
                and only a perfectly springy bounce hands all of it back.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
