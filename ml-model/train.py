# PhishBuster AI — train.py
# Trains the phishing detection ML model

import pandas as pd
import numpy as np
import pickle
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.pipeline import Pipeline

def create_demo_dataset():
    phishing_samples = [
        "URGENT: Your account has been suspended. Click here immediately to verify: http://fake-paypal.xyz/login",
        "Dear Customer, Your bank account requires immediate verification. Login now: http://192.168.1.1/secure",
        "Congratulations! You won $1,000,000. Claim your prize now! Send your details to claim@lottery-win.tk",
        "Warning: Unusual activity detected on your Amazon account. Verify now: http://amazon-secure-login.xyz",
        "Your Apple ID has been locked. Unlock immediately at: http://apple-id-verify.click/unlock",
        "FINAL NOTICE: Your PayPal account will be permanently suspended unless you verify within 24 hours",
        "Your Netflix subscription has expired. Update payment: http://netflix-billing-update.ml",
        "Microsoft Security Alert: Your computer is infected! Call 1-800-FAKE now for immediate help",
        "Dear user, confirm your email address or your account will be deleted: http://verify-now.tk/confirm",
        "You have a pending package. Pay $2 customs fee: http://dhl-delivery-fees.xyz/pay",
        "IMPORTANT: Your password expires today. Reset it here: http://password-reset-secure.ga",
        "Tax refund notice: You are eligible for a $500 refund. Submit form: http://irs-refund.ml/claim",
        "Your account has been compromised. Verify your identity immediately or lose access forever.",
        "WINNER: You have been selected for a $10,000 reward. Click to claim: http://reward-claim.tk",
        "Security breach detected. Update your credentials now: http://secure-update.xyz/login",
    ]

    safe_samples = [
        "Hi John, Just wanted to follow up on our meeting yesterday. Can we schedule a call for Thursday?",
        "Your order #12345 has been shipped. Expected delivery: March 25. Track at ups.com",
        "Team meeting reminder: Tomorrow at 2 PM in Conference Room B. Agenda attached.",
        "Newsletter: This month's top articles on technology and innovation. Unsubscribe anytime.",
        "GitHub: New pull request on repository phishbuster from user alice123. Review at github.com",
        "Your monthly bank statement is ready. Log in at yourbank.com to view your statement.",
        "Invitation: You are invited to Sarah's birthday party on April 5th at 7 PM. RSVP by March 30.",
        "Receipt for your Spotify subscription renewal - $9.99 charged to card ending 4242.",
        "Welcome to our team! Your onboarding documents are attached. See you Monday!",
        "Project update: The new feature is now live in production. QA sign-off complete.",
        "Reminder: Your dentist appointment is tomorrow at 10:00 AM at 123 Main St.",
        "Thanks for your purchase! Your confirmation number is ABC-12345. We will see you soon.",
        "Please find attached the quarterly report for your review. Let me know if you have questions.",
        "Your flight booking is confirmed. Check-in opens 24 hours before departure at airline.com",
        "Happy birthday! Wishing you a wonderful day filled with joy and celebration.",
    ]

    texts = phishing_samples + safe_samples
    labels = [1] * len(phishing_samples) + [0] * len(safe_samples)
    return pd.DataFrame({'text': texts, 'label': labels})


def preprocess_text(text):
    text = str(text).lower()
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def train_model(df):
    print("Dataset size:", len(df))
    print("Label counts:\n", df['label'].value_counts())

    X = df['text_combined'].apply(preprocess_text)
    y = df['label']

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(
            max_features=10000,
            ngram_range=(1, 2),
            sublinear_tf=True,
            min_df=1,
            stop_words='english'
        )),
        ('clf', LogisticRegression(
            C=1.0,
            max_iter=1000,
            solver='lbfgs',
            class_weight='balanced'
        ))
    ])

    print("\nTraining model...")
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    print("\nAccuracy:", accuracy_score(y_test, y_pred))
    print("\nReport:")
    print(classification_report(y_test, y_pred, target_names=['Safe', 'Phishing']))

    return pipeline


def save_model(pipeline, path='model.pkl'):
    with open(path, 'wb') as f:
        pickle.dump(pipeline, f)
    print(f"\nModel saved to {path}")


if __name__ == '__main__':
    print("=" * 40)
    print("  PhishBuster AI - Model Trainer")
    print("=" * 40)

    try:
        df = pd.read_csv('phishing_dataset.csv')
        print(f"Loaded real dataset: {len(df)} samples")
    except FileNotFoundError:
        print("No dataset found - using demo dataset")
        print("Download a real dataset from Kaggle for better accuracy!")
        df = create_demo_dataset()

    pipeline = train_model(df)
    save_model(pipeline)
    print("\nDone! Now run: python server.py")