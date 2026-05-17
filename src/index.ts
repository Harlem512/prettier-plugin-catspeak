import { type Parser, type Printer, type SupportLanguage } from 'prettier'
import { defaultOptions, options } from './options.js'
import type { AstNode, RootNode } from './parser/ast.js'
import { parse } from './parser/parser.js'
import { printer } from './printer.js'

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
    parse(text): RootNode {
      const result = parse(text)
      if (result.errors.length > 0) {
        const parseError = result.errors[0]
        const error = new Error(parseError.message)
        error.cause = parseError
        throw error
      }

      return result.ast
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
