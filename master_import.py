import csv
import json
import os
import urllib.request
import time
import sys
import io

# Set stdout to utf-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

url_people = "https://ddeqeaicjyrevqdognbn.supabase.co/rest/v1/industry_issue"
url_details = "https://ddeqeaicjyrevqdognbn.supabase.co/rest/v1/industry_issue_detailed"
key = "sb_publishable_UDxVdxP4fSEZmcjx-q_2DA_jzLA8mdZ"
folder = r"C:\HR ATS_CGC project\Industry issue"
files = [f for f in os.listdir(folder) if f.endswith('.csv')]

target_columns = [
    "companyFoundedIn", "companyIndustry", "companyLinkedin", "companyName",
    "companySize", "companyWebsite", "fullName", "jobTitle", "headline",
    "linkedinPublicUrl", "linkedinUrl"
]

def api_call(url, data, method="POST", extra_headers=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), method=method)
    req.add_header('apikey', key)
    req.add_header('Authorization', f'Bearer {key}')
    req.add_header('Content-Type', 'application/json')
    if extra_headers:
        for k, v in extra_headers.items():
            req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        print(f"API Error ({url}): {e}")
        if hasattr(e, 'read'):
            print(f"Response: {e.read().decode('utf-8')}")
        return None

# Dictionary to store linkedinUrl -> id mapping
url_to_id = {}

print(f"Starting migration to 2 tables...")

for file_idx, file_name in enumerate(files):
    path = os.path.join(folder, file_name)
    print(f"Processing {file_name} ({file_idx+1}/{len(files)})")
    
    try:
        with open(path, mode='r', encoding='utf-8-sig', errors='replace') as f:
            reader = csv.DictReader(f)
            for row in reader:
                lurl = row.get("linkedinUrl")
                if not lurl: continue
                
                # 1. Upsert person
                person_data = {col: row.get(col) for col in target_columns}
                
                # Check if we already handled this person in this script
                if lurl not in url_to_id:
                    # Upsert to get ID back
                    # Prefer: return=representation returns the inserted/existing row
                    res = api_call(url_people + "?on_conflict=linkedinUrl", [person_data], method="POST", 
                                   extra_headers={"Prefer": "return=representation"})
                    if res:
                        res_json = json.loads(res)
                        if res_json:
                            url_to_id[lurl] = res_json[0]['id']
                
                person_id = url_to_id.get(lurl)
                if not person_id: continue
                
                # 2. Extract experiences 0 to 6
                exp_batch = []
                for i in range(7):
                    cname_key = f"experiences/{i}/companyName"
                    cindustry_key = f"experiences/{i}/companyIndustry"
                    curn_key = f"experiences/{i}/companyUrn"
                    ctitle_key = f"experiences/{i}/title"
                    
                    cname = row.get(cname_key)
                    if cname and cname.strip():
                        exp_batch.append({
                            "industry_issue_id": person_id,
                            "companyName": cname,
                            "companyIndustry": row.get(cindustry_key),
                            "companyUrn": row.get(curn_key),
                            "title": row.get(ctitle_key),
                            "experience_index": i
                        })
                    else:
                        # Stop if companyName is empty as per user rule
                        break
                
                if exp_batch:
                    api_call(url_details, exp_batch, method="POST")

    except Exception as f_err:
        print(f"File Error {file_name}: {f_err}")

print("Master import completed.")
