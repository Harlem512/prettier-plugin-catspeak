# [Prettier](https://prettier.io/) Plugin for [Catspeak](https://github.com/katsaii/catspeak-lang)

> Once men turned their thinking over to machines in the hope that this would set them free. But that only permitted other men with machines to enslave them.

An unofficial Prettier plugin for formatting Catspeak's `.meow` files. Still a work in-progress.

## Features

- Pretty printing using Prettier's algorithm and mostly following Javascript formatting.
- Lovingly hand-written printing and ast-building logic.
- Comment support using Prettier's builtin plugin comment algorithm (it tries its best).
- Doesn't format files with syntax errors.
- Test cases!

## Options

### commaMode

Changes how commas are handled. `normal` prints non-trailing commas, `trailing` prints a trailing comma on wrapped lines, `none` attempts to remove all commas except those required to remove expression ambiguity.

```catspeak
-- Normal
[ a, b ]
[
  long
]

-- trailing
[ a, b ]
[
  long,
]

-- none
[ a b ]
[ a, [b] ]
```

### printSemicolons

Changes how semicolons are handled. If enabled, each statement will be terminated with a semicolon.

```catspeak
-- printSemicolons = false
let foo = bar;
(baz)

-- printSemicolons = true
let foo = bar;
(baz);
```

### doubleIndent

Determines if certain expressions should be double indented.

```catspeak
-- doubleIdent = true
if true {
  a[
      "some really long key"
  ]
}

-- doubleIdent = false
if true {
  a[
    "some really long key"
  ]
}
```

### emptyFunctionArguments

Determines if function declaration expressions with no arguments should have empty parenthesis.

```catspeak
-- emptyFunctionArguments = true
let fn = fun { }

-- emptyFunctionArguments = false
let fn = fun () { }
```

### wrapBinaryOperators

If enabled, wrapped binary operation expressions will place their operator on a newline before the second operand.

```catspeak
-- wrapBinaryOperators = true
x = foo
    + bar

-- wrapBinaryOperators = false
x = foo +
    bar
```

### parseCatchThrow

Version 3.2.0 of Catspeak introduces the `throw` and `catch` expressions and their keywords.

```catspeak
-- parseCatchThrow = true
let throw -- errors
throw "hello" -- formatted as an expression

-- parseCatchThrow = false
let throw -- no error
throw "hello" -- formatted as two no-op expressions
```

## "Reference Material"

- Astro's [Prettier plugin](https://github.com/withastro/prettier-plugin-astro)
- Catspeak's [GML Parser code](https://github.com/katsaii/catspeak-lang/blob/dev-3.2.1-with-inst-fix/src-lts/scripts/scr_catspeak_parser/scr_catspeak_parser.gml) (the parser is mostly transpiled from GML)
- Jinxdash's [Rust Prettier extension](https://github.com/jinxdash/prettier-plugin-rust/tree/master) (licensed under MIT, for extension template)
- `klapro`'s ["Catspeak extension"](https://github.com/klapro/catspeak-vscode-ext) (licensed under MIT, for the lexer's basic structure and test cases)
