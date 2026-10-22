# Text positions from a PDF in the same shape pdf.js gives the app (for testing the script reader off the browser).
import json, sys, pdfplumber
pdf = pdfplumber.open(sys.argv[1]); out = []
for i, p in enumerate(pdf.pages):
    ws = p.extract_words(extra_attrs=['fontname', 'size'], use_text_flow=True, keep_blank_chars=True, x_tolerance=1.5)
    out.append({'num': i + 1, 'width': float(p.width), 'height': float(p.height), 'items': [
        {'str': w['text'], 'x': round(w['x0'], 1), 'w': round(w['x1'] - w['x0'], 1), 'y': round(w['bottom'], 1),
         'size': round(w['size'], 1), 'font': w['fontname'].split('+')[-1]} for w in ws]})
json.dump(out, open(sys.argv[2], 'w'))
