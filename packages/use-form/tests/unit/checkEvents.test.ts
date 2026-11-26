import { test, expect, mock } from 'bun:test';

import { createCheckEvents, type EventRecord, type EventRequests } from '../../src/checkEvents';

test('a body that asks for no check runs no pass', () => {
  const events = createCheckEvents();
  const pass = mock(() => {});
  events.run(() => {}, pass);
  expect(pass).not.toHaveBeenCalled();
});

test('the outermost pass runs once, after the body, with what every nested body recorded', () => {
  const events = createCheckEvents();
  const order: string[] = [];
  const inner = mock(() => {});
  const pass = mock((record: EventRecord) => {
    order.push('pass');
    expect([...record.paths]).toEqual(['a', 'b']);
  });
  events.run((requests) => {
    requests.check(['a']);
    events.run((nested) => nested.check(['b']), inner);
    order.push('body');
  }, pass);
  expect(order).toEqual(['body', 'pass']);
  expect(pass).toHaveBeenCalledTimes(1);
  expect(inner).not.toHaveBeenCalled();
});

test('a body that throws runs no pass, and the next event starts fresh', () => {
  const events = createCheckEvents();
  const boom = new Error('boom');
  const pass = mock((_record: EventRecord) => {});

  expect(() =>
    events.run((requests) => {
      requests.check(['a']);
      throw boom;
    }, pass),
  ).toThrow(boom);
  expect(pass).not.toHaveBeenCalled();

  events.run(() => {}, pass);
  expect(pass).not.toHaveBeenCalled();

  events.run((requests) => requests.check(), pass);
  expect(pass).toHaveBeenCalledTimes(1);
  expect([...pass.mock.calls[0]![0].paths]).toEqual([]);
});

test('a throw from the pass reaches the caller, and the next event still runs its pass', () => {
  const events = createCheckEvents();
  const boom = new Error('boom');
  const asksForCheck = (requests: EventRequests) => requests.check();

  expect(() =>
    events.run(asksForCheck, () => {
      throw boom;
    }),
  ).toThrow(boom);

  const pass = mock(() => {});
  events.run(asksForCheck, pass);
  expect(pass).toHaveBeenCalledTimes(1);
});

test('a call made from inside the pass is an event of its own', () => {
  const events = createCheckEvents();
  const inner = mock(() => {});
  events.run(
    (requests) => requests.check(),
    () => events.run((requests) => requests.check(), inner),
  );
  expect(inner).toHaveBeenCalledTimes(1);
});

test('every request asks for a schema check: a check of paths, and a follow that re-checks fields and clears all', () => {
  const events = createCheckEvents();
  const pass = mock((_record: EventRecord) => {});

  events.run((requests) => requests.check(['a']), pass);
  expect(pass.mock.calls[0]![0].clearAll).toBe(false);
  expect([...pass.mock.calls[0]![0].fields]).toEqual([]);

  events.run((requests) => requests.recheckAfterFollow([]), pass);
  expect(pass).toHaveBeenCalledTimes(2);

  events.run((requests) => requests.recheckAfterFollow(['x', 'y']), pass);
  expect(pass.mock.calls[2]![0].clearAll).toBe(true);
  expect([...pass.mock.calls[2]![0].paths]).toEqual([]);
  expect([...pass.mock.calls[2]![0].fields]).toEqual(['x', 'y']);
});
