import os
import sys

scratch_dir = r'c:\Users\HP\.gemini\antigravity\scratch\CGTalentHub_ATS\scratch'

def get_batches(start, count):
    all_sql = []
    for i in range(start, min(start + count, 89)):
        filename = f'batch_{i}.sql'
        filepath = os.path.join(scratch_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    # Remove the trailing semicolon if we are joining them, 
                    # but actually postgres inserts can be multiple statements.
                    if not content.endswith(';'):
                        content += ';'
                    all_sql.append(content)
    return "\n".join(all_sql)

if __name__ == "__main__":
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    print(get_batches(start, count))
