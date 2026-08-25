import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";

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
                unknown and one equation; bouncing leaves two of each, with kinetic energy supplying the
                second.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-wrapup-forward" maxWidth="xl">
        <Block id="wrapup-forward" padding="sm">
            <EditableParagraph id="para-wrapup-forward" blockId="wrapup-forward">
                The idea worth carrying away is the split between those two quantities. Momentum survives
                every collision, while energy only survives the springy ones. That is why a car's crumple
                zone is built to destroy energy on purpose, while the momentum goes wherever it was
                always going to go. Next comes the same reasoning off the straight track, where two
                objects meet at an angle and momentum has to balance in two directions at once.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
