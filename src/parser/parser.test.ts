import {
  type AssignmentNode,
  type ArrayLiteralNode,
  type AstNode,
  type CallNode,
  type FunctionNode,
  type IdentifierNode,
  type LetStatement,
  type MatchNode,
  type NumberNode,
  type OperatorNode,
  type ParseError,
  type ParseResult,
  type StringNode,
  type StructLiteralNode,
  GroupNode,
  RootNode,
  CommentPlaceholderNode,
} from './ast.js'
import type { Position } from './lexer.js'
import { parse as baseParse } from './parser.js'

function parse(
  str: string | string[],
  nodeLength: number = 1,
  errorLength: number = 0,
): ParseResult {
  const input = Array.isArray(str) ? str.join('\n') : str
  const p = baseParse(input, { includePlaceholders: true })
  expect(p.errors).toHaveLength(errorLength)
  const block = node<RootNode>(p.ast, 'Root', 0, input.length, {
    isRoot: true,
  })
  expect(
    // filter out comment placeholder node
    block.block.filter(({ type }) => type !== 'CommentPlaceholder'),
  ).toHaveLength(nodeLength)
  expect(block.comments).toBeDefined()
  return p
}

function node<T extends AstNode>(
  _node: AstNode,
  type: T['type'],
  start: number | Position,
  end: number | Position,
  data?: Partial<T>,
): T {
  const node = _node as T

  expect(node).toBeDefined()
  expect(node.type).toBe(type)
  if (typeof start === 'number') {
    expect(node.range.start.character).toBe(start)
  } else {
    expect(node.range.start.character).toBe(start.character)
    expect(node.range.start.line).toBe(start.line)
  }
  if (typeof end === 'number') {
    expect(node.range.end.character).toBe(end)
  } else {
    expect(node.range.end.character).toBe(end.character)
    expect(node.range.end.line).toBe(end.line)
  }
  if (data) {
    for (const [key, value] of Object.entries(data)) {
      expect(node[key as keyof T]).toBe(value)
    }
  }

  return node
}

function error(
  error: ParseError,
  start: number | Position,
  end: number | Position,
) {
  if (typeof start === 'number') {
    expect(error.range.start.character).toBe(start)
  } else {
    expect(error.range.start.character).toBe(start.character)
    expect(error.range.start.line).toBe(start.line)
  }
  if (typeof end === 'number') {
    expect(error.range.end.character).toBe(end)
  } else {
    expect(error.range.end.character).toBe(end.character)
    expect(error.range.end.line).toBe(end.line)
  }
}

// MARK: let
describe('let statements', () => {
  it('without value', () => {
    const res = parse('let x')

    const letStatement = node<LetStatement>(
      res.ast.block[0],
      'LetStatement',
      0,
      5,
    )
    node<IdentifierNode>(letStatement.identifier, 'Identifier', 4, 5, {
      name: 'x',
    })
  })

  it('with value', () => {
    const res = parse('let x = 123')
    const letStatement = node<LetStatement>(
      res.ast.block[0],
      'LetStatement',
      0,
      11,
    )
    node<IdentifierNode>(letStatement.identifier, 'Identifier', 4, 5, {
      name: 'x',
    })
    node(letStatement.value!, 'Number', 8, 11, {
      value: '123',
    })
  })

  it('with accessor', () => {
    const res = parse('let a.b', 2, 1)

    const letStatement = node<LetStatement>(
      res.ast.block[0],
      'LetStatement',
      0,
      5,
    )
    node<IdentifierNode>(letStatement.identifier, 'Identifier', 4, 5, {
      name: 'a',
    })
    node<IdentifierNode>(res.ast.block[1], 'Identifier', 6, 7, {
      name: 'b',
    })
  })

  it('with invalid value', () => {
    const res = parse('let x = ()', 0, 1)
    error(res.errors[0], 9, 10)
  })

  it('with another invalid identifier', () => {
    const res = parse('let 123', 0, 1)
    error(res.errors[0], 4, 7)
  })
})

// MARK: terminal
describe('terminal expression', () => {
  it('numbers', () => {
    const res = parse('123 0b011 0xF14a', 3)
    node<NumberNode>(res.ast.block[0], 'Number', 0, 3, { value: '123' })
    node<NumberNode>(res.ast.block[1], 'Number', 4, 9, { value: '0b011' })
    node<NumberNode>(res.ast.block[2], 'Number', 10, 16, { value: '0xF14a' })
  })
  it('color code', () => {
    const res = parse('#fff')
    node<NumberNode>(res.ast.block[0], 'Number', 0, 4, { value: '#fff' })
  })
  it('string', () => {
    const res = parse('"str"')
    node<StringNode>(res.ast.block[0], 'String', 0, 5, { value: '"str"' })
  })
  it('at string', () => {
    const res = parse('@"str"')
    node<StringNode>(res.ast.block[0], 'String', 0, 6, { value: '@"str"' })
  })
  it('character', () => {
    const res = parse("'c'")
    node<NumberNode>(res.ast.block[0], 'Number', 0, 3, { value: "'c'" })
  })
  it('identifier', () => {
    const res = parse('my_var')
    node<IdentifierNode>(res.ast.block[0], 'Identifier', 0, 6, {
      name: 'my_var',
    })
  })
  it('keyword', () => {
    const res = parse('true false undefined NaN infinity global self other', 8)
    const ast = res.ast.block
    node<NumberNode>(ast[0], 'Number', 0, 4, { value: 'true' })
    node<NumberNode>(ast[1], 'Number', 5, 10, { value: 'false' })
    node<NumberNode>(ast[2], 'Number', 11, 20, { value: 'undefined' })
    node<NumberNode>(ast[3], 'Number', 21, 24, { value: 'NaN' })
    node<NumberNode>(ast[4], 'Number', 25, 33, { value: 'infinity' })
    node<IdentifierNode>(ast[5], 'Identifier', 34, 40, { name: 'global' })
    node<IdentifierNode>(ast[6], 'Identifier', 41, 45, { name: 'self' })
    node<IdentifierNode>(ast[7], 'Identifier', 46, 51, { name: 'other' })
  })
})

// MARK: group
describe('group', () => {
  it('operation priority', () => {
    const res = parse('(1+2)*3')
    const op = node<OperatorNode>(res.ast.block[0], 'Operator', 0, 7, {
      operation: '*',
    })
    const group = node<GroupNode>(op.left, 'Group', 0, 5)
    const op2 = node<OperatorNode>(group.inside, 'Operator', 1, 4, {
      operation: '+',
    })
    node<NumberNode>(op2.left, 'Number', 1, 2, { value: '1' })
    node<NumberNode>(op2.right, 'Number', 3, 4, { value: '2' })
    node<NumberNode>(op.right, 'Number', 6, 7, { value: '3' })
  })

  it('empty group', () => {
    const res = parse('()', 0, 1)
    error(res.errors[0], 1, 2)
  })

  it('group extends identifier token size', () => {
    const res = parse('( my_var )')
    const identifier = node<GroupNode>(res.ast.block[0], 'Group', 0, 10)
    node<IdentifierNode>(identifier.inside, 'Identifier', 2, 8, {
      name: 'my_var',
    })
  })
})

// MARK: array literal
describe('array literal', () => {
  it('empty', () => {
    const res = parse('[]')
    const ar = node<ArrayLiteralNode>(res.ast.block[0], 'ArrayLiteral', 0, 2)
    expect(ar.values).toHaveLength(1)
    node<CommentPlaceholderNode>(ar.values[0], 'CommentPlaceholder', 2, 2)
  })
  it('with commas', () => {
    const res = parse('[1, 2]')
    const ar = node<ArrayLiteralNode>(res.ast.block[0], 'ArrayLiteral', 0, 6)
    expect(ar.values).toHaveLength(2)
    node<NumberNode>(ar.values[0], 'Number', 1, 2, { value: '1' })
    node<NumberNode>(ar.values[1], 'Number', 4, 5, { value: '2' })
  })
  it('with trailing comma', () => {
    const res = parse('[1 2,]')
    const ar = node<ArrayLiteralNode>(res.ast.block[0], 'ArrayLiteral', 0, 6)
    expect(ar.values).toHaveLength(2)
    node<NumberNode>(ar.values[0], 'Number', 1, 2, { value: '1' })
    node<NumberNode>(ar.values[1], 'Number', 3, 4, { value: '2' })
  })
  it('without commas', () => {
    const res = parse('[1  2]')
    const ar = node<ArrayLiteralNode>(res.ast.block[0], 'ArrayLiteral', 0, 6)
    expect(ar.values).toHaveLength(2)
    node<NumberNode>(ar.values[0], 'Number', 1, 2, { value: '1' })
    node<NumberNode>(ar.values[1], 'Number', 4, 5, { value: '2' })
  })
})

// MARK: struct literal
describe('struct literal', () => {
  it('empty', () => {
    const res = parse('{}')
    const struct = node<StructLiteralNode>(
      res.ast.block[0],
      'StructLiteral',
      0,
      2,
    )
    expect(struct.entries).toHaveLength(1)
    node<CommentPlaceholderNode>(struct.entries[0], 'CommentPlaceholder', 2, 2)
  })

  it('terminal key', () => {
    const res = parse('{ my_var: 123 }')
    const struct = node<StructLiteralNode>(
      res.ast.block[0],
      'StructLiteral',
      0,
      15,
    )
    expect(struct.entries).toHaveLength(1)
    const entry = struct.entries[0]
    node<IdentifierNode>(entry.key, 'Identifier', 2, 8, { name: 'my_var' })
    node<NumberNode>(entry.value!, 'Number', 10, 13, { value: '123' })
  })

  it('expression key', () => {
    const res = parse('{ [123]: 456 }')
    const struct = node<StructLiteralNode>(
      res.ast.block[0],
      'StructLiteral',
      0,
      14,
    )
    expect(struct.entries).toHaveLength(1)
    const entry = struct.entries[0]
    node<NumberNode>(entry.key, 'Number', 3, 6, { value: '123' })
    node<NumberNode>(entry.value!, 'Number', 9, 12, { value: '456' })
  })

  it('only identifier', () => {
    const res = parse('{ name }')
    const struct = node<StructLiteralNode>(
      res.ast.block[0],
      'StructLiteral',
      0,
      8,
    )
    expect(struct.entries).toHaveLength(1)
    const entry = struct.entries[0]
    node<IdentifierNode>(entry.key, 'Identifier', 2, 6, { name: 'name' })
    expect(entry.value).toBeNull()
  })

  it('with commas', () => {
    const res = parse('{ a, b }')
    const struct = node<StructLiteralNode>(
      res.ast.block[0],
      'StructLiteral',
      0,
      8,
    )
    expect(struct.entries).toHaveLength(2)
    const entry1 = struct.entries[0]
    node<IdentifierNode>(entry1.key, 'Identifier', 2, 3, { name: 'a' })
    expect(entry1.value).toBeNull()
    const entry2 = struct.entries[1]
    node<IdentifierNode>(entry2.key, 'Identifier', 5, 6, { name: 'b' })
    expect(entry2.value).toBeNull()
  })

  it('with trailing comma', () => {
    const res = parse('{ a b, }')
    const struct = node<StructLiteralNode>(
      res.ast.block[0],
      'StructLiteral',
      0,
      8,
    )
    expect(struct.entries).toHaveLength(2)
    const entry1 = struct.entries[0]
    node<IdentifierNode>(entry1.key, 'Identifier', 2, 3, { name: 'a' })
    expect(entry1.value).toBeNull()
    const entry2 = struct.entries[1]
    node<IdentifierNode>(entry2.key, 'Identifier', 4, 5, { name: 'b' })
    expect(entry2.value).toBeNull()
  })

  it('without comma', () => {
    const res = parse('{ a b  }')
    const struct = node<StructLiteralNode>(
      res.ast.block[0],
      'StructLiteral',
      0,
      8,
    )
    expect(struct.entries).toHaveLength(2)
    const entry1 = struct.entries[0]
    node<IdentifierNode>(entry1.key, 'Identifier', 2, 3, { name: 'a' })
    expect(entry1.value).toBeNull()
    const entry2 = struct.entries[1]
    node<IdentifierNode>(entry2.key, 'Identifier', 4, 5, { name: 'b' })
    expect(entry2.value).toBeNull()
  })
})

// MARK: call
describe('call', () => {
  it('normal', () => {
    const res = parse('a()')
    const call = node<CallNode>(res.ast.block[0], 'Call', 0, 3)
    expect(call.arguments).toHaveLength(0)
    node<IdentifierNode>(call.fun, 'Identifier', 0, 1, {
      name: 'a',
    })
  })

  it('with trailing comma', () => {
    const res = parse('a(1,2,)')
    const call = node<CallNode>(res.ast.block[0], 'Call', 0, 7)
    expect(call.arguments).toHaveLength(2)
    node<IdentifierNode>(call.fun, 'Identifier', 0, 1, {
      name: 'a',
    })
    node<NumberNode>(call.arguments![0], 'Number', 2, 3, {
      value: '1',
    })
    node<NumberNode>(call.arguments![1], 'Number', 4, 5, {
      value: '2',
    })
  })

  it('without comma', () => {
    const res = parse('a(1 2 )')
    const call = node<CallNode>(res.ast.block[0], 'Call', 0, 7)
    expect(call.arguments).toHaveLength(2)
    node<IdentifierNode>(call.fun, 'Identifier', 0, 1, {
      name: 'a',
    })
    node<NumberNode>(call.arguments![0], 'Number', 2, 3, {
      value: '1',
    })
    node<NumberNode>(call.arguments![1], 'Number', 4, 5, {
      value: '2',
    })
  })
})

// MARK: fun
describe('function expression', () => {
  it('normal', () => {
    const res = parse('fun (a, b) { 123 }')
    const n = node<FunctionNode>(res.ast.block[0], 'Function', 0, 18)
    expect(n.arguments).toHaveLength(2)
    node<IdentifierNode>(n.arguments[0], 'Identifier', 5, 6, { name: 'a' })
    node<IdentifierNode>(n.arguments[1], 'Identifier', 8, 9, { name: 'b' })
    expect(n.block).toHaveLength(1)
    node<NumberNode>(n.block[0], 'Number', 13, 16, { value: '123' })
  })

  it('no arg commas', () => {
    const res = parse('fun (a b) { 123 }')
    const n = node<FunctionNode>(res.ast.block[0], 'Function', 0, 17)
    expect(n.arguments).toHaveLength(2)
    node<IdentifierNode>(n.arguments[0], 'Identifier', 5, 6, { name: 'a' })
    node<IdentifierNode>(n.arguments[1], 'Identifier', 7, 8, { name: 'b' })
    expect(n.block).toHaveLength(1)
    node<NumberNode>(n.block[0], 'Number', 12, 15, { value: '123' })
  })

  it('no args, no body', () => {
    const res = parse('fun () { }')
    const n = node<FunctionNode>(res.ast.block[0], 'Function', 0, 10)
    expect(n.arguments).toHaveLength(0)
    expect(n.block).toHaveLength(1)
    node<CommentPlaceholderNode>(n.block[0], 'CommentPlaceholder', 10, 10)
  })

  it('no args, no body, no parenthesis', () => {
    const res = parse('fun { }')
    const n = node<FunctionNode>(res.ast.block[0], 'Function', 0, 7)
    expect(n.arguments).toHaveLength(0)
    expect(n.block).toHaveLength(1)
    node<CommentPlaceholderNode>(n.block[0], 'CommentPlaceholder', 7, 7)
  })

  it('no args', () => {
    const res = parse('fun { 123 }')
    const n = node<FunctionNode>(res.ast.block[0], 'Function', 0, 11)
    expect(n.arguments).toHaveLength(0)
    expect(n.block).toHaveLength(1)
    node<NumberNode>(n.block[0], 'Number', 6, 9, { value: '123' })
  })
})

describe('assignment', () => {
  it('normal', () => {
    const res = parse('a = b')
    const n = node<AssignmentNode>(res.ast.block[0], 'Assignment', 0, 5)
    node<IdentifierNode>(n.identifier, 'Identifier', 0, 1, { name: 'a' })
    node<IdentifierNode>(n.value, 'Identifier', 4, 5, { name: 'b' })
  })
})

describe('match', () => {
  it('normal', () => {
    const res = parse('match a{case 1{b}case 2{c}else{d}}')
    const n = node<MatchNode>(res.ast.block[0], 'Match', 0, 34)
    node<IdentifierNode>(n.condition, 'Identifier', 6, 7, { name: 'a' })
    expect(n.cases).toHaveLength(3)
    // case 1
    node<NumberNode>(n.cases[0].case!, 'Number', 13, 14, { value: '1' })
    expect(n.cases[0].block).toHaveLength(1)
    node<IdentifierNode>(n.cases[0].block[0], 'Identifier', 15, 16, {
      name: 'b',
    })
    // case 2
    node<NumberNode>(n.cases[1].case!, 'Number', 22, 23, { value: '2' })
    expect(n.cases[1].block).toHaveLength(1)
    node<IdentifierNode>(n.cases[1].block[0], 'Identifier', 24, 25, {
      name: 'c',
    })
    // else
    expect(n.cases[2].case).toBeNull()
    expect(n.cases[2].block).toHaveLength(1)
    node<IdentifierNode>(n.cases[2].block[0], 'Identifier', 31, 32, {
      name: 'd',
    })
  })
})
