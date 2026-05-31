import { format, Options } from 'prettier'
import * as CatspeakPlugin from '..'
import { CatspeakOptions, CommaMode } from '../options'

// a long identifier to ensure the line wraps
const long =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

function test(raw: string, formatted: string, options?: Options) {
  const opts = {
    doubleIndent: true,
    ...options,
    plugins: [CatspeakPlugin],
    parser: 'catspeak',
    useTabs: true,
  }

  const expected = formatted ? formatted + '\n' : formatted

  return async () => {
    const form1 = await format(raw.replaceAll('long', long), opts)
    const formNormal = form1.replaceAll(long, 'long')
    // console.log(
    //   JSON.stringify(
    //     {
    //       itr: 1,
    //       got: formNormal,
    //       exp: expected,
    //     },
    //     undefined,
    //     2,
    //   ),
    // )
    expect(formNormal).toBe(expected)

    // run formatter again to ensure tokenization doesn't get messed up
    const form2 = await format(form1, opts)
    const formNormal2 = form2.replaceAll(long, 'long')
    // console.log(
    //   JSON.stringify(
    //     {
    //       itr: 1,
    //       got: formNormal2,
    //       exp: expected,
    //     },
    //     undefined,
    //     2,
    //   ),
    // )
    expect(formNormal2).toBe(expected)
  }
}

// MARK: group
describe('group', () => {
  it('grouped in precedence', test('(a*c)+b', '(a * c) + b'))
  it('grouped out of precedence', test('a*(c+b)', 'a * (c + b)'))
  it('long inside', test('(\n\tlong)', '(\n\t\tlong\n)'))
  it(
    'long inside, comment inside',
    test('(\n--\nlong)', '(\n\t\t--\n\t\tlong\n)'),
  )
  it(
    'long inside, comment outside',
    test('--\n(\n\t\tlong)', '--\n(\n\t\tlong\n)'),
  )
})

// MARK: let
describe('let statement', () => {
  it('simple', test('let a\n=\nb', 'let a = b'))
  it('no value', test('let\na', 'let a'))
  it('long identifier, no value', test('let\nlong', 'let long'))
  it('long identifier', test('let long\n\t\t=a', 'let long = a'))
  it('long value', test('let a=\n\t\tlong', 'let a = long'))
  it('double long', test('let \n\t\tlong=long', 'let long = long'))
  it(
    'assign from line break, with indent',
    test('let a=do{long}', 'let a = do {\n\t\t\tlong\n\t\t}'),
  )
  it(
    'assign from line break, without indent',
    test('let a=fun{long}', 'let a = fun () {\n\tlong\n}'),
  )
})

// MARK: root
describe('root statement', () => {
  it('simple', test('let a let long', 'let a\nlet long'))
  describe('semicolons', () => {
    it('array literal', test('let a    \n;[a]', 'let a;\n[a]'))
    it(
      'array literal with newline',
      test('let a    \n\n\n\n\n;[a]', 'let a;\n\n[a]'),
    )
    it(
      'array literal with newline before comment',
      test('let a    \n\n\n\n\n;[a]', 'let a;\n\n[a]'),
    )
    it('return', test('return\n;b', 'return;\nb'))
    it('break', test('break\n;b', 'break;\nb'))
  })
  describe('all semicolons', () => {
    const o: Options = { printSemicolons: true }
    it('only semicolons', test(';\n\n\n\n\n;\n\n\n\n\n\n', '', o))
    it('newline semicolons', test('a\n\n\n\n\n;\n\n\n\n\n\n', 'a;', o))
  })
})

// MARK: accessor
describe('accessor', () => {
  describe('bracket', () => {
    it('simple', test('a         [\nb\n]', 'a[b]'))
    it('long key', test('a   [\nlong]', 'a[\n\t\tlong\n]'))
    it('long array', test('long   [\na]', 'long[\n\t\ta\n]'))
    it('long array and key', test('long   [\nlong]', 'long[\n\t\tlong\n]'))
  })
  describe('dot', () => {
    it('simple', test('a         .\nb\n', 'a.b'))
    it('long key', test('a.   \nlong', 'a\n\t\t.long'))
    it('long array', test('long   .\na', 'long\n\t\t.a'))
    it('long array and key', test('long   .\nlong', 'long\n\t\t.long'))
  })
})

// MARK: [array literal]
describe('array literal', () => {
  it('simple', test('[    a b]', '[a, b]'))
  it('long', test('[    long b]', '[\n\tlong,\n\tb,\n]'))
  it('empty', test('[\n]', '[]'))
  it('with newline', test('[\n\n\na\n\n\n\n\nb]', '[\n\ta,\n\n\tb,\n]'))
  describe('comma tests', () => {
    // options tests
    it(
      'short no commas',
      test('[   long a]', '[\n\tlong\n\ta\n]', { commaMode: CommaMode.NONE }),
    )
    it(
      'short no commas but required comma',
      test('[   long, [a]\n,]', '[\n\tlong,\n\t[a]\n]', {
        commaMode: CommaMode.NONE,
      }),
    )
    it(
      'short no commas but required comma on a single line',
      test('[   a, [a]\n,]', '[a, [a]]', {
        commaMode: CommaMode.NONE,
      }),
    )
    it(
      'normal on a single line',
      test('[   a,b\n,]', '[a, b]', {
        commaMode: CommaMode.NORMAL,
      }),
    )
    it(
      'normal on a wrapped line',
      test('[   a,long\n,]', '[\n\ta,\n\tlong\n]', {
        commaMode: CommaMode.NORMAL,
      }),
    )
  })
  describe('comments', () => {
    it('empty', test('[\n--hello\n]', '[\n\t--hello\n]'))
    it('above item', test('[--\na]', '[\n\t--\n\ta,\n]'))
    it(
      'newline between commented items',
      test('[--\na\n\n\n\n--\na]', '[\n\t--\n\ta,\n\n\t--\n\ta,\n]'),
    )
  })
})

// MARK: assignment
describe('assignment', () => {
  it('simple', test('x=a', 'x = a'))
  it('long identifier', test('long=\n\na', 'long = a'))
  it('long value', test('a\n\n=long', 'a = long'))
  it('long identifier, long value', test('long=\n\nlong', 'long = long'))
  // it(
  //   'comments',
  //   test('--\na--\n\n=--\nb--\n--', '--\na --\n--\n\t=\n\tb --\n--'),
  // )
  it('comments', test('--\na=b--\n--', '--\na = b --\n--'))
})

// MARK: break
describe('break', () => {
  it('normal', test('\t\t\tbreak\na', 'break a'))
  it('no expression', test('\t\t\tbreak\n', 'break'))
  it('long', test('\t\t\tbreak long', 'break\n\tlong'))
})

// MARK: call
describe('call', () => {
  it('simple', test('f(a,b)', 'f(a, b)'))
  it('long name', test('long   (a,b)', 'long(\n\t\ta,\n\t\tb,\n)'))
  it('long arguments', test('a   (a,long)', 'a(\n\t\ta,\n\t\tlong,\n)'))
  it('no arguments', test('a\n(\n)', 'a()'))
  it('long name, no arguments', test('long\n(\n)', 'long()'))
  it('long name, new, no arguments', test('new long\n(\n)', 'new long()'))
  it('chained call', test('a\n\t()\n()', 'a()()'))
})

// MARK: catch
describe('catch', () => {
  it('simple', test('a catch b {}', 'a catch b { }'))
  it('do-catch', test('do {long}catch e{}', 'do {\n\tlong\n} catch e {\n}'))
  it('no identifier', test('a catch \n\n {}', 'a catch { }'))
  it('long expression', test('long catch \n\n {}', 'long catch {\n}'))
  it(
    'short expression long catch',
    test('a catch {long}', 'a catch {\n\tlong\n}'),
  )
  it(
    'long expression long catch',
    test('long catch {long}', 'long catch {\n\tlong\n}'),
  )
  it('all long', test('long catch long {long}', 'long catch long {\n\tlong\n}'))
})

// MARK: do
describe('do', () => {
  it('simple', test('do{a}', 'do { a }'))
  it('long block', test('do{long}', 'do {\n\tlong\n}'))
  it('empty block', test('do{}', 'do { }'))
  it('comments', test('--\ndo--\n{a--\n}', '--\ndo --\n{\n\ta --\n}'))
  it('comment after', test('do{a\n\n--\n}b', 'do {\n\ta\n\n\t--\n}\nb'))
  it('comment after 2', test('do{a\n--\n}b', 'do {\n\ta\n\t--\n}\nb'))
})

// MARK: fun
describe('fun', () => {
  it('simple', test('fun(a,b) {c}', 'fun (a, b) { c }'))
  it('long block', test('fun(a,b) {long}', 'fun (a, b) {\n\tlong\n}'))
  it('long args', test('fun(long) {a}', 'fun (\n\t\tlong,\n) {\n\ta\n}'))
  it(
    'long args and long block',
    test('fun(long) {long}', 'fun (\n\t\tlong,\n) {\n\tlong\n}'),
  )
  it('empty function block', test('fun{}', 'fun () { }'))
  // options
  it(
    'empty function arguments',
    test('fun {}', 'fun { }', { emptyFunctionArguments: true }),
  )
})

// MARK: if
describe('if', () => {
  describe('no else', () => {
    it('simple', test('if a{}', 'if a { }'))
    it('long condition', test('if long{}', 'if\n\t\tlong\n{\n}'))
    it('long body', test('if a{long}', 'if a {\n\tlong\n}'))
    it(
      'long body and condition',
      test('if long{long}', 'if\n\t\tlong\n{\n\tlong\n}'),
    )
  })
  describe('normal else', () => {
    // 0 0 0
    it('simple', test('if a{}else{}', 'if a { } else { }'))
    // 0 0 1
    it('long else', test('if a{}else{long}', 'if a {\n} else {\n\tlong\n}'))
    // 0 1 0
    it('long if', test('if a{long}else{}', 'if a {\n\tlong\n} else {\n}'))
    // 0 1 1
    it(
      'long if, long else',
      test('if a{long}else{long}', 'if a {\n\tlong\n} else {\n\tlong\n}'),
    )
    // 1 0 0
    it(
      'long condition',
      test('if long{}else{}', 'if\n\t\tlong\n{\n} else {\n}'),
    )
    // 1 0 1
    it(
      'long condition, long else',
      test('if long{}else{long}', 'if\n\t\tlong\n{\n} else {\n\tlong\n}'),
    )
    // 1 1 0
    it(
      'long condition, long else',
      test('if long{long}else{}', 'if\n\t\tlong\n{\n\tlong\n} else {\n}'),
    )
    // 1 1 1
    it(
      'all long',
      test(
        'if long{long}else{long}',
        'if\n\t\tlong\n{\n\tlong\n} else {\n\tlong\n}',
      ),
    )
  })
  describe('else if', () => {
    it(
      'simple',
      test(
        'if a{b}else if c{d}else{e}',
        'if a { b } else if c { d } else { e }',
      ),
    )
    it(
      'simple',
      test(
        'if a{long}else if c{d}else{e}',
        'if a {\n\tlong\n} else if c { d } else { e }',
      ),
    )
    it(
      'wrapped elseif condition',
      test(
        'if a{\t\nb}else if long{d}else{e}',
        'if a {\n\tb\n} else if\n\t\tlong\n{\n\td\n} else {\n\te\n}',
      ),
    )
    it(
      'elseif stays on one line',
      test(
        'if a{\t\nlong}else if long{d}else{e}',
        'if a {\n\tlong\n} else if\n\t\tlong\n{\n\td\n} else {\n\te\n}',
      ),
    )
  })
  describe('comments', () => {
    it(
      'comment after else',
      test('if a{}else{--\n}', 'if a {\n} else {\n\t--\n}'),
    )
    it(
      'comment between elseif blocks',
      test(
        'if a{a\n--\n}else\n\n\nif b{}',
        'if a {\n\ta\n\t--\n} else if b { }',
      ),
    )
    it(
      'comment between else blocks',
      test('if a{a\n\n\n--\n}else\n\n\n{}', 'if a {\n\ta\n\n\t--\n} else {\n}'),
    )
  })
})

// MARK: match
describe('match', () => {
  it(
    'simple',
    test(
      'match a{case 1{long}case 2{long}else{long}}',
      // '',
      'match a {\n\tcase 1 {\n\t\tlong\n\t}\n\tcase 2 {\n\t\tlong\n\t}\n\telse {\n\t\tlong\n\t}\n}',
    ),
  )
  it(
    'one line',
    test('match a{case a{1}else{2}}', 'match a { case a { 1 } else { 2 } }'),
  )
  it(
    'wrapped cases',
    test(
      'match a{case a{}case a{1}case a{1}case a{1}case a{1}case a{1}else{}}',
      'match a {\n\tcase a { }\n\tcase a { 1 }\n\tcase a { 1 }\n\tcase a { 1 }\n\tcase a { 1 }\n\tcase a { 1 }\n\telse { }\n}',
    ),
  )
  it(
    'long condition',
    test('match long {case a{}}', 'match\n\t\tlong\n{\n\tcase a { }\n}'),
  )
  it('empty', test('match a{}', 'match a { }'))
  describe('comments', () => {
    it('no cases', test('match a{\n\n--\n}', 'match a {\n\t--\n}'))
    it(
      'before case',
      test('match a{\n\n--\ncase a{ }}', 'match a {\n\t--\n\tcase a { }\n}'),
    )
    it(
      'between case',
      test(
        'match a{case a{ }\n\n--\ncase a{ }}',
        'match a {\n\tcase a { }\n\n\t--\n\tcase a { }\n}',
      ),
    )
  })
})

// MARK: operator
describe('operator', () => {
  it('simple', test('a+b*c', 'a + b * c'))
  it('chained operator', test('a\n\n\tand\n\n\tb and c', 'a and b and c'))

  describe('wrap operator', () => {
    const o: Partial<CatspeakOptions> = { wrapBinaryOperators: true }
    it('a + long', test('a+long', 'a\n\t\t+ long', o))
    it('long + b', test('long+b', 'long\n\t\t+ b', o))
    it('long + long', test('long+long', 'long\n\t\t+ long', o))
    it(
      'many wrapped operators',
      test(
        'long+long-long*long/long-long',
        'long\n\t\t+ long\n\t\t- long\n\t\t\t\t* long\n\t\t\t\t/ long\n\t\t- long',
        o,
      ),
    )
  })

  describe("don't wrap operator", () => {
    it('a + long', test('a+long', 'a +\n\t\tlong'))
    it('long + b', test('long+b', 'long +\n\t\tb'))
    it('long + long', test('long+long', 'long +\n\t\tlong'))
    it(
      'many wrapped operators',
      test(
        'long+long-long*long/long-long',
        'long +\n\t\tlong -\n\t\tlong *\n\t\t\t\tlong /\n\t\t\t\tlong -\n\t\tlong',
      ),
    )
  })
})

// MARK: return
describe('return', () => {
  it('normal', test('\t\treturn\na', 'return a'))
  it('no expression', test('\t\treturn\n', 'return'))
  it('long', test('\t\treturn long', 'return\n\tlong'))
})

// MARK: struct literal
describe('struct literal', () => {
  it('empty', test('{\n\t}', '{}'))
  it('no value', test('{\n\ta\n}', '{ a }'))
  it('key-value', test('{a:b}', '{ a: b }'))
  it('long key', test('{long:a}', '{\n\tlong: a,\n}'))
  it('long value', test('{a:long}', '{\n\ta: long,\n}'))
  it('long key value', test('{long:long}', '{\n\tlong: long,\n}'))
  it('expression key', test('{["a"]:b}', '{ ["a"]: b }'))
  it('identifier expression key', test('{[a]:b}', '{ [a]: b }'))
  it(
    "long value doesn't wrap",
    test('{[a]:long}', '{\n\t[\n\t\t\ta\n\t]: long,\n}'),
  )
  it(
    "long value doesn't wrap, array",
    test('{[a]:[long]}', '{\n\t[a]: [\n\t\tlong,\n\t],\n}'),
  )
  it(
    'long expression key',
    test('{[long()]:b}', '{\n\t[\n\t\t\tlong()\n\t]: b,\n}'),
  )
  // comma between keys
  it(
    'no comma with expression key',
    test('{a,[if true{}]:b}', '{ a, [if true { }]: b }', {
      commaMode: CommaMode.NONE,
    }),
  )
  describe('comments', () => {
    it('inside empty', test('{--\n}', '{\n\t--\n}'))
    it(
      'before expression key',
      test('{--\n["a"]:b}', '{\n\t--\n\t["a"]: b,\n}'),
    )
    it(
      'newline between commented entries',
      test('{--\na\n\n\n\n--\na}', '{\n\t--\n\ta,\n\n\t--\n\ta,\n}'),
    )
  })
})

describe('throw', () => {
  it('normal', test('throw a', 'throw a'))
  it('long throw', test('throw long', 'throw\n\tlong'))
})

// MARK: unary
describe('unary', () => {
  it('normal', test('!\n\nlong', '!long'))
  it('with assignment', test('let long=!long', 'let long = !long'))
})

// MARK: while
describe('while', () => {
  it('empty', test('while a{}', 'while a { }'))
  it('simple block', test('while a{b}', 'while a { b }'))
  it('long block', test('while a{long}', 'while a {\n\tlong\n}'))
  it('long condition', test('while long{}', 'while\n\t\tlong\n{\n}'))
  it(
    'long condition, long body',
    test('while long{long}', 'while\n\t\tlong\n{\n\tlong\n}'),
  )
})

// MARK: with
describe('with', () => {
  it('empty', test('with a{}', 'with a { }'))
  it('simple block', test('with a{b}', 'with a { b }'))
  it('long block', test('with a{long}', 'with a {\n\tlong\n}'))
  it('long condition', test('with long{}', 'with\n\t\tlong\n{\n}'))
  it(
    'long condition, long body',
    test('with long{long}', 'with\n\t\tlong\n{\n\tlong\n}'),
  )
})

// MARK: empty
describe('empty strings', () => {
  it('empty string', test('', ''))
  it('only whitespace', test('\n\n\n\n\t\t\t\n\n\n\n\n', ''))
})

// MARK: comments
describe('comments', () => {
  it('single', test('--hello', '--hello'))
  it('leading whitespace', test('\n\n\n\n\n\n--hello', '--hello'))
  it('trailing whitespace', test('--hello\n\n\n\n\n\na', '--hello\n\na'))
  it('newline before statement', test('-- a\n\nlet a', '-- a\n\nlet a'))
  it('attach to statement', test('-- a\nlet a', '-- a\nlet a'))
  it(
    'with newlines',
    test(
      '-- a\n\n\n\n\n\n-- b\n\n\n\n\n\n\t\n-- c\na',
      '-- a\n\n-- b\n\n-- c\na',
    ),
  )
  it('root a', test('-- a\n\n\n--b', '-- a\n\n--b'))
  it('root b', test('\n-- a\n\n\n--b', '-- a\n\n--b'))
  it('root c', test('\n\n-- a\n\n\n--b', '-- a\n\n--b'))
  it('root d', test('\n\n\n\n\n\n-- a\n\n\n--b', '-- a\n\n--b'))
  it('root e', test('-- a\n\n\n--b', '-- a\n\n--b'))
  it('root f', test('-- a\n\n\n--b\n\n\n', '-- a\n\n--b\n'))

  it('block a', test('do{--a\n}', 'do {\n\t--a\n}'))
  it('block b', test('do{\n--a\n}', 'do {\n\t--a\n}'))
  it('block c', test('do{\n\n--a\n}', 'do {\n\t--a\n}'))
  it('block d', test('do{\n\n\n\n\n--a\n}', 'do {\n\t--a\n}'))
  it('block e', test('do{--a\n\n}', 'do {\n\t--a\n}'))
  it('block f', test('do{\n\n\n\n\n--a\n}', 'do {\n\t--a\n}'))

  it('block 2 a', test('do{--a\n--b\n}', 'do {\n\t--a\n\t--b\n}'))
  it('block 2 b', test('do{--a\n\n\n\n\n--b\n}', 'do {\n\t--a\n\n\t--b\n}'))

  it(
    'comment inside single item block',
    test('do{--a\na}', 'do {\n\t--a\n\ta\n}'),
  )
})

// MARK: newlines
describe('newlines', () => {
  it('no newline', test('a\n\tb', 'a\nb'))
  it('insert newline exact', test('a\n\nb', 'a\n\nb'))
  it('insert newline overkill', test('a\n\n\n\n\t\n\nb', 'a\n\nb'))

  it('block', test('do{c\n--a\n\n\n\n--b\n}', 'do {\n\tc\n\t--a\n\n\t--b\n}'))
  it('root', test('c\n--a\n\n\n\n--b\n', 'c\n--a\n\n--b'))
  it('before block, omit lines', test('do{\n\n\n\n\n\na}', 'do { a }'))
  it('after block, omit lines', test('do{a\n\n\n\n\n\n}', 'do { a }'))
})

// MARK: snippets
describe('code snippets', () => {
  it(
    'let declare a function',
    test(
      'let my_func = fun (a,b) {long}',
      'let my_func = fun (a, b) {\n\tlong\n}',
    ),
  )
  it(
    'assign a function',
    test('my_func = fun (a,b) {long}', 'my_func = fun (a, b) {\n\tlong\n}'),
  )
  it(
    'assign a function in a struct',
    test(
      'let x={key:fun (a,b) {long}}',
      'let x = {\n\tkey: fun (a, b) {\n\t\tlong\n\t},\n}',
    ),
  )
  it(
    'if and',
    test(
      `if !a()
      and b
      and c
    {
     long
    }`,
      `if !a() and b and c {\n\tlong\n}`,
    ),
  )
})
