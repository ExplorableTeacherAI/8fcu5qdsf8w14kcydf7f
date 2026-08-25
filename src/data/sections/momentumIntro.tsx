import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph, InlineTooltip } from "@/components/atoms";
import { FormulaBlock } from "@/components/molecules";
import { VisualOptionCards } from "@/components/organisms";

export const momentumIntroBlocks: ReactElement[] = [
    <StackLayout key="layout-momentum-heading" maxWidth="xl">
        <Block id="momentum-heading" padding="md">
            <EditableH2 id="h2-momentum-heading" blockId="momentum-heading">
                Mass and Speed Together
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-momentum-setup" maxWidth="xl">
        <Block id="momentum-setup" padding="sm">
            <EditableParagraph id="para-momentum-setup" blockId="momentum-setup">
                A heavy trolley creeping along and a light trolley racing can be equally hard to stop.
                Neither mass nor velocity on its own captures what an object brings into a collision. The
                quantity that does is the two multiplied together, and it is called{" "}
                <InlineTooltip id="tooltip-momentum-definition" tooltip="Momentum is mass multiplied by velocity. It measures how much motion an object carries, and it points in the direction the object is travelling.">
                    momentum
                </InlineTooltip>.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-momentum-formula" maxWidth="xl">
        <Block id="momentum-formula" padding="lg">
            <FormulaBlock latex="p = m v" />
        </Block>
    </StackLayout>,

    <Block key="layout-momentum-visual" id="momentum-visual">
        <VisualOptionCards
            blockId="momentum-visual"
            cards={[
                {
                    id: "loaded-trolley-bar",
                    title: "A trolley students load with blocks, beside a bar showing its momentum",
                    looks: "Imagine an empty trolley on a straight track, a stack of identical 1 kg blocks sitting next to it, and a tall empty bar standing beside the track. Loading blocks and pulling the trolley's speed arrow out makes the bar climb, with its current value printed at the top.",
                    manipulate: "Load blocks onto the trolley and pull its speed arrow out to the length they want",
                    reveals: "One heavy slow trolley and one light fast trolley can carry exactly the same momentum, so neither mass nor speed alone tells the story.",
                    paradigm: "constructivist",
                    recommended: true,
                    secondView: {
                        shows: "A bar whose height is the trolley's momentum, with the running value printed",
                        role: "complementary",
                        syncedBy: "momentumMass and momentumVelocity, plus a shared hover highlight linking the trolley and its bar",
                    },
                },
                {
                    id: "matched-trolleys",
                    title: "Two trolleys on stacked tracks, one heavy and slow, one light and fast",
                    looks: "Imagine two straight tracks, one above the other. The top trolley is a bulky block that moves slowly, the bottom one a small block that moves quickly, and each pushes a shaded arrow ahead of it whose length is the momentum it carries.",
                    manipulate: "Stretch or shrink either trolley's arrow until the two shaded arrows are exactly the same length",
                    reveals: "Many different pairings of mass and speed give the same momentum, because it is the product of the two that matters.",
                    paradigm: "comparison",
                },
                {
                    id: "signed-momentum-scale",
                    title: "A trolley on a track that runs both ways, above a scale marked negative and positive",
                    looks: "Imagine a track with zero marked at its centre and a numbered scale running left and right beneath it. A trolley sits on the track with an arrow through it, and a marker slides along the scale below, crossing under zero when the trolley is sent to the left.",
                    manipulate: "Swing the trolley's arrow through zero from pointing right to pointing left",
                    reveals: "Direction is part of momentum: a trolley travelling left carries a negative amount, and that sign is what makes the totals work later.",
                    paradigm: "conventional",
                },
            ]}
        />
    </Block>,

    <StackLayout key="layout-momentum-direction" maxWidth="xl">
        <Block id="momentum-direction" padding="sm">
            <EditableParagraph id="para-momentum-direction" blockId="momentum-direction">
                Direction counts as much as size. Along a straight track we call one direction positive
                and the other negative, so a trolley rolling to the left carries negative momentum even
                though its mass and speed are ordinary positive numbers. Add the two trolleys' signed
                momenta together and you have the total the pair brings into the crash. That total is the
                number worth watching.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
