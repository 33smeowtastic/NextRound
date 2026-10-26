import test from "node:test";
import assert from "node:assert/strict";
import { shareNextRound, cornerMarkup } from "../corner-ui.js";

async function browser(navigator, href, run) {
  const saved = ["navigator", "window"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const prompts = [];
  Object.defineProperty(globalThis, "navigator", { value: navigator, configurable: true });
  Object.defineProperty(globalThis, "window", { value: { location: { href }, prompt: (...args) => prompts.push(args) }, configurable: true });
  try {
    await run(prompts);
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

test("shares the application entrance without workspace or private record state", async () => {
  const shares = [];
  await browser({ share: async (data) => shares.push(data) }, "https://example.org/next/index.html?space=formal&record=private#/interview/private", async () => {
    await shareNextRound(() => assert.fail("native share should not report a copy"));
    assert.deepEqual(shares, [{ title: "下一场 · NextRound", url: "https://example.org/next/" }]);
  });
});

test("cancelling native share silently preserves the clipboard", async () => {
  await browser({ share: async () => { throw Object.assign(new Error(), { name: "AbortError" }); }, clipboard: { writeText: () => assert.fail("cancel must not copy") } }, "https://example.org/", async (prompts) => {
    await shareNextRound(() => assert.fail("cancel must be silent"));
    assert.equal(prompts.length, 0);
  });
});

test("unsupported share copies the clean preview entrance and labels its local scope", async () => {
  const copied = [], feedback = [];
  await browser({ clipboard: { writeText: async (value) => copied.push(value) } }, "http://localhost:4184/?space=demo#/questions/private", async () => {
    await shareNextRound((message) => feedback.push(message));
    assert.deepEqual(copied, ["http://localhost:4184/"]);
    assert.match(feedback[0], /本地预览.*仅本机/);
  });
});

test("blocked native share falls back to copying the public application link", async () => {
  const copied = [], feedback = [];
  await browser({ share: async () => { throw Object.assign(new Error(), { name: "NotAllowedError" }); }, clipboard: { writeText: async (value) => copied.push(value) } }, "https://example.org/next/?space=formal#/private", async () => {
    await shareNextRound((message) => feedback.push(message));
    assert.deepEqual(copied, ["https://example.org/next/"]);
    assert.deepEqual(feedback, ["链接已复制。"]);
  });
});

test("clipboard denial leaves a manually copyable clean link", async () => {
  await browser({ clipboard: { writeText: async () => { throw new Error("denied"); } } }, "http://127.0.0.1:4184/?space=formal#/private", async (prompts) => {
    await shareNextRound(() => assert.fail("failed copy must not report success"));
    assert.equal(prompts[0][1], "http://127.0.0.1:4184/");
    assert.match(prompts[0][0], /本地预览/);
  });
});

test("share control keeps its accessible name and an icon-only visible face", () => {
  const button = cornerMarkup().match(/<button[^>]*data-corner-share[\s\S]*?<\/button>/)?.[0];
  assert.match(button, /aria-label="分享下一场"/);
  assert.match(button, /<svg/);
  assert.equal(button.replace(/<[^>]*>/g, "").trim(), "");
});
