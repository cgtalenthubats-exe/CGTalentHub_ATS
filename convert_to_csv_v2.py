import json
import csv
import os

# Load the JSON data
input_file = r'c:\Users\HP\.gemini\antigravity\brain\ef9421f3-72b7-4452-aab9-ada5962145b2\.system_generated\steps\4296\output.txt'
output_file = r'c:\Users\HP\.gemini\antigravity\scratch\CGTalentHub_ATS\interview_feedback_export_v2.csv'

with open(input_file, 'r', encoding='utf-8') as f:
    outer_data = json.load(f)
    result_str = outer_data.get('result', '')
    
    # Find the start of the JSON array within the result string
    json_start = result_str.find('[')
    json_end = result_str.rfind(']') + 1
    json_data = json.loads(result_str[json_start:json_end])

if not json_data:
    print("No data found.")
    exit()

# Get all unique keys from the data to use as headers
all_keys = []
for row in json_data:
    for key in row.keys():
        if key not in all_keys:
            all_keys.append(key)

# Reorder keys to put the requested ones first for convenience
priority_keys = ['jr_id', 'candidate_id', 'candidate_name', 'jr_candidate_id']
headers = [k for k in priority_keys if k in all_keys] + [k for k in all_keys if k not in priority_keys]

# Write to CSV
with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=headers)
    writer.writeheader()
    for row in json_data:
        # Clean up newlines in text fields
        for key in row:
            if isinstance(row[key], str):
                row[key] = row[key].replace('\n', ' ').replace('\r', ' ')
        writer.writerow(row)

print(f"Successfully exported {len(json_data)} records to {output_file}")
