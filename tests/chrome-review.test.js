import test from 'node:test';
import assert from 'node:assert/strict';
import { cornerMarkup } from '../corner-ui.js';

function lampForTheme(theme) {
  const previous = globalThis.document;
  try {
    globalThis.document = { body: { classList: { contains: name => name === `theme-${theme}` } } };
    return cornerMarkup({ includeTheme: true }).match(/<button[^>]*data-action="toggle-theme"[^>]*>[\s\S]*?<\/button>/)[0];
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

test('fresh heaven markup depicts the same sun state as subsequent theme updates', () => {
  const lamp = lampForTheme('light');
  assert.match(lamp, /aria-pressed="true"/);
  assert.match(lamp, /关灯，切换地狱主题/);
  assert.match(lamp, /<circle cx="12" cy="12" r="4"\/>/);
  assert.doesNotMatch(lamp, /A8\.5 8\.5/);
});

test('fresh hell markup depicts the same crescent state as subsequent theme updates', () => {
  const lamp = lampForTheme('dark');
  assert.match(lamp, /aria-pressed="false"/);
  assert.match(lamp, /开灯，切换天堂主题/);
  assert.match(lamp, /M20\.5 14\.2A8\.5 8\.5 0 0 1 9\.8 3\.5a8\.5 8\.5 0 1 0 10\.7 10\.7Z/);
  assert.doesNotMatch(lamp, /<circle/);
});

test('feedback gift shows one custom tooltip while retaining its accessible name', () => {
  const gift = cornerMarkup().match(/<a[^>]*class="icon-button gift-link"[\s\S]*?<\/a>/)?.[0];
  assert.ok(gift);
  assert.match(gift, /aria-label="填写反馈赢「月度共创礼」"/);
  assert.match(gift, /<span class="gift-tip" aria-hidden="true">填写反馈赢「月度共创礼」<\/span>/);
  assert.doesNotMatch(gift, /\btitle=/);
});
