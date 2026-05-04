import csv
import json
import os
import urllib.request
import time
import sys
import io

# Set stdout to utf-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

url = "https://ddeqeaicjyrevqdognbn.supabase.co/rest/v1/industry_issue"
key = "sb_publishable_UDxVdxP4fSEZmcjx-q_2DA_jzLA8mdZ"
folder = r"C:\HR ATS_CGC project\Industry issue"
files = [f for f in os.listdir(folder) if f.endswith('.csv')]

def clean_col(h):
    return h.replace('/', '_').replace(' ', '_').replace('.', '_').replace('-', '_').replace('(', '').replace(')', '')

def import_batch(batch):
    req = urllib.request.Request(url, data=json.dumps(batch).encode('utf-8'))
    req.add_header('apikey', key)
    req.add_header('Authorization', f'Bearer {key}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'return=minimal')
    try:
        with urllib.request.urlopen(req) as response:
            return response.status
    except Exception as e:
        print(f"Error importing batch: {e}")
        if hasattr(e, 'read'):
            print(f"Response: {e.read().decode('utf-8')}")
        return None

print(f"Starting import of {len(files)} files...")

total_imported = 0
for file_idx, file_name in enumerate(files):
    path = os.path.join(folder, file_name)
    file_data = []
    print(f"Processing file {file_idx+1}/{len(files)}: {file_name}")
    try:
        with open(path, mode='r', encoding='utf-8-sig', errors='replace') as f:
            reader = csv.DictReader(f)
            # Create a mapping of original header to cleaned header
            fieldnames = reader.fieldnames
            mapping = {h: clean_col(h) for h in fieldnames}
            
            for row in reader:
                # Build the record with cleaned keys
                record = {}
                for k, v in row.items():
                    if k in mapping:
                        record[mapping[k]] = v
                file_data.append(record)
                
                # Import in batches of 50
                if len(file_data) >= 50:
                    status = import_batch(file_data)
                    if status in [200, 201, 204]:
                        total_imported += len(file_data)
                    file_data = []
            
            # Import remaining from this file
            if file_data:
                status = import_batch(file_data)
                if status in [200, 201, 204]:
                    total_imported += len(file_data)
                file_data = []
                
    except Exception as e:
        print(f"Error processing {file_name}: {e}")

print(f"Import process completed. Total rows imported: {total_imported}")
