import { createToken, CustomPatternMatcherFunc, EmbeddedActionsParser, IToken, Lexer, tokenMatcher, TokenType } from "chevrotain";

const Identifier = createToken({ name: "Identifier", pattern: /[0-9\w][0-9\w\-]*/ });
const Integer = createToken({ name: "Integer", pattern: /0|[1-9]\d*/ });
const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});
const Comma = createToken({ name: "Comma", pattern: /,/ });
const Pipe = createToken({ name: "Pipe", pattern: /\|/ });
const Equal = createToken({ name: "Equal", pattern: /=/ });
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

const matchKeywordOfCommand = (token: TokenType, pattern: RegExp): CustomPatternMatcherFunc => (text, offset, matchedTokens, _groups) => {
  const pipeline = extractLastPipeline(matchedTokens);
  if (pipeline.length < 1) {
    return null;
  }

  // make sure it's stats command
  const command = pipeline[0];

  if (!tokenMatcher(command, token)) {
    return null;
  }

  return pattern.exec(text.substring(offset));
}

// Commands
const Table = createToken({ name: "Table", pattern: matchCommand(/^table/), longer_alt: Identifier, line_breaks: false });
const Stats = createToken({ name: "Stats", pattern: matchCommand(/^stats/), longer_alt: Identifier, line_breaks: false });

// Stats specific keywords
const By = createToken({ name: "By", pattern: matchKeywordOfCommand(Stats, /^(by)(?!\()/), longer_alt: Identifier, line_breaks: false });

// Regex specific
const Regex = createToken({ name: "Regex", pattern: matchCommand(/^regex/), longer_alt: Identifier, line_breaks: false });

const RegexPattern = createToken({ name: "RegexPattern", pattern: /`(?:[^\\`]|\\(?:[bfnrtv`\\/]|u[0-9a-fA-F]{4}|\w|[\[\]\(\)\{\}]))*`/ });

const RegexParamField = createToken({ name: "RegexParamField", pattern: matchKeywordOfCommand(Regex, /^(field)/), longer_alt: Identifier, line_breaks: false });

// OrderBy specific
const OrderBy = createToken({ name: "OrderBy", pattern: matchCommand(/^(orderBy)/), longer_alt: Identifier, line_breaks: false });

const Asc = createToken({ name: "Asc", pattern: matchKeywordOfCommand(OrderBy, /^(asc)/), longer_alt: Identifier, line_breaks: false });
const Desc = createToken({ name: "Desc", pattern: matchKeywordOfCommand(OrderBy, /^(desc)/), longer_alt: Identifier, line_breaks: false });



// note we are placing WhiteSpace first as it is very common thus it will speed up the lexer.
const allTokens = [
  WhiteSpace,
  DoubleQoutedString,
  RegexPattern,
  Pipe,
  Equal,
  Comma,
  OpenBrackets,
  CloseBrackets,

  // "keywords" appear before the Identifier
  Table,
  Stats,
  By,
  Regex,
  RegexParamField,
  OrderBy,
  Asc,
  Desc,

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
};

export type SuggetionType =
  | { type: "column" }
  | { type: "function" }
  | { type: "keywords", keywords: string[] }
  | { type: "params", keywords: string[] };


export type SuggestionData = {
  fromPosition: number;
  toPosition?: number;
  disabled?: boolean;
} & SuggetionType;

export type Order = "asc" | "desc";


export class QQLParser extends EmbeddedActionsParser {
  private highlightData: HighlightData[] = [];
  private suggestionData: SuggestionData[] = [];

  constructor() {
    super(allTokens, {
      recoveryEnabled: false,
    });
    this.performSelfAnalysis();
  }

  private getNextPos() {
    let res = this.LA(1).endOffset
    if (res === undefined || Number.isNaN(res)) {
      res = this.LA(1).startOffset
    }

    return res;
  }

  private addAutoCompleteType(suggestionType: SuggetionType, opts: { spacing?: number, disabled?: boolean } = {}) {
    let obj: SuggestionData | undefined = undefined;
    this.ACTION(() => {
      const startPos = ((this.LA(0).endColumn ?? this.LA(0).startColumn ?? 0) + (opts.spacing ?? 0));
      obj = {
        ...suggestionType,
        fromPosition: startPos,
        disabled: opts.disabled ?? false,
      }

      this.suggestionData.push(obj);
    })

    return {
      obj: obj,
      disable: () => {
        this.ACTION(() => {
          if (!obj) {
            return
          }

          obj.disabled = true;
        })
      },
      resetStart: () => {
        this.ACTION(() => {
          if (!obj) {
            return
          }

          obj.fromPosition = ((this.LA(0).endColumn ?? this.LA(0).startColumn ?? 0) + (opts.spacing ?? 0));
          obj.disabled = false;
        })
      },
      closeAfter1: () => {
        this.ACTION(() => {
          if (!obj) {
            return
          }
          obj.toPosition = this.getNextPos() + 1;
        })
      },
      close: () => {
        this.ACTION(() => {
          if (!obj) {
            return
          }

          obj.toPosition = this.LA(1).startOffset;
        })
      },
      remove: () => {
        this.ACTION(() => {
          if (!obj) {
            return
          }

          this.suggestionData.splice(this.suggestionData.indexOf(obj), 1);
        })
      }
    }
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
    this.suggestionData = [];
  }

  public getSuggestionData() {
    return this.suggestionData.filter((s) => !s.disabled);
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
    this.addAutoCompleteType({
      type: "keywords",
      keywords: ["table", "stats", "regex", "orderBy"],
    }).closeAfter1();

    const resp = this.OR<
      | ReturnType<typeof this.table>
      | ReturnType<typeof this.statsCommand>
      | ReturnType<typeof this.regex>
      | ReturnType<typeof this.orderBy>
    >([
      { ALT: () => this.SUBRULE(this.table) },
      { ALT: () => this.SUBRULE(this.statsCommand) },
      { ALT: () => this.SUBRULE(this.regex) },
      { ALT: () => this.SUBRULE(this.orderBy) },
    ]);

    return resp;
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

  private orderBy = this.RULE("orderBy", () => {
    const token = this.CONSUME(OrderBy);
    this.ACTION(() => {
      this.addHighlightData("keyword", token);
    });

    const columns: ReturnType<typeof this.orderByRule>[] = [];

    const columnAutocomplete = this.addAutoCompleteType({
      type: "column",
    });

    this.AT_LEAST_ONE_SEP({
      DEF: () => {
        columnAutocomplete.closeAfter1();
        this.addAutoCompleteType({
          type: "column",
        }).closeAfter1();
        const result = this.SUBRULE(this.orderByRule);
        columns.push(result);
      },
      SEP: Comma,
      ERR_MSG: "at least one column name",
    });

    columnAutocomplete.close();

    return {
      type: "orderBy",
      columns: columns,
    } as const;
  });

  private orderByRule = this.RULE("orderByRule", () => {
    const column = this.SUBRULE(this.columnName);

    this.addAutoCompleteType({
      type: "keywords",
      keywords: ["asc", "desc"],
    }).closeAfter1();
    const order: Order = this.OPTION(() => {
      const token = this.OR([
        { ALT: () => this.CONSUME(Asc) },
        { ALT: () => this.CONSUME(Desc) },
      ]);

      this.ACTION(() => {
        this.addHighlightData("keyword", token);
      });

      return token.image as Order;
    }) ?? 'asc';

    return {
      name: column,
      order: order,
    } as const;
  });

  private regex = this.RULE("regex", () => {
    const token = this.CONSUME(Regex);
    this.ACTION(() => {
      this.addHighlightData("keyword", token);
    });

    let columnSelected: string | undefined = undefined;

    this.addAutoCompleteType({
      type: "params",
      keywords: ["field"],
    }).closeAfter1();

    this.OPTION(() => {
      const field = this.CONSUME(RegexParamField);
      this.ACTION(() => {
        this.addHighlightData("param", field);
      });
      this.CONSUME(Equal);

      this.addAutoCompleteType({
        type: "column",
      }).closeAfter1();
      const column = this.SUBRULE(this.columnName);

      columnSelected = column;
    })

    const pattern = this.CONSUME(RegexPattern);
    this.ACTION(() => {
      this.addHighlightData("regex", pattern);
    });

    return this.ACTION(() => ({
      type: "regex",
      columnSelected: columnSelected,
      pattern: unqouteBacktick(pattern.image),
    } as const));
  });

  private table = this.RULE("table", () => {
    const token = this.CONSUME(Table);

    this.ACTION(() => {
      this.addHighlightData("keyword", token);
    })

    const columns: string[] = [];

    const autoComplete = this.addAutoCompleteType({
      type: "column",
    }, { spacing: 1 });  // require a space after the column name

    this.AT_LEAST_ONE({
      DEF: () => {
        const column = this.SUBRULE(this.columnName);
        this.OPTION(() => this.CONSUME(Comma));
        columns.push(column);
      },
      ERR_MSG: "at least one column name",
    })

    autoComplete.close();

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

    const autoCompleteByKeyword = this.addAutoCompleteType({
      type: "keywords",
      keywords: ["by"],
    }, { spacing: 1, disabled: true });

    let latestFunctionAutoComplete = this.addAutoCompleteType({
      type: "function",
    }, { spacing: 1 });
    latestFunctionAutoComplete.closeAfter1();

    const columns: ReturnType<typeof this.aggFunctionCall>[] = [];
    this.AT_LEAST_ONE({
      DEF: () => {
        autoCompleteByKeyword.disable();
        const func = this.SUBRULE(this.aggFunctionCall);
        this.OPTION(() => this.CONSUME(Comma));
        columns.push(func);

        // allow by auto complete only when there is at least one column
        autoCompleteByKeyword.resetStart();

        latestFunctionAutoComplete = this.addAutoCompleteType({
          type: "function",
        }, { spacing: 1 });
        latestFunctionAutoComplete.closeAfter1();
      },
    });

    latestFunctionAutoComplete.close();

    autoCompleteByKeyword.close(); // close right after the by keyword
    const groupBy = this.OPTION2(() => {
      autoCompleteByKeyword.closeAfter1(); // close right after the by keyword
      return this.SUBRULE(this.groupByClause)
    });

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
    const autoComplete = this.addAutoCompleteType({
      type: "column",
    }, { spacing: 1 });  // require a space after the column name

    this.AT_LEAST_ONE({
      DEF: () => {
        const column = this.SUBRULE(this.columnName);
        this.OPTION(() => this.CONSUME(Comma));
        columns.push(column);
      },
      ERR_MSG: "at least one column name",
    });

    autoComplete.close();

    return columns;
  });

  private aggFunctionCall = this.RULE("functionCall", () => {
    const functionName = this.CONSUME(Identifier);
    this.ACTION(() => {
      this.addHighlightData("function", functionName);
    });

    this.CONSUME(OpenBrackets);
    const autoComplete = this.addAutoCompleteType({
      type: "column",
    });
    const column = this.OPTION(() => this.SUBRULE(this.columnName));
    autoComplete.close();
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


// remove backticks from the string
// if backtick is escaped, then keep it
const unqouteBacktick = (input: string) => {
  return input.replace(/\\`/g, "`").slice(1, -1);
}