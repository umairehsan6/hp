import os
import requests
import time

PDF_PATH = r"C:\Users\Cyber Commando\Downloads\SAQLAIN-HAMDANI (5).pdf"
INGEST_URL = "http://127.0.0.1:8000/ingest"
CHAT_URL = "http://127.0.0.1:8000/chat"

if not os.path.exists(PDF_PATH):
    print("PDF not found:", PDF_PATH)
    raise SystemExit(1)

print('Uploading', PDF_PATH, 'to', INGEST_URL)
with open(PDF_PATH, 'rb') as f:
    files = {'file': (os.path.basename(PDF_PATH), f, 'application/pdf')}
    resp = requests.post(INGEST_URL, files=files)

print('Ingest status:', resp.status_code)
try:
    print(resp.json())
except Exception:
    print(resp.text)

# small pause to allow server to finish any async work
time.sleep(1)

print('\nRunning a test query to /chat')
q = "Where did Saqlain study?"
resp2 = requests.post(CHAT_URL, data={"question": q, "top_k": 3})
print('Chat status:', resp2.status_code)
try:
    print(resp2.json())
except Exception:
    print(resp2.text)
