import { test, expect, describe } from "@jest/globals";
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
    expect(docs[0].pageContent).toContain(
      "What is your best seller here? Our best seller here is cold brew iced coffee and lattes. Okay. And on a day like today where it's snowing quite a bit, do a lot of people still order iced coffee? Here in Maine, yes. Really? Yes.",
    );
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
    const file = await res.bytes();

    const loader = new SonioxAudioTranscriptLoader({
      audio: file,
      audioFormat: "mp3",
    });

    const docs = await loader.load();

    expect(docs.length).toBe(1);
    expect(docs[0].pageContent).toContain(
      "What is your best seller here? Our best seller here is cold brew iced coffee and lattes. Okay. And on a day like today where it's snowing quite a bit, do a lot of people still order iced coffee? Here in Maine, yes. Really? Yes.",
    );
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
    const file = await res.bytes();

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
    expect(docs[0].pageContent).toContain(
      "Hey, how are you? Hola, yo soy bien, ¿cómo estás? I'm fine too.",
    );
    expect(docs[0].metadata).toHaveProperty("id");
    expect(docs[0].metadata).toHaveProperty("text");
    expect(docs[0].metadata).toHaveProperty("tokens");

    expect(
      docs[0].metadata.tokens?.find((t) => t.translation_status !== null),
    ).toBeTruthy();
  });
});
