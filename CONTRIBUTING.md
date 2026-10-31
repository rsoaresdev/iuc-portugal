# Contributing

Thank you for helping. Issues and pull requests are welcome, in English or Portuguese.

## A wrong amount

Open an issue with the vehicle (category, year and month of first registration, fuel, engine size, CO2 and cycle), the amount this package gives and the amount the Portal das Finanças gives. That is the most useful report there is.

## A new year's rates

When a State Budget (Orçamento do Estado) changes a table:

1. Change the table in `src/tables.ts` and name the law in its comment.
2. Add a test in `test/iuc.test.ts` with a published example for the new rates.
3. Add a `CHANGELOG.md` entry.

## Development

Development needs Node 22.18 or later (the build and test tools require it). The published package runs on Node 20 and later, which CI checks with `npm run smoke`.

```bash
npm install
npm run coverage
npm run lint
npm run typecheck
npm run build && npm run check:package
```

`npm run format` fixes the formatting.
