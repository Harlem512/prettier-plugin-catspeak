import { AstPath, Doc, ParserOptions, Printer } from 'prettier'
import { builders, utils } from 'prettier/doc'
import { CommaMode, SemicolonMode } from './options'
import { AstNode, NodeMap, NodeType } from './parser/ast'
import { IterProperties, RNull } from './types'

// builder utilities
const { group, indent, join, line, softline, hardline, ifBreak } = builders

/**
 * Indents this block twice if it wraps
 * ```
 * if (
 *     some_long_condition
 * ) {
 *   ...
 * }
 * ```
 */
function indentExp(doc: Doc, options: ParserOptions<AstNode>): Doc {
  return options.doubleIndent ? indent(indent(doc)) : indent(doc)
}

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
    options.commaMode === CommaMode.NONE ? line : [',', line],
    path.map((_childNode, index, elements) => {
      const childNode = _childNode as AstPath<T>
      const child = print(childNode)

      switch (options.commaMode) {
        case CommaMode.NONE:
          // no next node, never comma
          return childNode.next &&
            // nodes require separation, add comma
            requiresSeparator(childNode.node, childNode.next)
            ? [child, ',']
            : child
        case CommaMode.NORMAL:
          return child
        case CommaMode.TRAILING:
          // trailing comma if this group broke
          return index === elements.length - 1 ? [child, ifBreak(',')] : child
        default:
          const _: never = options.commaMode
          return child
      }
    }, key),
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
  print: (path: AstPath<AstNode>) => Doc,
  options: ParserOptions<AstNode>,
  key: IterProperties<T>,
): Doc[] {
  return join(
    hardline,
    path.map((_childNode) => {
      const childNode = _childNode as AstPath<T>
      const child = print(childNode)

      // add always-required semicolon
      if (options.semicolonMode === SemicolonMode.ALL) return [child, ';']

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

// MARK: printBlock
function printBlock<N extends AstNode>(
  path: AstPath<N>,
  blockKey: IterProperties<N>,
  print: (path: AstPath<AstNode>) => Doc,
  options: ParserOptions<AstNode>,
): Doc {
  // this cast is always safe since blockKey must be a key of N that resolves to an array
  const children = path.node[blockKey as keyof N] as AstNode[]
  // this is always defined since empty blocks always have an internal CommentPlaceholder
  const firstChild = children[0]

  if (firstChild.type !== 'CommentPlaceholder')
    return indent([line, joinSemicolon(path, print, options, blockKey)])

  // check if the comment placeholder has comments
  const hasComments = firstChild.comments && firstChild.comments.length > 0
  // no comments, don't print anything to prevent text wrapping behavior
  if (!hasComments) return ''

  // print comment placeholder node so comments can be attached
  return group(
    // strip trailing hardline to prevent a weird trailing newline inside the block
    utils.stripTrailingHardline(
      indent([
        line,
        // this is safe since path.node[blockKey][0] has already been validated
        // @ts-ignore
        path.call(print, blockKey, 0),
      ]),
    ),
    // force break so comments get placed on newlines
    { shouldBreak: true },
  )
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
  // MARK: block
  Root(path, options, print) {
    const body = joinSemicolon(path, print, options, 'block')

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
      indentExp(group([softline, path.call(print, 'inside')]), options),
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
    // simple option
    if (!path.node.value) return ['let ', path.call(print, 'identifier')]

    // let a = b
    return group([
      // identifier always fits on a single line
      ['let ', path.call(print, 'identifier'), ' ='],
      // indent
      indentExp([line, path.call(print, 'value')], options),
    ])
  },
  // MARK: a[b]
  Accessor(path, options, print) {
    return group([
      path.call(print, 'collection'),
      group([
        '[',
        indentExp([softline, path.call(print, 'key')], options),
        softline,
        ']',
      ]),
    ])
  },
  // MARK: [ array ]
  ArrayLiteral(path, options, print) {
    return group([
      '[',
      indent([softline, joinComma(path, 'values', print, options)]),
      softline,
      ']',
    ])
  },
  // MARK: a = b
  Assignment(path, options, print) {
    return group([
      path.call(print, 'identifier'),
      indent([line, path.node.operator, line, path.call(print, 'value')]),
    ])
  },
  // MARK: break
  Break(path, options, print) {
    return path.node.value
      ? group(['break', indent(path.call(print, 'value'))])
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
            indentExp(
              [softline, joinComma(path, 'arguments', print, options)],
              options,
            ),
            softline,
          ]
        : '',
      ')',
    ])
  },
  // MARK: continue
  Continue() {
    return 'continue'
  },
  // MARK: do { }
  Do(path, options, print) {
    return group(['do {', printBlock(path, 'block', print, options), line, '}'])
  },
  // MARK: fun { }
  Function(path, options, print) {
    return group([
      [
        group([
          'fun ',
          // empty function block part
          ...(path.node.arguments.length > 0 && options.emptyFunctionArguments
            ? []
            : [
                '(',
                group(
                  indentExp(
                    [softline, joinComma(path, 'arguments', print, options)],
                    options,
                  ),
                ),
                softline,
                ') ',
              ]),
        ]),
        '{',
        printBlock(path, 'block', print, options),
        line,
        '}',
      ],
    ])
  },
  // MARK: foo
  Identifier(path) {
    return path.node.name
  },
  // MARK: if
  If(path, options, print) {
    return group([
      group([
        'if',
        indentExp([line, path.call(print, 'condition')], options),
        line,
        '{',
      ]),
      group([printBlock(path, 'ifBlock', print, options), line, '}']),
      path.node.elseBlock
        ? [
            ' else {',
            group([printBlock(path, 'elseBlock', print, options), line, '}']),
          ]
        : '',
      path.node.ifElseExpression
        ? [' else ', group(path.call(print, 'ifElseExpression'))]
        : '',
    ])
  },
  // MARK: match
  Match(path, options, print) {
    return group([
      group([
        'match ',
        indentExp(path.call(print, 'condition'), options),
        line,
        '{',
      ]),
      group(
        path.map((caseNode) => {
          // either `case X` or `else`
          const caseDoc = caseNode.node.case
            ? group([
                'case',
                line,
                // safe to hide print here, `case` will always be non-null
                caseNode.call(print as any, 'case'),
                line,
              ])
            : ['else ']
          // print body of the case/else
          return indent([
            line,
            group([
              caseDoc,
              '{',
              printBlock(path, 'block', print, options),
              line,
              '}',
            ]),
          ])
        }, 'cases'),
      ),
      line,
      '}',
    ])
  },
  // MARK: 123
  Number(path) {
    return path.node.value
  },
  // MARK: operator
  Operator(path, options, print) {
    return group([
      path.call(print, 'left'),
      indentExp(
        [line, path.node.operation, ' ', path.call(print, 'right')],
        options,
      ),
    ])
  },
  // MARK: return
  Return(path, options, print) {
    return path.node.value
      ? group(['return', indent(path.call(print, 'value'))])
      : 'return'
  },
  // MARK: "string"
  String(path) {
    return path.node.value
  },
  // MARK: { struct }
  StructLiteral(path, options, print) {
    const hasEntries = path.node.entries.length === 0

    return group([
      '{',
      hasEntries
        ? ''
        : indent([line, joinComma(path, 'entries', print, options)]),
      hasEntries ? '' : line,
      '}',
    ])
  },
  StructLiteralEntry(path, options, print) {
    // this is safe since this is the actual value of `entries`
    const keyType = path.node.key.type
    let key = path.call(print, 'key')

    // non-identifiers require [brackets]
    if (
      keyType !== 'Identifier' &&
      keyType !== 'Number' &&
      keyType !== 'String'
    ) {
      key = group(['[', indentExp([softline, key], options), softline, ']'])
    }

    // key only
    if (!path.node.value) return key

    // key and value
    return group([
      key,
      ':',
      indent([
        line,
        // value is always true, so this is safe
        path.call(print as any, 'value'),
      ]),
    ])
  },
  // MARK: !a
  Unary(path, options, print) {
    return [path.node.operation, path.call(print, 'value')]
  },
  // MARK: while
  While(path, options, print) {
    return group([
      group([
        'while',
        indentExp([line, path.call(print, 'condition')], options),
        line,
        '{',
      ]),
      group([printBlock(path, 'block', print, options), line, '}']),
    ])
  },
  // MARK: with
  With(path, options, print) {
    return group([
      group([
        'with',
        indentExp([line, path.call(print, 'condition')], options),
        line,
        '{',
      ]),
      group([printBlock(path, 'block', print, options), line, '}']),
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
    return fn(path as any, options, print, args)
  },
  printComment(path) {
    // ensure comment-only node
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
    switch (node.type) {
      case 'Accessor':
        return [node.key, node.collection]
      case 'ArrayLiteral':
        return node.values
      case 'Assignment':
        return [node.identifier, node.value]
      case 'Call':
        return [node.fun, ...(node.arguments ?? [])]
      case 'Do':
        return node.block
      case 'Function':
        return [...node.arguments, ...node.block]
      case 'Group':
        return [node.inside]
      case 'If':
        return [
          node.condition,
          ...node.ifBlock,
          ...(node.elseBlock ?? []),
          ...(node.ifElseExpression ? [node.ifElseExpression] : []),
        ]
      case 'LetStatement':
        return node.value ? [node.identifier, node.value] : [node.identifier]
      case 'Match':
        return [
          node.condition,
          ...node.cases.flatMap<AstNode>((m) =>
            m.case ? [m.case, ...m.block] : [...m.block],
          ),
        ]
      case 'Operator':
        return [node.left, node.right]
      case 'Return':
        return node.value ? [node.value] : []
      case 'Root':
        return node.block
      case 'StructLiteral':
        return node.entries
      case 'StructLiteralEntry':
        return node.value ? [node.key, node.value] : [node.key]
      case 'Unary':
        return [node.value]
      case 'While':
        return [node.condition, ...node.block]
      case 'With':
        return [node.condition, ...node.block]
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
      default:
        return []
    }
  },
}
