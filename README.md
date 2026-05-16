# [Prettier](https://prettier.io/) Plugin for [Catspeak](https://github.com/katsaii/catspeak-lang)

> Once men turned their thinking over to machines in the hope that this would set them free. But that only permitted other men with machines to enslave them.

An unofficial Prettier plugin for formatting Catspeak's `.meow` files. Still a work in-progress.

## Features

- Pretty printing using Prettier's algorithm and mostly following Javascript formatting.
- Lovingly hand-written printing and ast-building logic.
- Comment support using Prettier's builtin plugin comment algorithm (it tries its best).
- Doesn't format files with syntax errors.
- Test cases!
- A few limitations (its a work in progress).

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

### semicolonMode

Changes how semicolons are handled. `required` prints only semicolons required to remove ambiguity, `all` prints a semicolon after all statements.

```catspeak
-- required
let foo = bar;
(baz)

-- all
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

## Future Plans

- VSCode extension
- Add an option for wrapped operator placement (start or end of line)

## "Reference Material"

- Astro's [Prettier plugin](https://github.com/withastro/prettier-plugin-astro)
- Catspeak's [GML Parser code](https://github.com/katsaii/catspeak-lang/blob/dev-3.2.1-with-inst-fix/src-lts/scripts/scr_catspeak_parser/scr_catspeak_parser.gml) (the parser is mostly transpiled from GML)
- `klapro`'s ["Catspeak extension"](https://github.com/klapro/catspeak-vscode-ext) (licensed under MIT, for the lexer's basic structure and test cases)
