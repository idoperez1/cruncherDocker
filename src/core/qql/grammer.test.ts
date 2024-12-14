import { expect, test } from "vitest";
import { QQLLexer, QQLParser } from "./grammar";

test("parser hello world", () => {
  const parser = new QQLParser();

  const lexer = QQLLexer.tokenize("hello world this is awesome");
  expect(lexer.errors).toEqual([]);
  parser.input = lexer.tokens;
  expect(parser.query().search).toEqual([
    "hello",
    "world",
    "this",
    "is",
    "awesome",
  ]);
});

test("string", () => {
  const parser = new QQLParser();

  const lexer = QQLLexer.tokenize(`"hello world" token2 token3`);
  expect(lexer.errors).toEqual([]);
  parser.input = lexer.tokens;
  expect(parser.query().search).toEqual(["hello world", "token2", "token3"]);
});

test("integer", () => {
  const parser = new QQLParser();

  const lexer = QQLLexer.tokenize(`123 token`);
  expect(lexer.errors).toEqual([]);
  parser.input = lexer.tokens;
  expect(parser.query().search).toEqual([123, "token"]);
});

test("multiple strings", () => {
  const parser = new QQLParser();

  const lexer = QQLLexer.tokenize(`"hello world" token2 "token3 hey there"`);
  expect(lexer.errors).toEqual([]);
  parser.input = lexer.tokens;
  expect(parser.query().search).toEqual([
    "hello world",
    "token2",
    "token3 hey there",
  ]);
});

test("nested strings", () => {
  const parser = new QQLParser();

  const lexer = QQLLexer.tokenize(`"hello world \\"nested\\" string" token2`);
  expect(lexer.errors).toEqual([]);
  parser.input = lexer.tokens;
  expect(parser.query().search).toEqual([
    `hello world "nested" string`,
    "token2",
  ]);
});

test("table command", () => {
  const parser = new QQLParser();

  const lexer = QQLLexer.tokenize(`hello world | table column1`);
  expect(lexer.errors).toEqual([]);
  parser.input = lexer.tokens;
  expect(parser.query()).toEqual({
    search: ["hello", "world"],
    pipeline: [
      {
        type: "table",
        columns: ["column1"],
      },
    ],
  });
});

test("table command no columns", () => {
  const parser = new QQLParser();

  const lexer = QQLLexer.tokenize(`hello world | table `);
  expect(lexer.errors).toEqual([]);
  parser.input = lexer.tokens;
  parser.query();
  expect(parser.errors).length(1);
  expect(parser.errors[0].message).toEqual(
    "Expecting: at least one column name\nbut found: ''",
  );
});

test("table command multiple columns", () => {
  const parser = new QQLParser();

  const lexer = QQLLexer.tokenize(
    `hello world | table column1, column2, column3`,
  );
  expect(lexer.errors).toEqual([]);
  parser.input = lexer.tokens;
  expect(parser.query()).toEqual({
    search: ["hello", "world"],
    pipeline: [
      {
        type: "table",
        columns: ["column1", "column2", "column3"],
      },
    ],
  });
});

test("table command multiple columns no comma", () => {
  const parser = new QQLParser();

  const lexer = QQLLexer.tokenize(
    `hello world | table column1 column2 column3`,
  );
  expect(lexer.errors).toEqual([]);
  parser.input = lexer.tokens;
  expect(parser.query()).toEqual({
    search: ["hello", "world"],
    pipeline: [
      {
        type: "table",
        columns: ["column1", "column2", "column3"],
      },
    ],
  });
});

test("parsing uuid as string", () => {
  const parser = new QQLParser();

  const lexer = QQLLexer.tokenize(`hello 76e191f8-8ab6-4db7-9895-c1b6d188106c`);
  expect(lexer.errors).toEqual([]);
  parser.input = lexer.tokens;
  expect(parser.query()).toEqual({
    search: ["hello", "76e191f8-8ab6-4db7-9895-c1b6d188106c"],
    pipeline: [],
  });
})

test("support for stats command basic", () => {
  const parser = new QQLParser();

  const lexer = QQLLexer.tokenize(`hello world | stats count()`);
  expect(lexer.errors).toEqual([]);
  parser.input = lexer.tokens;
  expect(parser.query()).toEqual({
    search: ["hello", "world"],
    pipeline: [
      {
        type: "stats",
        columns: [
          {
            function: "count",
            column: undefined,
          }
        ],
        groupBy: undefined,
      },
    ],
  });
})


test("support for stats group by", () => {
  const parser = new QQLParser();

  const lexer = QQLLexer.tokenize(`hello world | stats count() by column1`);
  expect(lexer.errors).toEqual([]);
  parser.input = lexer.tokens;
  expect(parser.query()).toEqual({
    search: ["hello", "world"],
    pipeline: [
      {
        type: "stats",
        columns: [
          {
            function: "count",
            column: undefined,
          }
        ],
        groupBy: ["column1"],
      },
    ],
  });
})

test("support for regex command", () => {
  const parser = new QQLParser();

  const lexer = QQLLexer.tokenize(`hello world | regex \`pattern\``);
  expect(lexer.errors).toEqual([]);
  parser.input = lexer.tokens;
  const result = parser.query();
  expect(result).toEqual({
    search: ["hello", "world"],
    pipeline: [
      {
        type: "regex",
        pattern: "pattern",
      },
    ],
  });
})

test("support for regex command with column", () => {
  const parser = new QQLParser();

  const lexer = QQLLexer.tokenize(`hello world | regex field=abc \`pattern\``);
  expect(lexer.errors).toEqual([]);
  parser.input = lexer.tokens;
  const result = parser.query();
  expect(result).toEqual({
    search: ["hello", "world"],
    pipeline: [
      {
        type: "regex",
        columnSelected: "abc",
        pattern: "pattern",
      },
    ],
  });
})
