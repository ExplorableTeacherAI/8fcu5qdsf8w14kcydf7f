import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph, InlineFormula, InlineHyperlink, Table } from "@/components/atoms";
import { ENERGY, ENERGY_BG, ENERGY_TEXT, FORMULA_COLORS, MOMENTUM, MOMENTUM_BG, MOMENTUM_TEXT } from "./collisionPalette";
import { EnergyWord, MomentumWord } from "./lessonWords";

export const collisionsWrapUpBlocks: ReactElement[] = [
    <StackLayout key="layout-wrapup-heading" maxWidth="xl">
        <Block id="wrapup-heading" padding="md">
            <EditableH2 id="h2-wrapup-heading" blockId="wrapup-heading">
                Wrapping Up
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-wrapup-summary" maxWidth="xl">
        <Block id="wrapup-summary" padding="sm">
            <EditableParagraph id="para-wrapup-summary" blockId="wrapup-summary">
                So the crash itself was never the mystery. Whatever the trolleys do in that half second,
                the signed momenta they carried in add up to the momenta they carry out, and that one
                sentence is enough to predict a final velocity nobody has measured. Sticking leaves one
                unknown and one equation; bouncing leaves two of each, with <EnergyWord /> supplying the
                second.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-wrapup-table" maxWidth="xl">
        <Block id="wrapup-table" padding="sm">
            <Table
                columns={[
                    { header: "Quantity", align: "left" },
                    { header: "Magnets: they lock together", align: "left" },
                    { header: "Springy bumpers: they bounce apart", align: "left" },
                ]}
                rows={[
                    {
                        cells: [
                            <InlineFormula latex="\clr{p}{p} = \clr{m}{m}\clr{v}{v}" colorMap={FORMULA_COLORS} />,
                            <InlineHyperlink targetBlockId="stick-visual" color={MOMENTUM_TEXT} bgColor={MOMENTUM_BG} showHint={false}>
                                conserved — the teal bar keeps its length
                            </InlineHyperlink>,
                            <InlineHyperlink targetBlockId="bounce-visual" color={MOMENTUM_TEXT} bgColor={MOMENTUM_BG} showHint={false}>
                                conserved — the teal bar keeps its length
                            </InlineHyperlink>,
                        ],
                        highlight: true,
                        highlightColor: MOMENTUM,
                    },
                    {
                        cells: [
                            <InlineFormula latex="\clr{e}{E_k} = \tfrac{1}{2}\clr{m}{m}\clr{v}{v}^2" colorMap={FORMULA_COLORS} />,
                            <InlineHyperlink targetBlockId="bounce-visual" color={ENERGY_TEXT} bgColor={ENERGY_BG} showHint={false}>
                                some is lost — the violet bar shrinks
                            </InlineHyperlink>,
                            <InlineHyperlink targetBlockId="bounce-visual" color={ENERGY_TEXT} bgColor={ENERGY_BG} showHint={false}>
                                conserved — the violet bar comes back whole
                            </InlineHyperlink>,
                        ],
                    },
                    {
                        cells: [
                            "Unknowns after the crash",
                            "one shared velocity, so momentum alone fixes it",
                            "two velocities, so momentum and energy are both needed",
                        ],
                    },
                ]}
                color={ENERGY}
                caption="The two kinds of crash side by side. The highlighted row is the one that never fails: momentum survives every collision. Click a cell to jump back to its figure."
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-wrapup-forward" maxWidth="xl">
        <Block id="wrapup-forward" padding="sm">
            <EditableParagraph id="para-wrapup-forward" blockId="wrapup-forward">
                The idea worth carrying away is the split between those two quantities. <MomentumWord />{" "}
                survives every collision, while <EnergyWord>energy</EnergyWord> only survives the springy
                ones. That is why a car's crumple zone is built to destroy energy on purpose. Next comes
                the same reasoning off the straight track, where two objects meet at an angle and
                momentum has to balance in two directions at once.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
