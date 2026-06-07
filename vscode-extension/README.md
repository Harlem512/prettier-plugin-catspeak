# A Prettier plugin for Catspeak

> Once men turned their thinking over to machines in the hope that this would set them free. But that only permitted other men with machines to enslave them.

An unofficial extension for formatting and providing syntax highlighting for [Catspeak](https://github.com/katsaii/catspeak-lang) using a Prettier plugin.

## Features

- Catspeak syntax highlighting!
- Pretty printing using Prettier's algorithm and mostly following Javascript formatting.
- Lovingly hand-written printing and ast-building logic.
- Comment support using Prettier's builtin plugin comment algorithm (it tries its best).
- Doesn't format files with syntax errors.
- Test cases!

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
