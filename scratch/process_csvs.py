import os
import csv
import json
import sys

# Suppress output to keep things clean or use a logger
def log(msg):
    print(msg)

# Set encoding for stdout
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

path = r'C:\HR ATS_CGC project\Industry issue'
files = [f for f in os.listdir(path) if f.casefold().endswith('.csv')]

def get_val(row, keys):
    for k in keys:
        if k in row and row[k]:
            return row[k]
    return None

all_data = []

log(f"Loading data from {len(files)} files...")

for fname in files:
    fpath = os.path.join(path, fname)
    try:
        with open(fpath, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Basic cleaning: remove empty keys and None values
                clean_row = {k: v for k, v in row.items() if k and v}
                
                record = {
                    'full_name': get_val(row, ['fullName', 'name', 'full_name', 'fullName']),
                    'first_name': get_val(row, ['firstName', 'first_name']),
                    'last_name': get_val(row, ['lastName', 'last_name']),
                    'headline': get_val(row, ['headline', 'title', 'summary']),
                    'linkedin_url': get_val(row, ['linkedinUrl', 'linkedinPublicUrl', 'url', 'profileUrl']),
                    'public_identifier': get_val(row, ['publicIdentifier', 'public_identifier', 'username']),
                    'raw_data': clean_row
                }
                
                # If both first and last name exist but no full name, combine them
                if not record['full_name'] and record['first_name'] and record['last_name']:
                    record['full_name'] = f"{record['first_name']} {record['last_name']}"
                
                all_data.append(record)
    except Exception as e:
        log(f"Error reading {fname}: {e}")

log(f"Total records processed: {len(all_data)}")

# Save processed data to a JSON file first to be safe
with open('scratch/industry_issue_records.json', 'w', encoding='utf-8') as f:
    json.dump(all_data, f, ensure_ascii=False, indent=2)

log("Data saved to scratch/industry_issue_records.json")
