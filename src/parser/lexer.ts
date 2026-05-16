/**
 * Catspeak Lexer - Tokenizes Catspeak source code into a stream of tokens.
 */

export type TokenType =
  | 'Keyword'
  | 'Identifier'
  | 'String'
  | 'Number'
  | 'Operator'
  | 'Comment'
  | 'Punctuation'
  | 'Newline'
  | 'EOF'
  | 'Unknown'

export interface Range {
  start: Position
  end: Position
}

export interface Position {
  line: number
  character: number
  offset: number
}

export interface Token {
  type: TokenType
  value: string
  range: Range
}

const KEYWORDS = new Set([
  'let',
  'fun',
  'if',
  'else',
  'while',
  'for', // reserved but not used
  'return',
  'break',
  'continue',
  'throw', // reserved but not used in 3.1.2
  'catch', // reserved but not used in 3.1.2
  'do',
  'match',
  'case',
  'with',
  'new',
  'self',
  'other',
  'true',
  'false',
  'undefined',
  'infinity',
  'NaN',
  'and',
  'or',
  'xor',
  'impl', // reserved but not used
  'params', // reserved but not used
  'loop', // reserved but not used
])

// Two-character operators (order matters for matching)
const TWO_CHAR_OPERATORS = new Set([
  '//',
  '<<',
  '>>',
  '<=',
  '>=',
  '==',
  '!=',
  '<|',
  '|>',
  '+=',
  '-=',
  '*=',
  '/=',
])

const SINGLE_CHAR_OPERATORS = new Set([
  '+',
  '-',
  '*',
  '/',
  '%',
  '&',
  '|',
  '^',
  '<',
  '>',
  '=',
  '!',
  '~',
])

const PUNCTUATION = new Set(['(', ')', '[', ']', '{', '}', ',', ';', '.', ':'])

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let pos = 0
  let line = 0
  let col = 0

  function currentPos(): Position {
    return { line, character: col, offset: pos }
  }

  function current(): string {
    return pos < source.length ? source[pos] : '\0'
  }

  function peek(): string {
    const idx = pos + 1
    return idx < source.length ? source[idx] : '\0'
  }

  function advance(): string {
    const ch = source[pos]
    pos++
    if (ch === '\n') {
      line++
      col = 0
    } else {
      col++
    }
    return ch
  }

  /**
   * Consumes all characters that match the provided boolean function
   */
  function advanceMatching(matching: (current: string) => boolean) {
    let s = ''
    while (pos < source.length && matching(current())) {
      s += advance()
    }
    return s
  }

  function makeToken(type: TokenType, value: string, start: Position): void {
    tokens.push({ type, value, range: { start, end: currentPos() } })
  }

  // MARK: start
  while (pos < source.length) {
    const ch = current()

    // MARK: whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      advance()
      continue
    }

    const start = currentPos()

    // MARK: newline
    if (ch === '\n') {
      advance()
      makeToken('Newline', '\n', start)
      continue
    }

    // MARK: ---com
    if (ch === '-' && peek() === '-') {
      const comment = advanceMatching((current) => current !== '\n')
      makeToken('Comment', comment, start)
      // consume next token if its a newline (it could be EOF)
      if (current() === '\n') advance() // trailing new line
      continue
    }

    // MARK: @"..."
    if (ch === '@' && peek() === '"') {
      let value = advance() + advance() // start with @"
      value += advanceMatching((current) => current !== '"')
      if (current() === '"') {
        value += advance() // closing "
      }
      makeToken('String', value, start)
      continue
    }

    // MARK: "str"
    if (ch === '"') {
      let value = advance() // start with "
      while (pos < source.length && current() !== '"') {
        if (current() === '\\') {
          value += advance() // backslash
          if (pos < source.length) {
            value += advance() // escaped char
          }
        } else {
          value += advance()
        }
      }
      if (current() === '"') {
        value += advance() // closing "
      }
      makeToken('String', value, start)
      continue
    }

    // MARK: 'X'
    if (ch === "'") {
      let value = advance() // start with opening '
      // consume only next token, ignore escape sequences
      if (pos < source.length && current() !== "'") {
        value += advance()
      }
      if (current() === "'") {
        value += advance() // closing '
      }
      // characters are shorthand for ord("X"), a number
      makeToken('Number', value, start)
      continue
    }

    // MARK: `1_var`
    if (ch === '`') {
      let value = advance() // start with opening `
      value += advanceMatching((current) => current !== '`' && current !== '\n')
      if (current() === '`') {
        value += advance() // closing `
      }
      makeToken('Identifier', value, start)
      continue
    }

    // MARK: #FFF
    if (ch === '#' && isHexDigit(peek())) {
      let value = advance() // start with #
      value += advanceMatching(isHexDigit)
      makeToken('Number', value, start)
      continue
    }

    // MARK: 1234
    if (isDigit(ch)) {
      let value = ''
      if (current() === '0' && (peek() === 'x' || peek() === 'X')) {
        // Hexadecimal
        value += advance() // 0
        value += advance() // x
        // rest
        value += advanceMatching(
          (current) => isHexDigit(current) || current === '_',
        )
      } else if (current() === '0' && (peek() === 'b' || peek() === 'B')) {
        // Binary
        value += advance() // 0
        value += advance() // b
        value += advanceMatching(
          (current) => current === '0' || current === '1' || current === '_',
        )
      } else {
        // Decimal
        value += advanceMatching(
          (current) => isDigit(current) || current === '_',
        )
        // Fractional part
        if (current() === '.' && isDigit(peek())) {
          value += advance() // .
          value += advanceMatching(
            (current) => isHexDigit(current) || current === '_',
          )
        }
      }
      makeToken('Number', value, start)
      continue
    }

    // MARK: my_var
    if (isIdentifierStart(ch)) {
      const value = advanceMatching(isIdentifierCharacter)
      const type: TokenType = KEYWORDS.has(value) ? 'Keyword' : 'Identifier'
      makeToken(type, value, start)
      continue
    }

    // MARK: ==
    const twoChar = ch + peek()
    if (TWO_CHAR_OPERATORS.has(twoChar)) {
      advance()
      advance()
      makeToken('Operator', twoChar, start)
      continue
    }

    // MARK: +
    if (SINGLE_CHAR_OPERATORS.has(ch)) {
      makeToken('Operator', advance(), start)
      continue
    }

    // MARK: { }
    if (PUNCTUATION.has(ch)) {
      makeToken('Punctuation', advance(), start)
      continue
    }

    // MARK: unknown
    makeToken('Unknown', advance(), start)
  }

  // MARK: EOF
  makeToken('EOF', '', currentPos())
  return tokens
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

function isHexDigit(ch: string): boolean {
  return (
    (ch >= '0' && ch <= '9') ||
    (ch >= 'a' && ch <= 'f') ||
    (ch >= 'A' && ch <= 'F')
  )
}

function isIdentifierStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_'
}

function isIdentifierCharacter(ch: string): boolean {
  return isIdentifierStart(ch) || isDigit(ch)
}
