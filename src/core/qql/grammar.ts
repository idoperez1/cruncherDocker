import { createToken, EmbeddedActionsParser, Lexer } from "chevrotain";

const Identifier = createToken({ name: "Identifier", pattern: /[0-9\w][0-9\w\-]*/ });
const Integer = createToken({ name: "Integer", pattern: /0|[1-9]\d*/ });
const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});
const Comma = createToken({ name: "Comma", pattern: /,/ });
const Pipe = createToken({ name: "Pipe", pattern: /\|/ });
const DoubleQoutedString = createToken({
  name: "DoubleQoutedString",
  pattern: /"(?:[^\\"]|\\(?:[bfnrtv"\\/]|u[0-9a-fA-F]{4}))*"/,
});

const OpenBrackets = createToken({ name: "OpenBrackets", pattern: /\(/ });
const CloseBrackets = createToken({ name: "CloseBrackets", pattern: /\)/ });

// Commands
const Table = createToken({ name: "Table", pattern: /table/ });
const Stats = createToken({ name: "Stats", pattern: /stats/ });

// Stats specific keywords
const By = createToken({ name: "By", pattern: /by/ });

// note we are placing WhiteSpace first as it is very common thus it will speed up the lexer.
const allTokens = [
  WhiteSpace,
  DoubleQoutedString,
  Pipe,
  Comma,
  OpenBrackets,
  CloseBrackets,

  // "keywords" appear before the Identifier
  Table,
  Stats,
  By,

  Identifier,
  Integer,
];
export const QQLLexer = new Lexer(allTokens); // Quick Query Language

// parser needs to support:
// identifier1 identifier2
// parsed as:
// {
//     search: ["token1", "token2"],
// }

export function isNumeric(value: string) {
  return /^-?\d+(?:.\d+)?$/.test(value);
}

export class QQLParser extends EmbeddedActionsParser {
  constructor() {
    super(allTokens);
    this.performSelfAnalysis();
  }

  public query = this.RULE("query", () => {
    const search = this.SUBRULE(this.search);
    const pipeline: ReturnType<typeof this.pipelineCommand>[] = [];

    this.MANY(() => {
      this.CONSUME(Pipe);
      const pipelineItem = this.SUBRULE(this.pipelineCommand);
      pipeline.push(pipelineItem);
    });

    return {
      search: search.search,
      pipeline: pipeline,
    } as const;
  });

  private pipelineCommand = this.RULE("pipelineCommand", () => {
      return this.OR<
        | ReturnType<typeof this.table>
        | ReturnType<typeof this.statsCommand>
      >([
        { ALT: () => this.SUBRULE(this.table) },
        { ALT: () => this.SUBRULE(this.statsCommand) },
      ]);
  });

  private search = this.RULE("search", () => {
    const tokens: string[] = [];
    this.MANY(() => {
      const token = this.OR([
        { ALT: () => this.SUBRULE(this.doubleQuotedString) },
        { ALT: () => this.SUBRULE(this.identifier) },
        { ALT: () => this.SUBRULE(this.integer) },
      ]);

      tokens.push(token);
    });

    return { search: tokens };
  });

  private table = this.RULE("table", () => {
    this.CONSUME(Table);

    const columns: string[] = [];

    this.AT_LEAST_ONE({
      DEF: () => {
        const column = this.SUBRULE(this.columnName);
        this.OPTION(() => this.CONSUME(Comma));
        columns.push(column);
      },
      ERR_MSG: "at least one column name",
    })

    return {
      type: "table",
      columns: columns,
    } as const;
  });

  private statsCommand = this.RULE("statsCommand", () => {
    this.CONSUME(Stats);
    const columns: ReturnType<typeof this.aggFunctionCall>[] = [];

    this.MANY(() => {
      const func = this.SUBRULE(this.aggFunctionCall);
      this.OPTION(() => this.CONSUME(Comma));
      columns.push(func);
    });

    const groupBy = this.OPTION2(() => this.SUBRULE(this.groupByClause));

    return {
      type: "stats",
      columns: columns,
      groupBy: groupBy,
    } as const;
  });

  private groupByClause = this.RULE("groupByClause", () => {
    this.CONSUME(By);
    const columns: string[] = [];

    this.AT_LEAST_ONE({
      DEF: () => {
        const column = this.SUBRULE(this.columnName);
        this.OPTION(() => this.CONSUME(Comma));
        columns.push(column);
      },
      ERR_MSG: "at least one column name",
    });

    return columns;
  });

  private aggFunctionCall = this.RULE("functionCall", () => {
    const functionName = this.CONSUME(Identifier);
    this.CONSUME(OpenBrackets);
    const column = this.OPTION(() => this.SUBRULE(this.columnName));
    this.CONSUME(CloseBrackets);

    return {
      function: functionName.image,
      column: column,
    };
  });

  private columnName = this.RULE("columnName", () => {
    const column = this.CONSUME(Identifier);
    return column.image;
  });


  private identifier = this.RULE("identifier", () => {
    const value = this.CONSUME(Identifier);
    // try to parse the value as a number
    if (isNumeric(value.image)) {
      return parseInt(value.image, 10);
    }

    return value.image;
  });

  private integer = this.RULE("integer", () => {
    const token = this.CONSUME(Integer);

    return this.ACTION(() => {
      return parseInt(token.image, 10);
    });
  });

  private doubleQuotedString = this.RULE("doubleQuotedString", () => {
    const token = this.CONSUME(DoubleQoutedString);

    return this.ACTION(() => {
      return JSON.parse(token.image);
    });
  });
}

export type AggregationFunction = ReturnType<QQLParser["aggFunctionCall"]>;
