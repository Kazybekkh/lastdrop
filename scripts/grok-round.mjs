import { randomUUID as newRoundId } from 'node:crypto';

const ROLES = ['merchant', 'denim', 'bargain', 'premium'];
const CONFIG_KEYS = ['product', 'quantity', 'askingPricePence', 'floorPricePence', 'denimBudgetPence', 'bargainBudgetPence', 'premiumBudgetPence', 'premiumMaxQuantity'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(value);
const clone = value => JSON.parse(JSON.stringify(value));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const money = pence => `GBP ${(pence / 100).toFixed(2)}`;

function configFrom(value) {
  if (!record(value) || Object.keys(value).some(key => !CONFIG_KEYS.includes(key)) || typeof value.product !== 'string' || !value.product.trim() || value.product.trim().length > 500) throw fail('Enter a complete lot and valid product description.');
  for (const key of CONFIG_KEYS.slice(1)) {
    const max = ['quantity', 'premiumMaxQuantity'].includes(key) ? 10000 : 1000000000;
    if (!Number.isSafeInteger(value[key]) || value[key] < 1 || value[key] > max) throw fail('Use positive whole quantities and valid prices or budgets.');
  }
  if (value.floorPricePence > value.askingPricePence || value.premiumMaxQuantity > value.quantity) throw fail('The lot, floor and premium quantity are inconsistent.');
  return { ...value, product: value.product.trim() };
}

function membersFrom(value) {
  if (!Array.isArray(value) || value.length !== 4 || new Set(value.map(row => row?.id)).size !== 4 || new Set(value.map(row => row?.role)).size !== 4 || value.some(row => !record(row) || !validId(row.id) || typeof row.name !== 'string' || !row.name.trim() || !ROLES.includes(row.role))) throw fail('Choose four distinct bots with merchant, denim, bargain and premium roles.');
  return ROLES.map(role => {
    const member = value.find(row => row.role === role);
    return { id: member.id, name: member.name.trim(), role, state: 'active' };
  });
}

function groupFrom(value, botId) {
  const group = value?.group;
  if (!record(group) || group.id !== botId || group.isGroup !== true || !Array.isArray(group.memberIds) || !group.memberIds.length || group.memberIds.some(id => !validId(id)) || new Set(group.memberIds).size !== group.memberIds.length || !Array.isArray(value.members) || value.members.length !== group.memberIds.length || new Set(value.members.map(member => member?.id)).size !== group.memberIds.length || value.members.some(member => !record(member) || !group.memberIds.includes(member.id) || typeof member.name !== 'string' || !member.name.trim())) throw fail('The native group membership could not be verified.');
  return group;
}

function snapshot(round) {
  const { seenIds, startDelivery, removalAttempts, retryableError, ...publicRound } = round;
  return clone(publicRound);
}

function bestOffers(round) {
  let best = [], total = -1, quantity = -1;
  // Stable role order is the final tie-breaker; at most three live buyer offers.
  const offers = round.members.flatMap(member => round.offers.filter(offer => offer.botId === member.id));
  for (let mask = 1; mask < 2 ** offers.length; mask++) {
    const subset = offers.filter((_, index) => mask & (1 << index));
    const units = subset.reduce((sum, offer) => sum + offer.quantity, 0);
    const recovery = subset.reduce((sum, offer) => sum + offer.totalPence, 0);
    if (units <= round.config.quantity && (recovery > total || (recovery === total && units > quantity))) { best = subset; total = recovery; quantity = units; }
  }
  return best.map(offer => offer.id);
}

const lotReference = round => `LD-${round.roundId.slice(0, 8).toUpperCase()}`;
const receiptReference = approval => `C-${approval.id.slice(0, 8).toUpperCase()}`;
const confirmationLine = round => `Deal confirmed for lot ${lotReference(round)}: ${round.approval.quantity} units for ${money(round.approval.totalPence)}. Confirmation ${receiptReference(round.approval)}.`;

function brief(round) {
  const { config, members } = round;
  const lot = lotReference(round);
  const named = role => members.find(member => member.role === role).name;
  return `Start a NEW fictional Last Drop negotiation. Lot ${lot}. All earlier offers and approvals are void.
Stock: ${config.quantity} units of ${JSON.stringify(config.product)}. Ask ${money(config.askingPricePence)} each; firm floor ${money(config.floorPricePence)} each.
${named('merchant')} is the merchant. ${named('denim')} is the denim reseller, prefers the whole lot, total budget ${money(config.denimBudgetPence)}. ${named('bargain')} is the bargain reseller, total budget ${money(config.bargainBudgetPence)}. ${named('premium')} is the premium reseller, at most ${config.premiumMaxQuantity} units, total budget ${money(config.premiumBudgetPence)}.
Use this native group, mentions and your own judgment to negotiate and compete. Choose your own offers; no prescribed winner. Each reseller may make an opening offer and one final counter, or autonomously withdraw when the deal does not suit them. Merchant may counter once, compare eligible whole-lot and split allocations, then STOP for fresh human approval. Keep messages short and speak only as yourself.
Every buyer offer MUST end with a plain, unquoted sentence in this format, replacing QUANTITY and PRICE with your chosen whole quantity and price in pounds with two decimal places:
Offer for lot ${lot}: QUANTITY units at GBP PRICE each.
To leave, explain your own reason in this final sentence:
I withdraw from lot ${lot}: YOUR REASON.
The connector validates the latest offer against floor, budget and stock, and removes a withdrawing reseller when the room is idle. Use only your own offer or withdrawal. Do not show JSON, code blocks, internal action markers or copies of these examples.
Only the human may approve, by saying "approve" or "approve best deal" directly in this chat, or selecting offers on the website. Wait for the connector's locked allocation and confirmation reference before merchant acknowledgement. Winners remain; nonwinners withdraw and are removed automatically. Never place orders, make payments, alter real inventory, or use external tools. This entire negotiation and acknowledgement are fictional.`;
}

function approvalBrief(round) {
  const approval = round.approval;
  const merchant = round.members.find(member => member.role === 'merchant');
  const terms = approval.allocations.map(offer => `${offer.botName}: ${offer.quantity} units at ${money(offer.unitPricePence)} each = ${money(offer.totalPence)}`).join('\n');
  const losing = round.members.filter(member => member.role !== 'merchant' && !approval.allocations.some(offer => offer.botId === member.id) && member.removal !== 'removed');
  return `HUMAN APPROVED fictional allocation for lot ${lotReference(round)}. Confirmation ${receiptReference(approval)}. These exact terms are now locked:
${terms}
Total: ${money(approval.totalPence)} for ${approval.quantity} units. Remaining stock: ${approval.remaining}. No real order, payment or inventory change has been made.
@${merchant.name}: acknowledge the exact approved allocations publicly, then end your own message with this plain, unquoted confirmation sentence:
${confirmationLine(round)}
Winning resellers: acknowledge your own allocation and stay in the group. ${losing.length ? losing.map(member => `@${member.name}`).join(', ') + ': the human selected another allocation. Briefly acknowledge and end your own message with: I withdraw from lot ' + lotReference(round) + ': Another allocation was approved.' : ''}
After merchant acknowledgement and when the room is idle, the connector automatically removes nonwinning resellers. Do not negotiate further or approve anything yourselves. Do not show JSON or internal action markers.`;
}

// Keep old rounds working, but new bot messages use readable, lot-bound sentences.
// Both formats must be a single standalone trailing action, outside quotes/fences.
function actionFrom(text, round) {
  if (typeof text !== 'string' || text.length > 40000 || text.includes('```')) return null;
  const lines = text.trimEnd().split(/\r?\n/);
  const candidates = lines.flatMap((line, index) => /^(?:\[\[LASTDROP:|Offer for lot |I withdraw from lot |Deal confirmed for lot )/.test(line) ? [{ line, index }] : []);
  if (candidates.length !== 1 || candidates[0].index !== lines.length - 1) return null;
  const line = candidates[0].line;
  const legacy = line.match(/^\[\[LASTDROP:(\{[^\n]*\})\]\]$/);
  if (legacy) {
    try {
      const action = JSON.parse(legacy[1]);
      return record(action) && action.roundId === round.roundId ? action : null;
    } catch { return null; }
  }
  const offer = line.match(/^Offer for lot (LD-[A-F0-9]{8}): ([1-9][0-9]{0,4}) units at GBP ([0-9]{1,8})\.([0-9]{2}) each\.$/);
  if (offer && offer[1] === lotReference(round)) return { type: 'offer', quantity: Number(offer[2]), unitPricePence: Number(offer[3]) * 100 + Number(offer[4]) };
  const withdrawal = line.match(/^I withdraw from lot (LD-[A-F0-9]{8}): (.{1,300})$/);
  if (withdrawal && withdrawal[1] === lotReference(round)) return { type: 'withdraw', reason: withdrawal[2] };
  if (round.approval && line === confirmationLine(round)) return { type: 'deal_ack', approvalId: round.approval.id };
  return null;
}

function isApproval(text) {
  return typeof text === 'string' && /^approve(?:\s+best\s+deal)?[.!]*$/i.test(text.trim());
}

/** All calls are serialized by the connector; no timers or credentials live here. */
export function createRoundController({ cli, load = async () => null, save = async () => {}, now = Date.now }) {
  const rounds = new Map();
  const removalReconciliation = new Set();
  let ready;
  const persist = () => save(clone({ version: 1, rounds: [...rounds.values()] }));
  const ensureLoaded = () => ready ||= (async () => {
    const stored = await load();
    if (stored == null) return;
    if (stored.version !== 1 || !Array.isArray(stored.rounds)) throw fail('Saved round state is invalid. Restore the connector state file before continuing.', 500);
    for (const original of stored.rounds) {
      if (!record(original) || !validId(original.botId) || !validId(original.roundId) || !Array.isArray(original.seenIds) || !Array.isArray(original.members) || !Array.isArray(original.offers)) throw fail('Saved round state is invalid.', 500);
      const round = clone(original);
      // A crash after intent persistence cannot prove that a native send failed.
      if (round.startDelivery === 'sending' || round.approvalDelivery === 'sending') {
        if (round.startDelivery === 'sending') round.startDelivery = 'uncertain';
        if (round.approvalDelivery === 'sending') round.approvalDelivery = 'uncertain';
        round.error = 'A native message was interrupted. Inspect the Grok chat; it will not be resent automatically.';
      }
      for (const member of round.members) {
        if (round.removalAttempts?.[member.id] === 'sending') {
          round.removalAttempts[member.id] = 'uncertain'; member.removal = 'failed';
          round.error = 'A native removal was interrupted. Inspect group membership before retrying.';
        }
      }
      if (round.members.some(member => member.removal === 'failed')) removalReconciliation.add(round.botId);
      rounds.set(round.botId, round);
    }
  })();

  async function transcript(round) {
    const result = await cli(['transcript', '--id', round.botId, '--limit', '80']);
    if (result?.agent?.id !== round.botId || !Array.isArray(result.entries)) throw fail('The native transcript belongs to another room or is invalid.', 502);
    return result;
  }

  async function send(round, field, prompt) {
    round[field] = 'sending';
    await persist();
    try {
      const response = await cli(['send', '--id', round.botId, '--prompt', prompt]);
      if (response?.accepted !== true) throw new Error('Message acceptance was not confirmed.');
      round[field] = 'sent';
      await persist();
    } catch {
      round[field] = 'uncertain';
      round.error = 'Message delivery could not be confirmed. Inspect the Grok chat; the connector will not resend it automatically.';
      await persist();
      throw fail(round.error, 502);
    }
  }

  async function lockApproval(round, offerIds, source) {
    if (round.status !== 'negotiating' || round.approval) throw fail('This round is already approved. Its allocation cannot be changed.', 409);
    if (!Array.isArray(offerIds) || !offerIds.length || new Set(offerIds).size !== offerIds.length || offerIds.some(id => typeof id !== 'string')) throw fail('Select one or more distinct current offers.');
    const selected = offerIds.map(id => round.offers.find(offer => offer.id === id));
    if (selected.some(offer => !offer || round.members.find(member => member.id === offer.botId)?.state !== 'active')) throw fail('An offer changed or was withdrawn. Review the current offers before approving.', 409);
    const quantity = selected.reduce((sum, offer) => sum + offer.quantity, 0);
    if (quantity > round.config.quantity) throw fail('These offers request more units than the available stock.');
    const approval = { id: newRoundId(), offerIds: [...offerIds], allocations: clone(selected), totalPence: selected.reduce((sum, offer) => sum + offer.totalPence, 0), quantity, remaining: round.config.quantity - quantity, acknowledged: false, source };
    round.approval = approval;
    round.status = 'awaiting-ack';
    round.approvalDelivery = 'queued';
    delete round.error;
    await persist();
  }

  async function ingest(round, result) {
    const seen = new Set(round.seenIds);
    for (const entry of result.entries) {
      if (!record(entry) || entry.streaming === true || typeof entry.id !== 'string' || !entry.id || seen.has(entry.id)) continue;
      // Persist every seen id, including tool traces, so a later presentation change cannot replay it.
      seen.add(entry.id); round.seenIds.push(entry.id);
      if (!['message', 'send-message'].includes(entry.kind) || typeof entry.text !== 'string') continue;
      if (entry.author === 'user') {
        if (round.status === 'negotiating' && isApproval(entry.text)) {
          try { await lockApproval(round, round.bestOfferIds, { kind: 'chat', entryId: entry.id }); }
          catch (error) { round.error = error.message; round.retryableError = error.message; }
        }
        continue;
      }
      const member = record(entry.author) && round.members.find(item => item.id === entry.author.id);
      if (!member) continue;
      const action = actionFrom(entry.text, round);
      if (!action) continue;
      if (action.type === 'deal_ack' && member.role === 'merchant' && round.status === 'awaiting-ack' && round.approval && action.approvalId === round.approval.id && ['sent', 'uncertain'].includes(round.approvalDelivery)) {
        round.approval.acknowledged = true; round.status = 'closed';
        for (const buyer of round.members.filter(item => item.role !== 'merchant')) {
          if (round.approval.allocations.some(offer => offer.botId === buyer.id)) buyer.state = 'won';
          else { buyer.state = buyer.removal === 'removed' ? 'withdrawn' : 'lost'; if (buyer.removal !== 'removed' && buyer.removal !== 'failed') buyer.removal = 'pending'; }
        }
        delete round.error;
      } else if (action.type === 'withdraw' && member.role !== 'merchant' && member.removal !== 'removed' && !round.approval?.allocations.some(offer => offer.botId === member.id)) {
        member.state = round.status === 'closed' ? 'lost' : 'withdrawing';
        member.reason = typeof action.reason === 'string' ? action.reason.slice(0, 300) : 'The reseller withdrew.';
        if (!round.removalAttempts[member.id]) member.removal = 'pending';
        round.offers = round.offers.filter(offer => offer.botId !== member.id);
      } else if (action.type === 'offer' && member.role !== 'merchant' && member.state === 'active' && round.status === 'negotiating') {
        round.offers = round.offers.filter(offer => offer.botId !== member.id);
        const totalPence = action.quantity * action.unitPricePence;
        const maximum = member.role === 'premium' ? round.config.premiumMaxQuantity : round.config.quantity;
        const budget = round.config[`${member.role}BudgetPence`];
        if (Number.isSafeInteger(action.quantity) && action.quantity > 0 && action.quantity <= maximum && Number.isSafeInteger(action.unitPricePence) && action.unitPricePence >= round.config.floorPricePence && Number.isSafeInteger(totalPence) && totalPence <= budget) {
          round.offers.push({ id: entry.id, botId: member.id, botName: member.name, quantity: action.quantity, unitPricePence: action.unitPricePence, totalPence });
          delete round.offerIssues[member.id];
          if (round.error === round.retryableError) delete round.error;
          delete round.retryableError;
        } else round.offerIssues[member.id] = 'Latest offer rejected: quantity, floor or budget constraint was not met.';
      }
      round.bestOfferIds = bestOffers(round);
    }
    await persist();
  }

  async function advance(round) {
    const pending = round.members.filter(member => member.removal === 'pending' && !round.removalAttempts[member.id]);
    if (round.approvalDelivery !== 'queued' && !pending.length) return;
    const result = await cli(['group-info', '--id', round.botId]);
    const group = groupFrom(result, round.botId);
    if (group.memberIds.some(id => !round.members.some(member => member.id === id))) throw fail('The native group now contains an unknown member. Reconnect a fresh demo room.', 409);
    if (group.isRunning !== false) return;
    if (round.approvalDelivery === 'queued') {
      const required = [round.members.find(member => member.role === 'merchant').id, ...round.approval.allocations.map(offer => offer.botId)];
      if (required.some(id => !group.memberIds.includes(id))) throw fail('The merchant or a winning reseller left before approval could be sent.', 409);
      await send(round, 'approvalDelivery', approvalBrief(round));
      return; // Let the bots acknowledge before changing membership.
    }
    if (!pending.length) return;
    for (const member of pending) round.removalAttempts[member.id] = 'sending';
    await persist();
    try {
      const removed = await cli(['group-remove-member', '--id', round.botId, ...pending.flatMap(member => ['--member-id', member.id])]);
      const fresh = groupFrom(removed, round.botId);
      const expected = group.memberIds.filter(id => !pending.some(member => member.id === id));
      const provedAbsent = [...(Array.isArray(removed.removedMemberIds) ? removed.removedMemberIds : []), ...(Array.isArray(removed.alreadyAbsentMemberIds) ? removed.alreadyAbsentMemberIds : [])];
      if (pending.some(member => !provedAbsent.includes(member.id) || fresh.memberIds.includes(member.id)) || fresh.memberIds.length !== expected.length || expected.some(id => !fresh.memberIds.includes(id))) throw new Error('The expected native membership change was not verified.');
      for (const member of pending) { member.removal = 'removed'; member.state = member.state === 'lost' ? 'lost' : 'withdrawn'; round.removalAttempts[member.id] = 'removed'; }
      closeEmptyRound(round);
      await persist();
    } catch {
      for (const member of pending) { member.removal = 'failed'; round.removalAttempts[member.id] = 'uncertain'; }
      round.error = 'Native removal could not be verified. Inspect the Grok group; removal will not be retried automatically.';
      await persist();
    }
  }

  function closeEmptyRound(round) {
    if (!round.approval && round.members.filter(member => member.role !== 'merchant').every(member => member.removal === 'removed')) {
      round.status = 'closed'; round.closedReason = 'All resellers withdrew.';
    }
  }

  async function reconcileRemovals(round) {
    removalReconciliation.delete(round.botId);
    const result = await cli(['group-info', '--id', round.botId]);
    const group = groupFrom(result, round.botId);
    const protectedIds = [round.members.find(member => member.role === 'merchant').id, ...(round.approval?.allocations.map(offer => offer.botId) || [])];
    if (protectedIds.some(id => !group.memberIds.includes(id)) || group.memberIds.some(id => !round.members.some(member => member.id === id))) throw fail('Native group membership changed unexpectedly. Inspect the Grok group before continuing.', 409);
    for (const member of round.members.filter(item => item.removal === 'failed' && !group.memberIds.includes(item.id))) {
      member.removal = 'removed'; member.state = member.state === 'lost' ? 'lost' : 'withdrawn'; round.removalAttempts[member.id] = 'removed';
    }
    if (!round.members.some(member => member.removal === 'failed') && /removal/i.test(round.error || '')) delete round.error;
    closeEmptyRound(round);
    await persist();
  }

  return {
    async start({ botId, config, members }) {
      await ensureLoaded();
      if (!validId(botId)) throw fail('Choose a native Grok group.');
      if (rounds.has(botId)) throw fail('This room already has a tracked round. Create a fresh four-bot room for another round.', 409);
      const checkedConfig = configFrom(config), checkedMembers = membersFrom(members);
      const native = await cli(['group-info', '--id', botId]);
      const group = groupFrom(native, botId);
      if (group.memberIds.length !== 4 || checkedMembers.some(member => !group.memberIds.includes(member.id))) throw fail('The selected roles do not match this four-bot native group.');
      if (group.isRunning !== false) throw fail(group.isRunning === true ? 'Wait for the native group to finish before starting a new round.' : 'The native group activity is not known yet. Open the room in Grok Bot, then retry once it is idle.', 409);
      // Use native names, not names supplied by the browser, in trusted instructions.
      for (const member of checkedMembers) member.name = native.members.find(item => item.id === member.id).name;
      const round = { roundId: newRoundId(), botId, status: 'negotiating', config: checkedConfig, members: checkedMembers, offers: [], bestOfferIds: [], offerIssues: {}, startedAt: new Date(now()).toISOString(), seenIds: [], startDelivery: 'queued', approvalDelivery: null, removalAttempts: {} };
      const baseline = await transcript(round);
      round.seenIds = [...new Set(baseline.entries.map(entry => entry?.id).filter(id => typeof id === 'string'))];
      rounds.set(botId, round);
      await send(round, 'startDelivery', brief(round));
      return snapshot(round);
    },
    async state(botId) { await ensureLoaded(); const round = rounds.get(botId); return round ? snapshot(round) : null; },
    async approve({ botId, roundId, offerIds }) {
      await ensureLoaded();
      const round = rounds.get(botId);
      if (!round || round.roundId !== roundId) throw fail('This round is stale. Refresh the room before approving.', 409);
      if (round.status !== 'negotiating') throw fail('This round is already approved.', 409);
      await ingest(round, await transcript(round));
      await lockApproval(round, offerIds, { kind: 'selection' });
      await advance(round);
      return snapshot(round);
    },
    async tick() {
      await ensureLoaded();
      for (const round of rounds.values()) {
        if (round.status === 'closed' && !round.members.some(member => member.removal === 'pending') && !removalReconciliation.has(round.botId)) continue;
        try {
          if (removalReconciliation.has(round.botId)) await reconcileRemovals(round);
          if (round.status === 'closed' && !round.members.some(member => member.removal === 'pending')) continue;
          await ingest(round, await transcript(round)); await advance(round);
          if (round.error === round.retryableError) delete round.error;
          delete round.retryableError;
          await persist();
        }
        catch (error) {
          if (!round.error || round.error === round.retryableError) { round.error = error.message; round.retryableError = error.message; }
          await persist();
        }
      }
    },
  };
}
