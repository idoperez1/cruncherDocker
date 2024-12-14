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

export const asDisplayString = (field: Field): string => {
  if (!field) {
    return "<null>";
  }

  if (field.type === "date") {
    return formatDataTime(field.value);
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
