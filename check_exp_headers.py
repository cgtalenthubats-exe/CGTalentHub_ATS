import csv
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

path = r'C:\HR ATS_CGC project\Industry issue\dataset_Linkedin-Profile-Scraper_2026-04-21_14-09-14-183.csv'
with open(path, mode='r', encoding='utf-8-sig', errors='replace') as f:
    reader = csv.reader(f)
    headers = next(reader)
    # Print headers that start with 'experiences'
    exp_headers = [h for h in headers if h.startswith('experiences')]
    print("|".join(exp_headers[:20]))
