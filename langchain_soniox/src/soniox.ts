import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import { Document } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  SonioxAudioFormat,
  SonioxCreateTranscriptionRequest,
  SonioxCreateTranscriptionResponse,
  SonioxFileUploadResponse,
  SonioxLoaderOptions,
  SonioxLoaderParams,
  SonioxTranscriptionModelId,
  SonioxTranscriptionStatusResponse,
  SonioxTranscriptResponse,
} from "./types/types.js";

abstract class SonioxBaseLoader extends BaseDocumentLoader {
  protected readonly API_BASE_URL = "https://api.soniox.com/v1";
  protected readonly POLLING_INTERVAL_MS = 1000;
  protected readonly POLLING_TIMEOUT_MS = 3 * 60 * 1000;
  protected readonly DEFAULT_MODEL: SonioxTranscriptionModelId = "stt-async-v3";
  protected params: SonioxLoaderParams;
  protected options?: SonioxLoaderOptions;

  constructor(
    sonioxParams: SonioxLoaderParams,
    sonioxOptions?: SonioxLoaderOptions,
  ) {
    super();
    if (!sonioxParams) {
      throw new Error("No Soniox params provided");
    }
    if (!sonioxParams.apiKey) {
      sonioxParams.apiKey = getEnvironmentVariable("SONIOX_API_KEY");
    }
    if (!sonioxParams.apiKey) {
      throw new Error("No Soniox API key provided");
    }
    if (!sonioxParams.apiBaseUrl) {
      sonioxParams.apiBaseUrl = this.API_BASE_URL;
    }
    if (
      sonioxParams.pollingIntervalMs &&
      sonioxParams.pollingIntervalMs < 1000
    ) {
      throw new Error("Polling interval should be longer than 1000 ms");
    }
    this.params = sonioxParams;
    this.options = sonioxOptions;
  }

  protected getHeaders() {
    return {
      Authorization: `Bearer ${this.params.apiKey}`,
    };
  }
}

/**
 * A document loader for transcribing text from audio files. It uses the
 * Soniox API to transcribe with or without translation.
 * @example
 * ```typescript
 * // Basic transcription
 * const loader = new SonioxAudioTranscriptLoader(
 *   {
 *     audio: audioBuffer, // or URL string
 *   },
 *   {
 *     model: "stt-async-v3",
 *     language_hints: ["en"],
 *     enable_speaker_diarization: true
 *   }
 * );
 * const docs = await loader.load();
 *
 * // Two-way translation with speaker diarization
 * const translationLoader = new SonioxAudioTranscriptLoader(
 *   {
 *     audio: audioBuffer, // or URL string
 *     audioFormat: "mp3",
 *     apiKey: "your_api_key",
 *     pollingIntervalMs: 2000,
 *     pollingTimeoutMs: 300000
 *   },
 *   {
 *     model: "stt-async-v3",
 *     translation: { type: "two_way", language_a: "en", language_b: "es" },
 *     language_hints: ["en", "es"],
 *     language_hints_strict: false,
 *     enable_speaker_diarization: true,
 *     enable_language_identification: true,
 *     context: {
 *       general: [
 *         { key: "industry", value: "healthcare" },
 *         { key: "meeting_type", value: "consultation" }
 *       ],
 *       terms: ["hypertension", "cardiology", "metformin"],
 *       translation_terms: [
 *         { source: "blood pressure", target: "presión arterial" },
 *         { source: "medication", target: "medicamento" }
 *       ]
 *     },
 *     client_reference_id: "meeting-2024-01-19-001",
 *     webhook_url: "https://api.example.com/webhooks/transcription",
 *     webhook_auth_header_name: "X-API-Key",
 *     webhook_auth_header_value: "your-webhook-secret"
 *   }
 * );
 * const translatedDocs = await translationLoader.load();
 *
 * // One-way translation
 * const oneWayLoader = new SonioxAudioTranscriptLoader(
 *   {
 *     audio: audioBuffer, // or URL string
 *   },
 *   {
 *     model: "stt-async-v3",
 *     translation: { type: "one_way", target_language: "fr" },
 *     language_hints: ["en"],
 *     context: "Medical consultation discussing treatment options"
 *   }
 * );
 * const frenchDocs = await oneWayLoader.load();
 * ```
 */
export class SonioxAudioTranscriptLoader extends SonioxBaseLoader {
  constructor(
    sonioxParams: SonioxLoaderParams,
    sonioxOptions?: SonioxLoaderOptions,
  ) {
    super(sonioxParams, sonioxOptions);
  }

  /**
   * Uploads a file to the Soniox backend.
   * @returns A file resource object with ID
   */
  private async uploadFile(
    audio: Uint8Array,
    audioFormat?: SonioxAudioFormat,
  ): Promise<SonioxFileUploadResponse> {
    const blob = new Blob([audio as BlobPart]);

    const fileExtension = audioFormat || "wav";

    const mimeTypeMap: Record<string, string> = {
      aac: "audio/aac",
      aiff: "audio/aiff",
      amr: "audio/amr",
      asf: "video/x-ms-asf",
      flac: "audio/flac",
      mp3: "audio/mpeg",
      ogg: "audio/ogg",
      wav: "audio/wav",
      webm: "audio/webm",
    };

    const mimeType = mimeTypeMap[fileExtension] || "audio/wav";

    const formData = new FormData();
    formData.append(
      "file",
      new File([blob], `audio.${fileExtension}`, {
        type: mimeType,
      }),
    );

    const res = await fetch(`${this.params.apiBaseUrl}/files`, {
      method: "POST",
      headers: this.getHeaders(),
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`File upload failed: ${res.statusText}`);
    }

    const file: SonioxFileUploadResponse = await res.json();
    return file;
  }

  /**
   * Deletes a file from the Soniox backend.
   */
  private async deleteFile(fileId: string) {
    try {
      await fetch(`${this.params.apiBaseUrl}/files/${fileId}`, {
        method: "DELETE",
        headers: this.getHeaders(),
      });
    } catch (error) {
      throw new Error(`File deletion failed: ${error}`);
    }
  }

  /**
   * Creates the transcription resource from a file with provided parameters.
   */
  private async createTranscription(
    body: SonioxCreateTranscriptionRequest,
  ): Promise<SonioxCreateTranscriptionResponse> {
    try {
      const res = await fetch(`${this.params.apiBaseUrl}/transcriptions`, {
        method: "POST",
        headers: {
          ...this.getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Transcription creation failed: ${res.statusText}`);
      }

      const transcription = await res.json();
      return transcription;
    } catch (error) {
      throw new Error(`Transcription creation failed: ${error}`);
    }
  }

  /**
   * Gets the transcription resource from the Soniox backend.
   */
  private async getTranscription(
    transcriptionId: string,
  ): Promise<SonioxTranscriptionStatusResponse> {
    try {
      const res = await fetch(
        `${this.params.apiBaseUrl}/transcriptions/${transcriptionId}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        },
      );

      if (!res.ok) {
        throw new Error(`Transcription query failed: ${res.statusText}`);
      }

      const status = await res.json();
      return status;
    } catch (error) {
      throw new Error(`Transcription query failed: ${error}`);
    }
  }

  /**
   * Deletes the transcription resource from the Soniox backend.
   */
  private async deleteTranscription(transcriptionId: string) {
    try {
      await fetch(
        `${this.params.apiBaseUrl}/transcriptions/${transcriptionId}`,
        {
          method: "DELETE",
          headers: this.getHeaders(),
        },
      );
    } catch (error) {
      throw new Error(`Transcription deletion failed: ${error}`);
    }
  }

  /**
   * Fetches the transcription transcript from the Soniox backend.
   * @returns A transcription with text and metadata
   */
  private async getTranscriptionTranscript(
    transcriptionId: string,
  ): Promise<SonioxTranscriptResponse> {
    try {
      const res = await fetch(
        `${this.params.apiBaseUrl}/transcriptions/${transcriptionId}/transcript`,
        {
          method: "GET",
          headers: this.getHeaders(),
        },
      );

      if (!res.ok) {
        throw new Error(
          `Transcription transcript query failed: ${res.statusText}`,
        );
      }

      const status = await res.json();
      return status;
    } catch (error) {
      throw new Error(`Transcription transcript query failed: ${error}`);
    }
  }

  /**
   * Transcribes provided audio file by uploading it to Soniox, submitting
   * a transcription request and polling until it finishes.
   * @returns A transcription of the audio file
   */
  private async transcribe(): Promise<SonioxTranscriptResponse> {
    let fileId: string | undefined;
    let transcriptionId: string | undefined;

    try {
      const mode: "file" | "url" =
        typeof this.params.audio === "string" ? "url" : "file";

      if (mode === "file") {
        const file = await this.uploadFile(
          this.params.audio as Uint8Array,
          this.params.audioFormat,
        );
        fileId = file.id;
      }

      const body: SonioxCreateTranscriptionRequest = {
        model: this.options?.model || this.DEFAULT_MODEL,
        ...(this.options || {}),
      };

      if (mode === "file") {
        body.file_id = fileId;
      }

      if (mode === "url") {
        body.audio_url = this.params.audio as string;
      }

      const transcription = await this.createTranscription(body);

      transcriptionId = transcription.id;

      const pollingInterval =
        this.params.pollingIntervalMs ?? this.POLLING_INTERVAL_MS;
      const timeoutMs = this.params.pollingTimeoutMs ?? this.POLLING_TIMEOUT_MS;
      const startTime = Date.now();

      let statusResponse: SonioxTranscriptionStatusResponse | undefined;

      while (true) {
        if (Date.now() - startTime > timeoutMs) {
          throw new Error(
            `Transcription job polling timed out: ${JSON.stringify(
              statusResponse,
            )}`,
          );
        }

        statusResponse = await this.getTranscription(transcriptionId);

        if (statusResponse.status === "completed") {
          break;
        }

        if (statusResponse.status === "error") {
          throw new Error(
            `Transcription failed: ${
              statusResponse.error_message ?? "Unknown error"
            }`,
          );
        }

        await new Promise((r) => setTimeout(r, pollingInterval));
      }

      const transcript = await this.getTranscriptionTranscript(transcriptionId);
      return transcript;
    } finally {
      if (fileId) {
        await this.deleteFile(fileId);
      }

      if (transcriptionId) {
        await this.deleteTranscription(transcriptionId);
      }
    }
  }

  /**
   * Transcribes provided audio file. It uses the Soniox API to transcribe with
   * or without translation.
   * @returns An array of Documents representing the retrieved data.
   */
  override async load(): Promise<Document<SonioxTranscriptResponse>[]> {
    const transcript = await this.transcribe();

    return [
      new Document({
        pageContent: transcript.text as string,
        metadata: transcript,
      }),
    ];
  }
}
