import json
import sys

# Set default encoding to utf-8
sys.stdout.reconfigure(encoding='utf-8')

if len(sys.argv) < 2:
    print("Usage: python print_batch.py <index>")
    sys.exit(1)

index = int(sys.argv[1])
with open('import_industry_issue_batches.json', encoding='utf-8') as f:
    batches = json.load(f)
    if 0 <= index < len(batches):
        print(batches[index])
    else:
        print(f"Index {index} out of range (0-{len(batches)-1})")
