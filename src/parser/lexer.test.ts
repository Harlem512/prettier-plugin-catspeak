import { tokenize } from './lexer.js'

function tokTypes(source: string, keepWhitespace: boolean = false): string[] {
  return tokenize(source)
    .filter((t) => (keepWhitespace || t.type !== 'Newline') && t.type !== 'EOF')
    .map((t) => (t.type === 'Newline' ? 'Newline' : `${t.type}:${t.value}`))
}

describe('Lexer', () => {
  it('tokenizes whitespace', () => {
    expect(
      tokTypes(
        `      
      
      
      `,
        true,
      ),
    ).toEqual(['Newline', 'Newline', 'Newline'])
  })

  it('tokenizes whitespace with comments', () => {
    expect(
      tokTypes(
        `  -- hello

      `,
        true,
      ),
    ).toEqual(['Comment:-- hello', 'Newline'])
  })

  it('tokenizes keywords', () => {
    const result = tokTypes('let fun if else while for return case match')
    expect(result).toEqual([
      'Keyword:let',
      'Keyword:fun',
      'Keyword:if',
      'Keyword:else',
      'Keyword:while',
      'Keyword:for',
      'Keyword:return',
      'Keyword:case',
      'Keyword:match',
    ])
  })

  it('tokenizes identifiers', () => {
    expect(tokTypes('foo bar _baz x1')).toEqual([
      'Identifier:foo',
      'Identifier:bar',
      'Identifier:_baz',
      'Identifier:x1',
    ])
  })

  it('tokenizes string literals with escapes', () => {
    const result = tokTypes('"hello" "world\\n"')
    expect(result).toEqual(['String:"hello"', 'String:"world\\n"'])
  })
  it('tokenizes string literals with quote escapes', () => {
    const result = tokTypes('"h\\"ello" "world\\n"')
    expect(result).toEqual(['String:"h\\"ello"', 'String:"world\\n"'])
  })
  it('tokenizes string literals with new lines', () => {
    const result = tokTypes('"hello\nworld"')
    expect(result).toEqual(['String:"hello\nworld"'])
  })
  it('tokenizes empty string literals', () => {
    const result = tokTypes('""')
    expect(result).toEqual(['String:""'])
  })

  it('tokenizes raw strings', () => {
    expect(tokTypes('@"raw string"')).toEqual(['String:@"raw string"'])
  })
  it('tokenizes raw strings with new lines', () => {
    expect(tokTypes('@"raw\nstring"')).toEqual(['String:@"raw\nstring"'])
  })
  it('tokenizes raw strings with escaped quote', () => {
    expect(tokTypes('@"raw \\"string')).toEqual([
      'String:@"raw \\"',
      'Identifier:string',
    ])
  })
  it('tokenizes empty raw string literals', () => {
    const result = tokTypes('@""')
    expect(result).toEqual(['String:@""'])
  })

  it('tokenizes decimal numbers', () => {
    expect(tokTypes('42 3.14 1_000')).toEqual([
      'Number:42',
      'Number:3.14',
      'Number:1_000',
    ])
  })

  it('tokenizes hex and binary numbers', () => {
    expect(tokTypes('0xFF 0b10_10')).toEqual(['Number:0xFF', 'Number:0b10_10'])
  })

  it('tokenizes invalid hex and binary', () => {
    expect(tokTypes('0b   123  0x')).toEqual([
      'Number:0b',
      'Number:123',
      'Number:0x',
    ])
  })

  it('tokenizes NaN infinity', () => {
    expect(tokTypes('NaN infinity')).toEqual([
      'Keyword:NaN',
      'Keyword:infinity',
    ])
  })

  it('tokenizes colour codes', () => {
    expect(tokTypes('#FFF #FF00FF #FF00FF80')).toEqual([
      'Number:#FFF',
      'Number:#FF00FF',
      'Number:#FF00FF80',
    ])
  })

  it('tokenizes character literals', () => {
    expect(tokTypes("'a' '1'")).toEqual(["Number:'a'", "Number:'1'"])
  })

  it('tokenizes invalid character literal', () => {
    expect(tokTypes("'invalid'")).toEqual([
      "Number:'i",
      'Identifier:nvalid',
      "Number:'",
    ])
  })

  it('tokenizes invalid escape character literal', () => {
    expect(tokTypes("'\\n'   ")).toEqual([
      "Number:'\\",
      'Identifier:n',
      "Number:' ",
    ])
  })

  it('tokenizes invalid short character literal', () => {
    expect(tokTypes("''  --c")).toEqual(["Number:''", 'Comment:--c'])
  })

  it('tokenizes comments', () => {
    expect(tokTypes('-- this is a comment\nx')).toEqual([
      'Comment:-- this is a comment',
      'Identifier:x',
    ])
  })

  it('tokenizes operators', () => {
    expect(tokTypes('+ - * / // %')).toEqual([
      'Operator:+',
      'Operator:-',
      'Operator:*',
      'Operator:/',
      'Operator://',
      'Operator:%',
    ])
  })

  it('tokenizes two-char operators', () => {
    expect(tokTypes('<= >= == != <| |>')).toEqual([
      'Operator:<=',
      'Operator:>=',
      'Operator:==',
      'Operator:!=',
      'Operator:<|',
      'Operator:|>',
    ])
  })

  it('tokenizes assignment operators', () => {
    expect(tokTypes('+= -= *= /=')).toEqual([
      'Operator:+=',
      'Operator:-=',
      'Operator:*=',
      'Operator:/=',
    ])
  })

  it('tokenizes punctuation', () => {
    expect(tokTypes('( ) [ ] { } , ; .')).toEqual([
      'Punctuation:(',
      'Punctuation:)',
      'Punctuation:[',
      'Punctuation:]',
      'Punctuation:{',
      'Punctuation:}',
      'Punctuation:,',
      'Punctuation:;',
      'Punctuation:.',
    ])
  })

  it('tokenizes backtick identifiers', () => {
    expect(tokTypes('`1raw ident`')).toEqual(['Identifier:`1raw ident`'])
  })
  it('tokenizes backtick identifiers with newlines', () => {
    expect(tokTypes('`1raw\nident`')).toEqual([
      'Identifier:`1raw',
      'Identifier:ident',
      'Identifier:`',
    ])
  })

  it('tracks line and column positions', () => {
    const tokens = tokenize('let x\ny')
    const letTok = tokens[0]
    expect(letTok.range.start).toEqual({ line: 0, character: 0, offset: 0 })
    expect(letTok.range.end).toEqual({ line: 0, character: 3, offset: 3 })
    const yTok = tokens.find((t) => t.value === 'y')!
    expect(yTok.range.start).toEqual({ line: 1, character: 0, offset: 6 })
  })

  it('always ends with EOF', () => {
    const tokens = tokenize('')
    expect(tokens.length).toBe(1)
    expect(tokens[0].type).toBe('EOF')
  })
})
