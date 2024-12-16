import { Field, isNotDefined, ProcessedData } from "~core/common/logTypes";
import { AndExpression, ComparisonExpression, FactorType, FunctionExpression, LogicalExpression, NotExpression, OrExpression, UnitExpression } from "~core/qql/grammar";


type Context = {
    data: ProcessedData;
}

export const processLogicalExpression = (logicalExpression: LogicalExpression, context: Context): boolean => {
    const { left, right } = logicalExpression;

    const leftResult = processUnitExpression(left, context);
    if (!right) {
        return leftResult;
    }

    switch (right.type) {
        case "andExpression":
            return processAndExpression(right, leftResult, context);
        case "orExpression":
            return processOrExpression(right, leftResult, context);
        default:
            throw new Error("Invalid logical expression type");
    }
}

const processUnitExpression = (unitExpression: UnitExpression, context: Context): boolean => {
    const { value } = unitExpression;
    switch (value.type) {
        case "comparisonExpression":
            return processComparisonExpression(value, context);
        case "notExpression":
            return processNotExpression(value, context);
        case "functionExpression":
            return processFunctionExpression(value, context);
        default:
            throw new Error("Invalid unit expression type");
    }
}

export const SUPPORTED_BOOLEAN_FUNCTIONS = [
    "contains", 
    "startsWith", 
    "endsWith", 
    "match", 
    "isNull", 
    "isNotNull",
] as const;
export type SupportedBooleanFunction = typeof SUPPORTED_BOOLEAN_FUNCTIONS[number];


const processFunctionExpression = (functionExpression: FunctionExpression, context: Context): boolean => {
    const { functionName, args } = functionExpression;

    switch (functionName as SupportedBooleanFunction) {
        case "contains":
            return processContainsFunction(args, context);
        case "startsWith":
            return processStartsWithFunction(args, context);
        case "endsWith":
            return processEndsWithFunction(args, context);
        case "match":
            return matches(args, context);
        case "isNotNull":
            return processSingleArgFunction(args, context, (a) => !isNotDefined(a));
        case "isNull":
            return processSingleArgFunction(args, context, isNotDefined);
        default:
            console.warn("Unsuported function: ", functionName, args, context);
            throw new Error(`Function \`${functionName}\` is not supported!`);
    }
}

const processSingleArgFunction = (args: FactorType[], context: Context, func: (a: Field) => boolean): boolean => {
    if (args.length !== 1) {
        throw new Error("Invalid number of arguments for function - expected exactly 1");
    }

    const [arg] = args;
    const argValue = processFieldValue(context, arg);

    return func(argValue);
}

const processStringFunction = (args: FactorType[], context: Context, func: (a: string, b: string) => boolean): boolean => {
    if (args.length !== 2) {
        throw new Error("Invalid number of arguments for function - expected exactly 2");
    }

    const [left, right] = args;
    if ((left.type !== "string" && left.type !== "columnRef") || (right.type !== "string" && right.type !== "columnRef")) {
        throw new Error(`Invalid argument types for function - expected: (string | columnRef, string | columnRef), got ${left.type} and ${right.type}`);
    }

    const leftValue = processFieldValue(context, left);
    const rightValue = processFieldValue(context, right);

    if (isNotDefined(leftValue) || isNotDefined(rightValue)) {
        return false;
    }

    if (leftValue.type !== "string" || rightValue.type !== "string") {
        return false;
    }

    return func(leftValue.value, rightValue.value);
}

const matches = (args: FactorType[], context: Context): boolean => {
    return processStringFunction(args, context, (a, b) => {
        const regex = new RegExp(b);
        return regex.test(a);
    });
}


const processStartsWithFunction = (args: FactorType[], context: Context): boolean => {
    return processStringFunction(args, context, (a, b) => a.startsWith(b));
}

const processEndsWithFunction = (args: FactorType[], context: Context): boolean => {
    return processStringFunction(args, context, (a, b) => a.endsWith(b));
}

const processContainsFunction = (args: FactorType[], context: Context): boolean => {
    return processStringFunction(args, context, (a, b) => a.includes(b));
}

const processComparisonExpression = (comparisonExpression: ComparisonExpression, context: Context): boolean => {
    const { left, right, operator } = comparisonExpression;
    const leftValue = processFieldValue(context, left);
    const rightValue = processFieldValue(context, right);

    if (isNotDefined(leftValue)) {
        return handleValueIsUndefined(rightValue, operator);
    }

    if (isNotDefined(rightValue)) {
        return handleValueIsUndefined(leftValue, operator);
    }

    switch (operator) {
        case "==":
            return leftValue.value === rightValue.value;
        case "!=":
            return leftValue.value !== rightValue.value;
        case ">":
            return leftValue.value > rightValue.value;
        case "<":
            return leftValue.value < rightValue.value;
        case ">=":
            return leftValue.value >= rightValue.value;
        case "<=":
            return leftValue.value <= rightValue.value;
        default:
            throw new Error("Invalid comparison operator");
    }
}

const handleValueIsUndefined = (fieldValue: Field, operator: string) => {
    switch (operator) {
        case "==":
            return isNotDefined(fieldValue);
        case "!=":
            return !isNotDefined(fieldValue);
        default:
            return false;
    }
}

const processFieldValue = (context: Context, field: FactorType): Field => {
    switch (field.type) {
        case "number":
            return {
                type: "number",
                value: field.value,
            };
        case "string":
            return {
                type: "string",
                value: field.value,
            };
        case "columnRef":
            return context.data.object[field.columnName];

        case "boolean":
            return {
                type: "boolean",
                value: field.value,
            };
        default:
            throw new Error("Invalid field type");
    }
}

const processNotExpression = (notExpression: NotExpression, context: Context): boolean => {
    const { expression } = notExpression;
    return !processUnitExpression(expression, context);
}

const processAndExpression = (andExpression: AndExpression, left: boolean, context: Context): boolean => {
    const { right } = andExpression;
    return left && processLogicalExpression(right, context);
}

const processOrExpression = (orExpression: OrExpression, left: boolean, context: Context): boolean => {
    const { right } = orExpression;
    return left || processLogicalExpression(right, context);
}
