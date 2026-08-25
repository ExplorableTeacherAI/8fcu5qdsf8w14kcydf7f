import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";
import { FormulaBlock } from "@/components/molecules";
import { VisualOptionCards } from "@/components/organisms";

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
                shared velocity. That makes this the easiest prediction in collision physics, because
                there is only one unknown number to find. So which trolley decides it, the heavy one or
                the fast one?
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-stick-formula" maxWidth="xl">
        <Block id="stick-formula" padding="lg">
            <FormulaBlock latex="m_1 v_1 + m_2 v_2 = (m_1 + m_2) v" />
        </Block>
    </StackLayout>,

    <Block key="layout-stick-visual" id="stick-visual">
        <VisualOptionCards
            blockId="stick-visual"
            cards={[
                {
                    id: "predict-joined-pair",
                    title: "A heavy trolley meets a light one, with a faint joined pair waiting further down the track",
                    looks: "Imagine a heavy trolley rolling to the right towards a light trolley rolling to the left, magnets on their facing ends. A faint copy of the two stuck together sits further along the track, and a flag marks the moment one second after they lock.",
                    manipulate: "Slide the faint joined pair to where they think it will be one second after the two trolleys lock together, then release the trolleys",
                    reveals: "The two leave at a single shared speed, and a light fast trolley can drag a heavy slow one backwards.",
                    targetsMisconception: "Students think the heavier object always ends up moving faster",
                    paradigm: "prediction",
                    recommended: true,
                },
                {
                    id: "aim-for-standstill",
                    title: "Two trolleys with stretchable speed arrows, above a strip showing the speed of the joined pair",
                    looks: "Imagine a heavy trolley on the left and a light trolley on the right, each with an arrow through it that can be stretched longer or shorter. Beneath the track a strip runs from left to right through a marked zero, and a pointer slides along it showing how fast the pair will move once locked.",
                    manipulate: "Stretch the light trolley's arrow until the pointer settles exactly on zero and the joined pair ends up standing still",
                    reveals: "The pair only stops dead when the two momenta are equal and opposite, which takes a much faster light trolley to balance a slow heavy one.",
                    paradigm: "goal",
                },
                {
                    id: "mirrored-crashes",
                    title: "The same crash on two tracks, heavy into light above and light into heavy below",
                    looks: "Imagine two tracks stacked one above the other. On the top track a heavy trolley runs into a stationary light one; on the bottom track a light trolley runs into a stationary heavy one at the same speed. Each locked pair slides on, leaving a trail of dots marking where it was every tenth of a second.",
                    manipulate: "Drag the shared speed arrow that launches both incoming trolleys and compare how far apart the two trails of dots spread",
                    reveals: "The joined pair always moves more slowly than the trolley that was moving, and how much more slowly depends only on the two masses.",
                    paradigm: "comparison",
                },
            ]}
        />
    </Block>,

    <StackLayout key="layout-stick-reflect" maxWidth="xl">
        <Block id="stick-reflect" padding="sm">
            <EditableParagraph id="para-stick-reflect" blockId="stick-reflect">
                This is where the idea that the heavier object wins runs into trouble. Once the pair is
                locked together there is only one speed, so the heavy trolley cannot end up moving faster
                than the light one. Mass does not decide who comes off faster. It decides how much of the
                total momentum each trolley put in.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
