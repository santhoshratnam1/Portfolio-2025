# Website Content Extractor

A user-friendly Python tool to extract all content from websites including pages, CSS, JavaScript, images, SVGs, and more.

## Quick Start

### Method 1: Interactive Mode (Easiest)
Just run the script and follow the prompts:
```bash
python website_extractor.py
```

### Method 2: Command Line
```bash
python website_extractor.py <URL> <output_folder>
```

### Method 3: Windows Quick Launch
Double-click `extract_website.bat` or drag-and-drop a URL file

## Examples

```bash
# Extract with auto-generated folder name
python website_extractor.py https://example.com

# Extract to specific folder
python website_extractor.py https://example.com ./my_extracted_site

# Just run and enter details when prompted
python website_extractor.py
```

## Features

✅ **Extracts Everything:**
- All HTML pages
- CSS stylesheets
- JavaScript files
- Images (PNG, JPG, SVG, WebP, etc.)
- Fonts (WOFF, TTF, etc.)
- All other assets

✅ **User-Friendly:**
- Interactive prompts if no arguments provided
- Auto-generates folder names from URLs
- Creates all necessary folders automatically
- Progress indicators
- Detailed extraction report

✅ **Smart Features:**
- Updates all links to work offline
- Maintains original folder structure
- Respects same-domain only
- Handles errors gracefully

## Installation

```bash
pip install -r requirements.txt
```

## Requirements

- Python 3.7+
- requests
- beautifulsoup4
- lxml

## Output

All files are saved in the specified folder with:
- Original folder structure preserved
- All links updated to work offline
- `extraction_report.json` with full details




