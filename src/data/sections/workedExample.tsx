import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";
import { FormulaBlock } from "@/components/molecules";
import { VisualOptionCards } from "@/components/organisms";

export const workedExampleBlocks: ReactElement[] = [
    <StackLayout key="layout-worked-heading" maxWidth="xl">
        <Block id="worked-heading" padding="md">
            <EditableH2 id="h2-worked-heading" blockId="worked-heading">
                Working It Out Step by Step
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-worked-example" maxWidth="xl">
        <Block id="worked-example" padding="sm">
            <EditableParagraph id="para-worked-example" blockId="worked-example">
                Here is the whole method on one case. A 2 kg trolley moving right at 3 m/s meets a 1 kg
                trolley moving left at 1.2 m/s, and the magnets catch. The momentum going in is 2 times 3
                plus 1 times negative 1.2, which comes to 4.8 kg m/s to the right, and after the crash
                that same 4.8 is carried by 3 kg of trolley. Dividing gives 1.6 m/s, still to the right.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-worked-formula" maxWidth="xl">
        <Block id="worked-formula" padding="lg">
            <FormulaBlock latex="v = \frac{m_1 v_1 + m_2 v_2}{m_1 + m_2}" />
        </Block>
    </StackLayout>,

    <Block key="layout-worked-visual" id="worked-visual">
        <VisualOptionCards
            blockId="worked-visual"
            cards={[
                {
                    id: "frozen-stages",
                    title: "The crash frozen at each stage, with the matching line of the working lit up beside it",
                    looks: "Imagine the two trolleys on a track with a handle underneath that moves the moment being shown, from approaching, to touching, to locked and moving off. Beside the track the four lines of the calculation sit stacked, and the line belonging to the current moment brightens while the others fade back.",
                    manipulate: "Drag the handle along the track to walk the crash from approach to lock-up and back again",
                    reveals: "Every line of the working describes a moment students can see, so the algebra stops being a recipe and becomes a description of the crash.",
                    paradigm: "temporal",
                    recommended: true,
                    secondView: {
                        shows: "The four lines of the calculation, with the line matching the current moment highlighted",
                        role: "constructing",
                        syncedBy: "workedStage, plus a shared hover highlight linking each trolley to its term in the working",
                    },
                },
                {
                    id: "momentum-balance",
                    title: "A balance holding the momentum before the crash on one pan and after on the other",
                    looks: "Imagine the two trolleys sitting above a wide balance. The left pan holds the momentum coming in as a stack of blocks, the right pan holds the momentum going out, and the beam tips towards whichever side is heavier until the two stacks match.",
                    manipulate: "Drag the speed handle on the joined pair until the beam sits perfectly level",
                    reveals: "Only one final speed keeps the two totals equal, and finding it is exactly what solving the equation does.",
                    paradigm: "inversion",
                },
                {
                    id: "rewriting-working",
                    title: "Two adjustable trolleys above a calculation that rewrites itself as they change",
                    looks: "Imagine the pair on the track, each trolley carrying a stack of 1 kg blocks and an arrow that can be stretched. Under the track stand the same four lines of working, and every number in them changes the instant a block is added or an arrow is pulled.",
                    manipulate: "Add or remove blocks and stretch the arrow on either trolley",
                    reveals: "The same four steps work for any pair of numbers, including the ones where the answer comes out negative.",
                    paradigm: "conventional",
                },
            ]}
        />
    </Block>,

    <StackLayout key="layout-worked-pattern" maxWidth="xl">
        <Block id="worked-pattern" padding="sm">
            <EditableParagraph id="para-worked-pattern" blockId="worked-pattern">
                The pattern never changes. Add the signed momenta before the crash, divide by the total
                mass, and keep the sign that comes out. That sign is the part worth checking, because a
                negative answer means the pair leaves in the direction the second trolley arrived from.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
