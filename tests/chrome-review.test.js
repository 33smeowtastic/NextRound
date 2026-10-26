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
