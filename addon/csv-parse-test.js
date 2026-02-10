/* eslint quotes: ["error", "single", {"avoidEscape": true}] */
export async function csvParseTest(test) {
  console.log('TEST csvParse');
  let {assertEquals, assertThrows} = test;
  let {csvParse} = await import('./csv-parse.js');
  // Quotes
  assertEquals([['a', 'b'], ['c', 'd']], csvParse('a,b\nc,d', ',')); // without quotes
  assertEquals([['a', 'b'], ['c', 'd']], csvParse('"a","b"\n"c","d"', ',')); // with quotes
  assertEquals([['a', 'b'], ['c', 'd']], csvParse('"a",b\nc,"d"', ',')); // mixed with and without quotes
  assertThrows({name: 'CSVParseError', message: 'Quote not closed', offsetStart: 4, offsetEnd: 5}, () => csvParse('"a","b\nc,d', ',')); // unclosed quote
  assertEquals([['aa', 'b"b'], ['c""c', 'dd"']], csvParse('aa,b"b\nc""c,dd"', ',')); // unquoted values may contain quotes, as long as they are not at the beginning of the value. These should not be unescaped.
  assertEquals([['a"a', 'bb'], ['c""c', 'dd']], csvParse('"a""a","bb"\n"c""""c","dd"', ',')); // quoted values may contain escaped quotes. These should be unescaped (by replacing each pair of quotes with a single quote).
  assertEquals([['a"a', 'bb'], ['"c"c"', 'dd']], csvParse('"a""a","bb"\n"c"c","dd"', ',')); // quoted values with unescaped quotes are now treated leniently as unquoted fields to handle user data with quotes
  assertEquals([['foo', 'bar'], ['foo', '"bar"text after quote']], csvParse('"foo","bar"\r\n"foo","bar"text after quote', ',')); // text after closing quote is handled gracefully (fixes issue with quotes in imported data)
  // Line breaks
  assertEquals([['a', 'b'], ['c', 'd']], csvParse('a,b\nc,d', ',')); // LF
  assertEquals([['a', 'b'], ['c', 'd']], csvParse('a,b\r\nc,d', ',')); // CRLF
  assertEquals([['a', 'b'], ['c', 'd']], csvParse('a,b\rc,d', ',')); // CR
  assertEquals([['a', 'b'], ['c', 'd']], csvParse('"a","b"\n"c","d"', ',')); // LF with quotes
  assertEquals([['a', 'b'], ['c', 'd']], csvParse('"a","b"\r\n"c","d"', ',')); // CRLF with quotes
  assertEquals([['a', 'b'], ['c', 'd']], csvParse('"a","b"\r"c","d"', ',')); // CR with quotes
  assertEquals([['a', 'b'], ['c', 'd']], csvParse('a,b\nc,d\n', ',')); // LF with line break at end of file
  assertEquals([['a', 'b'], ['c', 'd']], csvParse('a,b\r\nc,d\r\n', ',')); // CRLF with line break at end of file
  assertEquals([['a', 'b'], ['c', 'd']], csvParse('a,b\rc,d\r', ',')); // CR with line break at end of file
  assertEquals([['a\na', 'b\rb'], ['c\r\nc', 'dd']], csvParse('"a\na","b\rb"\n"c\r\nc","dd"', ',')); // line break in quoted value
  // separators
  assertEquals([['a', 'b'], ['c', 'd']], csvParse('a,b\nc,d', ',')); // comma separated
  assertEquals([['a', 'b'], ['c', 'd']], csvParse('a\tb\nc\td', '\t')); // tab separated
  assertEquals([['a,b'], ['c,d']], csvParse('a,b\nc,d', '\t')); // commas in tab separated
  assertEquals([['a\tb'], ['c\td']], csvParse('a\tb\nc\td', ',')); // tabs in comma separated
  assertEquals([['a,a', 'b\tb'], ['cc', 'dd']], csvParse('"a,a","b\tb"\n"cc","dd"', ',')); // quoted separators in comma separated
  assertEquals([['a,a', 'b\tb'], ['cc', 'dd']], csvParse('"a,a"\t"b\tb"\n"cc"\t"dd"', '\t')); //quoted separators in tab separated
  // table dimensions
  assertEquals([['a', 'b'], ['c', 'd']], csvParse('a,b\nc,d', ',')); // 2x2
  assertEquals([['a']], csvParse('a', ',')); // 1x1
  assertEquals([['']], csvParse('\n', ',')); // 1x1 empty
  assertEquals([['a', ' '], ['', '']], csvParse('a, \n,', ',')); // empty and spaces
  assertThrows({name: 'CSVParseError', message: 'no data', offsetStart: 0, offsetEnd: 0}, () => csvParse('', ',')); // no data
  assertThrows({name: 'CSVParseError', message: 'row 3 has 2 cells, expected 3', offsetStart: 12, offsetEnd: 15}, () => csvParse('a,b,c\nd,e,f\ng,h\ni,j,k', ',')); // 3+3+2+3 not all rows have same length
}
