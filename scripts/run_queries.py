import requests, time

URL = "http://127.0.0.1:8000/chat"
questions = [
    "Where did Saqlain study?",
    "What is Saqlain's email and phone?",
    "What roles has Saqlain held?",
    "What skills and technologies does Saqlain list?",
    "Summarize Saqlain's professional experience."
]

for q in questions:
    resp = requests.post(URL, data={"question": q, "top_k": 3})
    print('Q:', q)
    print('Status:', resp.status_code)
    try:
        data = resp.json()
    except Exception:
        print('Response:', resp.text)
        continue
    print('\nAnswer:\n', data.get('answer',''))
    print('\nResults:')
    for r in data.get('results', []):
        txt = r.get('text','').replace('\n',' ')[:300]
        print(f" - score={r.get('score'):.3f}  {txt}")
    print('\n' + ('-'*60) + '\n')
    time.sleep(0.4)
