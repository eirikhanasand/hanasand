#!/usr/bin/env python3
"""Raise small rotating audit stores to 2GB without changing security actions."""
from pathlib import Path
import os
import re
import shutil
import subprocess

def configure(path=Path('/etc/audit/auditd.conf')):
    text = path.read_text()
    values = dict(re.findall(r'^\s*([a-z_]+)\s*=\s*([^#\n]+)', text, re.MULTILINE))
    values = {key:value.strip() for key,value in values.items()}
    if values.get('max_log_file_action','').upper() != 'ROTATE':
        return {'changed':False,'reason':'Existing non-rotating security policy preserved'}
    size = max(100,int(values.get('max_log_file','8')))
    count = max(int(values.get('num_logs','5')), (2000+size-1)//size)
    old_size = int(values.get('max_log_file','8')); old_count = int(values.get('num_logs','5'))
    if old_size*old_count >= 2000:
        return {'changed':False,'max_log_file':old_size,'num_logs':old_count}
    log_dir = Path(values.get('log_file','/var/log/audit/audit.log')).parent
    required = (size*count-old_size*old_count)*1024*1024
    # Leave another full retention budget free for applications and system use.
    if shutil.disk_usage(log_dir).free < required + 2*1024**3:
        raise RuntimeError('Insufficient disk headroom for 2GB audit retention')
    for key,value in (('max_log_file',size),('num_logs',count)):
        pattern = r'^(\s*'+key+r'\s*=\s*)\d+'
        if re.search(pattern,text,re.MULTILINE):
            text = re.sub(pattern,lambda match:match.group(1)+str(value),text,flags=re.MULTILINE)
        else: text += '\n'+key+' = '+str(value)+'\n'
    backup = path.with_name(path.name+'.before-hanasand-retention')
    if not backup.exists(): shutil.copy2(path,backup)
    temporary = path.with_name(path.name+'.hanasand-pending')
    temporary.write_text(text)
    stat = path.stat(); os.chmod(temporary,stat.st_mode & 0o777)
    if os.geteuid() == 0: os.chown(temporary,stat.st_uid,stat.st_gid)
    temporary.replace(path)
    return {'changed':True,'max_log_file':size,'num_logs':count}

if __name__ == '__main__':
    result = configure()
    if result['changed']: subprocess.run(['auditctl','--signal','reload'],check=True)
    print(result)
