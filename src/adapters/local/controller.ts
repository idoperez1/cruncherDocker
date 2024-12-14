import { QueryOptions, QueryProvider } from "~core/common/interface";
import { asNumberField, Field, ObjectFields, ProcessedData } from "~core/common/logTypes";

const tagsOptions = ["nice", "developer", "trash collector"];
const data = [
    {
        key: "1",
        name: "John Brown",
        age: 32,
        address: "New York No. 1 Lake Park",
        tags: ["nice", "developer"],
    },
];

for (let i = 2; i <= 100000; i++) {
    const randomTags = [
        tagsOptions[Math.floor(Math.random() * tagsOptions.length)],
        tagsOptions[Math.floor(Math.random() * tagsOptions.length)],
    ];

    // generate random field keys
    const fields = {};

    const randomFieldsCount = Math.floor(Math.random() * 10) + 1;
    for (let j = 0; j < randomFieldsCount; j++) {
        // @ts-expect-error
        fields[`field${j}`] = `value${j}`;
    }


    data.push({
        key: i.toString(),
        name: `Name ${i}`,
        age: 20 + (i % 50),
        address: `Address ${i}`,
        tags: randomTags,
        ...fields,
    });
}

const processField = (field: any): Field => {
    if (typeof field === "number") {
        return {
            type: "number",
            value: field,
        };
    } else if (field instanceof Date) {
        return {
            type: "date",
            value: field.getTime(),
        };
    } else if (typeof field === "boolean") {
        return {
            type: "boolean",
            value: field,
        };
    } else if (Array.isArray(field)) {
        return {
            type: "array",
            value: field.map((item) => processField(item)),
        };
    } else if (typeof field === "object") {
        const objectFields: ObjectFields = {};

        Object.entries(field).forEach(([key, value]) => {
            objectFields[key] = processField(value);
        });

        return {
            type: "object",
            value: objectFields,
        };
    }

    // try to parse as number
    if (/^\d+(?:\.\d+)?$/.test(field)) {
        return {
            type: "number",
            value: parseFloat(field),
        };
    }

    return {
        type: "string",
        value: field,
    };
}

// Used for testing purposes
export const MockController = {
    query: async (searchTerm: string[], options: QueryOptions): Promise<void> => {
        return new Promise((resolve, reject) => {
            // filter using the search term
            const filteredData = data.filter((item) => {
                if (searchTerm.length === 0) {
                    return true;
                }

                return searchTerm.some((term) => {
                    return item.name.includes(term) || item.address.includes(term) || item.tags.some((tag) => tag.includes(term));
                });
            });

            const fromTime = options.fromTime;
            const toTime = options.toTime;


            // convert the data to ProcessedData
            const result = filteredData.map<ProcessedData>((item) => {
                // get random time between fromTime and toTime
                const randomTime = Math.floor(Math.random() * (toTime.getTime() - fromTime.getTime())) + fromTime.getTime();
                const fields: ObjectFields = {
                    _time: {
                        type: "date",
                        value: randomTime,
                    },
                    _raw: {
                        type: "string",
                        value: JSON.stringify(item),
                    }
                };
                Object.entries(item).forEach(([key, value]) => {
                    fields[key] = processField(value);
                });

                return {
                    object: fields,
                    message: `Name: ${item.name}, Age: ${item.age}, Address: ${item.address}, Tags: ${item.tags.join(", ")}`,
                };
            });

            // sort by timestamp
            result.sort((a, b) => {
                return asNumberField(b.object._time).value - asNumberField(a.object._time).value;
            });

            // randomize a delay between 1 - 3 seconds
            const delay = Math.floor(Math.random() * 1000) + 500;

            // simulate a delay - and listen to options.cancelToken as well - reject if cancelled
            const timeout = setTimeout(() => {
                options.onBatchDone(result);
                resolve();
            }, delay);

            options.cancelToken.addEventListener("abort", () => {
                clearTimeout(timeout);
                reject("Query cancelled");
            });
        });
    },
} satisfies QueryProvider;
