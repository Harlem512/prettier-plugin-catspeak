import { AstPath, Doc, ParserOptions, Printer } from 'prettier'
import { builders, utils } from 'prettier/doc'
import { CommaMode } from './options.js'
import { AstNode, NodeMap, NodeType } from './parser/ast.js'
import { IterProperties, RNull } from './types.js'

// builder utilities
const { group, indent, join, line, softline, hardline, ifBreak } = builders

// MARK: separator
/**
 * Returns true if these nodes require a separator to disambiguate some statements.
 *
 * Ie. `[ a, [b] ]`
 */
function requiresSeparator(a: AstNode, b: AstNode): boolean {
  // newline nodes never require separation
  if (a.type === 'Newline') return false

  // disambiguate accessor and struct expression key
  // `{ a, [b]: b2 }` vs `{ a [b]: [b2] }` (causing syntax error)
  if (a.type === 'StructLiteralEntry' && b.type === 'StructLiteralEntry') {
    const keyType = b.key.type
    // if second key isn't an identifier, separator is required
    // returning false since all other conditions are already checked
    return (
      keyType !== 'Identifier' && keyType !== 'Number' && keyType !== 'String'
    )
  }

  // disambiguate array literal and accessor
  // `a; [b]` vs `a[b]`
  if (b.type === 'ArrayLiteral') return true

  // disambiguate empty return/break with a trailing expression
  // and a return/break with a value
  // `return; b` vs `return b`
  if (a.type === 'Return' || a.type === 'Break') return true

  // default
  return false
}

// MARK: joinComma
/**
 * Joins an array of nodes, but checks for required leading/trailing commas
 */
function joinComma<T extends AstNode>(
  path: AstPath<T>,
  key: IterProperties<T>,
  print: (path: AstPath<AstNode>) => Doc,
  options: ParserOptions<AstNode>,
) {
  return join(
    // commas are added inside the map loop
    line,
    path.map((_childNode, index, elements) => {
      const childNode = _childNode as AstPath<T>
      const child = print(childNode)
      // don't print comma for empty node
      if (
        childNode.node.type === 'Newline' ||
        childNode.node.type === 'CommentPlaceholder'
      ) {
        return child
      }

      switch (options.commaMode) {
        case CommaMode.NONE:
          // no next node, never comma
          return childNode.next &&
            // nodes require separation, add comma
            requiresSeparator(childNode.node, childNode.next)
            ? [child, ',']
            : child
        case CommaMode.NORMAL:
          return index === elements.length - 1 ? child : [child, ',']
        case CommaMode.TRAILING:
          // trailing comma if this group broke
          return index === elements.length - 1
            ? [child, ifBreak(',')]
            : [child, ',']
        default:
          const _: never = options.commaMode
          return child
      }
    }, key),
  )
}

// MARK: join comments
/**
 * Joins an array of nodes that may contain comments. Performs special handling so comment-only blocks work correctly.
 */
function joinWithComments<N extends AstNode>(
  path: AstPath<N>,
  blockKey: IterProperties<N>,
  print: (path: AstPath<AstNode>) => Doc,
  options: ParserOptions<AstNode>,
  groupPrefix: Doc,
  joinFn: (
    pa: typeof path,
    b: typeof blockKey,
    pr: typeof print,
    o: typeof options,
  ) => Doc,
): Doc {
  // this cast is always safe since blockKey must be a key of N that resolves to an array
  const children = path.node[blockKey as keyof N] as AstNode[]
  // this is always defined since empty blocks always have an internal CommentPlaceholder
  const firstChild = children[0]

  // body has content, print normally
  if (firstChild.type !== 'CommentPlaceholder')
    return indent([groupPrefix, joinFn(path, blockKey, print, options)])

  // check if the comment placeholder has comments
  const hasComments = firstChild.comments && firstChild.comments.length > 0
  // no comments, don't print anything to prevent text wrapping behavior
  if (!hasComments) return ''

  // print comment placeholder node so comments can be attached
  return group(
    // strip trailing hardline to prevent a weird trailing newline inside the block
    utils.stripTrailingHardline(
      indent([
        groupPrefix,
        // this is safe since path.node[blockKey][0] has already been validated
        // @ts-expect-error
        path.call(print, blockKey, 0),
      ]),
    ),
    // force break so comments get placed on newlines
    { shouldBreak: true },
  )
}

/**
 * Gets the next node, ignoring any newline nodes
 */
function getNext(path: AstPath<AstNode>): AstNode | undefined {
  const siblings = path.siblings
  // no sibling nodes
  if (!siblings || path.index === null) return undefined

  for (let i = path.index + 1; i < siblings.length; i++) {
    if (siblings[i].type !== 'Newline') return siblings[i]
  }

  return undefined
}

// MARK: joinSemicolon
/**
 * Joins an array of nodes, but checks for required leading/trailing semicolons
 */
function joinSemicolon<T extends AstNode>(
  path: AstPath<T>,
  key: IterProperties<T>,
  print: (path: AstPath<AstNode>) => Doc,
  options: ParserOptions<AstNode>,
): Doc[] {
  return join(
    hardline,
    path.map((_childNode) => {
      const childNode = _childNode as AstPath<T>
      const child = print(childNode)

      // add always-required semicolon
      if (options.printSemicolons) {
        // don't print semicolons for empty nodes
        const childType = childNode.node.type
        if (childType === 'Newline' || childType === 'CommentPlaceholder')
          return child

        return [child, ';']
      }

      const next = getNext(childNode)
      // no next node, never semicolon
      if (!next) return child

      // nodes don't require separation
      if (!requiresSeparator(childNode.node, next)) return child

      // nodes require separation, insert semicolon
      return [child, ';']
    }, key),
  )
}

const toIndent = new Set<NodeType>([
  'Catch',
  'Do',
  'If',
  'Match',
  'While',
  'With',
])
function indentAssignment(
  node: AstNode,
  doc: Doc,
  options: ParserOptions<AstNode>,
) {
  return options.indentAssignment && toIndent.has(node.type) ? indent(doc) : doc
}

// MARK: PRINTERS
const nodePrinters: {
  [Type in NodeType]: (
    // typescript nonsense for a slightly better type-check
    // (barely works)
    path: Omit<AstPath<AstNode>, 'node' | 'call' | 'map'> &
      Pick<AstPath<RNull<NodeMap[Type]>>, 'call' | 'map'> &
      Pick<AstPath<NodeMap[Type]>, 'node'>,
    options: ParserOptions<AstNode>,
    print: (path: AstPath<AstNode>) => Doc,
    args?: unknown,
  ) => Doc
} = {
  // MARK: block
  Block(path, options, print) {
    return [
      '{',
      joinWithComments(path, 'children', print, options, line, joinSemicolon),
      line,
      '}',
    ]
  },
  // comments are printed elsewhere
  Comment(path) {
    throw new Error(
      `Attempted to manually print comment ${JSON.stringify(path.node)}`,
    )
  },
  // comment placeholder
  CommentPlaceholder() {
    return ''
  },
  // MARK: root
  Root(path, options, print) {
    const body = joinSemicolon(path, 'block', print, options)

    if (path.node.block[0].type === 'CommentPlaceholder') {
      // if the only node is a CommentPlaceholder,
      // then this is a comment-only file
      // so don't print the trailing hardline
      // since the comment itself prints the newline
      return body
    }

    // default to printing body and a trailing hardline
    return [body, hardline]
  },
  // MARK: group
  Group(path, options, print) {
    return group([
      '(',
      indent([softline, path.call(print, 'inside')]),
      softline,
      ')',
    ])
  },
  // MARK: newline
  Newline() {
    return ifBreak('', hardline)
  },
  // MARK: let
  LetStatement(path, options, print) {
    // no value, only identifier
    if (!path.node.value) return ['let ', path.call(print, 'identifier')]

    const value = path.call(print, 'value')

    // assignments always fit on a single line
    return [
      'let ',
      path.call(print, 'identifier'),
      ' = ',
      indentAssignment(path.node.value, value, options),
    ]
  },
  // MARK: a[b]
  Accessor(path, options, print) {
    if (path.node.isIdentifier) {
      // a.b
      return group([
        path.call(print, 'collection'),
        indent([softline, '.', path.call(print, 'key')]),
      ])
    } else {
      // a[b]
      return group([
        path.call(print, 'collection'),
        group([
          '[',
          indent([softline, path.call(print, 'key')]),
          softline,
          ']',
        ]),
      ])
    }
  },
  // MARK: [ array ]
  ArrayLiteral(path, options, print) {
    const join = joinWithComments(
      path,
      'values',
      print,
      options,
      softline,
      joinComma,
    )

    return group([
      '[',
      join,
      // so empty arrays print as `[]`
      join === '' ? '' : softline,
      ']',
    ])
  },
  // MARK: a = b
  Assignment(path, options, print) {
    const value = path.call(print, 'value')

    // assignment always fits on one line
    return [
      path.call(print, 'identifier'),
      ' ',
      path.node.operator,
      ' ',
      indentAssignment(path.node.value, value, options),
    ]
  },
  // MARK: break
  Break(path, options, print) {
    return path.node.value
      ? group(['break ', path.call(print, 'value')])
      : 'break'
  },
  // MARK: fn()
  Call(path, options, print) {
    return group([
      path.node.isConstructor ? 'new ' : '',
      path.call(print, 'fun'),
      '(',
      path.node.arguments && path.node.arguments.length > 0
        ? [
            indent([softline, joinComma(path, 'arguments', print, options)]),
            softline,
          ]
        : '',
      ')',
    ])
  },
  // MARK: catch e
  Catch(path, options, print) {
    return group([
      group([path.call(print, 'expression')]),
      ' catch ',
      path.node.identifier ? [path.call(print, 'identifier'), ' '] : '',
      path.call(print, 'block'),
    ])
  },
  // MARK: continue
  Continue() {
    return 'continue'
  },
  // MARK: do { }
  Do(path, options, print) {
    return group(['do ', path.call(print, 'block')])
  },
  // MARK: fun { }
  Function(path, options, print) {
    // fun ... {
    const args =
      options.emptyFunctionArguments && path.node.arguments.length === 0
        ? 'fun '
        : group([
            'fun (',
            indent([softline, joinComma(path, 'arguments', print, options)]),
            softline,
            ') ',
          ])

    return group([args, path.call(print, 'block')])
  },
  // MARK: foo
  Identifier(path) {
    return path.node.name
  },
  // MARK: if
  If(path, options, print) {
    return group([
      'if ',
      path.call(print, 'condition'),
      ' ', // space after if condition before opening brace
      // if block
      path.call(print, 'ifBlock'),
      // else block
      path.node.elseBlock ? [' else ', path.call(print, 'elseBlock')] : '',
      // special else-if handler
      path.node.elseIfExpression
        ? [' else ', path.call(print, 'elseIfExpression')]
        : '',
    ])
  },
  // MARK: match
  Match(path, options, print) {
    return group([
      'match ',
      path.call(print, 'condition'),
      ' {',
      joinWithComments(path, 'cases', print, options, line, () =>
        join(line, path.map(print, 'cases')),
      ),
      line,
      '}',
    ])
  },
  // MARK: match case
  MatchCase(path, options, print) {
    // either `case X` or `else`
    const caseDoc = path.node.case
      ? group(['case', line, path.call(print, 'case'), line])
      : ['else ']

    // print body of the case/else
    return group([caseDoc, path.call(print, 'block')])
  },
  // MARK: 123
  Number(path) {
    return path.node.value
  },
  // MARK: operator
  Operator(path, options, print) {
    if (options.wrapBinaryOperators) {
      return group([
        path.call(print, 'left'),
        indent([line, path.node.operation, ' ', path.call(print, 'right')]),
      ])
    } else {
      return group([
        path.call(print, 'left'),
        ' ',
        path.node.operation,
        indent([line, path.call(print, 'right')]),
      ])
    }
  },
  // MARK: return
  Return(path, options, print) {
    return path.node.value
      ? group(['return ', path.call(print, 'value')])
      : 'return'
  },
  // MARK: "string"
  String(path) {
    return path.node.value
  },
  // MARK: { struct }
  StructLiteral(path, options, print) {
    const join = joinWithComments(
      path,
      'entries',
      print,
      options,
      line,
      joinComma,
    )

    return group([
      '{',
      join,
      // so empty structs print as `{}`
      join === '' ? '' : line,
      '}',
    ])
  },
  StructLiteralEntry(path, options, print) {
    let key = path.call(print, 'key')

    // non-identifiers require [brackets]
    if (!path.node.isIdentifier) {
      key = ['[', indent([softline, key]), softline, ']']
    }

    // key only
    if (!path.node.value) return key

    // key and value
    return [group(key), ': ', path.call(print, 'value')]
  },
  // MARK: throw
  Throw(path, options, print) {
    return path.node.value
      ? group(['throw ', path.call(print, 'value')])
      : 'throw'
  },
  // MARK: !a
  Unary(path, options, print) {
    return [path.node.operation, path.call(print, 'value')]
  },
  // MARK: while
  While(path, options, print) {
    return group([
      group(['while ', path.call(print, 'condition'), ' ']),
      path.call(print, 'block'),
    ])
  },
  // MARK: with
  With(path, options, print) {
    return group([
      group(['with ', path.call(print, 'condition'), ' ']),
      path.call(print, 'block'),
    ])
  },
}

// MARK: printer entry
export const printer: Printer<AstNode> = {
  print(path, options, print, args) {
    const fn = nodePrinters[path.node.type]
    if (!fn)
      throw new Error(
        `Unexpected node type '${path.node.type}' when printing AST`,
      )
    // typecast is safe since fn is valid
    // @ts-expect-error
    return fn(path, options, print, args)
  },
  getVisitorKeys(node, nonTraversableKeys) {
    return Object.keys(node).filter(
      (key) => !nonTraversableKeys.has(key) && key !== 'range',
    )
  },
  printComment(path) {
    // only comment nodes can be properly printed
    if (path.node.type !== 'Comment') return path.node.type
    // default comment print
    return path.node.value.trimEnd()
  },
  // required to make prettier's auto-comments work correctly
  // all nodes can have comments
  canAttachComment() {
    return true
  },
  // MARK: comment child nodes
  getCommentChildNodes(node) {
    const ar: AstNode[] = []
    const potentialChildren = getCommentChildren(node)

    for (const child of potentialChildren) {
      if (!child) continue
      if (Array.isArray(child)) {
        ar.push(...child)
      } else {
        ar.push(child)
      }
    }

    return ar
  },
}

function getCommentChildren(node: AstNode): (AstNode | AstNode[] | null)[] {
  switch (node.type) {
    case 'Accessor':
      return [node.key, node.collection]
    case 'ArrayLiteral':
      return node.values
    case 'Assignment':
      return [node.identifier, node.value]
    case 'Block':
      return node.children
    case 'Call':
      return [node.fun, node.arguments]
    case 'Catch':
      return [node.expression, node.identifier, node.block]
    case 'Do':
      return [node.block]
    case 'Function':
      return [node.arguments, node.block]
    case 'Group':
      return [node.inside]
    case 'If':
      return [
        node.condition,
        node.ifBlock,
        node.elseBlock,
        node.elseIfExpression,
      ]
    case 'LetStatement':
      return [node.identifier, node.value]
    case 'Match':
      return [node.condition, node.cases]
    case 'MatchCase':
      return [node.case, node.block]
    case 'Operator':
      return [node.left, node.right]
    case 'Return':
      return [node.value]
    case 'Root':
      return node.block
    case 'StructLiteral':
      return node.entries
    case 'StructLiteralEntry':
      return [node.key, node.value]
    case 'Throw':
      return [node.value]
    case 'Unary':
      return [node.value]
    case 'While':
      return [node.condition, node.block]
    case 'With':
      return [node.condition, node.block]
    // terminals
    case 'String':
    case 'Number':
    case 'Identifier':
    case 'Continue':
    case 'Break':
    // fake nodes
    case 'Newline':
    case 'Comment':
    case 'CommentPlaceholder':
      return []
    default:
      const _: never = node
      return []
  }
}
