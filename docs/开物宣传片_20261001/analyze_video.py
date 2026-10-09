from pathlib import Path
import subprocess
from PIL import Image, ImageDraw, ImageFont

SOURCE = Path(r'E:\剪映素材\实体获客编导（不一）\开物.mp4')
FFMPEG = Path(r'C:\Users\DELL\.codex\visualizations\2026\10\01\01a0f6b7-a3a2-7882-a963-9b4ae554e9a3\video-tools\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe')
OUT = Path(__file__).resolve().parent
FRAMES = OUT / 'frames'
FRAMES.mkdir(exist_ok=True)
times = list(range(0, 257, 12))
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 22)
sheet = Image.new('RGB', (1920, ((len(times)+2)//3)*374), '#10121a')
for i, t in enumerate(times):
    path = FRAMES / f'{t:03d}s.jpg'
    p = subprocess.run([str(FFMPEG), '-hide_banner', '-loglevel', 'error', '-ss', str(t), '-i', str(SOURCE), '-frames:v', '1', '-q:v', '2', '-y', str(path)], capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.decode('utf-8', 'replace'))
    with Image.open(path) as frame:
        frame.thumbnail((640,344))
        x, y = (i%3)*640, (i//3)*374
        sheet.paste(frame, (x,y+30))
        ImageDraw.Draw(sheet).text((x+10,y+3),f'{t//60:02d}:{t%60:02d}',font=font,fill='white')
sheet.save(OUT / 'contact-sheet.jpg', quality=92)
print(f'Extracted {len(times)} frames; contact sheet: {OUT / "contact-sheet.jpg"}')
