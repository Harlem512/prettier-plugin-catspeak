import type {
  ArrayLiteralNode,
  AstExpressionNode,
  AstNode,
  BlockNode,
  CatchNode,
  CommentNode,
  CommentPlaceholderNode,
  GroupNode,
  IdentifierNode,
  IfNode,
  MatchNode,
  NewlineNode,
  NumberNode,
  ParseError,
  ParseResult,
  StringNode,
  StructLiteralNode,
} from './ast.js'
import {
  LexerOptions,
  tokenize,
  type Range,
  type Token,
  type TokenType,
} from './lexer.js'

export interface ParserOptions {
  includePlaceholders?: boolean
}

export function parse(
  source: string,
  options?: LexerOptions & ParserOptions,
): ParseResult {
  const tokens = tokenize(source, options)
  const errors: ParseError[] = []
  const comments: CommentNode[] = tokens
    .filter((t) => t.type === 'Comment')
    .map<CommentNode>((n) => ({
      type: 'Comment',
      value: n.value,
      range: n.range,
    }))

  /** current token index */
  let pos = -1
  /** last significant token. used for node range calculations */
  let lastToken: Token | undefined = undefined
  let lastTokenPos: number = 0

  // advance to the first token in the tokenizer
  // advanced is used instead of pos = 0 to skip leading whitespace/comments
  advance()

  // MARK: position
  function current(): Token {
    return tokens[pos]
  }

  function is(type: TokenType, value?: string, token: Token = current()) {
    return token.type === type && (value === undefined || token.value === value)
  }

  /**
   * advance until next newline/comment token
   */
  function advance(): void {
    // if the current token is an end of file, throw an error
    if (pos !== -1 && is('EOF')) {
      throwError('Unexpected end of file', current().range)
    }

    // update last token
    lastToken = current()
    lastTokenPos = pos

    while (true) {
      pos++
      const currentType = current().type
      if (currentType !== 'Newline' && currentType !== 'Comment') return
    }
  }

  /**
   * Creates a newline block out of newline tokens between statements inside
   * a block.
   *
   * Consumes newline tokens until it hits a comment, then exits with the
   * accumulated tokens. Prettier's commenting algorithm already handles
   * newlines placed between comments, so we shouldn't parse those a second
   * time.
   *
   * Overall, allows for a single blank line to be preserved between statements in a block when run through the printer.
   *
   * ```
   * -- note the newline between these statements
   * let a = foo
   *
   * let b = bar
   * ```
   */
  function getNewline(): NewlineNode | null {
    let firstNewline: Token | null = null
    let sequentialNewLines = 0

    for (let tokenIndex = lastTokenPos + 1; tokenIndex <= pos; tokenIndex++) {
      const token = tokens[tokenIndex]
      const type = token.type

      // consume newline tokens until...
      if (type === 'Newline') {
        if (!firstNewline) {
          // first newline in the sequence
          firstNewline = token
        }
        // increment sequential counter
        sequentialNewLines += 1
        continue
      }

      // (handles trailing comments, ignore the first comment)
      if (tokenIndex === lastTokenPos + 1) {
        if (type === 'Comment') {
          // increment newlines since the trailing comment has a newline
          sequentialNewLines += 1
          continue
        }
      }

      // ... not a new line...
      if (sequentialNewLines > 1 && firstNewline) {
        // build the newline node
        return {
          type: 'Newline',
          range: {
            start: firstNewline.range.start,
            end: token.range.start,
          },
        }
      }

      return null
    }

    return null
  }

  function expect(type: TokenType, value?: string): Token {
    const tok = current()
    if (tok.type !== type || (value !== undefined && tok.value !== value)) {
      const expected = value ? `'${value}'` : type
      throwError(`Expected ${expected}, got '${tok.value}'`, tok.range)
    }
    return tok
  }

  function throwError(message: string, range: Range): never {
    const err = { message, range }
    errors.push(err)
    throw err
  }

  function getRange(
    start: { range: Range },
    end: { range: Range } | undefined = lastToken,
  ): Range {
    if (!end) throwError('Unexpected lack of lastToken', start.range)
    return { start: start.range.start, end: end?.range.end }
  }

  /**
   * Accepts an array of nodes and appends the passed node. Also handles adding `newline` nodes.
   */
  function appendNodeArray<T extends AstNode>(
    arr: (T | NewlineNode)[],
    node: T | null,
  ) {
    if (node) arr.push(node)
    // no further processing
    if (!options?.includePlaceholders) return

    // suppress multiple newlines in a row
    if (arr.at(-1)?.type === 'Newline') return

    const leadingNewline = getNewline()
    if (leadingNewline) arr.push(leadingNewline)
  }
  /**
   * Transforms an array of nodes after finished appending. Adds comment placeholder nodes to empty arrays.
   */
  function transformNodeArray<T extends AstNode>(
    arr: (T | CommentPlaceholderNode)[],
  ) {
    // no transformations if placeholders are omitted
    if (!options?.includePlaceholders) return

    // remove trailing newline block
    if (arr.at(-1)?.type === 'Newline') arr.splice(-1)

    // no nodes, push a placeholder so comments can be attached correctly
    if (arr.length === 0) {
      const end = current().range.end
      arr.push({
        type: 'CommentPlaceholder',
        // range is wonky so comments are all printed at the start of the block
        range: { start: end, end },
      })
    }
  }

  // MARK: block
  function parseBlock(): BlockNode {
    const start = expect('Punctuation', '{')
    advance()

    const nodes: AstNode[] = []
    while (!is('Punctuation', '}') && !is('EOF')) {
      try {
        appendNodeArray(nodes, parseStatement())
      } catch (e: any) {
        // check if this is a normal error
        if (!e.range) throw e
        if (!is('EOF')) advance()
      }
    }
    transformNodeArray(nodes)

    expect('Punctuation', '}')
    advance()

    return {
      type: 'Block',
      children: nodes,
      range: getRange(start),
    }
  }

  // MARK: statement
  function parseStatement(): AstNode | null {
    const peeked = current()

    if (is('Punctuation', ';', peeked)) {
      // empty semicolons don't exist in the AST
      advance() // consume `;`
      return null
    }

    if (is('Keyword', 'let', peeked)) {
      // MARK: let ...
      advance() // consume `let`
      const identifierToken = expect('Identifier')
      const identifierNode: IdentifierNode = {
        type: 'Identifier',
        name: identifierToken.value,
        range: identifierToken.range,
      }
      advance() // consume identifier

      let value: AstExpressionNode | null = null
      if (is('Operator', '=')) {
        // MARK: let = ...
        advance() // consume =
        value = parseExpression()
      }

      return {
        type: 'LetStatement',
        identifier: identifierNode,
        value,
        range: getRange(peeked),
      }
    }

    // statement must be an expression
    return parseExpression()
  }

  function parseExpression(): AstExpressionNode {
    const peeked = current()

    if (is('Keyword', 'return', peeked) || is('Keyword', 'break', peeked)) {
      // MARK: return break
      const type = peeked.value === 'return' ? 'Return' : 'Break'
      advance() // consume return
      let value: AstExpressionNode | null
      if (
        is('Keyword', 'let') ||
        is('Punctuation', '}') ||
        is('Punctuation', ';') ||
        is('EOF')
      ) {
        value = null
      } else {
        value = parseExpression()
      }
      return {
        type,
        range: value ? getRange(peeked, value) : peeked.range,
        value,
      }
    } else if (is('Keyword', 'continue', peeked)) {
      // MARK: continue
      advance() // consume continue
      // continue accepts no child statements
      return {
        type: 'Continue',
        range: peeked.range,
      }
    } else if (is('Keyword', 'throw', peeked)) {
      // MARK: throw
      advance() // consume throw
      return {
        type: 'Throw',
        value: parseExpression(),
        range: getRange(peeked),
      }
    } else {
      return parseAssign()
    }
  }

  function parseAssign(): AstExpressionNode {
    const node = parseCatch()
    const peeked = current()

    // MARK: = *= /= -= +=
    if (
      peeked.type === 'Operator' &&
      ['=', '*=', '/=', '-=', '+='].includes(peeked.value)
    ) {
      advance() // consume operator
      // verify left-hand side of assignment is valid
      if (node.type !== 'Identifier' && node.type !== 'Accessor') {
        throwError(
          `Expected left-hand assignment identifier, got ${node.type}`,
          node.range,
        )
      }

      const value = parseExpression()
      return {
        type: 'Assignment',
        range: getRange(node, value),
        operator: peeked.value,
        identifier: node,
        value,
      }
    }
    return node
  }

  function parseCatch(): AstExpressionNode {
    let result = parseExpressionBlock()

    // MARK: catch
    while (true) {
      const peeked = current()
      // not a catch block
      if (!is('Keyword', 'catch', peeked)) return result

      let identifier: CatchNode['identifier'] = null

      advance() // consume catch

      const next = current()
      if (is('Identifier')) {
        advance() // consume identifier
        identifier = {
          type: 'Identifier',
          name: next.value,
          range: next.range,
        }
      }

      result = {
        type: 'Catch',
        identifier,
        expression: result,
        block: parseBlock(),
        range: getRange(result),
      }
    }
  }

  function parseExpressionBlock(): AstExpressionNode {
    const peeked = current()
    if (is('Keyword', 'do', peeked)) {
      // MARK: do
      advance() // consume do

      return {
        type: 'Do',
        block: parseBlock(),
        range: getRange(peeked),
      }
    } else if (is('Keyword', 'if', peeked)) {
      // MARK: if
      advance() // consume if
      const condition = parseCondition()
      const ifBlock = parseBlock()

      let elseBlock: IfNode['elseBlock'] = null
      let elseIfExpression: IfNode['elseIfExpression'] = null

      if (is('Keyword', 'else')) {
        // MARK: else
        advance() // consume else
        if (is('Keyword', 'if')) {
          // MARK: else if
          elseIfExpression = parseExpression()
        } else {
          elseBlock = parseBlock()
        }
      }

      return {
        type: 'If',
        condition,
        ifBlock,
        elseBlock,
        elseIfExpression,
        range: getRange(peeked),
      }
    } else if (
      is('Keyword', 'while', peeked) ||
      is('Keyword', 'with', peeked)
    ) {
      // MARK: while with
      advance() // consume while/with
      const condition = parseCondition()

      return {
        type: peeked.value === 'while' ? 'While' : 'With',
        condition,
        block: parseBlock(),
        range: getRange(peeked),
      }
    } else if (is('Keyword', 'match', peeked)) {
      // MARK: match
      advance() // consume match

      const condition = parseExpression() // match [x]

      expect('Punctuation', '{')
      advance() // consume {

      const cases: MatchNode['cases'] = []
      while (!is('Punctuation', '}') && !is('EOF')) {
        let caseExp: AstExpressionNode | null = null

        const tok = current()
        advance() // consume case/else

        // MARK: case
        if (is('Keyword', 'case', tok)) {
          caseExp = parseExpression()
        } else if (!is('Keyword', 'else', tok)) {
          throwError(
            `expected 'case' or 'else' before match arm, got ${tok.value}`,
            tok.range,
          )
        }

        appendNodeArray(cases, {
          type: 'MatchCase',
          case: caseExp,
          block: parseBlock(),
          range: getRange(tok),
        })
      }
      transformNodeArray(cases)

      expect('Punctuation', '}')
      advance() // consume }

      return {
        type: 'Match',
        condition,
        cases,
        range: getRange(peeked),
      }
    } else if (is('Keyword', 'fun', peeked)) {
      // MARK: fun
      advance() // consume fun

      const args: IdentifierNode[] = []
      if (!is('Punctuation', '{')) {
        // read function arguments (optional)
        expect('Punctuation', '(')
        advance() // consume (

        while (!is('Punctuation', ')') && !is('EOF')) {
          expect('Identifier')
          const cur = current()
          args.push({
            type: 'Identifier',
            name: cur.value,
            range: cur.range,
          })
          advance() // consume identifier
          if (is('Punctuation', ',')) advance() // consume comma
        }

        expect('Punctuation', ')')
        advance() // consume closing )
      }

      return {
        type: 'Function',
        arguments: args,
        block: parseBlock(),
        range: getRange(peeked),
      }
    } else {
      return parseCondition()
    }
  }

  // MARK: CONDITION
  function parseCondition(): AstExpressionNode {
    return parseOpLogicalOr()
  }

  function parseOpLogicalOr(): AstExpressionNode {
    let result = parseOpLogicalAnd()
    while (true) {
      if (is('Keyword', 'or') || is('Keyword', 'xor')) {
        // MARK: or xor
        const op = current().value
        advance() // consume or/xor
        const right = parseOpLogicalAnd()
        result = {
          type: 'Operator',
          left: result,
          right,
          operation: op,
          range: getRange(result, right),
        }
      } else {
        return result
      }
    }
  }

  function parseOpLogicalAnd(): AstExpressionNode {
    let result = parseOpPipe()
    while (true) {
      if (is('Keyword', 'and')) {
        // MARK: and
        advance() // consume and
        const right = parseOpPipe()
        result = {
          type: 'Operator',
          left: result,
          right,
          operation: 'and',
          range: getRange(result, right),
        }
      } else {
        return result
      }
    }
  }

  function parseOpPipe(): AstExpressionNode {
    let result = parseOpEquality()
    while (true) {
      if (is('Operator', '|>') || is('Operator', '<|')) {
        // MARK: |> <|
        const resultIsName = current().value === '|>'
        advance() // consume pipe
        const other = parseOpEquality()
        result = {
          type: 'Call',
          fun: resultIsName ? result : other,
          arguments: resultIsName ? [other] : [result],
          isConstructor: false,
          range: getRange(result, other),
        }
      } else {
        return result
      }
    }
  }

  function parseOpEquality(): AstExpressionNode {
    let result = parseOpRelational()
    while (true) {
      if (is('Operator', '==') || is('Operator', '!=')) {
        // MARK: == !=
        const relation = current().value
        advance() // consume op
        const right = parseOpRelational()
        result = {
          type: 'Operator',
          left: result,
          right,
          operation: relation,
          range: getRange(result, right),
        }
      } else {
        return result
      }
    }
  }

  function parseOpRelational(): AstExpressionNode {
    let result = parseOpBitwise()
    while (true) {
      if (
        is('Operator', '<') ||
        is('Operator', '>') ||
        is('Operator', '<=') ||
        is('Operator', '>=')
      ) {
        // MARK: < > <= >=
        const op = current().value
        advance() // consume op
        const right = parseOpBitwise()
        result = {
          type: 'Operator',
          left: result,
          right,
          operation: op,
          range: getRange(result, right),
        }
      } else {
        return result
      }
    }
  }

  function parseOpBitwise(): AstExpressionNode {
    let result = parseOpAdd()
    while (true) {
      if (
        is('Operator', '&') ||
        is('Operator', '|') ||
        is('Operator', '^') ||
        is('Operator', '<<') ||
        is('Operator', '>>')
      ) {
        // MARK: & | ^ << >>
        const op = current().value
        advance() // consume op
        const right = parseOpAdd()
        result = {
          type: 'Operator',
          left: result,
          right,
          operation: op,
          range: getRange(result, right),
        }
      } else {
        return result
      }
    }
  }

  function parseOpAdd(): AstExpressionNode {
    let result = parseOpMultiply()
    while (true) {
      if (is('Operator', '+') || is('Operator', '-')) {
        // MARK: + -
        const op = current().value
        advance() // consume op
        const right = parseOpMultiply()
        result = {
          type: 'Operator',
          left: result,
          right,
          operation: op,
          range: getRange(result, right),
        }
      } else {
        return result
      }
    }
  }

  function parseOpMultiply(): AstExpressionNode {
    let result = parseOpUnary()
    while (true) {
      if (
        is('Operator', '*') ||
        is('Operator', '/') ||
        is('Operator', '//') ||
        is('Operator', '%')
      ) {
        // MARK: * / // %
        const op = current().value
        advance() // consume op
        const right = parseOpUnary()
        result = {
          type: 'Operator',
          left: result,
          right,
          operation: op,
          range: getRange(result, right),
        }
      } else {
        return result
      }
    }
  }

  function parseOpUnary(): AstExpressionNode {
    if (
      is('Operator', '!') ||
      is('Operator', '~') ||
      is('Operator', '-') ||
      is('Operator', '+')
    ) {
      // MARK: unary ! ~ + -
      const operator = current()
      advance() // consume op
      const index = parseIndex()
      return {
        type: 'Unary',
        value: index,
        operation: operator.value,
        range: getRange(operator, index),
      }
    } else {
      return parseIndex()
    }
  }

  function parseIndex(): AstExpressionNode {
    // first token, used for range calculations
    const start = current()

    // used to track if this is a constructor with no arguments
    // ie `new foo` vs `new foo()`
    let callNewNoArgs = is('Keyword', 'new') ? start : null
    if (callNewNoArgs) advance()

    let result = parseTerminal()
    while (true) {
      if (is('Punctuation', '(')) {
        // MARK: call (
        advance() // consume (
        const args = []
        while (!is('Punctuation', ')') && !is('EOF')) {
          args.push(parseExpression())
          if (is('Punctuation', ',')) advance()
        }
        expect('Punctuation', ')')
        advance() // consume )
        result = {
          type: 'Call',
          isConstructor: callNewNoArgs !== null,
          arguments: args,
          fun: result,
          range: getRange(start),
        }
        callNewNoArgs = null
      } else if (is('Punctuation', '[')) {
        // MARK: access [
        advance() // consume [
        const key = parseExpression()
        expect('Punctuation', ']')
        advance() // consume ]
        result = {
          type: 'Accessor',
          collection: result,
          key,
          isIdentifier: false,
          range: getRange(start),
        }
      } else if (is('Punctuation', '.')) {
        // MARK: access .
        advance() // consume .
        const tok = expect('Identifier')
        const key: IdentifierNode = {
          type: 'Identifier',
          name: tok.value,
          range: tok.range,
        }
        advance() // consume identifier
        result = {
          type: 'Accessor',
          collection: result,
          key,
          isIdentifier: true,
          range: getRange(start, key),
        }
      } else {
        break
      }
    }

    if (callNewNoArgs) {
      // MARK: new no args
      return {
        type: 'Call',
        arguments: null,
        fun: result,
        isConstructor: true,
        range: getRange(start),
      }
    }

    return result
  }

  function parseTerminal(): AstExpressionNode {
    const tok = current()
    if (
      is('Identifier', undefined, tok) ||
      is('Keyword', 'global', tok) ||
      is('Keyword', 'self', tok) ||
      is('Keyword', 'other', tok)
    ) {
      // MARK: foo global self
      const node: IdentifierNode = {
        type: 'Identifier',
        name: tok.value,
        range: tok.range,
      }
      advance() // consume token
      return node
    } else if (
      is('Number', undefined, tok) ||
      is('Keyword', 'undefined', tok) ||
      is('Keyword', 'NaN', tok) ||
      is('Keyword', 'infinity', tok) ||
      is('Keyword', 'true', tok) ||
      is('Keyword', 'false', tok)
    ) {
      // MARK: 123 NaN true 'C'
      const node: NumberNode = {
        type: 'Number',
        value: tok.value,
        range: tok.range,
      }
      advance() // consume token
      return node
    } else if (is('String', undefined, tok)) {
      // MARK: "string"
      const node: StringNode = {
        type: 'String',
        value: tok.value,
        range: tok.range,
      }
      advance() // consume token
      return node
    } else {
      return parseGrouping()
    }
  }

  function parseGrouping(): AstExpressionNode {
    const peeked = current()

    if (is('Punctuation', '(', peeked)) {
      // MARK: group ( )
      advance() // consume (
      const inside = parseExpression()
      expect('Punctuation', ')')
      advance() // consume )

      const node: GroupNode = {
        type: 'Group',
        inside,
        range: getRange(peeked),
      }
      return node
    } else if (is('Punctuation', '[', peeked)) {
      // MARK: array literal []
      advance() // consume [

      const values: AstExpressionNode[] = []
      while (!is('Punctuation', ']') && !is('EOF')) {
        const exp = parseExpression()
        if (is('Punctuation', ',')) advance()
        appendNodeArray(values, exp)
      }
      transformNodeArray(values)

      expect('Punctuation', ']')
      advance() // consume ]

      const array: ArrayLiteralNode = {
        type: 'ArrayLiteral',
        values,
        range: getRange(peeked),
      }

      return array
    } else if (is('Punctuation', '{')) {
      // MARK: struct { }
      advance() // consume {

      const entries: StructLiteralNode['entries'] = []
      while (!is('Punctuation', '}') && !is('EOF')) {
        const keyToken = current()

        let isExpression = false
        let key: AstExpressionNode
        if (is('Punctuation', '[', keyToken)) {
          // MARK: { [exp()]: ... }
          isExpression = true
          advance() // consume initial [
          key = parseExpression()
          expect('Punctuation', ']')
          advance() // consume trailing ]
        } else if (is('Identifier', undefined, keyToken)) {
          // MARK: { foo: ... }
          key = {
            type: 'Identifier',
            name: keyToken.value,
            range: keyToken.range,
          }
          advance()
        } else if (
          is('Number', undefined, keyToken) ||
          is('Keyword', 'NaN', keyToken) ||
          is('Keyword', 'infinity', keyToken) ||
          is('Keyword', 'true', keyToken) ||
          is('Keyword', 'false', keyToken)
        ) {
          // MARK: { 123: ... }
          key = {
            type: 'Number',
            value: keyToken.value,
            range: keyToken.range,
          }
          advance()
        } else if (is('String', undefined, keyToken)) {
          // MARK: { "foo": ... }
          key = {
            type: 'String',
            value: keyToken.value,
            range: keyToken.range,
          }
          advance()
        } else {
          throwError(
            `Expected identifier or value as struct key, got '${current().value}'`,
            keyToken.range,
          )
        }

        // values
        let value: AstExpressionNode | null = null
        if (is('Punctuation', ':')) {
          // MARK: { A: ...}
          advance() // consume :
          value = parseExpression()
        } else if (key.type === 'Identifier') {
          // MARK: { A }
          // identifier as key and value, skipped
        } else {
          throwError(
            `Expect ':' between struct key and value, got '${current().value}'`,
            current().range,
          )
        }

        if (is('Punctuation', ',')) advance()

        appendNodeArray(entries, {
          type: 'StructLiteralEntry',
          key,
          value,
          isIdentifier: !isExpression,
          range: getRange(keyToken),
        })
      }
      transformNodeArray(entries)

      expect('Punctuation', '}')
      advance()

      return {
        type: 'StructLiteral',
        entries: entries,
        range: getRange(peeked),
      }
    } else {
      throwError(
        `Expected '(', '[' or '{' as start of grouping, got '${peeked.value}'`,
        peeked.range,
      )
    }
  }

  // MARK: RUN
  const nodes: AstNode[] = []
  while (!is('EOF')) {
    try {
      appendNodeArray(nodes, parseStatement())
    } catch (e: any) {
      // check if this is a normal error
      if (!e.range) throw e
      if (!is('EOF')) advance()
    }
  }
  transformNodeArray(nodes)

  return {
    ast: {
      type: 'Root',
      block: nodes,
      comments,
      range: {
        start: { character: 0, line: 0, offset: 0 },
        end: current().range.end,
      },
    },
    errors,
  }
}
