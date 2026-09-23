/**
 * Variables Configuration
 * =======================
 * 
 * CENTRAL PLACE TO DEFINE ALL SHARED VARIABLES
 * 
 * This file defines all variables that can be shared across sections.
 * AI agents should read this file to understand what variables are available.
 * 
 * USAGE:
 * 1. Define variables here with their default values and metadata
 * 2. Use them in any section with: const x = useVar('variableName', defaultValue)
 * 3. Update them with: setVar('variableName', newValue)
 */

import { type VarValue } from '@/stores';

/**
 * Variable definition with metadata
 */
export interface VariableDefinition {
    /** Default value */
    defaultValue: VarValue;
    /** Human-readable label */
    label?: string;
    /** Description for AI agents */
    description?: string;
    /** Variable type hint */
    type?: 'number' | 'text' | 'boolean' | 'select' | 'array' | 'object' | 'spotColor' | 'linkedHighlight';
    /** Unit (e.g., 'Hz', '°', 'm/s') - for numbers */
    unit?: string;
    /** Minimum value (for number sliders) */
    min?: number;
    /** Maximum value (for number sliders) */
    max?: number;
    /** Step increment (for number sliders) */
    step?: number;
    /** Display color for InlineScrubbleNumber / InlineSpotColor (e.g. '#D81B60') */
    color?: string;
    /** Options for 'select' type variables */
    options?: string[];
    /** Placeholder text for text inputs */
    placeholder?: string;
    /**
     * Correct answer for cloze input validation.
     * Accepts a single string, pipe-separated alternates (e.g. "first | 1 | 1st"),
     * or an array of accepted answers (e.g. ["first", "1", "1st"]).
     */
    correctAnswer?: string | string[];
    /** Whether cloze matching is case sensitive */
    caseSensitive?: boolean;
    /** Background color for inline components */
    bgColor?: string;
    /** Schema hint for object types (for AI agents) */
    schema?: string;
}

/**
 * =====================================================
 * 🎯 DEFINE YOUR VARIABLES HERE
 * =====================================================
 * 
 * SUPPORTED TYPES:
 * 
 * 1. NUMBER (slider):
 *    { defaultValue: 5, type: 'number', min: 0, max: 10, step: 1 }
 * 
 * 2. TEXT (free text):
 *    { defaultValue: 'Hello', type: 'text', placeholder: 'Enter text...' }
 * 
 * 3. SELECT (dropdown):
 *    { defaultValue: 'sine', type: 'select', options: ['sine', 'cosine', 'tangent'] }
 * 
 * 4. BOOLEAN (toggle):
 *    { defaultValue: true, type: 'boolean' }
 * 
 * 5. ARRAY (list of numbers):
 *    { defaultValue: [1, 2, 3], type: 'array' }
 * 
 * 6. OBJECT (complex data):
 *    { defaultValue: { x: 5, y: 10 }, type: 'object', schema: '{ x: number, y: number }' }
 */
export const variableDefinitions: Record<string, VariableDefinition> = {
    // ─────────────────────────────────────────
    // LESSON-WIDE: colour keys for the word pills (see sections/lessonWords.tsx)
    // One hue per idea, used for nothing else anywhere in the lesson.
    // ─────────────────────────────────────────
    actorHeavy: {
        defaultValue: 'heavy trolley',
        type: 'text',
        label: 'Heavy trolley',
        description: 'Colour key for the heavy trolley: sky blue, used for nothing else',
        color: '#62CCF9',
    },
    actorLight: {
        defaultValue: 'light trolley',
        type: 'text',
        label: 'Light trolley',
        description: 'Colour key for the light trolley: rose, used for nothing else',
        color: '#F8A0CD',
    },
    quantityMomentum: {
        defaultValue: 'momentum',
        type: 'text',
        label: 'Momentum',
        description: 'Colour key for momentum p: teal, the bars and strips in every figure',
        color: '#62D0AD',
    },
    quantityMass: {
        defaultValue: 'mass',
        type: 'text',
        label: 'Mass',
        description: 'Colour key for mass m: amber, the block stack on a trolley bed',
        color: '#F7B23B',
    },
    quantityVelocity: {
        defaultValue: 'velocity',
        type: 'text',
        label: 'Velocity',
        description: 'Colour key for velocity v: indigo, the arrows on the trolleys',
        color: '#8E90F5',
    },
    quantityEnergy: {
        defaultValue: 'kinetic energy',
        type: 'text',
        label: 'Kinetic energy',
        description: 'Colour key for kinetic energy: violet, the energy bars',
        color: '#AC8BF9',
    },

    // ─────────────────────────────────────────
    // SECTION: Collisions (opening)
    // ─────────────────────────────────────────
    introPullback: {
        defaultValue: 1,
        type: 'number',
        label: 'Pull back distance',
        description: 'How far the heavy trolley is pulled back before the push, which sets how fast it arrives',
        unit: 'm',
        min: 0.4,
        max: 2,
        step: 0.05,
        color: '#1E8FC2',
    },
    introTime: {
        defaultValue: 0,
        type: 'number',
        label: 'Opening playback time',
        description: 'Seconds elapsed in the opening collision playback',
        unit: 's',
        min: 0,
        max: 1.75,
        step: 0.01,
    },
    introPlaying: {
        defaultValue: false,
        type: 'boolean',
        label: 'Opening collision playing',
        description: 'Whether the opening collision is running',
    },

    // ─────────────────────────────────────────
    // SECTION: Mass and Speed Together
    // ─────────────────────────────────────────
    momentumMass: {
        defaultValue: 3,
        type: 'number',
        label: 'Trolley mass',
        description: 'Mass of the single trolley, set by the stack of 1 kg blocks on its bed',
        unit: 'kg',
        min: 1,
        max: 5,
        step: 1,
        color: '#F7B23B',
    },
    momentumVelocity: {
        defaultValue: 2,
        type: 'number',
        label: 'Trolley velocity',
        description: 'Signed velocity of the trolley along the track, negative to the left',
        unit: 'm/s',
        min: -3,
        max: 3,
        step: 0.1,
        color: '#8E90F5',
    },
    momentumHighlight: {
        defaultValue: '',
        type: 'text',
        label: 'Momentum view highlight',
        description: "Which quantity is highlighted across both views: '' | 'massStack' | 'velocityArrow' | 'momentumBar'",
        color: '#62D0AD',
        bgColor: 'rgba(98, 208, 173, 0.22)',
    },
    momentumProduct: {
        defaultValue: 6,
        type: 'number',
        label: 'Momentum p',
        description: 'Live value of mass times velocity for the single trolley, written by the trolley figure and shown by \\val{} in the formula',
        unit: 'kg m/s',
        min: -15,
        max: 15,
        step: 0.1,
        color: '#1F9E78',
    },
    answerMomentumProduct: {
        defaultValue: '',
        type: 'text',
        label: 'Momentum product answer',
        description: 'Student answer for the momentum of a 4 kg trolley at 2.5 m/s',
        placeholder: '???',
        correctAnswer: '10',
        color: '#2563EB',
    },
    // ─────────────────────────────────────────
    // SECTION: Adding Momentum
    // ─────────────────────────────────────────
    addHeavyVelocity: {
        defaultValue: 2,
        type: 'number',
        label: 'Heavy trolley velocity',
        description: 'Signed velocity of the 3 kg trolley before the crash, negative to the left',
        unit: 'm/s',
        min: -3,
        max: 3,
        step: 0.1,
        color: '#8E90F5',
    },
    addLightVelocity: {
        defaultValue: -3,
        type: 'number',
        label: 'Light trolley velocity',
        description: 'Signed velocity of the 1 kg trolley before the crash, negative to the left',
        unit: 'm/s',
        min: -3,
        max: 3,
        step: 0.1,
        color: '#8E90F5',
    },
    addTotalMomentum: {
        defaultValue: 3,
        type: 'number',
        label: 'Total momentum',
        description: 'Live signed sum of the two momenta, written by the adding figure for \\val{} in the formula',
        unit: 'kg m/s',
        min: -12,
        max: 12,
        step: 0.1,
        color: '#1F9E78',
    },
    addHighlight: {
        defaultValue: '',
        type: 'text',
        label: 'Adding momentum highlight',
        description: "Which element is highlighted: '' | 'addHeavy' | 'addLight' | 'addTotal'",
        color: '#62D0AD',
        bgColor: 'rgba(98, 208, 173, 0.22)',
    },
    answerAddTotal: {
        defaultValue: '',
        type: 'text',
        label: 'Total momentum answer',
        description: 'Student answer for the total momentum of a 2 kg trolley at 3 m/s right and a 1 kg trolley at 2 m/s left',
        placeholder: '???',
        correctAnswer: ['4', '4.0', '+4'],
        color: '#2563EB',
    },
    answerAddCancel: {
        defaultValue: '',
        type: 'text',
        label: 'Cancelling momentum answer',
        description: 'Student answer for the total when the 1 kg trolley rolls left at 6 m/s instead',
        placeholder: '???',
        correctAnswer: ['0', '0.0'],
        color: '#2563EB',
    },
    // ─────────────────────────────────────────
    // SECTION: When Things Stick Together
    // ─────────────────────────────────────────
    stickHeavyVelocity: {
        defaultValue: 2,
        type: 'number',
        label: 'Heavy trolley velocity',
        description: 'Velocity of the 3 kg trolley moving to the right before the magnets catch',
        unit: 'm/s',
        min: 0.5,
        max: 3,
        step: 0.1,
        color: '#8E90F5',
    },
    stickGhostPosition: {
        defaultValue: 1,
        type: 'number',
        label: 'Predicted position',
        description: 'Where the student places the faint joined pair, in metres from the lock-up point',
        unit: 'm',
        min: -2,
        max: 2.5,
        step: 0.05,
        color: '#F4A89A',
    },
    stickTime: {
        defaultValue: 0,
        type: 'number',
        label: 'Collision playback time',
        description: 'Seconds elapsed in the collision playback, from release to one second after lock-up',
        unit: 's',
        min: 0,
        max: 1.6,
        step: 0.01,
    },
    stickPlaying: {
        defaultValue: false,
        type: 'boolean',
        label: 'Collision playing',
        description: 'Whether the collision playback is running',
    },
    stickHighlight: {
        defaultValue: '',
        type: 'text',
        label: 'Sticking view highlight',
        description: "Which element is highlighted: '' | 'stickHeavy' | 'stickLight' | 'stickTotal' | 'stickPair' (the pair, its faint prediction, and the total bar once locked)",
        color: '#62D0AD',
        bgColor: 'rgba(98, 208, 173, 0.22)',
    },
    stickTotalMomentum: {
        defaultValue: 3,
        type: 'number',
        label: 'Momentum going in',
        description: 'Live signed total of the two momenta before the magnets catch, written by the sticking figure for \\val{} in the formula',
        unit: 'kg m/s',
        min: -3,
        max: 6,
        step: 0.1,
        color: '#1F9E78',
    },
    stickAfterVelocity: {
        defaultValue: 0.75,
        type: 'number',
        label: 'Joined pair velocity',
        description: 'Live velocity of the locked pair, written by the sticking figure for \\val{} in the formula',
        unit: 'm/s',
        min: -0.75,
        max: 1.5,
        step: 0.01,
        color: '#5B5FD9',
    },
    answerStickSameSpeed: {
        defaultValue: '',
        type: 'select',
        label: 'Shared speed answer',
        description: 'Student answer for how the two trolleys move once locked together',
        placeholder: '???',
        correctAnswer: 'at exactly the same speed as',
        options: ['faster than', 'slower than', 'at exactly the same speed as'],
        color: '#2563EB',
    },
    answerStickPairSpeed: {
        defaultValue: '',
        type: 'text',
        label: 'Joined pair speed answer',
        description: 'Student answer for the speed of a 2 kg trolley at 3 m/s locking onto a stationary 4 kg trolley',
        placeholder: '???',
        correctAnswer: ['1', '1.0', '1 m/s'],
        color: '#2563EB',
    },
    // ─────────────────────────────────────────
    // SECTION: Working It Out Step by Step
    // ─────────────────────────────────────────
    workedStage: {
        defaultValue: 0,
        type: 'number',
        label: 'Worked example stage',
        description: 'Position along the worked collision, from 0 (approaching) to 3 (moving off locked)',
        min: 0,
        max: 3,
        step: 0.01,
        color: '#64748B',
    },
    workedHighlight: {
        defaultValue: '',
        type: 'text',
        label: 'Worked example highlight',
        description: "Which element is highlighted across the trolleys, the ledger and the working: '' | 'workedHeavy' | 'workedLight' | 'workedTotal' | 'workedPair'",
        color: '#62D0AD',
        bgColor: 'rgba(98, 208, 173, 0.22)',
    },
    answerWorkedPairSpeed: {
        defaultValue: '',
        type: 'text',
        label: 'Practice pair speed',
        description: 'Student answer for a 5 kg trolley at 2 m/s locking onto a 3 kg trolley at 2 m/s the other way',
        placeholder: '???',
        correctAnswer: ['0.5', '.5', '0.50'],
        color: '#2563EB',
    },
    answerWorkedNegative: {
        defaultValue: '',
        type: 'text',
        label: 'Practice negative velocity',
        description: 'Student answer for the same pair when the 3 kg trolley arrives at 6 m/s',
        placeholder: '???',
        correctAnswer: ['-1', '\u22121', '-1.0'],
        color: '#2563EB',
    },
    // ─────────────────────────────────────────
    // SECTION: When Things Bounce Apart
    // ─────────────────────────────────────────
    bounceSpeed: {
        defaultValue: 2,
        type: 'number',
        label: 'Incoming speed',
        description: 'Speed of the 2 kg trolley that launches both crashes',
        unit: 'm/s',
        min: 1,
        max: 3,
        step: 0.1,
        color: '#8E90F5',
    },
    bounceTime: {
        defaultValue: 0,
        type: 'number',
        label: 'Comparison playback time',
        description: 'Seconds elapsed in the side by side playback of the two crashes',
        unit: 's',
        min: 0,
        max: 1.6,
        step: 0.01,
    },
    bouncePlaying: {
        defaultValue: false,
        type: 'boolean',
        label: 'Comparison playing',
        description: 'Whether the two crashes are running',
    },
    bounceHighlight: {
        defaultValue: '',
        type: 'text',
        label: 'Comparison highlight',
        description: "Which quantity is highlighted: '' | 'bounceMomentum' | 'bounceEnergy' | 'bounceRowBounce' | 'bounceRowStick'",
        color: '#62D0AD',
        bgColor: 'rgba(98, 208, 173, 0.22)',
    },
    bounceEnergyBefore: {
        defaultValue: 4,
        type: 'number',
        label: 'Kinetic energy going in',
        description: 'Live kinetic energy of the incoming 2 kg trolley, written by the comparison figure for \\val{} in the formula',
        unit: 'J',
        min: 1,
        max: 9,
        step: 0.1,
        color: '#7C4DDB',
    },
    bounceEnergyLocked: {
        defaultValue: 2.7,
        type: 'number',
        label: 'Kinetic energy kept when locked',
        description: 'Live kinetic energy the locked pair keeps, written by the comparison figure for \\val{} in the formula',
        unit: 'J',
        min: 0.6,
        max: 6,
        step: 0.1,
        color: '#7C4DDB',
    },
    answerBounceEnergy: {
        defaultValue: '',
        type: 'select',
        label: 'Energy after locking answer',
        description: 'Student answer comparing kinetic energy after locking with the energy before',
        placeholder: '???',
        correctAnswer: 'smaller than',
        options: ['smaller than', 'the same as', 'larger than'],
        color: '#2563EB',
    },
    answerBounceJoules: {
        defaultValue: '',
        type: 'text',
        label: 'Energy after locking value',
        description: 'Student answer for the kinetic energy of two 4 kg trolleys locked together at 1 m/s',
        placeholder: '???',
        correctAnswer: ['4', '4 J', '4.0'],
        color: '#2563EB',
    },
    answerMomentumDirection: {
        defaultValue: '',
        type: 'text',
        label: 'Negative momentum answer',
        description: 'Student answer for the momentum of the same trolley travelling left',
        placeholder: '???',
        correctAnswer: ['-10', '\u221210'],
        color: '#2563EB',
    },


    // Uncomment and modify these examples for your lesson:

    /*
    // ─────────────────────────────────────────
    // NUMBER - Use with sliders
    // ─────────────────────────────────────────
    myValue: {
        defaultValue: 5,
        type: 'number',
        label: 'My Value',
        description: 'A number that controls something',
        unit: 'm',           // optional unit display
        min: 0,
        max: 10,
        step: 0.5,
    },

    // ─────────────────────────────────────────
    // TEXT - Free text input
    // ─────────────────────────────────────────
    lessonTitle: {
        defaultValue: 'My Lesson',
        type: 'text',
        label: 'Lesson Title',
        description: 'The title of your lesson',
        placeholder: 'Enter a title...',
    },

    // ─────────────────────────────────────────
    // SELECT - Dropdown with options
    // ─────────────────────────────────────────
    difficulty: {
        defaultValue: 'medium',
        type: 'select',
        label: 'Difficulty',
        description: 'The difficulty level of the lesson',
        options: ['easy', 'medium', 'hard', 'expert'],
    },

    // ─────────────────────────────────────────
    // BOOLEAN - Toggle switch
    // ─────────────────────────────────────────
    showHints: {
        defaultValue: true,
        type: 'boolean',
        label: 'Show Hints',
        description: 'Toggle to show or hide hints',
    },

    // ─────────────────────────────────────────
    // ARRAY - List of numbers
    // ─────────────────────────────────────────
    dataPoints: {
        defaultValue: [1, 4, 9, 16, 25],
        type: 'array',
        label: 'Data Points',
        description: 'Y-values for plotting a graph',
    },

    // ─────────────────────────────────────────
    // OBJECT - Complex structured data
    // ─────────────────────────────────────────
    graphSettings: {
        defaultValue: { 
            xMin: -10, 
            xMax: 10, 
            showGrid: true 
        },
        type: 'object',
        label: 'Graph Settings',
        description: 'Configuration for the graph display',
        schema: '{ xMin: number, xMax: number, showGrid: boolean }',
    },
    */
};

/**
 * Get all variable names (for AI agents to discover)
 */
export const getVariableNames = (): string[] => {
    return Object.keys(variableDefinitions);
};

/**
 * Get a variable's default value
 */
export const getDefaultValue = (name: string): VarValue => {
    return variableDefinitions[name]?.defaultValue ?? 0;
};

/**
 * Get a variable's metadata
 */
export const getVariableInfo = (name: string): VariableDefinition | undefined => {
    return variableDefinitions[name];
};

/**
 * Get all default values as a record (for initialization)
 */
export const getDefaultValues = (): Record<string, VarValue> => {
    const defaults: Record<string, VarValue> = {};
    for (const [name, def] of Object.entries(variableDefinitions)) {
        defaults[name] = def.defaultValue;
    }
    return defaults;
};

/**
 * Get number props for InlineScrubbleNumber from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx, or getExampleVariableInfo(name) in exampleBlocks.tsx.
 */
export function numberPropsFromDefinition(def: VariableDefinition | undefined): {
    defaultValue?: number;
    min?: number;
    max?: number;
    step?: number;
    color?: string;
} {
    if (!def || def.type !== 'number') return {};
    return {
        defaultValue: def.defaultValue as number,
        min: def.min,
        max: def.max,
        step: def.step,
        ...(def.color ? { color: def.color } : {}),
    };
}

/**
 * Get cloze input props for InlineClozeInput from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx, or getExampleVariableInfo(name) in exampleBlocks.tsx.
 */
/**
 * Get cloze choice props for InlineClozeChoice from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx.
 */
export function choicePropsFromDefinition(def: VariableDefinition | undefined): {
    placeholder?: string;
    color?: string;
    bgColor?: string;
} {
    if (!def || def.type !== 'select') return {};
    return {
        ...(def.placeholder ? { placeholder: def.placeholder } : {}),
        ...(def.color ? { color: def.color } : {}),
        ...(def.bgColor ? { bgColor: def.bgColor } : {}),
    };
}

/**
 * Get toggle props for InlineToggle from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx.
 */
export function togglePropsFromDefinition(def: VariableDefinition | undefined): {
    color?: string;
    bgColor?: string;
} {
    if (!def || def.type !== 'select') return {};
    return {
        ...(def.color ? { color: def.color } : {}),
        ...(def.bgColor ? { bgColor: def.bgColor } : {}),
    };
}

export function clozePropsFromDefinition(def: VariableDefinition | undefined): {
    placeholder?: string;
    color?: string;
    bgColor?: string;
    caseSensitive?: boolean;
} {
    if (!def || def.type !== 'text') return {};
    return {
        ...(def.placeholder ? { placeholder: def.placeholder } : {}),
        ...(def.color ? { color: def.color } : {}),
        ...(def.bgColor ? { bgColor: def.bgColor } : {}),
        ...(def.caseSensitive !== undefined ? { caseSensitive: def.caseSensitive } : {}),
    };
}

/**
 * Get spot-color props for InlineSpotColor from a variable definition.
 * Extracts the `color` field.
 *
 * @example
 * <InlineSpotColor
 *     varName="radius"
 *     {...spotColorPropsFromDefinition(getVariableInfo('radius'))}
 * >
 *     radius
 * </InlineSpotColor>
 */
export function spotColorPropsFromDefinition(def: VariableDefinition | undefined): {
    color: string;
} {
    return {
        color: def?.color ?? '#8B5CF6',
    };
}

/**
 * Get linked-highlight props for InlineLinkedHighlight from a variable definition.
 * Extracts the `color` and `bgColor` fields.
 *
 * @example
 * <InlineLinkedHighlight
 *     varName="activeHighlight"
 *     highlightId="radius"
 *     {...linkedHighlightPropsFromDefinition(getVariableInfo('activeHighlight'))}
 * >
 *     radius
 * </InlineLinkedHighlight>
 */
export function linkedHighlightPropsFromDefinition(def: VariableDefinition | undefined): {
    color?: string;
    bgColor?: string;
} {
    return {
        ...(def?.color ? { color: def.color } : {}),
        ...(def?.bgColor ? { bgColor: def.bgColor } : {}),
    };
}

/**
 * Build the `variables` prop for FormulaBlock from variable definitions.
 *
 * Takes an array of variable names and returns the config map expected by
 * `<FormulaBlock variables={...} />`.
 *
 * @example
 * import { scrubVarsFromDefinitions } from './variables';
 *
 * <FormulaBlock
 *     latex="\scrub{mass} \times \scrub{accel}"
 *     variables={scrubVarsFromDefinitions(['mass', 'accel'])}
 * />
 */
export function scrubVarsFromDefinitions(
    varNames: string[],
): Record<string, { min?: number; max?: number; step?: number; color?: string }> {
    const result: Record<string, { min?: number; max?: number; step?: number; color?: string }> = {};
    for (const name of varNames) {
        const def = variableDefinitions[name];
        if (!def) continue;
        result[name] = {
            ...(def.min !== undefined ? { min: def.min } : {}),
            ...(def.max !== undefined ? { max: def.max } : {}),
            ...(def.step !== undefined ? { step: def.step } : {}),
            ...(def.color ? { color: def.color } : {}),
        };
    }
    return result;
}
