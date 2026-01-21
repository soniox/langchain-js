import { expect, test, describe, beforeEach, jest } from "@jest/globals";
import { SonioxAudioTranscriptLoader } from "../soniox.js";

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe("SonioxAudioTranscriptLoader", () => {
  const mockApiKey = "test-api-key";
  const mockAudioData = new Uint8Array([1, 2, 3, 4, 5]);
  const mockFileId = "file-123";
  const mockTranscriptionId = "transcription-456";

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear environment variables
    delete process.env.SONIOX_API_KEY;
  });

  describe("Constructor validation", () => {
    test("should throw error when no options provided", () => {
      expect(() => {
        // @ts-expect-error Testing invalid input
        new SonioxAudioTranscriptLoader();
      }).toThrow("No Soniox params provided");
    });

    test("should throw error when no API key provided", () => {
      expect(() => {
        new SonioxAudioTranscriptLoader({
          audio: mockAudioData,
        });
      }).toThrow("No Soniox API key provided");
    });

    test("should use environment variable for API key", () => {
      process.env.SONIOX_API_KEY = mockApiKey;

      const loader = new SonioxAudioTranscriptLoader({
        audio: mockAudioData,
      });

      expect(loader).toBeDefined();
    });

    test("should throw error when polling interval is too short", () => {
      expect(() => {
        new SonioxAudioTranscriptLoader({
          audio: mockAudioData,
          apiKey: mockApiKey,
          pollingIntervalMs: 500,
        });
      }).toThrow("Polling interval should be longer");
    });

    test("should accept valid polling interval", () => {
      const loader = new SonioxAudioTranscriptLoader({
        audio: mockAudioData,
        apiKey: mockApiKey,
        pollingIntervalMs: 2000,
      });

      expect(loader).toBeDefined();
    });

    test("should accept valid polling timeout", () => {
      const loader = new SonioxAudioTranscriptLoader({
        audio: mockAudioData,
        apiKey: mockApiKey,
        pollingTimeoutMs: 2 * 60 * 1000,
      });

      expect(loader).toBeDefined();
    });
  });

  describe("Transcription workflow", () => {
    beforeEach(() => {
      // Mock successful file upload
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: mockFileId }),
          statusText: "OK",
        } as Response),
      );

      // Mock successful transcription creation
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: mockTranscriptionId }),
          statusText: "OK",
        } as Response),
      );

      // Mock transcription status - completed
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: "completed" }),
          statusText: "OK",
        } as Response),
      );

      // Mock transcript retrieval
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ text: "Test transcription text" }),
          statusText: "OK",
        } as Response),
      );

      // Mock file deletion
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          statusText: "OK",
        } as Response),
      );

      // Mock transcription deletion
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          statusText: "OK",
        } as Response),
      );
    });

    test("should successfully transcribe audio", async () => {
      const loader = new SonioxAudioTranscriptLoader({
        audio: mockAudioData,
        apiKey: mockApiKey,
      });

      const docs = await loader.load();

      expect(docs).toHaveLength(1);
      expect(docs[0].pageContent).toBe("Test transcription text");
      expect(docs[0].metadata).toEqual({ text: "Test transcription text" });
    });
  });

  describe("Error handling", () => {
    test("should handle empty file upload", async () => {
      const loader = new SonioxAudioTranscriptLoader({
        audio: new Uint8Array(),
        apiKey: "invalid-key",
      });

      await expect(loader.load()).rejects.toThrow("Audio buffer is empty");
    });

    test("should handle file upload failure", async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          statusText: "Unauthorized",
        } as Response),
      );

      const loader = new SonioxAudioTranscriptLoader({
        audio: mockAudioData,
        apiKey: mockApiKey,
      });

      await expect(loader.load()).rejects.toThrow("File upload failed");
    });

    test("should handle transcription creation failure", async () => {
      // Mock successful file upload
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: mockFileId }),
          statusText: "OK",
        } as Response),
      );

      // Mock failed transcription creation
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          statusText: "Bad Request",
        } as Response),
      );

      // Mock file deletion
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          statusText: "OK",
        } as Response),
      );

      const loader = new SonioxAudioTranscriptLoader({
        audio: mockAudioData,
        apiKey: mockApiKey,
      });

      await expect(loader.load()).rejects.toThrow(
        "Transcription creation failed",
      );
    });

    test("should handle transcription error status", async () => {
      // Mock successful file upload
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: mockFileId }),
          statusText: "OK",
        } as Response),
      );

      // Mock successful transcription creation
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: mockTranscriptionId }),
          statusText: "OK",
        } as Response),
      );

      // Mock transcription status - error
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: "error",
              error_message: "Audio format not supported",
            }),
          statusText: "OK",
        } as Response),
      );

      // Mock file deletion
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          statusText: "OK",
        } as Response),
      );

      // Mock transcription deletion
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          statusText: "OK",
        } as Response),
      );

      const loader = new SonioxAudioTranscriptLoader({
        audio: mockAudioData,
        apiKey: mockApiKey,
      });

      await expect(loader.load()).rejects.toThrow(
        "Transcription failed: Audio format not supported",
      );
    });

    test("should handle polling timeout", async () => {
      // Mock successful file upload
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: mockFileId }),
          statusText: "OK",
        } as Response),
      );

      // Mock successful transcription creation
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: mockTranscriptionId }),
          statusText: "OK",
        } as Response),
      );

      // Mock transcription status - always processing (will timeout)
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: "processing" }),
          statusText: "OK",
        } as Response),
      );

      const loader = new SonioxAudioTranscriptLoader({
        audio: mockAudioData,
        apiKey: mockApiKey,
        pollingIntervalMs: 1000,
        pollingTimeoutMs: 2000,
      });

      await expect(loader.load()).rejects.toThrow(
        "Transcription job polling timed out",
      );
    }, 3000); // Increase timeout for this test

    test("should handle transcript retrieval failure", async () => {
      // Mock successful file upload
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: mockFileId }),
          statusText: "OK",
        } as Response),
      );

      // Mock successful transcription creation
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: mockTranscriptionId }),
          statusText: "OK",
        } as Response),
      );

      // Mock transcription status - completed
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: "completed" }),
          statusText: "OK",
        } as Response),
      );

      // Mock failed transcript retrieval
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          statusText: "Not Found",
        } as Response),
      );

      // Mock file deletion
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          statusText: "OK",
        } as Response),
      );

      // Mock transcription deletion
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          statusText: "OK",
        } as Response),
      );

      const loader = new SonioxAudioTranscriptLoader({
        audio: mockAudioData,
        apiKey: mockApiKey,
      });

      await expect(loader.load()).rejects.toThrow(
        "Transcription transcript query failed",
      );
    });
  });

  describe("Cleanup operations", () => {
    test("should cleanup files even when transcription fails", async () => {
      // Mock successful file upload
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: mockFileId }),
          statusText: "OK",
        } as Response),
      );

      // Mock failed transcription creation
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          statusText: "Bad Request",
        } as Response),
      );

      // Mock file deletion
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          statusText: "OK",
        } as Response),
      );

      const loader = new SonioxAudioTranscriptLoader({
        audio: mockAudioData,
        apiKey: mockApiKey,
      });

      await expect(loader.load()).rejects.toThrow();

      // Verify file deletion was called
      const deleteCalls = (
        fetch as jest.MockedFunction<typeof fetch>
      ).mock.calls.filter((call) => call[1]?.method === "DELETE");
      expect(deleteCalls.length).toBeGreaterThan(0);
    });
  });
});
