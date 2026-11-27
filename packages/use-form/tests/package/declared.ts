// A library that exports a withDeps validator and emits declarations, type-checked by `bun run test:package`. It
// imports withDeps alone, so its declaration can name FieldValidatorWithDeps only through the package's exports.
import { withDeps } from '@railway-ts/use-form';

type Project = { workspaceId: number; slug: string };

export const slugFree = withDeps<Project, string, readonly ['workspaceId']>(['workspaceId'], (slug, { workspaceId }) =>
  workspaceId > 0 && slug ? undefined : 'taken',
);
