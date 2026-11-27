// A consumer of the built package, type-checked by `bun run test:package`: every type a documented signature names
// is importable.
import type { DepValues, FieldTypeAtPath, FieldValidatorAnswer, FieldValidatorWithDeps } from '@railway-ts/use-form';

type Project = { workspaceId: number; slug: string; billing?: { country: string } };

export type Named = [
  DepValues<Project, readonly ['workspaceId']>,
  FieldValidatorWithDeps<Project, string>,
  FieldValidatorAnswer,
  FieldTypeAtPath<Project, 'billing.country'>,
];
