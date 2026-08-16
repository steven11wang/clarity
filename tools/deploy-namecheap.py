#!/usr/bin/env python3
"""
Deploy Clarity to Namecheap Stellar Hosting via FTP / FTPS
Usage:
    python3 tools/deploy-namecheap.py
Or set environment variables:
    FTP_HOST=ftp.satclarity.com (or server IP / hostname)
    FTP_USER=your_cpanel_username
    FTP_PASS=your_cpanel_password
    FTP_DIR=public_html
"""

import os
import sys
import ftplib
import getpass
from pathlib import Path

def get_credentials():
    host = os.environ.get('FTP_HOST') or input('Namecheap FTP Host / Server IP (e.g. ftp.satclarity.com or 198.54.116.145): ').strip()
    user = os.environ.get('FTP_USER') or input('cPanel / FTP Username: ').strip()
    password = os.environ.get('FTP_PASS') or getpass.getpass('cPanel / FTP Password: ').strip()
    remote_dir = os.environ.get('FTP_DIR', 'public_html')
    return host, user, password, remote_dir

def ensure_remote_dir(ftp, path_parts):
    current = ""
    for part in path_parts:
        if not part:
            continue
        try:
            ftp.cwd(part)
        except ftplib.error_perm:
            try:
                ftp.mkd(part)
                ftp.cwd(part)
            except Exception as e:
                print(f"Error creating directory {part}: {e}")

def upload_directory(ftp, local_base, remote_root):
    local_base = Path(local_base)
    files_uploaded = 0
    total_files = sum(1 for _ in local_base.rglob('*') if _.is_file())

    print(f"\n🚀 Uploading {total_files} files to {remote_root}...")

    for root, dirs, files in os.walk(local_base):
        rel_path = Path(root).relative_to(local_base)
        
        # Navigate to target directory
        ftp.cwd('/')
        try:
            ftp.cwd(remote_root)
        except Exception:
            ftp.mkd(remote_root)
            ftp.cwd(remote_root)

        if str(rel_path) != '.':
            for part in rel_path.parts:
                try:
                    ftp.cwd(part)
                except ftplib.error_perm:
                    ftp.mkd(part)
                    ftp.cwd(part)

        for filename in files:
            if filename in ['.DS_Store', 'Thumbs.db']:
                continue
            local_filepath = Path(root) / filename
            files_uploaded += 1
            print(f"[{files_uploaded}/{total_files}] Uploading: {rel_path / filename}")
            
            with open(local_filepath, 'rb') as f:
                ftp.storbinary(f'STOR {filename}', f)

def main():
    dist_path = Path(__file__).resolve().parent.parent / 'dist'
    if not dist_path.exists() or not (dist_path / 'landing.html').exists():
        print("dist folder not found or incomplete. Running npm run package first...")
        os.system('npm run package')

    print("=" * 60)
    print("  Clarity -> Namecheap Stellar Hosting Deployer")
    print("=" * 60)

    host, user, password, remote_dir = get_credentials()

    print(f"\nConnecting to {host} as {user}...")
    try:
        # Try TLS first for security, fallback to standard FTP if TLS not configured
        try:
            ftp = ftplib.FTP_TLS(host)
            ftp.login(user, password)
            ftp.prot_p()
            print(" Connected securely via FTPS (FTP with TLS).")
        except Exception:
            ftp = ftplib.FTP(host)
            ftp.login(user, password)
            print(" Connected via standard FTP.")

        upload_directory(ftp, dist_path, remote_dir)
        ftp.quit()
        print("\n🎉 Deployment completed successfully!")
        print("Visit: https://satclarity.com")
    except Exception as e:
        print(f"\n❌ Deployment failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
