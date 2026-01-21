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
import {
  SonioxAPIError,
  SonioxTimeoutError,
  SonioxValidationError,
} from "./errors.js";

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
      throw new SonioxValidationError("No Soniox params provided");
    }
    if (!sonioxParams.apiKey) {
      sonioxParams.apiKey = getEnvironmentVariable("SONIOX_API_KEY");
    }
    if (!sonioxParams.apiKey) {
      throw new SonioxValidationError("No Soniox API key provided");
    }
    if (!sonioxParams.apiBaseUrl) {
      sonioxParams.apiBaseUrl = this.API_BASE_URL;
    }
    if (
      sonioxParams.pollingIntervalMs &&
      sonioxParams.pollingIntervalMs < 1000
    ) {
      throw new SonioxValidationError(
        "Polling interval should be longer than 1000 ms",
      );
    }
    this.params = sonioxParams;
    this.options = sonioxOptions;
  }

  protected getHeaders() {
    return {
      Authorization: `Bearer ${this.params.apiKey}`,
    };
  }

  protected async fetch(
    input: URL | RequestInfo,
    init?: RequestInit,
  ): Promise<Response> {
    if (this.params.fetch) {
      return this.params.fetch(input, init);
    } else {
      return fetch(input, init);
    }
  }

  protected async parseJSON<T>(response: Response): Promise<T> {
    try {
      return await response.json();
    } catch (error) {
      throw new SonioxAPIError(
        `Failed to parse API response`,
        response.status,
        error instanceof Error ? error : undefined,
      );
    }
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
    let res: Response;

    if (audio.byteLength === 0) {
      throw new SonioxValidationError("Audio buffer is empty");
    }

    try {
      const blob = new Blob([audio as BlobPart]);
      const fileExtension = audioFormat || "wav";
      const formData = new FormData();
      formData.append("file", new File([blob], `audio.${fileExtension}`));

      res = await this.fetch(`${this.params.apiBaseUrl}/files`, {
        method: "POST",
        headers: this.getHeaders(),
        body: formData,
      });
    } catch (error) {
      throw new SonioxAPIError(
        "File upload failed: network error",
        undefined,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    if (!res.ok) {
      throw new SonioxAPIError(
        "File upload failed",
        res.status,
        new Error(res.statusText),
      );
    }

    return await this.parseJSON<SonioxFileUploadResponse>(res);
  }

  /**
   * Deletes a file from the Soniox backend.
   */
  private async deleteFile(fileId: string) {
    let res: Response;

    try {
      res = await this.fetch(`${this.params.apiBaseUrl}/files/${fileId}`, {
        method: "DELETE",
        headers: this.getHeaders(),
      });
    } catch (error) {
      throw new SonioxAPIError(
        "File deletion failed: network error",
        undefined,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    if (!res.ok) {
      throw new SonioxAPIError(
        "File deletion failed",
        res.status,
        new Error(res.statusText),
      );
    }
  }

  /**
   * Creates the transcription resource from a file with provided parameters.
   */
  private async createTranscription(
    body: SonioxCreateTranscriptionRequest,
  ): Promise<SonioxCreateTranscriptionResponse> {
    let res: Response;

    try {
      res = await this.fetch(`${this.params.apiBaseUrl}/transcriptions`, {
        method: "POST",
        headers: {
          ...this.getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new SonioxAPIError(
        "Transcription creation failed: network error",
        undefined,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    if (!res.ok) {
      throw new SonioxAPIError(
        "Transcription creation failed",
        res.status,
        new Error(res.statusText),
      );
    }

    return this.parseJSON<SonioxCreateTranscriptionResponse>(res);
  }

  /**
   * Gets the transcription resource from the Soniox backend.
   */
  private async getTranscription(
    transcriptionId: string,
  ): Promise<SonioxTranscriptionStatusResponse> {
    let res: Response;

    try {
      res = await this.fetch(
        `${this.params.apiBaseUrl}/transcriptions/${transcriptionId}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        },
      );
    } catch (error) {
      throw new SonioxAPIError(
        "Transcription query failed: network error",
        undefined,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    if (!res.ok) {
      throw new SonioxAPIError(
        "Transcription query failed",
        res.status,
        new Error(res.statusText),
      );
    }

    return await this.parseJSON<SonioxTranscriptionStatusResponse>(res);
  }

  /**
   * Deletes the transcription resource from the Soniox backend.
   */
  private async deleteTranscription(transcriptionId: string) {
    let res: Response;

    try {
      res = await this.fetch(
        `${this.params.apiBaseUrl}/transcriptions/${transcriptionId}`,
        {
          method: "DELETE",
          headers: this.getHeaders(),
        },
      );
    } catch (error) {
      throw new SonioxAPIError(
        "Transcription deletion failed: network error",
        undefined,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    if (!res.ok) {
      throw new SonioxAPIError(
        "Transcription deletion failed",
        res.status,
        new Error(res.statusText),
      );
    }
  }

  /**
   * Fetches the transcription transcript from the Soniox backend.
   * @returns A transcription with text and metadata
   */
  private async getTranscriptionTranscript(
    transcriptionId: string,
  ): Promise<SonioxTranscriptResponse> {
    let res: Response;
    try {
      res = await this.fetch(
        `${this.params.apiBaseUrl}/transcriptions/${transcriptionId}/transcript`,
        {
          method: "GET",
          headers: this.getHeaders(),
        },
      );
    } catch (error) {
      throw new SonioxAPIError(
        "Transcription transcript query failed: network error",
        undefined,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    if (!res.ok) {
      throw new SonioxAPIError(
        "Transcription transcript query failed",
        res.status,
        new Error(res.statusText),
      );
    }

    return await this.parseJSON<SonioxTranscriptResponse>(res);
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

      while (true) {
        if (Date.now() - startTime > timeoutMs) {
          throw new SonioxTimeoutError("Transcription job polling timed out");
        }

        const statusResponse = await this.getTranscription(transcriptionId);

        if (statusResponse.status === "completed") {
          break;
        }

        if (statusResponse.status === "error") {
          throw new SonioxAPIError(
            `Transcription failed: ${
              statusResponse.error_message ?? "Unknown error"
            }`,
          );
        }

        await new Promise((r) => setTimeout(r, pollingInterval));
      }

      return await this.getTranscriptionTranscript(transcriptionId);
    } finally {
      const cleanupErrors: Error[] = [];

      if (fileId) {
        try {
          await this.deleteFile(fileId);
        } catch (error) {
          cleanupErrors.push(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }

      if (transcriptionId) {
        try {
          await this.deleteTranscription(transcriptionId);
        } catch (error) {
          cleanupErrors.push(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }

      if (cleanupErrors.length > 0) {
        console.warn("Cleanup errors:", cleanupErrors);
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
