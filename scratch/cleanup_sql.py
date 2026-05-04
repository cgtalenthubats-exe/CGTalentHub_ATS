import os
import re

scratch_dir = r'c:\Users\HP\.gemini\antigravity\scratch\CGTalentHub_ATS\scratch'

for i in range(89):
    filename = f'batch_{i}.sql'
    filepath = os.path.join(scratch_dir, filename)
    if not os.path.exists(filepath):
        continue
    
    print(f"Cleaning {filename}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    cleaned_lines = []
    for line in lines:
        # Match pattern like "1: " at the start of the line
        match = re.match(r'^\d+:\s?(.*)', line)
        if match:
            cleaned_lines.append(match.group(1) + '\n')
        else:
            # If it's a header line or something else
            if not line.startswith("The following code has been modified"):
                cleaned_lines.append(line)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(cleaned_lines)

print("Done cleaning all files.")
