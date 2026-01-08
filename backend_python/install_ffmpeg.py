import os
import zipfile
import urllib.request
import shutil
import sys

FFMPEG_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
INSTALL_DIR = os.path.join(os.getcwd(), "ffmpeg_runtime")
BIN_DIR = os.path.join(INSTALL_DIR, "bin")

def install_ffmpeg():
    print(f"🚀 Starting Auto-Installation of FFmpeg...")
    print(f"📂 Target Directory: {INSTALL_DIR}")

    if os.path.exists(BIN_DIR) and os.path.exists(os.path.join(BIN_DIR, "ffmpeg.exe")):
        print("✅ FFmpeg is already installed!")
        return

    os.makedirs(INSTALL_DIR, exist_ok=True)
    zip_path = os.path.join(INSTALL_DIR, "ffmpeg_temp.zip")

    # 1. Download
    print(f"⬇️ Downloading FFmpeg (approx 30MB-80MB)...")
    try:
        urllib.request.urlretrieve(FFMPEG_URL, zip_path)
    except Exception as e:
        print(f"❌ Download failed: {e}")
        return

    # 2. Extract
    print("📦 Extracting...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        # Get the root folder name inside zip
        root_folder = zip_ref.namelist()[0].split('/')[0]
        zip_ref.extractall(INSTALL_DIR)
    
    # 3. Organize
    print("🧹 Organizing files...")
    extracted_root = os.path.join(INSTALL_DIR, root_folder)
    extracted_bin = os.path.join(extracted_root, "bin")

    # Move bin contents to our clean BIN_DIR
    if os.path.exists(extracted_bin):
        if os.path.exists(BIN_DIR):
            shutil.rmtree(BIN_DIR)
        shutil.move(extracted_bin, INSTALL_DIR)
        
        # Cleanup extra files
        shutil.rmtree(extracted_root)
        os.remove(zip_path)
        print("✅ FFmpeg successfully installed locally!")
        print(f"📝 Path: {BIN_DIR}")
    else:
        print("❌ Could not find 'bin' folder in extracted zip.")

if __name__ == "__main__":
    install_ffmpeg()
