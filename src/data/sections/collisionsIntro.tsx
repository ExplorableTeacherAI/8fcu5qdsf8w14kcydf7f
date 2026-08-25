import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH1, EditableParagraph } from "@/components/atoms";

export const collisionsIntroBlocks: ReactElement[] = [
    <StackLayout key="layout-collisions-intro-title" maxWidth="xl">
        <Block id="collisions-intro-title" padding="md">
            <EditableH1 id="h1-collisions-intro-title" blockId="collisions-intro-title">
                Collisions
            </EditableH1>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-collisions-intro-hook" maxWidth="xl">
        <Block id="collisions-intro-hook" padding="sm">
            <EditableParagraph id="para-collisions-intro-hook" blockId="collisions-intro-hook">
                Two trolleys sit on a low-friction track in the lab. You give one a push, it runs into
                the other, and half a second later both are moving in ways nobody in the room called out
                in advance. Physics can call them, and with surprisingly little information.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-collisions-intro-promise" maxWidth="xl">
        <Block id="collisions-intro-promise" padding="sm">
            <EditableParagraph id="para-collisions-intro-promise" blockId="collisions-intro-promise">
                The reason is that a colliding pair carries something through the crash untouched. By the
                end of this lesson you will be able to take two objects, their masses and their speeds,
                and work out how fast each one moves once they have hit. All you need to bring is the
                everyday sense of how heavy something is and how fast it is going; we build the rest here.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
