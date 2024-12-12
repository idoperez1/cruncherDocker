export type ProcessedData = {
  uniqueId: string;
  nanoSeconds: number;
  timestamp: number;
  object: Record<string, string | number>;
  message: string;
};
