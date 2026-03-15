import { getVoiceIdForJudge, VALID_JUDGE_IDS } from "../../../lib/tts-config.js";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";
const MAX_TEXT_LENGTH = 5000;
const MIN_TEXT_LENGTH = 1;

export async function POST(request) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "TTS not configured" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const judgeId = typeof body?.judgeId === "string" ? body.judgeId.trim().toLowerCase() : "";

    if (!VALID_JUDGE_IDS.includes(judgeId)) {
      return new Response(
        JSON.stringify({ error: "Invalid judgeId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (text.length < MIN_TEXT_LENGTH || text.length > MAX_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Text length must be between 1 and 5000 characters" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const voiceId = getVoiceIdForJudge(judgeId);
    if (!voiceId) {
      return new Response(
        JSON.stringify({ error: "Voice not configured for this judge" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const url = `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2"
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[TTS] ElevenLabs error:", res.status, errText);
      return new Response(
        JSON.stringify({ error: "TTS service error" }),
        { status: res.status === 401 || res.status === 403 ? 503 : res.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const blob = await res.blob();
    const contentType = res.headers.get("Content-Type") || "audio/mpeg";

    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch (err) {
    console.error("[TTS] Error:", err);
    return new Response(
      JSON.stringify({ error: "TTS failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
