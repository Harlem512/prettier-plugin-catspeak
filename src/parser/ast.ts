/**
 * Catspeak AST Node Definitions
 */

import type { Range } from './lexer.js'

interface BaseNode {
  range: Range
  /** IMPORTANT: used by prettier to automatically print comments */
  comments?: CommentNode[]
}

// MARK: fake

export interface RootNode extends BaseNode {
  type: 'Root'
  block: AstNode[]
  isRoot: boolean
}

export interface BlockNode extends BaseNode {
  type: 'Block'
  children: AstNode[]
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
  /** if the key is a identifier or an expression */
  isIdentifier: boolean
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

export interface CatchNode extends BaseNode {
  type: 'Catch'
  expression: AstExpressionNode
  identifier: IdentifierNode | null
  block: BlockNode
}

export interface ContinueNode extends BaseNode {
  type: 'Continue'
}

export interface DoNode extends BaseNode {
  type: 'Do'
  block: BlockNode
}

export interface FunctionNode extends BaseNode {
  type: 'Function'
  arguments: IdentifierNode[]
  block: BlockNode
}

export interface IdentifierNode extends BaseNode {
  type: 'Identifier'
  name: string
}

export interface IfNode extends BaseNode {
  type: 'If'
  condition: AstExpressionNode
  ifBlock: BlockNode
  elseBlock: BlockNode | null
  elseIfExpression: AstExpressionNode | null
}

export interface MatchNode extends BaseNode {
  type: 'Match'
  condition: AstExpressionNode
  cases: MatchCaseNode[]
}

export interface MatchCaseNode extends BaseNode {
  type: 'MatchCase'
  case: AstExpressionNode | null
  block: BlockNode
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
  /** if the key is a identifier or an expression */
  isIdentifier: boolean
  value: AstExpressionNode | null
}

export interface ThrowNode extends BaseNode {
  type: 'Throw'
  value: AstExpressionNode
}

export interface UnaryNode extends BaseNode {
  type: 'Unary'
  operation: string
  value: AstExpressionNode
}

export interface WithNode extends BaseNode {
  type: 'With'
  condition: AstExpressionNode
  block: BlockNode
}

export interface WhileNode extends BaseNode {
  type: 'While'
  condition: AstExpressionNode
  block: BlockNode
}

// non-statement, non-expression nodes (used internally)
export type AstFakeNode =
  | RootNode
  | BlockNode
  | CommentNode
  | CommentPlaceholderNode
  | MatchCaseNode
  | StructLiteralEntryNode

export type AstExpressionNode =
  | NewlineNode
  //
  | AccessorNode
  | ArrayLiteralNode
  | AssignmentNode
  | BreakNode
  | CallNode
  | CatchNode
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
  | ThrowNode
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
  ast: RootNode
  errors: ParseError[]
}

// Maps node types to their interface
// MARK: nodemap
export type NodeMap = {
  // fake nodes
  Root: RootNode
  Block: BlockNode
  Comment: CommentNode
  CommentPlaceholder: CommentPlaceholderNode
  Group: GroupNode
  MatchCase: MatchCaseNode
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
  Catch: CatchNode
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
  Throw: ThrowNode
  Unary: UnaryNode
  While: WhileNode
  With: WithNode
}
