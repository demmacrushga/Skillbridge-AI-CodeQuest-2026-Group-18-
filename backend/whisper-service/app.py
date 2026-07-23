"""
SkillBridge Whisper Speech-to-Text Microservice
Wraps OpenAI Whisper to provide an /asr REST endpoint
for the mock-interview-service backend.
"""
import os
import sys
import tempfile
import whisper
from flask import Flask, request, jsonify

app = Flask(__name__)

# Load model once at startup — use 'base.en' for speed/accuracy balance
MODEL_NAME = os.environ.get("WHISPER_MODEL", "tiny.en")
print(f"[whisper-service] Loading Whisper model: {MODEL_NAME} ...")
model = whisper.load_model(MODEL_NAME)
print(f"[whisper-service] Model '{MODEL_NAME}' loaded successfully.")


@app.route("/asr", methods=["POST"])
def transcribe():
    """
    Accepts multipart/form-data with an 'audio_file' field.
    Returns JSON: { "text": "transcribed text..." }
    """
    if "audio_file" not in request.files:
        return jsonify({"error": "No audio_file provided"}), 400

    audio_file = request.files["audio_file"]
    if audio_file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    # Save to temp file for Whisper to process
    suffix = os.path.splitext(audio_file.filename)[1] or ".m4a"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
        audio_file.save(tmp_path)

    try:
        result = model.transcribe(tmp_path, language="en", fp16=False)
        text = result.get("text", "").strip()

        if not text:
            return jsonify({"error": "No speech detected"}), 422

        return jsonify({"text": text})
    except Exception as e:
        print(f"[whisper-service] Transcription error: {e}", file=sys.stderr)
        return jsonify({"error": f"Transcription failed: {str(e)}"}), 500
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint for startup probes."""
    return jsonify({"status": "ok", "model": MODEL_NAME})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 9000))
    print(f"[whisper-service] Starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
