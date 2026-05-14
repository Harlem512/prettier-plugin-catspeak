import type {
  ArrayLiteralNode,
  AstExpressionNode,
  AstNode,
  CommentNode,
  GroupNode,
  IdentifierNode,
  IfNode,
  MatchNode,
  NumberNode,
  ParseError,
  ParseResult,
  StringNode,
  StructLiteralNode,
} from './ast'
import { tokenize, type Range, type Token, type TokenType } from './lexer'

export function parse(source: string): ParseResult {
  const tokens = tokenize(source)
  const errors: ParseError[] = []
  const comments: CommentNode[] = tokens
    .filter((t) => t.type === 'Comment')
    .map<CommentNode>((n) => ({
      type: 'Comment',
      value: n.value,
      range: n.range,
      leading: true,
      leadingTrivia: null,
      trailingTrivia: null,
    }))

  /** current token index */
  let pos = -1
  advance()
  /** last-used trivia index */
  let triviaPos = 0

  // MARK: position
  function current(): Token {
    return tokens[pos]
  }

  function is(type: TokenType, value?: string, token: Token = current()) {
    return token.type === type && (value === undefined || token.value === value)
  }

  function isAtEnd(): boolean {
    return current().type === 'EOF'
  }

  /**
   * advance until next newline/comment token
   */
  function advance(): void {
    // if the current token is an end of file, throw an error
    if (pos !== -1 && isAtEnd()) {
      throwError('Unexpected end of file', current().range)
    }

    while (true) {
      pos++
      const currentType = current().type
      if (currentType !== 'Newline' && currentType !== 'Comment') return
    }
  }

  function getLeadingTrivia(): Token[] | null {
    const leadingTrivia: Token[] = []
    // get leading tokens
    for (let p = triviaPos; p < pos; p++) {
      const token = tokens[p]
      if (token.type === 'Comment' || token.type === 'Newline') {
        leadingTrivia.push(token)
      }
    }
    triviaPos = pos
    return leadingTrivia.length === 0 ? null : leadingTrivia
  }

  function getTrailingTrivia(): Token | null {
    // EOF has no trailing tokens (or trivia)
    if (isAtEnd()) return null

    const trailingToken = tokens[pos + 1]

    // trailing comment
    if (trailingToken.type === 'Comment') {
      triviaPos = pos + 1
      return trailingToken
    }
    // trailing semicolon
    if (trailingToken.type === 'Punctuation') {
      // next token is a semicolon, check for next comment
      // ie `let x = a; --comment`
      const trailingAfterSemi = tokens[pos + 2]
      if (trailingAfterSemi.type === 'Comment') {
        triviaPos = pos + 2
        return trailingAfterSemi
      }
    }

    // no trailing trivia
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

  // MARK: block
  function parseBlock(): AstNode[] {
    const nodes: AstNode[] = []

    expect('Punctuation', '{')
    advance()

    while (!isAtEnd() && !is('Punctuation', '}')) {
      try {
        const statement = parseStatement()
        if (statement) nodes.push(statement)
      } catch {}
    }

    expect('Punctuation', '}')
    advance()

    return nodes
  }

  // MARK: statement
  function parseStatement(): AstNode | null {
    const peeked = current()
    const start = peeked.range.start

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
        leadingTrivia: getLeadingTrivia(),
        trailingTrivia: getTrailingTrivia(),
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
        // let statement has no trivia, the identifier and value have trivia
        leadingTrivia: null,
        trailingTrivia: null,
        range: { start, end: current().range.start },
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
      let value: AstExpressionNode | null = null
      if (
        is('Keyword', 'let') ||
        is('Punctuation', '}') ||
        is('Punctuation', ';')
      ) {
        value = null
      } else {
        value = parseExpression()
      }
      return {
        type,
        range: value
          ? { start: peeked.range.start, end: value.range.end }
          : peeked.range,
        value,
        leadingTrivia: getLeadingTrivia(),
        trailingTrivia: getTrailingTrivia(),
      }
    } else if (is('Keyword', 'continue', peeked)) {
      // MARK: continue
      advance() // consume continue
      // continue accepts no child statements
      return {
        type: 'Continue',
        range: peeked.range,
        leadingTrivia: getLeadingTrivia(),
        trailingTrivia: getTrailingTrivia(),
      }
    } else if (is('Keyword', 'throw', peeked)) {
      // MARK: throw
      throw 'Throw keyword'
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
        range: { start: node.range.start, end: value.range.end },
        leadingTrivia: null,
        trailingTrivia: null,
        operator: peeked.value,
        identifier: node,
        value,
      }
    }
    return node
  }

  function parseCatch(): AstExpressionNode {
    const result = parseExpressionBlock()
    // MARK: catch
    // TODO: parse catch expressions
    return result
  }

  function parseExpressionBlock(): AstExpressionNode {
    const peeked = current()
    if (is('Keyword', 'do', peeked)) {
      // MARK: do
      advance() // consume do
      const leadingTrivia = getLeadingTrivia()

      return {
        type: 'Do',
        block: parseBlock(),
        range: { start: peeked.range.start, end: current().range.start },
        leadingTrivia,
        trailingTrivia: getTrailingTrivia(),
      }
    } else if (is('Keyword', 'if', peeked)) {
      // MARK: if
      advance() // consume if
      const leadingTrivia = getLeadingTrivia()
      const condition = parseCondition()
      const ifBlock = parseBlock()

      let elseBlock: IfNode['elseBlock'] = null
      let ifElseExpression: IfNode['ifElseExpression'] = null

      if (is('Keyword', 'else')) {
        // MARK: else
        advance() // consume else
        if (is('Keyword', 'if')) {
          // MARK: else if
          ifElseExpression = parseExpression()
        } else {
          elseBlock = parseBlock()
        }
      }
      return {
        type: 'If',
        condition,
        ifBlock,
        elseBlock,
        ifElseExpression,
        range: {
          start: peeked.range.start,
          end: current().range.start,
        },
        leadingTrivia,
        trailingTrivia: getTrailingTrivia(),
      }
    } else if (
      is('Keyword', 'while', peeked) ||
      is('Keyword', 'with', peeked)
    ) {
      // MARK: while with
      advance() // consume while/with
      const leadingTrivia = getLeadingTrivia()
      const condition = parseCondition()
      const block = parseBlock()

      return {
        type: peeked.value === 'while' ? 'While' : 'With',
        condition,
        block,
        range: {
          start: peeked.range.start,
          end: current().range.start,
        },
        leadingTrivia,
        trailingTrivia: getTrailingTrivia(),
      }
    } else if (is('Keyword', 'match', peeked)) {
      // MARK: match
      const start = current().range.start
      const leadingTrivia = getLeadingTrivia()
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

        cases.push({ case: caseExp, block: parseBlock() })
      }

      expect('Punctuation', '}')
      advance() // consume }

      return {
        type: 'Match',
        condition,
        cases,
        leadingTrivia,
        trailingTrivia: getTrailingTrivia(),
        range: { start, end: current().range.start },
      }
    } else if (is('Keyword', 'fun', peeked)) {
      // MARK: fun
      const start = current().range.start
      const leadingTrivia = getLeadingTrivia()
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
            leadingTrivia: getLeadingTrivia(),
            trailingTrivia: getTrailingTrivia(),
          })
          advance() // consume identifier
          if (is('Punctuation', ',')) advance() // consume comma
        }

        expect('Punctuation', ')')
        advance() // consume closing )
      }

      const body = parseBlock()

      return {
        type: 'Function',
        arguments: args,
        block: body,
        leadingTrivia,
        trailingTrivia: getTrailingTrivia(),
        range: { start, end: current().range.end },
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
    const result = parseOpLogicalAnd()
    while (true) {
      if (is('Keyword', 'or') || is('Keyword', 'xor')) {
        // MARK: or xor
        const op = current().value
        advance() // consume or/xor
        const right = parseOpLogicalAnd()
        return {
          type: 'Operator',
          left: result,
          right,
          operation: op,
          range: { start: result.range.start, end: right.range.end },
          leadingTrivia: null,
          trailingTrivia: null,
        }
      } else {
        return result
      }
    }
  }

  function parseOpLogicalAnd(): AstExpressionNode {
    const result = parseOpPipe()
    while (true) {
      if (is('Keyword', 'and')) {
        // MARK: and
        advance() // consume and
        const right = parseOpPipe()
        return {
          type: 'Operator',
          left: result,
          right,
          operation: 'and',
          range: { start: result.range.start, end: right.range.end },
          leadingTrivia: null,
          trailingTrivia: null,
        }
      } else {
        return result
      }
    }
  }

  function parseOpPipe(): AstExpressionNode {
    const result = parseOpEquality()
    while (true) {
      if (is('Operator', '|>') || is('Operator', '<|')) {
        // MARK: |> <|
        const resultIsName = current().value === '|>'
        advance() // consume pipe
        const other = parseOpEquality()
        return {
          type: 'Call',
          fun: resultIsName ? result : other,
          arguments: resultIsName ? [other] : [result],
          isConstructor: false,
          range: { start: result.range.start, end: other.range.end },
          leadingTrivia: null,
          trailingTrivia: null,
        }
      } else {
        return result
      }
    }
  }

  function parseOpEquality(): AstExpressionNode {
    const result = parseOpRelational()
    while (true) {
      if (is('Operator', '==') || is('Operator', '!=')) {
        // MARK: == !=
        const relation = current().value
        advance() // consume op
        const right = parseOpRelational()
        return {
          type: 'Operator',
          left: result,
          right,
          operation: relation,
          range: { start: result.range.start, end: right.range.end },
          leadingTrivia: null,
          trailingTrivia: null,
        }
      } else {
        return result
      }
    }
  }

  function parseOpRelational(): AstExpressionNode {
    const result = parseOpBitwise()
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
        return {
          type: 'Operator',
          left: result,
          right,
          operation: op,
          range: { start: result.range.start, end: right.range.end },
          leadingTrivia: null,
          trailingTrivia: null,
        }
      } else {
        return result
      }
    }
  }

  function parseOpBitwise(): AstExpressionNode {
    const result = parseOpAdd()
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
        return {
          type: 'Operator',
          left: result,
          right,
          operation: op,
          range: { start: result.range.start, end: right.range.end },
          leadingTrivia: null,
          trailingTrivia: null,
        }
      } else {
        return result
      }
    }
  }

  function parseOpAdd(): AstExpressionNode {
    const result = parseOpMultiply()
    while (true) {
      if (is('Operator', '+') || is('Operator', '-')) {
        // MARK: + -
        const op = current().value
        advance() // consume op
        const right = parseOpMultiply()
        return {
          type: 'Operator',
          left: result,
          right,
          operation: op,
          range: { start: result.range.start, end: right.range.end },
          leadingTrivia: null,
          trailingTrivia: null,
        }
      } else {
        return result
      }
    }
  }

  function parseOpMultiply(): AstExpressionNode {
    const result = parseOpUnary()
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
        return {
          type: 'Operator',
          left: result,
          right,
          operation: op,
          range: { start: result.range.start, end: right.range.end },
          leadingTrivia: null,
          trailingTrivia: null,
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
      const peeked = current()
      advance() // consume op
      const index = parseIndex()
      return {
        type: 'Unary',
        value: index,
        operation: peeked.value,
        range: { start: peeked.range.start, end: index.range.end },
        leadingTrivia: null,
        trailingTrivia: null,
      }
    } else {
      return parseIndex()
    }
  }

  function parseIndex(): AstExpressionNode {
    let callNew = is('Keyword', 'new') ? current() : null
    if (callNew) advance()

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
          isConstructor: callNew !== null,
          arguments: args,
          fun: result,
          leadingTrivia: getLeadingTrivia(),
          trailingTrivia: getTrailingTrivia(),
          range: { start: result.range.start, end: current().range.start },
        }
        callNew = null
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
          leadingTrivia: getLeadingTrivia(),
          trailingTrivia: getTrailingTrivia(),
          range: { start: result.range.start, end: current().range.start },
        }
      } else if (is('Punctuation', '.')) {
        // MARK: access .
        advance() // consume .
        const tok = expect('Identifier')
        const key: AstExpressionNode = {
          type: 'Identifier',
          name: tok.value,
          range: tok.range,
          leadingTrivia: getLeadingTrivia(),
          trailingTrivia: getTrailingTrivia(),
        }
        advance() // consume identifier
        result = {
          type: 'Accessor',
          collection: result,
          key,
          leadingTrivia: null,
          trailingTrivia: null,
          range: { start: result.range.start, end: key.range.end },
        }
      } else {
        break
      }
    }

    if (callNew) {
      // MARK: new
      return {
        type: 'Call',
        arguments: null,
        fun: result,
        isConstructor: true,
        range: { start: callNew.range.start, end: current().range.start },
        leadingTrivia: null,
        trailingTrivia: getTrailingTrivia(),
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
        leadingTrivia: getLeadingTrivia(),
        trailingTrivia: getTrailingTrivia(),
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
        leadingTrivia: getLeadingTrivia(),
        trailingTrivia: getTrailingTrivia(),
      }
      advance() // consume token
      return node
    } else if (is('String', undefined, tok)) {
      // MARK: "string"
      const node: StringNode = {
        type: 'String',
        value: tok.value,
        range: tok.range,
        leadingTrivia: getLeadingTrivia(),
        trailingTrivia: getTrailingTrivia(),
      }
      advance() // consume token
      return node
    } else {
      return parseGrouping()
    }
  }

  function parseGrouping(): AstExpressionNode {
    const peeked = current()
    const start = peeked.range.start
    const leadingTrivia = getLeadingTrivia()

    if (is('Punctuation', '(', peeked)) {
      // MARK: group ( )
      advance() // consume (
      const inside = parseExpression()
      expect('Punctuation', ')')

      const node: GroupNode = {
        type: 'Group',
        inside,
        leadingTrivia: leadingTrivia,
        trailingTrivia: getTrailingTrivia(),
        range: { start, end: current().range.end },
      }

      advance() // consume )
      return node
    } else if (is('Punctuation', '[', peeked)) {
      // MARK: array literal []
      advance() // consume [

      const values: AstExpressionNode[] = []
      while (!is('Punctuation', ']') && !is('EOF')) {
        values.push(parseExpression())
        if (is('Punctuation', ',')) advance()
      }
      expect('Punctuation', ']')

      const array: ArrayLiteralNode = {
        type: 'ArrayLiteral',
        values,
        range: { start, end: current().range.end },
        leadingTrivia,
        trailingTrivia: getTrailingTrivia(),
      }

      advance() // consume ]
      return array
    } else if (is('Punctuation', '{')) {
      // MARK: struct { }
      advance() // consume {

      const entries: StructLiteralNode['entries'] = []
      while (!is('Punctuation', '}') && !is('EOF')) {
        const keyToken = current()
        const leadingTrivia = getLeadingTrivia()

        let key: AstExpressionNode
        if (is('Punctuation', '[', keyToken)) {
          // MARK: { [exp()]: ... }
          advance() // consume initial [
          key = parseExpression()
          expect('Punctuation', ']')
          advance() // consume trailing ]
        } else if (is('Identifier', undefined, keyToken)) {
          // MARK: { foo: ... }
          key = {
            type: 'Identifier',
            name: keyToken.value,
            leadingTrivia: getLeadingTrivia(),
            trailingTrivia: getTrailingTrivia(),
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
            leadingTrivia: getLeadingTrivia(),
            trailingTrivia: getTrailingTrivia(),
            range: keyToken.range,
          }
          advance()
        } else if (is('String', undefined, keyToken)) {
          // MARK: { "foo": ... }
          key = {
            type: 'String',
            value: keyToken.value,
            range: keyToken.range,
            leadingTrivia: getLeadingTrivia(),
            trailingTrivia: getTrailingTrivia(),
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

        entries.push({
          type: 'StructLiteralEntry',
          key,
          value,
          leadingTrivia,
          trailingTrivia: getTrailingTrivia(),
          range: { start: keyToken.range.start, end: current().range.start },
        })
      }

      expect('Punctuation', '}')
      advance()

      return {
        type: 'StructLiteral',
        entries: entries,
        leadingTrivia,
        trailingTrivia: getTrailingTrivia(),
        range: { start, end: current().range.end },
      }
    } else {
      throwError(
        `Expected '(', '[' or '{' as start of grouping, got '${current().value}'`,
        current().range,
      )
    }
  }

  // MARK: RUN
  const start = current().range.start

  const nodes: AstNode[] = []
  while (!isAtEnd()) {
    try {
      // console.log('Start Root Node', ast, current())
      const statement = parseStatement()
      if (statement) nodes.push(statement)
    } catch (e) {
      if (!isAtEnd()) {
        advance()
      }
    }
  }

  return {
    ast: {
      type: 'Block',
      block: nodes,
      leadingTrivia: null,
      trailingTrivia: null,
      comments,
      isRoot: true,
      range: {
        start,
        end: current().range.end,
      },
    },
    errors,
  }
}
