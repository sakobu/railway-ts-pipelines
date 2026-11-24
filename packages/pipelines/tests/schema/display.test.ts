import { describe, expect, test } from 'bun:test';
import path from 'node:path';

import ts from 'typescript';

// Prints the type of each export in display-fixture.ts as an editor's hover shows it, so an internal helper
// alias (such as ValidatorMapOutput<…>) doesn't stand in for the type a user reads.
const printedTypes = (): Record<string, string> => {
  const config = ts.getParsedCommandLineOfConfigFile(
    path.join(import.meta.dir, '../../tsconfig.json'),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );
  const fixture = path.join(import.meta.dir, 'display-fixture.ts');
  const program = ts.createProgram([fixture], { ...config!.options, noEmit: true });
  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(fixture)!)!;
  return Object.fromEntries(
    checker
      .getExportsOfModule(moduleSymbol)
      .map((symbol) => [
        symbol.name,
        checker.typeToString(checker.getTypeOfSymbol(symbol), undefined, ts.TypeFormatFlags.NoTruncation),
      ]),
  );
};

describe('printed types', () => {
  const printed = printedTypes();
  const shapes = '{ type: "circle"; r: number; } | { type: "square"; s: number; }';

  test('InferSchemaType of a discriminatedUnion prints the union of its members', () => {
    expect(printed['shapeValue']).toBe(shapes);
  });

  test('InferSchemaType of an object() holding a discriminatedUnion prints the union', () => {
    expect(printed['holderValue']).toBe(`{ shape: ${shapes}; }`);
  });

  test('a discriminatedUnion validator prints the union as its output', () => {
    expect(printed['shapeValidator']).toBe(`Validator<unknown, ${shapes}>`);
  });
});
