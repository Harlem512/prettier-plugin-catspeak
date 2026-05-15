/**
 * Catspeak AST Node Definitions
 */

import type { Range } from './lexer'

interface BaseNode {
  range: Range
}

// MARK: fake

export interface BlockNode extends BaseNode {
  type: 'Block'
  block: AstNode[]
  /** IMPORTANT: used by prettier to automatically print comments */
  comments?: CommentNode[]
  isRoot: boolean
}

export interface CommentNode extends BaseNode {
  type: 'Comment'
  value: string
}

/**
 * A "placeholder" node for attaching comments to
 */
export interface CommentPlaceholderNode extends BaseNode {
  type: 'CommentPlaceholder'
}

export interface GroupNode extends BaseNode {
  type: 'Group'
  inside: AstExpressionNode
}

/**
 * A "placeholder" node for blank lines. Condenses 2 or more sequential newline
 * tokens into a single node.
 */
export interface NewlineNode extends BaseNode {
  type: 'Newline'
}

// MARK: statement

export interface LetStatement extends BaseNode {
  type: 'LetStatement'
  identifier: IdentifierNode | AssignmentNode
  value: AstExpressionNode | null
}

// MARK: expression

export interface AccessorNode extends BaseNode {
  type: 'Accessor'
  collection: AstExpressionNode
  key: AstExpressionNode
}

export interface ArrayLiteralNode extends BaseNode {
  type: 'ArrayLiteral'
  values: AstExpressionNode[]
}

export interface AssignmentNode extends BaseNode {
  type: 'Assignment'
  operator: string
  identifier: AccessorNode | IdentifierNode
  value: AstExpressionNode
}

export interface BreakNode extends BaseNode {
  type: 'Break'
  value: AstExpressionNode | null
}

export interface CallNode extends BaseNode {
  type: 'Call'
  fun: AstExpressionNode
  isConstructor: boolean
  arguments: AstExpressionNode[] | null
}

export interface ContinueNode extends BaseNode {
  type: 'Continue'
}

export interface DoNode extends BaseNode {
  type: 'Do'
  block: AstNode[]
}

export interface FunctionNode extends BaseNode {
  type: 'Function'
  arguments: IdentifierNode[]
  block: AstNode[]
}

export interface IdentifierNode extends BaseNode {
  type: 'Identifier'
  name: string
}

export interface IfNode extends BaseNode {
  type: 'If'
  condition: AstExpressionNode
  ifBlock: AstNode[]
  elseBlock: AstNode[] | null
  ifElseExpression: AstExpressionNode | null
}

export interface MatchNode extends BaseNode {
  type: 'Match'
  condition: AstExpressionNode
  cases: { case: AstExpressionNode | null; block: AstNode[] }[]
}

export interface NumberNode extends BaseNode {
  type: 'Number'
  value: string
}

export interface OperatorNode extends BaseNode {
  type: 'Operator'
  operation: string
  left: AstExpressionNode
  right: AstExpressionNode
}

export interface ReturnNode extends BaseNode {
  type: 'Return'
  value: AstExpressionNode | null
}

export interface StringNode extends BaseNode {
  type: 'String'
  value: string
}

export interface StructLiteralNode extends BaseNode {
  type: 'StructLiteral'
  entries: StructLiteralEntryNode[]
}

// fake node
export interface StructLiteralEntryNode extends BaseNode {
  type: 'StructLiteralEntry'
  key: AstExpressionNode
  value: AstExpressionNode | null
}

export interface UnaryNode extends BaseNode {
  type: 'Unary'
  operation: string
  value: AstExpressionNode
}

export interface WithNode extends BaseNode {
  type: 'With'
  condition: AstExpressionNode
  block: AstNode[]
}

export interface WhileNode extends BaseNode {
  type: 'While'
  condition: AstExpressionNode
  block: AstNode[]
}

// non-statement, non-expression nodes (used internally)
export type AstFakeNode =
  | BlockNode
  | CommentNode
  | CommentPlaceholderNode
  | NewlineNode
  | StructLiteralEntryNode

export type AstExpressionNode =
  | AccessorNode
  | ArrayLiteralNode
  | AssignmentNode
  | BreakNode
  | CallNode
  | ContinueNode
  | DoNode
  | FunctionNode
  | GroupNode
  | IdentifierNode
  | IfNode
  | MatchNode
  | NumberNode
  | OperatorNode
  | ReturnNode
  | StringNode
  | StructLiteralNode
  | UnaryNode
  | WhileNode
  | WithNode
export type AstNode = AstFakeNode | LetStatement | AstExpressionNode
export type NodeType = AstNode['type']

// MARK: Main

export interface ParseError {
  message: string
  range: Range
}

export interface ParseResult {
  ast: BlockNode
  errors: ParseError[]
}

// Maps node types to their interface
// MARK: nodemap
export type NodeMap = {
  // fake nodes
  Block: BlockNode
  Comment: CommentNode
  CommentPlaceholder: CommentPlaceholderNode
  Group: GroupNode
  Newline: NewlineNode
  StructLiteralEntry: StructLiteralEntryNode
  // let statement
  LetStatement: LetStatement
  // expressions
  Accessor: AccessorNode
  ArrayLiteral: ArrayLiteralNode
  Assignment: AssignmentNode
  Break: BreakNode
  Call: CallNode
  Continue: ContinueNode
  Do: DoNode
  Function: FunctionNode
  Identifier: IdentifierNode
  If: IfNode
  Match: MatchNode
  Number: NumberNode
  Operator: OperatorNode
  Return: ReturnNode
  String: StringNode
  StructLiteral: StructLiteralNode
  Unary: UnaryNode
  While: WhileNode
  With: WithNode
}
