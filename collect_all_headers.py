import csv
import os
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

folder = r"C:\HR ATS_CGC project\Industry issue"
files = [f for f in os.listdir(folder) if f.endswith('.csv')]

all_headers = set()
for file_name in files:
    path = os.path.join(folder, file_name)
    try:
        with open(path, mode='r', encoding='utf-8-sig', errors='replace') as f:
            reader = csv.reader(f)
            headers = next(reader)
            for h in headers:
                if h.strip():
                    all_headers.add(h.strip())
    except Exception as e:
        print(f"Error reading {file_name}: {e}")

def clean_col(h):
    return h.replace('/', '_').replace(' ', '_').replace('.', '_').replace('-', '_').replace('(', '').replace(')', '')

unique_clean_headers = sorted(list(set(clean_col(h) for h in all_headers)))

print(f"Total unique headers: {len(unique_clean_headers)}")
# print("|".join(unique_clean_headers))


