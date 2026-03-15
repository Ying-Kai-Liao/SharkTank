/**
 * Maps stage judge ids (cat, dog, shark) to ElevenLabs voice ID env var names.
 * Used by the TTS API route only; do not expose voice IDs to the client.
 */
export const JUDGE_VOICE_ENV_KEYS = Object.freeze({
  cat: "ELEVENLABS_VOICE_ID_CAT",
  dog: "ELEVENLABS_VOICE_ID_DOG",
  shark: "ELEVENLABS_VOICE_ID_SHARK"
});

export const VALID_JUDGE_IDS = Object.freeze(Object.keys(JUDGE_VOICE_ENV_KEYS));

export function getVoiceIdForJudge(judgeId, env = process.env) {
  const key = JUDGE_VOICE_ENV_KEYS[judgeId];
  if (!key) return null;
  const value = env[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
