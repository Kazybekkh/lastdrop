import { expect, it, vi } from 'vitest';
import { DEFAULT_DEMO_CONFIG } from './grok-demo';

const modulePath = '../scripts/grok-round.mjs';
const { createRoundController } = await import(modulePath);
const members = [
  { id: 'merchant-1', name: 'Merchant', role: 'merchant' },
  { id: 'denim-1', name: 'Denim', role: 'denim' },
  { id: 'bargain-1', name: 'Bargain', role: 'bargain' },
  { id: 'premium-1', name: 'Premium', role: 'premium' },
];
type Entry = { id: string; kind: string; author: unknown; text: string; streaming?: boolean };
function harness(saved?: unknown) {
  let entries: Entry[] = [];
  let memberIds = members.map(member => member.id);
  let running: boolean | null | undefined = false;
  let stored = saved;
  const save = vi.fn(async (value: unknown) => { stored = structuredClone(value); });
  const native = () => ({ group: { id: 'room-1', name: 'Room', isGroup: true, memberIds: [...memberIds], isRunning: running }, members: members.filter(member => memberIds.includes(member.id)) });
  const cli = vi.fn(async (args: string[]) => {
    if (args[0] === 'group-info') return native();
    if (args[0] === 'transcript') return { agent: { id: 'room-1', isRunning: running }, entries };
    if (args[0] === 'send') return { accepted: true };
    if (args[0] === 'group-remove-member') {
      const removedMemberIds = args.slice(3).filter((_, index) => index % 2 === 1);
      memberIds = memberIds.filter(id => !removedMemberIds.includes(id));
      return { ...native(), removedMemberIds, alreadyAbsentMemberIds: [], removed: true };
    }
    throw new Error(`Unexpected CLI command: ${args[0]}`);
  });
  const controller = createRoundController({ cli, save, load: async () => stored, now: () => Date.UTC(2026, 8, 26) });
  return {
    controller, cli, save,
    entries: (value: Entry[]) => { entries = value; },
    running: (value: boolean | null | undefined) => { running = value; },
    membership: (value: string[]) => { memberIds = value; },
    stored: () => stored,
    start: (config = DEFAULT_DEMO_CONFIG) => controller.start({ botId: 'room-1', config, members }),
    sends: () => cli.mock.calls.filter(([args]) => args[0] === 'send'),
    removals: () => cli.mock.calls.filter(([args]) => args[0] === 'group-remove-member'),
  };
}
function action(id: string, roundId: string, role: string, payload: Record<string, unknown>, kind = 'send-message'): Entry {
  const member = members.find(member => member.role === role)!;
  return { id, kind, author: { id: member.id, name: member.name }, text: `My own action.\n[[LASTDROP:${JSON.stringify({ roundId, ...payload })}]]` };
}
function offer(id: string, roundId: string, role: string, quantity = 300, unitPricePence = 3000) {
  return action(id, roundId, role, { type: 'offer', quantity, unitPricePence });
}
const human = (id: string, text: string): Entry => ({ id, kind: 'message', author: 'user', text });
const lot = (roundId: string) => `LD-${roundId.slice(0, 8).toUpperCase()}`;
function readable(id: string, role: string, text: string): Entry {
  const member = members.find(member => member.role === role)!;
  return { id, kind: 'send-message', author: { id: member.id, name: member.name }, text };
}

it('runs readable native offers through human approval, a verified receipt and real departures', async () => {
  const h = harness(); const { roundId } = await h.start();
  const entries = [readable('offer', 'denim', `I can take the whole lot.\nOffer for lot ${lot(roundId)}: 300 units at GBP 30.01 each.`)];
  h.entries(entries); await h.controller.tick();
  expect((await h.controller.state('room-1')).offers[0]).toMatchObject({ quantity: 300, unitPricePence: 3001, totalPence: 900300 });
  entries.push(human('approve', 'approve'));
  h.entries(entries); await h.controller.tick();
  const approved = await h.controller.state('room-1');
  const receipt = `Deal confirmed for lot ${lot(roundId)}: 300 units for GBP 9003.00. Confirmation C-${approved.approval.id.slice(0, 8).toUpperCase()}.`;
  entries.push(
    readable('wrong-author', 'bargain', receipt),
    readable('wrong-total', 'merchant', receipt.replace('9003.00', '9000.00')),
    readable('wrong-quantity', 'merchant', receipt.replace('300 units', '299 units')),
    readable('wrong-reference', 'merchant', receipt.replace(/C-[A-F0-9]{8}/, 'C-WRONGREF')),
  );
  h.entries(entries); await h.controller.tick();
  expect((await h.controller.state('room-1')).status).toBe('awaiting-ack');
  expect(h.removals()).toHaveLength(0);
  entries.push(readable('receipt', 'merchant', `Denim takes all 300. No real order has been placed.\n${receipt}`));
  h.entries(entries); await h.controller.tick();
  const closed = await h.controller.state('room-1');
  expect(closed.approval.acknowledged).toBe(true);
  expect(closed.status).toBe('closed');
  expect(closed.members.filter((member: { removal?: string }) => member.removal === 'removed')).toHaveLength(2);
});

it('accepts readable self-withdrawal only from that reseller and removes their own offer', async () => {
  const h = harness(); const { roundId } = await h.start();
  const withdrawal = `I withdraw from lot ${lot(roundId)}: The margin does not work for me.`;
  h.entries([readable('offer', 'denim', `Offer for lot ${lot(roundId)}: 300 units at GBP 30.00 each.`), readable('merchant-cannot-withdraw', 'merchant', withdrawal)]);
  await h.controller.tick(); expect((await h.controller.state('room-1')).offers).toHaveLength(1);
  h.entries([readable('withdraw', 'denim', withdrawal)]); await h.controller.tick();
  const state = await h.controller.state('room-1');
  expect(state.offers).toHaveLength(0);
  expect(state.members.find((member: { role: string }) => member.role === 'denim')).toMatchObject({ state: 'withdrawn', removal: 'removed', reason: 'The margin does not work for me.' });
});

it('rejects quoted, stale, streaming, malformed, duplicated and mixed-format readable actions', async () => {
  const h = harness(); const { roundId } = await h.start();
  const line = `Offer for lot ${lot(roundId)}: 300 units at GBP 30.00 each.`;
  const badTexts = [
    '> ' + line, '```\n' + line + '\n```', line + '\nStill considering.',
    line.replace(lot(roundId), 'LD-STALELOT'), line.replace('30.00', '30.001'),
    line.replace('300 units', '2.5 units'), line + '\n' + line,
    line + '\n' + offer('legacy', roundId, 'denim').text,
    offer('legacy', roundId, 'denim').text + '\n' + line,
  ];
  const valid = readable('valid', 'denim', line);
  h.entries([...badTexts.map((text, index) => readable(`bad-${index}`, 'denim', text)),
    { ...valid, id: 'unknown', author: { id: 'intruder', name: 'Denim' } },
    { ...valid, id: 'human', author: 'user' },
    { ...valid, id: 'tool', kind: 'tool-result' }, { ...valid, streaming: true }]);
  await h.controller.tick(); expect((await h.controller.state('room-1')).offers).toEqual([]);
  h.entries([valid]); await h.controller.tick(); expect((await h.controller.state('room-1')).offers).toHaveLength(1);
});

it('verifies exactly four role identities and excludes the historical baseline', async () => {
  const h = harness();
  h.entries([human('past-approval', 'approve')]);
  const round = await h.start();
  expect(round.status).toBe('negotiating');
  expect(round.startedAt).toBe('2026-09-26T00:00:00.000Z');
  expect(round).not.toHaveProperty('seenIds');
  const prompt = h.sends()[0][0][4];
  expect(prompt).toContain(`LD-${round.roundId.slice(0, 8).toUpperCase()}`);
  expect(prompt).toContain('Choose your own offers');
  expect(prompt).toContain('QUANTITY units at GBP PRICE each.');
  expect(prompt).not.toContain('[[LASTDROP:');
  h.entries([human('past-approval', 'approve'), offer('new-offer', round.roundId, 'denim')]);
  await h.controller.tick();
  expect((await h.controller.state('room-1')).status).toBe('negotiating');
  expect((await h.controller.state('room-1')).offers).toHaveLength(1);
  await expect(h.start()).rejects.toMatchObject({ status: 409 });
});

it('rejects invalid config, role maps and forged native membership before sending', async () => {
  for (const config of [
    { ...DEFAULT_DEMO_CONFIG, quantity: 3.2 },
    { ...DEFAULT_DEMO_CONFIG, quantity: 10001 },
    { ...DEFAULT_DEMO_CONFIG, premiumMaxQuantity: 301 },
    { ...DEFAULT_DEMO_CONFIG, floorPricePence: 9999 },
    { ...DEFAULT_DEMO_CONFIG, bargainBudgetPence: -1 },
  ]) {
    const h = harness(); await expect(h.start(config)).rejects.toThrow(); expect(h.sends()).toHaveLength(0);
  }
  const h = harness();
  await expect(h.controller.start({ botId: 'room-1', config: DEFAULT_DEMO_CONFIG, members: members.map(member => ({ ...member, role: 'merchant' })) })).rejects.toThrow();
  h.membership(['merchant-1', 'denim-1', 'bargain-1']);
  await expect(h.start()).rejects.toThrow();
  expect(h.sends()).toHaveLength(0);
});

it('ignores unknown authors, user/tool markers, other rounds and quoted marker examples', async () => {
  const h = harness(); const { roundId } = await h.start();
  const valid = offer('valid', roundId, 'denim');
  h.entries([
    { ...valid, id: 'unknown', author: { id: 'intruder', name: 'Denim' } },
    { ...valid, id: 'user-marker', author: 'user' },
    { ...valid, id: 'tool-marker', kind: 'tool-result' },
    offer('old-round', 'old-round', 'denim'),
    { ...valid, id: 'quoted', text: valid.text.replace('[[LASTDROP:', '> [[LASTDROP:') },
    { ...valid, id: 'code', text: '```\n' + valid.text + '\n```' },
    offer('merchant-offer', roundId, 'merchant'),
    valid,
  ]);
  await h.controller.tick();
  expect((await h.controller.state('room-1')).offers.map((row: { id: string }) => row.id)).toEqual(['valid']);
});

it('uses latest valid live offers and chooses the highest compatible split recovery', async () => {
  const h = harness(); const { roundId } = await h.start();
  h.entries([
    offer('denim-old', roundId, 'denim', 300, 2800),
    offer('denim-latest', roundId, 'denim', 300, 3300),
    offer('bargain', roundId, 'bargain', 180, 2800),
    offer('premium', roundId, 'premium', 120, 4400),
  ]);
  await h.controller.tick();
  const state = await h.controller.state('room-1');
  expect(state.offers.map((row: { id: string }) => row.id)).toEqual(['denim-latest', 'bargain', 'premium']);
  expect(state.bestOfferIds).toEqual(['bargain', 'premium']);
  expect(h.sends()).toHaveLength(1);
  await expect(h.controller.approve({ botId: 'room-1', roundId, offerIds: ['denim-latest', 'premium'] })).rejects.toThrow('more units');
});

it('rejects floors, budgets, premium capacity and noninteger values', async () => {
  const h = harness(); const { roundId } = await h.start();
  h.entries([
    offer('below-floor', roundId, 'denim', 300, 2100),
    offer('over-budget', roundId, 'bargain', 300, 3000),
    offer('over-capacity', roundId, 'premium', 121, 3000),
    offer('not-integer', roundId, 'denim', 2.5, 2200),
  ]);
  await h.controller.tick();
  const state = await h.controller.state('room-1');
  expect(state.offers).toEqual([]); expect(Object.keys(state.offerIssues)).toHaveLength(3);
  await expect(h.controller.approve({ botId: 'room-1', roundId, offerIds: ['over-budget'] })).rejects.toMatchObject({ status: 409 });
});

it('refreshes before explicit approval and rejects changed, duplicate, stale or withdrawn offers', async () => {
  const h = harness(); const { roundId } = await h.start();
  h.entries([offer('initial', roundId, 'denim')]); await h.controller.tick();
  h.entries([offer('initial', roundId, 'denim'), offer('new', roundId, 'denim', 300, 3300)]);
  await expect(h.controller.approve({ botId: 'room-1', roundId, offerIds: ['initial'] })).rejects.toMatchObject({ status: 409 });
  await expect(h.controller.approve({ botId: 'room-1', roundId: 'old-round', offerIds: ['new'] })).rejects.toMatchObject({ status: 409 });
  await expect(h.controller.approve({ botId: 'room-1', roundId, offerIds: ['new', 'new'] })).rejects.toThrow('distinct');
  h.entries([offer('new', roundId, 'denim'), action('withdraw', roundId, 'denim', { type: 'withdraw' })]);
  await expect(h.controller.approve({ botId: 'room-1', roundId, offerIds: ['new'] })).rejects.toMatchObject({ status: 409 });
  expect(h.sends()).toHaveLength(1);
});

it('requires exact fresh human approval, freezes the then-current best and sends once when idle', async () => {
  const h = harness(); const { roundId } = await h.start();
  const entries = [offer('denim', roundId, 'denim'), human('not-exact', 'I might approve later'), human('question', 'approve?'), human('question-best', 'approve best deal?'), { ...human('bot-approval', 'approve'), author: { id: 'merchant-1', name: 'Merchant' } }];
  h.entries(entries); await h.controller.tick();
  expect((await h.controller.state('room-1')).approval).toBeUndefined();
  h.running(true);
  h.entries([...entries, human('yes', 'APPROVE best deal!'), offer('too-late', roundId, 'denim', 300, 3200)]);
  await h.controller.tick();
  expect((await h.controller.state('room-1')).approval.offerIds).toEqual(['denim']);
  expect(h.sends()).toHaveLength(1);
  h.running(false); await h.controller.tick(); await h.controller.tick();
  const state = await h.controller.state('room-1');
  expect(state.status).toBe('awaiting-ack');
  expect(state.approval.acknowledged).toBe(false);
  expect(h.sends()).toHaveLength(2);
  expect(h.sends()[1][0][4]).toContain(`C-${state.approval.id.slice(0, 8).toUpperCase()}`);
  expect(h.sends()[1][0][4]).not.toContain('[[LASTDROP:');
  expect(h.removals()).toHaveLength(0);
});

it('closes only on the real merchant matching acknowledgement and removes losers after idle', async () => {
  const h = harness(); const { roundId } = await h.start();
  const entries = [offer('denim', roundId, 'denim')]; h.entries(entries); await h.controller.tick();
  const approved = await h.controller.approve({ botId: 'room-1', roundId, offerIds: ['denim'] });
  const marker = { type: 'deal_ack', approvalId: approved.approval.id };
  h.entries([...entries, action('spoof-ack', roundId, 'bargain', marker), action('old-ack', roundId, 'merchant', { ...marker, approvalId: 'wrong' })]);
  await h.controller.tick(); expect((await h.controller.state('room-1')).status).toBe('awaiting-ack');
  h.running(true); h.entries([...entries, action('ack', roundId, 'merchant', marker)]);
  await h.controller.tick();
  expect((await h.controller.state('room-1')).status).toBe('closed'); expect(h.removals()).toHaveLength(0);
  h.running(false); await h.controller.tick();
  const closed = await h.controller.state('room-1');
  expect(closed.members.find((row: { role: string }) => row.role === 'denim').state).toBe('won');
  expect(closed.members.filter((row: { removal: string }) => row.removal === 'removed')).toHaveLength(2);
  expect(h.removals()[0][0]).toEqual(['group-remove-member', '--id', 'room-1', '--member-id', 'bargain-1', '--member-id', 'premium-1']);
  const calls = h.cli.mock.calls.length; await h.controller.tick(); expect(h.cli.mock.calls).toHaveLength(calls);
});

it('lets a reseller autonomously withdraw, cancels their offer and verifies actual removal', async () => {
  const h = harness(); const { roundId } = await h.start(); h.running(true);
  const entries = [offer('denim', roundId, 'denim'), action('withdraw', roundId, 'denim', { type: 'withdraw', reason: 'Margin is too small.' })];
  h.entries(entries); await h.controller.tick();
  let state = await h.controller.state('room-1');
  expect(state.offers).toHaveLength(0);
  expect(state.members.find((row: { role: string }) => row.role === 'denim').removal).toBe('pending');
  h.running(false); await h.controller.tick(); await h.controller.tick();
  state = await h.controller.state('room-1');
  expect(state.members.find((row: { role: string }) => row.role === 'denim')).toMatchObject({ state: 'withdrawn', removal: 'removed', reason: 'Margin is too small.' });
  expect(h.removals()).toHaveLength(1);
});

it('does not claim removal on unverified success and never blindly repeats the mutation', async () => {
  const h = harness(); const { roundId } = await h.start();
  const original = h.cli.getMockImplementation()!;
  h.cli.mockImplementation(async args => args[0] === 'group-remove-member' ? { group: { id: 'room-1', name: 'Room', isGroup: true, memberIds: members.map(row => row.id), isRunning: false }, members, removedMemberIds: ['denim-1'], alreadyAbsentMemberIds: [], removed: true } : original(args));
  h.entries([action('withdraw', roundId, 'denim', { type: 'withdraw' })]);
  await h.controller.tick(); await h.controller.tick();
  const state = await h.controller.state('room-1');
  expect(state.members.find((row: { role: string }) => row.role === 'denim').removal).toBe('failed');
  expect(state.error).toContain('could not be verified'); expect(h.removals()).toHaveLength(1);
});

it('persists approval intent before sending and never resends uncertain acceptance after restart', async () => {
  const h = harness(); const { roundId } = await h.start();
  h.entries([offer('denim', roundId, 'denim')]); await h.controller.tick();
  const original = h.cli.getMockImplementation()!;
  h.cli.mockImplementation(async args => {
    if (args[0] === 'send') {
      const persisted = h.stored() as { rounds: { approvalDelivery: string; approval: unknown }[] };
      expect(persisted.rounds[0].approvalDelivery).toBe('sending');
      expect(persisted.rounds[0].approval).toBeDefined();
      throw new Error('Transport disconnected');
    }
    return original(args);
  });
  await expect(h.controller.approve({ botId: 'room-1', roundId, offerIds: ['denim'] })).rejects.toMatchObject({ status: 502 });
  const restarted = harness(h.stored());
  restarted.entries([offer('denim', roundId, 'denim'), human('again', 'approve')]);
  await restarted.controller.tick();
  expect(restarted.sends()).toHaveLength(0);
  expect((await restarted.controller.state('room-1')).error).toContain('will not resend');
});

it('does not replay seen offers or approvals when an old entry falls out of the transcript window', async () => {
  const h = harness(); const { roundId } = await h.start();
  h.entries([offer('offer', roundId, 'denim'), action('withdraw', roundId, 'denim', { type: 'withdraw' })]);
  await h.controller.tick();
  const restarted = harness(h.stored());
  restarted.membership(['merchant-1', 'bargain-1', 'premium-1']);
  restarted.entries([offer('offer', roundId, 'denim')]);
  await restarted.controller.tick();
  expect((await restarted.controller.state('room-1')).offers).toHaveLength(0);
  expect(restarted.removals()).toHaveLength(0);
});


it('waits for final streamed message text before consuming its entry ID', async () => {
  const h = harness(); const { roundId } = await h.start();
  h.entries([{ ...offer('streaming', roundId, 'denim'), streaming: true }]);
  await h.controller.tick(); expect((await h.controller.state('room-1')).offers).toHaveLength(0);
  h.entries([offer('streaming', roundId, 'denim')]);
  await h.controller.tick(); expect((await h.controller.state('room-1')).offers).toHaveLength(1);
});

it('reconciles uncertain native removal after restart by reading membership without resending', async () => {
  const h = harness(); const { roundId } = await h.start();
  const original = h.cli.getMockImplementation()!;
  h.cli.mockImplementation(async args => {
    if (args[0] === 'group-remove-member') throw new Error('Connection lost');
    return original(args);
  });
  h.entries([action('withdraw', roundId, 'denim', { type: 'withdraw' })]); await h.controller.tick();
  const restarted = harness(h.stored());
  restarted.membership(['merchant-1', 'bargain-1', 'premium-1']);
  await restarted.controller.tick();
  expect((await restarted.controller.state('room-1')).members.find((row: { role: string }) => row.role === 'denim').removal).toBe('removed');
  expect(restarted.removals()).toHaveLength(0);
});


it('clears a transient transcript error after a successful poll without freezing approval', async () => {
  const h = harness(); const { roundId } = await h.start();
  h.entries([offer('offer', roundId, 'denim')]);
  h.cli.mockRejectedValueOnce(new Error('Temporary read failure'));
  await h.controller.tick(); expect((await h.controller.state('room-1')).error).toBe('Temporary read failure');
  await h.controller.tick();
  expect((await h.controller.state('room-1')).error).toBeUndefined();
  expect((await h.controller.approve({ botId: 'room-1', roundId, offerIds: ['offer'] })).status).toBe('awaiting-ack');
});

it('closes without a deal only after every autonomous withdrawal is verified', async () => {
  const h = harness(); const { roundId } = await h.start();
  h.running(true);
  h.entries(['denim', 'bargain', 'premium'].map(role => action(`withdraw-${role}`, roundId, role, { type: 'withdraw' })));
  await h.controller.tick(); expect((await h.controller.state('room-1')).status).toBe('negotiating');
  h.running(false); await h.controller.tick();
  const state = await h.controller.state('room-1');
  expect(state.status).toBe('closed'); expect(state.approval).toBeUndefined();
  expect(state.closedReason).toBe('All resellers withdrew.');
  expect(h.removals()).toHaveLength(1);
  const calls = h.cli.mock.calls.length; await h.controller.tick(); expect(h.cli.mock.calls).toHaveLength(calls);
});


it('does not start, send approval or remove members while native activity is unknown', async () => {
  for (const unknown of [null, undefined]) {
    const h = harness(); h.running(unknown);
    await expect(h.start()).rejects.toMatchObject({ status: 409 }); expect(h.sends()).toHaveLength(0);
    h.running(false); const { roundId } = await h.start();
    h.entries([offer('offer', roundId, 'denim')]); await h.controller.tick();
    h.running(unknown);
    const approved = await h.controller.approve({ botId: 'room-1', roundId, offerIds: ['offer'] });
    expect(approved.approvalDelivery).toBe('queued'); expect(h.sends()).toHaveLength(1);
    h.running(false); await h.controller.tick();
    expect((await h.controller.state('room-1')).approvalDelivery).toBe('sent');
    h.running(unknown);
    h.entries([offer('offer', roundId, 'denim'), action('ack', roundId, 'merchant', { type: 'deal_ack', approvalId: approved.approval.id })]);
    await h.controller.tick(); expect(h.removals()).toHaveLength(0);
    h.running(false); await h.controller.tick(); expect(h.removals()).toHaveLength(1);
  }
});
