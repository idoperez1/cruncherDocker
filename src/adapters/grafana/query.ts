const buildExpression = (baseFilter: string, search: string[], filterExtensions?: string[]) => {
  const terms = [
    baseFilter,
  ];
  search.forEach((term) => {
    terms.push(`|= \`${term}\``);
  });

  terms.push(
    "| json",
  );

  if (filterExtensions) {
    terms.push(...(filterExtensions ?? []));    
  }

  return terms.join("\n");
};

export const buildQuery = (uid: string, baseFilter: string, search: string[], fromTime: Date, toTime: Date, filterExtensions?: string[]) => {
  return {
    queries: [
      {
        refId: "A",
        expr: buildExpression(baseFilter, search, filterExtensions),
        queryType: "range",
        datasource: {
          type: "loki",
          uid: uid,
        },
        editorMode: "code",
        maxLines: 5000,
        step: "",
        legendFormat: "",
        datasourceId: 7,
        intervalMs: 60000,
        maxDataPoints: 1002,
      },
    ],
    from: fromTime.getTime().toString(),
    to: toTime.getTime().toString(),
  };
};
