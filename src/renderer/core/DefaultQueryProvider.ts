import { QueryProvider } from "./common/interface";


class DefaultQueryProvider implements QueryProvider {
  waitForReady(): Promise<void> {
    return Promise.resolve();
  }
  getControllerParams(): Promise<Record<string, string[]>> {
    throw new Error("No query provider available - please configure ~/.config/cruncher/cruncher.config.yaml");
  }
  query(): Promise<void> {
    throw new Error("No query provider available - please configure ~/.config/cruncher/cruncher.config.yaml");
  }
}

export const DEFAULT_QUERY_PROVIDER = new DefaultQueryProvider();
