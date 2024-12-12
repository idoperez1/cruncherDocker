import type { ILexingError, IRecognitionException } from "chevrotain";
import { QQLLexer, QQLParser } from "./grammar";

class QQLLexingError extends Error {
  constructor(
    message: string,
    public errors: ILexingError[],
  ) {
    super(message);
  }
}

class QQLParserError extends Error {
  constructor(
    message: string,
    public errors: IRecognitionException[],
  ) {
    super(message);
  }
}

export const parse = (input: string) => {
  const lexer = QQLLexer.tokenize(input);
  if (lexer.errors.length > 0) {
    throw new QQLLexingError("Failed to parse input", lexer.errors);
  }

  const parser = new QQLParser();
  parser.input = lexer.tokens;
  const response = parser.query();
  if (parser.errors.length > 0) {
    throw new QQLParserError("Failed to parse input", parser.errors);
  }

  return response;
};

export type ParsedQuery = ReturnType<typeof parse>;
export type PipelineItem = ParsedQuery["pipeline"][number];
