import { ControllerIndexParam, Search } from "~lib/qql/grammar";
import { ProcessedData } from "./logTypes";
import { z } from "zod";

export type QueryOptions = {
  fromTime: Date;
  toTime: Date;
  limit: number;
  cancelToken: AbortSignal;
  onBatchDone: (data: ProcessedData[]) => void;
};

export interface QueryProvider {
  getControllerParams(): Promise<Record<string, string[]>>;
  query(
    params: ControllerIndexParam[],
    searchTerm: Search,
    queryOptions: QueryOptions
  ): Promise<void>;
}

type ObjectParam = {
  type: "object";
  defaultValue?: object;
};
type ArrayParam = {
  type: "array";
  defaultValue?: unknown[];
};
type StringParam = {
  type: "string";
  defaultValue?: string;
};
type NumberParam = {
  type: "number";
  defaultValue?: number;
};
type BooleanParam = {
  type: "boolean";
  defaultValue?: boolean;
};
type DateParam = {
  type: "date";
  defaultValue?: Date;
};

export type Param = {
  name: string;
  description: string;
} & (
  | ObjectParam
  | ArrayParam
  | StringParam
  | NumberParam
  | BooleanParam
  | DateParam
);

export type FactoryParams = {
  params: Record<string, unknown>;
};

export type PluginRef = string & { _pr: never }; // A unique identifier for a plugin

export type ExternalAuthProvider = {
  getCookies(
    requestedUrl: string,
    cookies: string[],
    validate: (cookies: Record<string, string>) => Promise<boolean>
  ): Promise<Record<string, string>>;
};

export type AdapterContext = {
  externalAuthProvider: ExternalAuthProvider;
};

export interface Adapter {
  name: string;
  ref: PluginRef;
  description: string;
  version: string;

  params: z.ZodObject<{}>;
  factory: (context: AdapterContext, params: FactoryParams) => QueryProvider;
}

export function newPluginRef(ref: string): PluginRef {
  return ref as PluginRef;
}
