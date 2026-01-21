# Soniox LangChain integration

Get started using the Soniox audio transcription loader in LangChain.

## Setup

Install the package:

```bash npm2yarn
npm install @soniox/langchain
```

### Credentials

Get your Soniox API key from the [Soniox console](https://console.soniox.com) and set it as an environment variable:

```bash
export SONIOX_API_KEY=your_api_key
```

## Usage

### Basic transcription

Transcribe audio files using the `SonioxAudioTranscriptLoader`:

```typescript
import { SonioxAudioTranscriptLoader } from "@soniox/langchain";

// Fetch the file
const response = await fetch(
  "https://github.com/soniox/soniox_examples/raw/refs/heads/master/speech_to_text/assets/coffee_shop.mp3",
);
const audioBuffer = await response.bytes(); // Uint8Array

const loader = new SonioxAudioTranscriptLoader(
  {
    audio: audioBuffer, // Or you can pass in a URL string
  },
  {
    language_hints: ["en"],
    // Any other transcription parameters you find here
    // https://soniox.com/docs/stt/api-reference/transcriptions/create_transcription
  },
);

const docs = await loader.load();
console.log(docs[0].pageContent); // Transcribed text
```

### Two-way translation

Transcribe and translate between two languages simultaneously:

```typescript
const loader = new SonioxAudioTranscriptLoader(
  {
    audio: audioBuffer,
  },
  {
    translation: {
      type: "two_way",
      language_a: "en",
      language_b: "es",
    },
    language_hints: ["en", "es"],
  },
);

const docs = await loader.load();
```

### One-way translation

Translate from any detected language to a target language:

```typescript
const loader = new SonioxAudioTranscriptLoader(
  {
    audio: audioBuffer,
  },
  {
    translation: {
      type: "one_way",
      target_language: "fr",
    },
    language_hints: ["en"],
  },
);

const docs = await loader.load();
```

## Advanced usage

### Language hints

Provide [language hints](https://soniox.com/docs/stt/concepts/language-hints) to improve transcription accuracy:

```typescript
const loader = new SonioxAudioTranscriptLoader(
  {
    audio: audioBuffer,
  },
  {
    language_hints: ["en", "es"],
  },
);
```

### Context for improved accuracy

Provide domain-specific [context](https://soniox.com/docs/stt/concepts/context) to improve transcription accuracy:

```typescript
const loader = new SonioxAudioTranscriptLoader(
  {
    audio: audioBuffer,
  },
  {
    context: {
      general: [
        { key: "industry", value: "healthcare" },
        { key: "meeting_type", value: "consultation" },
      ],
      terms: ["hypertension", "cardiology", "metformin"],
      translation_terms: [
        { source: "blood pressure", target: "presión arterial" },
        { source: "medication", target: "medicamento" },
      ],
    },
  },
);
```

## API reference

### Constructor parameters

#### SonioxLoaderParams (required)

| Parameter           | Type                   | Required | Description                                            |
| ------------------- | ---------------------- | -------- | ------------------------------------------------------ |
| `audio`             | `Uint8Array \| string` | Yes      | Audio file as buffer or URL                            |
| `audioFormat`       | `SonioxAudioFormat`    | No       | Audio file format                                      |
| `apiKey`            | `string`               | No       | Soniox API key (defaults to `SONIOX_API_KEY` env var)  |
| `apiBaseUrl`        | `string`               | No       | API base URL (defaults to `https://api.soniox.com/v1`) |
| `pollingIntervalMs` | `number`               | No       | Polling interval in ms (min: 1000, default: 1000)      |
| `pollingTimeoutMs`  | `number`               | No       | Polling timeout in ms (default: 180000)                |

#### SonioxLoaderOptions (optional)

| Parameter                        | Type                         | Description                              |
| -------------------------------- | ---------------------------- | ---------------------------------------- |
| `model`                          | `SonioxTranscriptionModelId` | Model to use (default: `"stt-async-v3"`) |
| `translation`                    | `object`                     | Translation configuration                |
| `language_hints`                 | `string[]`                   | Language hints for transcription         |
| `language_hints_strict`          | `boolean`                    | Enforce strict language hints            |
| `enable_speaker_diarization`     | `boolean`                    | Enable speaker identification            |
| `enable_language_identification` | `boolean`                    | Enable language detection                |
| `context`                        | `object`                     | Context for improved accuracy            |

Browse the [documentation](https://soniox.com/docs/stt/api-reference/transcriptions/create_transcription) for a full list of supported options.

### Supported audio formats

- `aac` - Advanced Audio Coding
- `aiff` - Audio Interchange File Format
- `amr` - Adaptive Multi-Rate
- `asf` - Advanced Systems Format
- `flac` - Free Lossless Audio Codec
- `mp3` - MPEG Audio Layer III
- `ogg` - Ogg Vorbis
- `wav` - Waveform Audio File Format
- `webm` - WebM Audio

### Return value

The `load()` method returns an array containing a single `Document` object:

```typescript
Document {
  pageContent: string, // The transcribed text
  metadata: SonioxTranscriptResponse // Full transcript with metadata
}
```

The metadata includes transcribed text, speaker information (if diarization enabled), language information (if identification enabled), translation data (if translation enabled), and timing information.

## Related

- [Soniox API documentation](https://soniox.com/docs)
