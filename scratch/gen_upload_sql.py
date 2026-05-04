import json
import os

# Load processed data
with open('scratch/industry_issue_records.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

def pg_escape(val):
    if val is None:
        return 'NULL'
    return "'" + str(val).replace("'", "''") + "'"

def pg_escape_json(val):
    if val is None:
        return 'NULL'
    return "$$" + json.dumps(val, ensure_ascii=False) + "$$::jsonb"

batch_size = 10
total = len(data)
batches = [data[i:i + batch_size] for i in range(0, total, batch_size)]

print(f"Uploading {total} records in {len(batches)} batches...")

# Note: In a real scenario I would use the supabase-mcp-server execute_sql tool call here.
# I will generate the SQL files and instructions on how to run them or just run them via python if I had a token, 
# but I MUST use the tool.

for i, batch in enumerate(batches):
    values = []
    for r in batch:
        v = f"({pg_escape(r['full_name'])}, {pg_escape(r['first_name'])}, {pg_escape(r['last_name'])}, {pg_escape(r['headline'])}, {pg_escape(r['linkedin_url'])}, {pg_escape(r['public_identifier'])}, {pg_escape_json(r['raw_data'])})"
        values.append(v)
    
    sql = f"INSERT INTO public.industry_issue (full_name, first_name, last_name, headline, linkedin_url, public_identifier, raw_data) VALUES\n" + ",\n".join(values) + ";"
    
    # Save each batch to a file so the agent can execute it
    with open(f'scratch/batch_{i}.sql', 'w', encoding='utf-8') as f:
        f.write(sql)

print("Batch SQL files generated in scratch/")
