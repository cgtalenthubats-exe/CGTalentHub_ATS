import os
filepath = r'c:\Users\HP\.gemini\antigravity\scratch\CGTalentHub_ATS\scratch\batch_0.sql'
with open(filepath, 'r', encoding='utf-8') as f:
    for i in range(5):
        line = f.readline()
        if not line: break
        print(f"{i}: {repr(line[:200])}...")
