import assert from 'node:assert/strict';
import test from 'node:test';
import { insertAtCursor, prepareQuickReply } from './quick-reply.ts';

test('fills known customer and staff placeholders while retaining unknown ones', () => {
  assert.equal(
    prepareQuickReply('Chào {tên khách}, tôi là {tên nhân viên}. Cọc {số tiền cọc}.', 'Nguyễn An', 'Trần Bình'),
    'Chào Nguyễn An, tôi là Trần Bình. Cọc {số tiền cọc}.',
  );
});

test('inserts a quick reply at the caret without dropping surrounding draft text', () => {
  assert.equal(insertAtCursor('Chào  nhé', 'anh An', 5, 5), 'Chào anh An nhé');
  assert.equal(insertAtCursor('Chào khách nhé', 'anh An', 5, 10), 'Chào anh An nhé');
});
