import os
import csv
import json
import sys

# Set default encoding to utf-8 for stdout
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

path = r'C:\HR ATS_CGC project\Industry issue'

if os.path.exists(path):
    files = [f for f in os.listdir(path) if f.casefold().endswith('.csv')]
    if files:
        sample_path = os.path.join(path, files[0])
        try:
            with open(sample_path, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                first_row = next(reader)
                print("First row data (JSON):")
                # Filter out empty values for brevity
                clean_row = {k: v for k, v in first_row.items() if v}
                print(json.dumps(clean_row, indent=2, ensure_ascii=False))
        except Exception as e:
            print(f"Error: {e}")
