import csv
import sys
import io

# Set stdout to utf-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

csv_file = r'C:\HR ATS_CGC project\Industry issue\dataset_Linkedin-Profile-Scraper_2026-04-21_14-09-14-183.csv'
try:
    with open(csv_file, mode='r', encoding='utf-8-sig', errors='replace') as f:
        reader = csv.reader(f)
        headers = next(reader)
        # Filter out empty headers and clean them
        headers = [h.strip() for h in headers if h.strip()]
        # Remove any unwanted characters from headers that might break SQL
        # Replace / with _ and space with _
        clean_headers = [h.replace('/', '_').replace(' ', '_').replace('.', '_') for h in headers]
        print("|".join(clean_headers))
except Exception as e:
    print(f"Error: {e}")

