import os
import csv
import json

path = r'C:\HR ATS_CGC project\Industry issue'
all_cols = set()
files = [f for f in os.listdir(path) if f.casefold().endswith('.csv')]

print(f"Analyzing {len(files)} files...")

for fname in files:
    fpath = os.path.join(path, fname)
    try:
        with open(fpath, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            if reader.fieldnames:
                all_cols.update(reader.fieldnames)
    except Exception as e:
        print(f"Error reading headers of {fname}: {e}")

all_cols_list = sorted(list(all_cols))
print(f"Total unique columns found: {len(all_cols_list)}")

# Save to help in generating SQL
with open('scratch/all_columns.json', 'w') as f:
    json.dump(all_cols_list, f)

# Print a few to confirm
print("\nSamples of columns:")
print(all_cols_list[:50])
