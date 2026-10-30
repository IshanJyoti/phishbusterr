# PhishBuster AI — server.py

from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import os
import re

app = Flask(__name__)
CORS(app)

MODEL_PATH = 'model.pkl'
model = None

def load_model():
    global model
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)
        print("Model loaded successfully!")
    else:
        print("No model found. Run train.py first!")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'running', 'model_loaded': model is not None})

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({'error': 'Model not loaded. Run train.py first.'}), 503

    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'Missing text field'}), 400

    text = data['text']
    probability = model.predict_proba([text])[0]
    phishing_prob = float(probability[1]) * 100

    if phishing_prob >= 75:
        verdict = 'PHISHING'
        result_type = 'danger'
    elif phishing_prob >= 40:
        verdict = 'SUSPICIOUS'
        result_type = 'warning'
    else:
        verdict = 'SAFE'
        result_type = 'safe'

    indicators = generate_indicators(text, phishing_prob)

    explanation = (
        f"ML model confidence: {phishing_prob:.1f}% phishing probability. "
        f"{'High risk — do not click any links.' if phishing_prob > 60 else 'Exercise caution with this email.' if phishing_prob > 30 else 'Email appears legitimate.'}"
    )

    return jsonify({
        'verdict': verdict,
        'score': round(phishing_prob),
        'explanation': explanation,
        'indicators': indicators,
        'type': result_type,
        'model': 'ml'
    })

def generate_indicators(text, score):
    indicators = []
    text_lower = text.lower()

    urgent_words = ['urgent', 'immediate', 'suspend', 'expire', 'verify', 'confirm', 'warning', 'alert']
    if any(w in text_lower for w in urgent_words):
        indicators.append({'label': 'URGENCY LANGUAGE', 'color': 'red'})

    if re.search(r'https?://\d+\.\d+\.\d+\.\d+', text):
        indicators.append({'label': 'IP ADDRESS LINK', 'color': 'red'})

    suspicious_tlds = ['.xyz', '.tk', '.ml', '.ga', '.cf', '.click', '.top']
    if any(tld in text_lower for tld in suspicious_tlds):
        indicators.append({'label': 'SUSPICIOUS TLD', 'color': 'red'})

    money_words = ['won', 'prize', 'million', 'reward', 'free', 'gift', 'claim']
    if any(w in text_lower for w in money_words):
        indicators.append({'label': 'REWARD BAIT', 'color': 'yellow'})

    if re.search(r'dear (customer|user|client|member)', text_lower):
        indicators.append({'label': 'GENERIC GREETING', 'color': 'yellow'})

    credential_words = ['password', 'login', 'username', 'credential', 'account details']
    if any(w in text_lower for w in credential_words):
        indicators.append({'label': 'CREDENTIAL REQUEST', 'color': 'red'})

    if score < 30:
        indicators.append({'label': 'LOW RISK SCORE', 'color': 'green'})

    return indicators[:6]

if __name__ == '__main__':
    load_model()
    print("\nPhishBuster ML Server running on http://localhost:5000\n")
    app.run(host='0.0.0.0', port=5000, debug=False)