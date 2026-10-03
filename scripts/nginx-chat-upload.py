from pathlib import Path
from datetime import datetime
import shutil
import subprocess

target = Path('/etc/nginx/sites-available/xiaosong-web')
source = target.read_text()
anchor = '    server_name _;'
if anchor not in source:
    raise RuntimeError('Unexpected site configuration; no changes made')
if 'client_max_body_size' in source:
    raise RuntimeError('Upload limit already configured; inspect before changing')
backup = target.with_name('xiaosong-web.before-chat-files-' + datetime.now().strftime('%Y%m%d_%H%M%S'))
shutil.copy2(target, backup)
target.write_text(source.replace(anchor, anchor + '\n    client_max_body_size 12m;\n    proxy_read_timeout 300s;\n    proxy_send_timeout 300s;', 1))
check = subprocess.run(['nginx', '-t'], capture_output=True, text=True)
if check.returncode:
    shutil.copy2(backup, target)
    raise RuntimeError('Nginx validation failed; original configuration restored')
subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
print('Nginx upload limit 12 MB and upstream timeout 300 s applied; backup:', backup)
