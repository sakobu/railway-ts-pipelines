import { test, expect, mock } from 'bun:test';

import { createCheckEvents, type EventRecord } from '../../src/checkEvents';

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
  events.run((record) => {
    record.schema = true;
    record.paths.add('a');
    events.run((nested) => void nested.paths.add('b'), inner);
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
    events.run((record) => {
      record.schema = true;
      record.paths.add('a');
      throw boom;
    }, pass),
  ).toThrow(boom);
  expect(pass).not.toHaveBeenCalled();

  events.run(() => {}, pass);
  expect(pass).not.toHaveBeenCalled();

  events.run((record) => {
    record.schema = true;
  }, pass);
  expect(pass).toHaveBeenCalledTimes(1);
  expect([...pass.mock.calls[0]![0].paths]).toEqual([]);
});

test('a throw from the pass reaches the caller, and the next event still runs its pass', () => {
  const events = createCheckEvents();
  const boom = new Error('boom');
  const asksForCheck = (record: EventRecord) => {
    record.schema = true;
  };

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
    (record) => {
      record.schema = true;
    },
    () =>
      events.run((record) => {
        record.schema = true;
      }, inner),
  );
  expect(inner).toHaveBeenCalledTimes(1);
});
