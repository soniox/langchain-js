import { test, expect, describe } from "@jest/globals";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - undici types don't export fetch but it exists at runtime
import { fetch as undiciFetch } from "undici";
import { SonioxAudioTranscriptLoader } from "../soniox.js";

describe("SonioxAudioTranscriptLoader", () => {
  test("transcription from URL", async () => {
    const loader = new SonioxAudioTranscriptLoader({
      audio:
        "https://github.com/soniox/soniox_examples/raw/refs/heads/master/speech_to_text/assets/coffee_shop.mp3",
      audioFormat: "mp3",
    });

    const docs = await loader.load();

    expect(docs.length).toBe(1);
    expect(docs[0].pageContent).toBeGreaterThan(0);
    expect(docs[0].metadata).toHaveProperty("id");
    expect(docs[0].metadata).toHaveProperty("text");
    expect(docs[0].metadata).toHaveProperty("tokens");

    expect(
      docs[0].metadata.tokens?.find((t) => t.translation_status !== null),
    ).not.toBeTruthy();
  });

  test("transcription with file", async () => {
    const res = await fetch(
      "https://github.com/soniox/soniox_examples/raw/refs/heads/master/speech_to_text/assets/coffee_shop.mp3",
    );
    const file = new Uint8Array(await res.arrayBuffer());

    const loader = new SonioxAudioTranscriptLoader({
      audio: file,
      audioFormat: "mp3",
    });

    const docs = await loader.load();

    expect(docs.length).toBe(1);
    expect(docs[0].pageContent.length).toBeGreaterThan(0);
    expect(docs[0].metadata).toHaveProperty("id");
    expect(docs[0].metadata).toHaveProperty("text");
    expect(docs[0].metadata).toHaveProperty("tokens");

    expect(
      docs[0].metadata.tokens?.find((t) => t.translation_status !== null),
    ).not.toBeTruthy();
  });

  test("translation", async () => {
    const res = await fetch(
      "https://github.com/soniox/soniox_examples/raw/refs/heads/master/speech_to_text/assets/two_way_translation.mp3",
    );
    const file = new Uint8Array(await res.arrayBuffer());

    const loader = new SonioxAudioTranscriptLoader(
      {
        audio: file,
        audioFormat: "mp3",
      },
      {
        translation: { type: "two_way", language_a: "en", language_b: "es" },
      },
    );

    const docs = await loader.load();

    expect(docs.length).toBe(1);
    expect(docs[0].pageContent).toBeGreaterThan(0);
    expect(docs[0].metadata).toHaveProperty("id");
    expect(docs[0].metadata).toHaveProperty("text");
    expect(docs[0].metadata).toHaveProperty("tokens");

    expect(
      docs[0].metadata.tokens?.find((t) => t.translation_status !== null),
    ).toBeTruthy();
  });

  test("custom fetch", async () => {
    const loader = new SonioxAudioTranscriptLoader({
      audio:
        "https://github.com/soniox/soniox_examples/raw/refs/heads/master/speech_to_text/assets/coffee_shop.mp3",
      audioFormat: "mp3",
      fetch: undiciFetch,
    });

    const docs = await loader.load();

    expect(docs.length).toBe(1);
    expect(docs[0].pageContent).toBeGreaterThan(0);
    expect(docs[0].metadata).toHaveProperty("id");
    expect(docs[0].metadata).toHaveProperty("text");
    expect(docs[0].metadata).toHaveProperty("tokens");

    expect(
      docs[0].metadata.tokens?.find((t) => t.translation_status !== null),
    ).not.toBeTruthy();
  });
});
