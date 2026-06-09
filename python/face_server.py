import base64
import os
import tempfile

from deepface import DeepFace
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

PORT = int(os.environ.get("FACE_SERVER_PORT", "5001"))


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "deepface"})


def decode_image_payload(raw: str) -> bytes:
    if "," in raw and raw.strip().startswith("data:"):
        raw = raw.split(",", 1)[1]
    return base64.b64decode(raw)


def clean_face(face: dict) -> dict:
    return {
        "age": face.get("age"),
        "gender": face.get("dominant_gender"),
        "emotion": face.get("dominant_emotion"),
        "race": face.get("dominant_race"),
        "emotions": face.get("emotion"),
        "gender_scores": face.get("gender"),
        "race_scores": face.get("race"),
        "region": face.get("region"),
    }


@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True) or {}
    image_raw = data.get("image")

    if not image_raw or not isinstance(image_raw, str):
        return jsonify({"error": "No image provided"}), 400

    tmp_path = None
    try:
        img_data = decode_image_payload(image_raw)
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            f.write(img_data)
            tmp_path = f.name

        result = DeepFace.analyze(
            img_path=tmp_path,
            actions=["age", "gender", "emotion", "race"],
            enforce_detection=False,
        )
        faces = result if isinstance(result, list) else [result]
        cleaned = [clean_face(face) for face in faces]
        return jsonify({"faces": cleaned, "count": len(cleaned)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=PORT, debug=False)
