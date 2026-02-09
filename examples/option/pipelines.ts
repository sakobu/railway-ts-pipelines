import { pipe } from '@/composition';
import { filterWith, flatMapWith, fromNullable, mapWith, match, tapWith, unwrapOr, type Option } from '@/option';

// === mapWith: Point-Free Transform ===
console.log('=== mapWith: Point-Free Transform ===');

type User = { name: string; email?: string };

const userWithEmail: User = { name: 'Alice', email: 'ALICE@EXAMPLE.COM' };
const userNoEmail: User = { name: 'Bob' };

const getEmail = (user: User) =>
  pipe(
    fromNullable(user.email),
    mapWith((email) => email.toLowerCase()),
    (opt) => unwrapOr(opt, 'no-email@example.com'),
  );

console.log('mapWith some:', getEmail(userWithEmail)); // "alice@example.com"
console.log('mapWith none:', getEmail(userNoEmail)); // "no-email@example.com"

// === flatMapWith: Chain Optional Lookups ===
console.log('\n=== flatMapWith: Chain Optional Lookups ===');

type Department = { name: string; managerId?: number };
type Company = { departments: Record<string, Department> };

const company: Company = {
  departments: {
    engineering: { name: 'Engineering', managerId: 1 },
    marketing: { name: 'Marketing' }, // no manager
  },
};

const employees: Record<number, User> = {
  1: { name: 'Alice', email: 'alice@company.com' },
};

const getDepartment = (name: string): Option<Department> => fromNullable(company.departments[name]);
const getManager = (dept: Department): Option<User> =>
  fromNullable(dept.managerId ? employees[dept.managerId] : undefined);

const managerName = (deptName: string) =>
  pipe(
    getDepartment(deptName),
    flatMapWith(getManager),
    mapWith((user) => user.name),
    (opt) => unwrapOr(opt, 'No manager'),
  );

console.log('flatMapWith found:', managerName('engineering')); // "Alice"
console.log('flatMapWith no manager:', managerName('marketing')); // "No manager"
console.log('flatMapWith no dept:', managerName('sales')); // "No manager"

// === filterWith: Conditional Narrowing ===
console.log('\n=== filterWith: Conditional Narrowing ===');

const nonEmpty = filterWith((s: string) => s.length > 0);

const validEmail = pipe(
  fromNullable(userWithEmail.email),
  mapWith((email) => email.trim()),
  nonEmpty,
  mapWith((email) => email.toLowerCase()),
  (opt) => unwrapOr(opt, 'no-email'),
);
console.log('filterWith passes:', validEmail); // "alice@example.com"

const emptyString = pipe(
  fromNullable('   '),
  mapWith((s) => s.trim()),
  nonEmpty,
  (opt) =>
    match(opt, {
      some: (value) => `Got: "${value}"`,
      none: () => 'Empty after trim',
    }),
);
console.log('filterWith rejects:', emptyString); // "Empty after trim"

// === tapWith: Side Effects ===
console.log('\n=== tapWith: Side Effects ===');

const auditLog: string[] = [];

const processUser = (deptName: string) =>
  pipe(
    getDepartment(deptName),
    flatMapWith(getManager),
    tapWith((user) => auditLog.push(`Accessed: ${user.name}`)),
    mapWith((user) => user.name),
    (opt) => unwrapOr(opt, 'Unknown'),
  );

processUser('engineering');
processUser('sales'); // None — tap is skipped

console.log('Audit log:', auditLog); // ["Accessed: Alice"]

// === Full Example: Safe Config Access ===
console.log('\n=== Full Example: Safe Config Access ===');

type Config = {
  database?: {
    host?: string;
    port?: number;
  };
};

const config: Config = { database: { host: '  localhost  ', port: 5432 } };
const emptyConfig: Config = {};

const getDbHost = (cfg: Config) =>
  pipe(
    fromNullable(cfg.database),
    flatMapWith((db) => fromNullable(db.host)),
    mapWith((host) => host.trim()),
    filterWith((host) => host.length > 0),
    (opt) => unwrapOr(opt, '127.0.0.1'),
  );

console.log('DB host:', getDbHost(config)); // "localhost"
console.log('DB host (empty):', getDbHost(emptyConfig)); // "127.0.0.1"
