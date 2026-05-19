import path from 'node:path'
import prettier, { Config, resolveConfig } from 'prettier'
import * as CatspeakPlugin from '@harlem512/prettier-plugin-catspeak'
import {
  ExtensionContext,
  languages,
  Position,
  Range,
  TextDocument,
  TextEdit,
  window,
  workspace,
} from 'vscode'
import type { ParseError } from '../../out/parser/ast.js'

const console = createOutputChannel('Prettier (Catspeak)')
export async function activate(context: ExtensionContext) {
  context.subscriptions.push(
    languages.registerDocumentFormattingEditProvider('catspeak', {
      async provideDocumentFormattingEdits(document, options) {
        const workspaceConfig = workspace.getConfiguration()

        // base config to format with catspeak
        const baseConfig: Config = {
          // prettier.catspeak contains all of the parsing options
          ...workspaceConfig.get('prettier.catspeak'),
          // defaults
          useTabs: !options.insertSpaces,
          tabWidth: options.tabSize,
          plugins: [CatspeakPlugin],
          parser: 'catspeak',
        }

        // load config from a .prettier file
        const fileConfig = await resolveConfig(document.fileName, {
          editorconfig: true,
          useCache: false,
        })

        // merge configs
        const config = { ...baseConfig, ...fileConfig }

        // format + return (or throw errors)
        return format(document, config)
      },
    }),
  )
}

async function format(document: TextDocument, config: Config) {
  function compare(index: number) {
    // formatted will always be truthy when this is called
    return old.charCodeAt(index) === formatted!.charCodeAt(index)
  }

  const formatted = await tryFormat(document, config)

  // error thrown, no changes
  if (formatted === null) return []

  const old = document.getText()
  const end = Math.min(old.length, formatted.length)

  // get index of the left-most modified character
  let i = 0
  for (; i < end && compare(i); i++);

  // get dndex of the righ-most modified character
  let j = 0
  for (; i + j < end && compare(old.length - j - 1); j++);

  return [
    TextEdit.replace(
      new Range(document.positionAt(i), document.positionAt(old.length - j)),
      formatted.substring(i, formatted.length - j),
    ),
  ]
}

async function tryFormat(
  doc: TextDocument,
  config: prettier.Config,
): Promise<string | null> {
  try {
    return await prettier.format(doc.getText(), config)
  } catch (e: any) {
    if (!(e instanceof Error)) {
      console.log('not an error', e)
      window.showErrorMessage('Unexpected error')
      return null
    }

    if (!e.cause) {
      console.log('no cause', e)
      window.showErrorMessage('Unexpected error')
      return null
    }

    const parseError: ParseError = e.cause as any
    try {
      const start = new Position(
        parseError.range.start.line,
        parseError.range.start.character,
      )
      const end = new Position(
        parseError.range.end.line,
        parseError.range.end.character,
      )

      // highlight the error location
      window.showTextDocument(doc, { selection: new Range(start, end) })
      // show formatting error message
      window.showErrorMessage(parseError.message)
      return null
    } catch (e2) {
      console.log('error parsing error', e2)
      window.showErrorMessage('Unexpected error')
      return null
    }
  }
}

function createOutputChannel(name: string) {
  const out = window.createOutputChannel(name)
  return {
    log(...arr: any[]) {
      for (var item of arr) {
        if (typeof item === 'string') {
          out.appendLine(unstyle(item))
        } else if (item instanceof Error) {
          if (item?.message) out.appendLine(unstyle(item.message))
          if (item?.stack) out.appendLine(unstyle(item.stack))
        } else {
          out.appendLine(JSON.stringify(item, null, 2))
        }
      }
    },
  }
}
function unstyle(str: string) {
  return str.replace(/\x1B\[[0-9][0-9]?m/g, '')
}

function cmd(filepath: string | undefined, frompath = '') {
  return normPath(path.relative(frompath, normPath(filepath ?? ''))) || '.'
}
function normPath(filepath: string) {
  return filepath.replace(/^file:\/\/\//, '').replace(/\\\\?/g, '/')
}
