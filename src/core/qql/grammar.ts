import { createToken, CustomPatternMatcherFunc, EmbeddedActionsParser, IToken, Lexer, tokenMatcher } from "chevrotain";

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

const extractLastPipeline = (matchedTokens: IToken[]) => {
  const result: IToken[] = [];
  for (let i = matchedTokens.length - 1; i >= 0; i--) {
    const token = matchedTokens[i];
    if (tokenMatcher(token, Pipe)) {
      break;
    }

    result.unshift(token);
  }

  return result;
}

const matchCommand = (pattern: RegExp): CustomPatternMatcherFunc => (text, offset, matchedTokens, _groups) => {
  if (matchedTokens.length < 1) {
    return null;
  }

  let lastMatchedToken = matchedTokens[matchedTokens.length - 1];
  if (!lastMatchedToken) {
    return null;
  }

  if (!tokenMatcher(lastMatchedToken, Pipe)) {
    return null;
  }

  // Note that just because we are using a custom token pattern
  // Does not mean we cannot implement it using JavaScript Regular Expressions...
  // get substring using offset
  const textSubstring = text.substring(offset);
  const execResult = pattern.exec(textSubstring);
  return execResult;
}

// Commands
const Table = createToken({ name: "Table", pattern: matchCommand(/^table/), longer_alt: Identifier, line_breaks: false });
const Stats = createToken({ name: "Stats", pattern: matchCommand(/^stats/), longer_alt: Identifier, line_breaks: false });

const matchStatsByKeyword: CustomPatternMatcherFunc = (text, offset, matchedTokens, _groups) => {
  const pipeline = extractLastPipeline(matchedTokens);
  if (pipeline.length < 1) {
    return null;
  }

  // make sure it's stats command
  const command = pipeline[0];

  if (!tokenMatcher(command, Stats)) {
    return null;
  }

  return /^by/.exec(text.substring(offset));
}

// Stats specific keywords
const By = createToken({ name: "By", pattern: matchStatsByKeyword, longer_alt: Identifier, line_breaks: false });

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

export type HighlightData = {
  type: string;
  token: {
    startOffset: number;
    endOffset: number | undefined;
  };
}

export class QQLParser extends EmbeddedActionsParser {
  private highlightData: HighlightData[] = [];

  constructor() {
    super(allTokens);
    this.performSelfAnalysis();
  }

  private addHighlightData(type: string, token: IToken) {
    this.highlightData.push({
      type: type,
      token: {
        startOffset: token.startOffset,
        endOffset: token.endOffset,
      },
    });
  }

  public reset() {
    this.highlightData = [];
  }

  public getHighlightData() {
    return this.highlightData;
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
    const token = this.CONSUME(Table);

    this.ACTION(() => {
      this.addHighlightData("keyword", token);
    })

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
    const token = this.CONSUME(Stats);
    this.ACTION(() => {
      this.addHighlightData("keyword", token);
    })


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
    const token = this.CONSUME(By);
    this.ACTION(() => {
      this.addHighlightData("keyword", token);
    });

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
    this.ACTION(() => {
      this.addHighlightData("function", functionName);
    });

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

    this.ACTION(() => {
      this.addHighlightData("column", column);
    });

    return column.image;
  });


  private identifier = this.RULE("identifier", () => {
    const value = this.CONSUME(Identifier);
    // try to parse the value as a number
    if (isNumeric(value.image)) {
      this.addHighlightData("number", value);

      return parseInt(value.image, 10);
    }

    return value.image;
  });

  private integer = this.RULE("integer", () => {
    const token = this.CONSUME(Integer);

    return this.ACTION(() => {
      this.addHighlightData("number", token);

      return parseInt(token.image, 10);
    });
  });

  private doubleQuotedString = this.RULE("doubleQuotedString", () => {
    const token = this.CONSUME(DoubleQoutedString);

    return this.ACTION(() => {
      this.addHighlightData("string", token);

      return JSON.parse(token.image);
    });
  });
}

export type AggregationFunction = ReturnType<QQLParser["aggFunctionCall"]>;
