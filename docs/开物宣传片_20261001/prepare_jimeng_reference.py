from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
OUT = ROOT / '即梦上传素材'
OUT.mkdir(exist_ok=True)
SOURCE = r'E:\剪映素材\实体获客编导（不一）\开物.mp4'
FFMPEG = r'C:\Users\DELL\.codex\visualizations\2026\10\01\01a0f6b7-a3a2-7882-a963-9b4ae554e9a3\video-tools\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
cuts = [(0, 3), (22, 25), (140, 145), (224, 227)]
filters = []
for i, (start, end) in enumerate(cuts):
    f = f'[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS,crop=1920:912:0:120'
    if i >= 2:
        f += ',drawbox=x=1530:y=0:w=390:h=90:color=0x12131c:t=fill'
        f += ',drawbox=x=0:y=680:w=275:h=232:color=0x12131c:t=fill'
        f += ',drawbox=x=275:y=835:w=550:h=77:color=0x12131c:t=fill'
        # Hide the current account line inside the dashboard, preserving the time and tools.
        if i == 3:
            f += ',drawbox=x=570:y=148:w=550:h=35:color=0x111620:t=fill'
    f += f',scale=1280:608,pad=1280:720:0:56:color=0x080b14,fps=24,setsar=1,format=yuv420p[v{i}]'
    filters.append(f)
filters.append(''.join(f'[v{i}]' for i in range(4)) + 'concat=n=4:v=1:a=0[out]')
video = OUT / '开物_即梦参考_14秒.mp4'
cmd = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-i', SOURCE,
       '-filter_complex', ';'.join(filters), '-map', '[out]', '-an',
       '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-movflags', '+faststart', '-y', str(video)]
subprocess.run(cmd, check=True)
for t, name in [(1, '01_品牌首页'), (4.5, '02_功能卡片'), (8, '03_AI对话'), (12.5, '04_沉浸工作台')]:
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-ss', str(t), '-i', str(video),
                    '-frames:v', '1', '-y', str(OUT / f'{name}.png')], check=True)
meta = subprocess.run([FFMPEG, '-hide_banner', '-i', str(video)], capture_output=True)
print(meta.stderr.decode('utf-8', 'replace'))
print('Reference video and four screenshots prepared.')
