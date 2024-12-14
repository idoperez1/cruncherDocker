import { formatDataTime } from "./formatters";

export type ProcessedData = {
  object: ObjectFields
  message: string;
};

export type ObjectFields = {
  [key: string]: Field;
}

export type FieldWithError = {
  errors?: string[];
}

export type NumberField = {
  type: "number";
  value: number;
} & FieldWithError;

export type StringField = {
  type: "string";
  value: string;
} & FieldWithError;

export type DateField = {
  type: "date";
  value: number;
} & FieldWithError;

export type ArrayField = {
  type: "array";
  value: Field[];
} & FieldWithError;

export type ObjectField = {
  type: "object";
  value: ObjectFields;
} & FieldWithError;

export type BooleanField = {
  type: "boolean";
  value: boolean;
} & FieldWithError;

export type Field =
  | NumberField
  | StringField
  | DateField
  | ArrayField
  | ObjectField
  | BooleanField
  | undefined | null;


export const asNumberField = (field: Field): NumberField => {
  if (typeof field?.value === "number") {
    return {
      type: "number",
      value: field.value,
    };
  }

  return {
    type: "number",
    value: NaN,
    errors: ["Invalid number"],
  }
}

export const asJson = (field: Field): string => {
  if (!field) {
    return "<null>";
  }

  
  if (field.type === "object") {
    const results: Record<string, any> = {};
    for (const key in field.value) {
      results[key] = asJson(field.value[key]);
    }

    return JSON.stringify(results);
  }

  if (field.type === "array") {
    return JSON.stringify(field.value.map(asJson));
  }

  return field.value.toString();
}

export const asDisplayString = (field: Field): string => {
  if (!field) {
    return "<null>";
  }

  if (field.type === "date") {
    return formatDataTime(field.value);
  }

  if (field.type === "object" || field.type === "array") {
    return asJson(field);
  }

  return field.value.toString();
}

export const asDateField = (field: Field): DateField => {
  if (field?.type === "date") {
    return field;
  }

  if (typeof field?.value === "number") {
    return {
      type: "date",
      value: field.value,
    };
  }

  return {
    type: "date",
    value: 0,
    errors: ["Invalid date"],
  }
}

export const getTimeFromProcessedData = (data: ProcessedData): number => {
  if (data.object._time) {
    return asDateField(data.object._time).value;
  }

  return 0;
}

export const compareProcessedData = (a: ProcessedData, b: ProcessedData): number => {
  return getTimeFromProcessedData(b) - getTimeFromProcessedData(a);
}
