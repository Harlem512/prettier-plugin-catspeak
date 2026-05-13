import { type Parser, type Printer, type SupportLanguage } from 'prettier'
import { defaultOptions, options } from './options'
import type { AstNode, BlockNode, CommentNode } from './parser/ast'
import { parse } from './parser/parser'
import { printer } from './printer'

// MARK: Languages
// https://prettier.io/docs/en/plugins.html#languages
export const languages: SupportLanguage[] = [
  {
    name: 'catspeak',
    parsers: ['catspeak'],
    extensions: ['.meow'],
    vscodeLanguageIds: ['catspeak'],
  },
]

// MARK: parser
// https://prettier.io/docs/en/plugins.html#parsers
export const parsers: Record<string, Parser<AstNode>> = {
  catspeak: {
    parse(text): BlockNode {
      const result = parse(text)
      if (result.errors.length > 0) {
        console.log(result.errors)
        throw new Error(JSON.stringify(result.errors[0], undefined, 2))
      }

      const commentNodes = result.tokens
        .filter((t) => t.type === 'Comment')
        .map<CommentNode>((n) => ({
          type: 'Comment',
          value: n.value,
          range: n.range,
          leading: true,
          leadingTrivia: null,
          trailingTrivia: null,
        }))

      return {
        type: 'Block',
        block: result.ast,
        leadingTrivia: null,
        trailingTrivia: null,
        comments: commentNodes,
        isRoot: true,
        range: {
          start: result.ast[0]?.range.start ?? {
            offset: text.length,
            character: 0,
            line: 0,
          },
          end: result.ast.at(-1)?.range.end ?? {
            offset: text.length,
            character: 0,
            line: 0,
          },
        },
      }
    },
    astFormat: 'catspeak',
    locStart(node) {
      return node.range.start.offset
    },
    locEnd(node) {
      return node.range.end.offset
    },
  },
}

// MARK: printer
// https://prettier.io/docs/en/plugins.html#printers
export const printers: Record<string, Printer<AstNode>> = {
  catspeak: printer,
}

// MARK: options / defaultOptions
export { defaultOptions, options }
