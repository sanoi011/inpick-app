"""Test render_dimensions function from module"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from dimension_renderer import render_dimensions
import os

clean_path = 'saved_plans/대전유성구/샘물타운/76_60m2/clean.png'
final_path = 'saved_plans/대전유성구/샘물타운/76_60m2/final.png'

# Remove existing final
if os.path.exists(final_path):
    os.remove(final_path)

result = render_dimensions(clean_path, final_path, 78.0)
print(f'Result: {result}')
if os.path.exists(final_path):
    print(f'Final: {os.path.getsize(final_path)} bytes')
