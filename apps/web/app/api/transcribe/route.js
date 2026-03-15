import OpenAI from "openai";

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "Server misconfiguration: missing OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  let formData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Request body must be multipart/form-data" },
      { status: 400 }
    );
  }

  const audioFile = formData.get("audio");

  if (!audioFile || typeof audioFile === "string") {
    return Response.json(
      { error: "Missing required 'audio' file in form data" },
      { status: 400 }
    );
  }

  const sequence = Number(formData.get("sequence") ?? 0);

  try {
    const openai = new OpenAI({ apiKey });

    const transcription = await openai.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file: audioFile,
      response_format: "json"
    });

    return Response.json({
      text: transcription.text,
      sequence: Number.isInteger(sequence) ? sequence : 0
    });
  } catch (error) {
    const status = error?.status || 502;
    const message =
      error?.message || "Whisper API request failed";

    return Response.json(
      { error: message },
      { status: status >= 400 && status < 500 ? status : 502 }
    );
  }
}
