from pathlib import Path
import re
import html
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from pypdf import PdfReader
from pdf2image import convert_from_path

ROOT = Path(__file__).resolve().parent.parent
src = ROOT / 'docs/用户视角体检_20261020/开物用户体验与产品发展体检报告.md'
dest = ROOT / 'output/pdf/开物用户体验与产品发展体检报告_20261020.pdf'
qa = ROOT / 'output/audit-qa-20261020'
dest.parent.mkdir(parents=True, exist_ok=True)
qa.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('AuditBody', 'C:/Windows/Fonts/simsun.ttc', subfontIndex=0))
pdfmetrics.registerFont(TTFont('AuditBold', 'C:/Windows/Fonts/simhei.ttf'))
pdfmetrics.registerFontFamily('AuditBody', normal='AuditBody', bold='AuditBold', italic='AuditBody', boldItalic='AuditBold')
styles = {
 'title': ParagraphStyle('title', fontName='AuditBold', fontSize=23, leading=32, spaceAfter=14, textColor=colors.black, wordWrap='CJK'),
 'h1': ParagraphStyle('h1', fontName='AuditBold', fontSize=16, leading=23, spaceBefore=19, spaceAfter=9, keepWithNext=True, wordWrap='CJK'),
 'h2': ParagraphStyle('h2', fontName='AuditBold', fontSize=12.5, leading=19, spaceBefore=14, spaceAfter=7, keepWithNext=True, wordWrap='CJK'),
 'body': ParagraphStyle('body', fontName='AuditBody', fontSize=11, leading=18, spaceAfter=9, wordWrap='CJK', allowWidows=0, allowOrphans=0),
 'bullet': ParagraphStyle('bullet', fontName='AuditBody', fontSize=11, leading=18, spaceAfter=7, leftIndent=10, firstLineIndent=-9, wordWrap='CJK', allowWidows=0, allowOrphans=0),
 'cell': ParagraphStyle('cell', fontName='AuditBody', fontSize=9.5, leading=15, wordWrap='CJK'),
 'th': ParagraphStyle('th', fontName='AuditBold', fontSize=10, leading=15, wordWrap='CJK'),
}
def rich(s):
 s=html.escape(s)
 s=re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
 return re.sub(r'`([^`]+)`', r'\1', s)

story=[]
lines=src.read_text(encoding='utf-8').splitlines()
i=0
while i<len(lines):
 line=lines[i].strip()
 if not line:
  i+=1
  continue
 if line.startswith('|'):
  rows=[]
  while i<len(lines) and lines[i].strip().startswith('|'):
   cells=[s.strip() for s in lines[i].strip().strip('|').split('|')]
   if not all(re.fullmatch(r':?-+:?',s.replace(' ','')) for s in cells): rows.append(cells)
   i+=1
  n=len(rows[0]); avail=A4[0]-100
  widths={2:[avail*.30,avail*.70],3:[avail*.20,avail*.31,avail*.49],4:[avail*.075,avail*.275,avail*.31,avail*.34]}[n]
  t=Table([[Paragraph(rich(c),styles['th' if ri==0 else 'cell']) for c in row] for ri,row in enumerate(rows)], colWidths=widths, repeatRows=1, hAlign='LEFT')
  t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#EDF1F4')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),('LINEBELOW',(0,0),(-1,0),.7,colors.HexColor('#A9B5BF')),('LINEBELOW',(0,1),(-1,-1),.3,colors.HexColor('#D8DFE5'))]))
  story.extend([t,Spacer(1,10)])
  continue
 if line.startswith('# '):
  story.append(Paragraph(rich(line[2:]),styles['title']))
 elif line.startswith('## '):
  story.append(Paragraph(rich(line[3:]),styles['h1']))
 elif line.startswith('### '):
  story.append(Paragraph(rich(line[4:]),styles['h2']))
 elif line.startswith('- '):
  story.append(Paragraph('· '+rich(line[2:]),styles['bullet']))
 elif re.match(r'^\d+\. ',line):
  story.append(Paragraph(rich(line),styles['bullet']))
 else:
  story.append(Paragraph(rich(line),styles['body']))
 i+=1

def chrome(canvas,doc):
 canvas.saveState()
 canvas.setFont('AuditBody',9)
 canvas.setFillColor(colors.HexColor('#607080'))
 if doc.page>1:
  canvas.drawString(50,A4[1]-30,'开物  用户体验与产品发展体检报告')
 canvas.drawString(50,26,'2026年10月20日  |  产品决策参考')
 canvas.drawRightString(A4[0]-50,26,str(doc.page))
 canvas.restoreState()

doc=SimpleDocTemplate(str(dest),pagesize=A4,rightMargin=50,leftMargin=50,topMargin=49,bottomMargin=48,title='开物用户体验与产品发展体检报告',author='产品体验审查',pageCompression=1)
doc.build(story,onFirstPage=chrome,onLaterPages=chrome)
pdf=PdfReader(dest)
text=''.join(page.extract_text() for page in pdf.pages)
assert '开物用户体验与产品发展体检报告' in text
assert 'Q05' in text and 'B04' in text and '附录' in text
renders=convert_from_path(str(dest),dpi=105,fmt='png',output_folder=str(qa),paths_only=True,poppler_path='C:/Users/DELL/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin')
for index,path in enumerate(renders):
 Path(path).replace(qa/f'page-{index+1:02}.png')
print(f'PDF: {dest}\nPages: {len(pdf.pages)}\nSource characters: {len(src.read_text(encoding="utf-8"))}\nExtracted characters: {len(text)}\nQA: {qa}')
