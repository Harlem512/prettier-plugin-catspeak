import type { SupportOption } from 'prettier'

export enum CommaMode {
  /** No commas except when required */
  NONE = 'none',
  /** Print all non-trailing comments */
  NORMAL = 'normal',
  /** Add trailing comments when allowed */
  TRAILING = 'trailing',
}

export enum SemicolonMode {
  /** Only print required semicolons */
  REQUIRED = 'required',
  /** End all statements with a semicolon */
  ALL = 'all',
}

export interface CatspeakOptions {
  // required to fix typescript error when importing the plugin
  [key: string]: unknown
  /** colon mode */
  commaMode: CommaMode
  /** semicolon mode */
  semicolonMode: SemicolonMode
  /** double indent inside of some blocks */
  doubleIndent: boolean
  /** if functions with no arguments should drop ( ) */
  emptyFunctionArguments: boolean
  /** if operators should be wrapped with their second expression */
  wrapBinaryOperators: boolean
}

// adds catspeak options to the formatter
declare module 'prettier' {
  interface RequiredOptions extends CatspeakOptions {}
}

// MARK: Options
// https://prettier.io/docs/en/plugins.html#options
export const options: Record<keyof CatspeakOptions, SupportOption> = {
  commaMode: {
    category: 'catspeak',
    type: 'choice',
    default: CommaMode.TRAILING,
    description: 'Specifies how commas should be printed.',
    choices: [
      {
        value: CommaMode.NONE,
        description: 'Print no commas except when required. `fn(a, [b] c)`',
      },
      {
        value: CommaMode.NORMAL,
        description: "Print commas in a 'normal' manner. `fn(a, [b], c)`",
      },
      {
        value: CommaMode.TRAILING,
        description:
          'Print trailing commas when the statement wraps to a new line. `fn(a, [b, ], c, )`',
      },
    ],
  },
  doubleIndent: {
    category: 'catspeak',
    type: 'boolean',
    default: true,
    description:
      'Enable/disable double indenting some wrapped expression blocks, such as if conditions, accessors, and function calls.',
  },
  semicolonMode: {
    category: 'catspeak',
    type: 'choice',
    default: SemicolonMode.REQUIRED,
    description: 'Specifies how semicolons should be printed.',
    choices: [
      {
        value: SemicolonMode.REQUIRED,
        description: 'Prints only required semicolons. `let x return; fn()`',
      },
      {
        value: SemicolonMode.ALL,
        description:
          'Prints semicolons after every statement. `let x; return; fn();`',
      },
    ],
  },
  emptyFunctionArguments: {
    category: 'catspeak',
    type: 'boolean',
    default: false,
    description:
      'If enabled, function declarations with no arguments will not have parenthesis. `let fn = fun { ... }`',
  },
  wrapBinaryOperators: {
    category: 'catspeak',
    type: 'boolean',
    default: true,
    description:
      'If enabled, wrapped binary operation expressions will place their operator on a newline before the second operand.',
  },
}

// MARK: Default Options
export const defaultOptions: CatspeakOptions = {
  commaMode: CommaMode.TRAILING,
  doubleIndent: true,
  semicolonMode: SemicolonMode.REQUIRED,
  emptyFunctionArguments: false,
  wrapBinaryOperators: true,
}
