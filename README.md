# [Prettier](https://prettier.io/) Plugin for [Catspeak](https://github.com/katsaii/catspeak-lang)

> Once men turned their thinking over to machines in the hope that this would set them free. But that only permitted other men with machines to enslave them.

An unofficial Prettier plugin for formatting Catspeak's `.meow` files and providing syntax highlighting. Still a work in-progress.

## Features

- Catspeak syntax highlighting!
- Pretty printing using Prettier's algorithm and mostly following Javascript formatting.
- Lovingly hand-written printing and ast-building logic.
- Comment support using Prettier's builtin plugin comment algorithm (it tries its best).
- Doesn't format files with syntax errors.
- Test cases!

## To Install

Download a [release](https://github.com/Harlem512/prettier-plugin-catspeak/releases) and run the `Extensions: Install from VSIX...` command palette option to install it.

Marketplace download coming when it's done.

## Options

### commaMode

Changes how commas are handled. `normal` prints non-trailing commas, `trailing` prints a trailing comma on wrapped lines, `none` attempts to remove all commas except those required to remove expression ambiguity. Default `trailing`.

```catspeak
-- commaMode = "normal"
[ a, b ]
[
  a,
  [b],
  long
]

-- commaMode = "trailing"
[ a, b ]
[
  a,
  [b],
  long,
]

-- commaMode = "none"
[ a b ]
[
  a,
  [b]
  long
]
```

### printSemicolons

Changes how semicolons are handled. If enabled, each statement will be terminated with a semicolon. Default `false`.

```catspeak
-- printSemicolons = false
let foo = bar;
(baz)

-- printSemicolons = true
let foo = bar;
(baz);
```

### emptyFunctionArguments

Determines if function declaration expressions with no arguments should have empty parenthesis. Default `false`.

```catspeak
-- emptyFunctionArguments = true
let fn = fun { }

-- emptyFunctionArguments = false
let fn = fun () { }
```

### wrapBinaryOperators

If enabled, wrapped binary operation expressions will place their operator on a newline before the second operand. Default `false`.

```catspeak
-- wrapBinaryOperators = true
x = foo
    + bar

-- wrapBinaryOperators = false
x = foo +
    bar
```

### parseCatchThrow

Version 3.2.0 of Catspeak introduces the `throw` and `catch` expressions and their keywords. When enabled, these keywords will be parsed as keywords instead of identifiers. Default `true`.

```catspeak
-- parseCatchThrow = true
let throw; -- errors
throw "hello"; -- formatted as an expression

-- parseCatchThrow = false
let throw; -- no error
throw; -- formatted as a identifier and a string
"hello";
```

### indentAssignment

If enabled, assignment values that are a block statement (catch, do, if, match, while, with) will be indented. Default `false`.

```catspeak
-- indentAssignment = false
let x = do {
  long
}

-- indentAssignment = true
let x = do {
      long
    }
```

## Developers

The repository consists of two parts, a Prettier plugin (living in `src/`) and the VSCode extension (living in `/vscode-extension`). All test cases operate on the plugin in isolation.

- `npm test` in the root directory runs Jest with all test cases.
- To test the extension, use VSCode's F5 Run Extension shortcut. This builds the plugin and extension, then opens a VSCode window.
- `npm run extension-package` bundles the extension into a `.vsix` file placed in `/vscode-extension/dist`

## TODO

- New-line before statements to force wrapping (?)

Formatting weirdness (to fix):

```catspeak
if long
    and long {
  ...
}

if (
  long
    and long
) {
  ...
}
```

```catspeak
{
  a, -- significant trailing comment

  -- newline above is erased
  b,
}
```

## "Reference Material"

- Astro's [Prettier plugin](https://github.com/withastro/prettier-plugin-astro)
- Catspeak's [GML Parser code](https://github.com/katsaii/catspeak-lang/blob/dev-3.2.1-with-inst-fix/src-lts/scripts/scr_catspeak_parser/scr_catspeak_parser.gml) (the parser is mostly transpiled from GML)
- Jinxdash's [Rust Prettier extension](https://github.com/jinxdash/prettier-plugin-rust/tree/master) (licensed under MIT, for extension template)
- `klapro`'s ["Catspeak extension"](https://github.com/klapro/catspeak-vscode-ext) (licensed under MIT, for the lexer's basic structure and test cases)
