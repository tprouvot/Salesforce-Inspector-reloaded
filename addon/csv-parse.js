export function csvParse(csv, separator) {
  let table = []; // completely parsed rows, not including the row currently being parsed
  let row = []; // cells parsed so far from the current row
  let offset = 0; // the next character to read from the input
  for (;;) { // for each value. Each iteration parses a cell value including following cell ceparator or line ceparator
    // parse cell value
    if (offset != csv.length && csv[offset] == "\"") { // quoted value
      let quoteStart = offset;
      let next = csv.indexOf("\"", offset + 1);
      let text = "";
      for (;;) {
        if (next == -1) {
          throw Object.assign(new Error(), {
            name: "CSVParseError",
            message: "Quote not closed",
            offsetStart: offset,
            offsetEnd: offset + 1
          });
        }
        text += csv.substring(offset + 1, next);
        offset = next + 1;
        if (offset == csv.length || csv[offset] != "\"") {
          break;
        }
        text += "\"";
        next = csv.indexOf("\"", offset + 1);
      }
      // After closing quote, check if next character is separator, line break, or EOF
      // If not, this might be malformed CSV (like "Hello"world).
      // We'll be lenient: treat the quote as part of an unquoted field and reparse from the start
      if (offset < csv.length && csv[offset] != separator && csv[offset] != "\n" && csv[offset] != "\r") {
        // There's content after the closing quote that's not a separator or line break
        // This is malformed CSV, but we'll be lenient and treat it as an unquoted field
        // Reset to the original quote position and parse as unquoted
        offset = quoteStart;
        // find the first EOF, separator, "\r" or "\n" from the quote position
        let unquotedNext = csv.length;
        let i = csv.indexOf(separator, offset);
        if (i != -1 && i < unquotedNext) {
          unquotedNext = i;
        }
        i = csv.indexOf("\n", offset);
        if (i != -1 && i < unquotedNext) {
          unquotedNext = i;
        }
        i = csv.indexOf("\r", offset);
        if (i != -1 && i < unquotedNext) {
          unquotedNext = i;
        }
        text = csv.substring(offset, unquotedNext);
        offset = unquotedNext;
      }
      row.push(text);
    } else { // unquoted value
      // find the first EOF, separator, "\r" or "\n"
      let next = csv.length;
      let i = csv.indexOf(separator, offset);
      if (i != -1 && i < next) {
        next = i;
      }
      i = csv.indexOf("\n", offset);
      if (i != -1 && i < next) {
        next = i;
      }
      i = csv.indexOf("\r", offset);
      if (i != -1 && i < next) {
        next = i;
      }
      let text = csv.substring(offset, next);
      offset = next;
      row.push(text);
    }
    // parse end if file, line break or cell separator
    if (offset == csv.length) {
      if (row.length != 1 || row[0] != "") { // if input ended in a line break, the last line will have one empty cell, which we should ignore
        table.push(row); // the input did not end with a line break - include the last line
      }
      if (table.length == 0) {
        throw Object.assign(new Error(), {
          name: "CSVParseError",
          message: "no data",
          offsetStart: 0,
          offsetEnd: csv.length
        });
      }
      let len = table[0].length;
      for (let i = 0; i < table.length; i++) {
        if (table[i].length != len) {
          throw Object.assign(new Error(), {
            name: "CSVParseError",
            message: "row " + (i + 1) + " has " + table[i].length + " cells, expected " + len,
            offsetStart: csv.split("\n").slice(0, i).join("\n").length + 1,
            offsetEnd: csv.split("\n").slice(0, i + 1).join("\n").length
          });
        }
      }
      return table;
    } else if (csv[offset] == "\n" || csv[offset] == "\r") {
      if (csv[offset] == "\r" && offset + 1 < csv.length && csv[offset + 1] == "\n") {
        offset += 2;
      } else {
        offset++;
      }
      table.push(row);
      row = [];
    } else if (csv[offset] == separator) {
      offset++;
    } else {
      throw Object.assign(new Error(), {
        name: "CSVParseError",
        message: "unexpected token '" + csv[offset] + "'",
        offsetStart: offset,
        offsetEnd: offset + 1
      });
    }
  }
}
