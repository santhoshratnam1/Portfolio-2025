"""
Website Content Extractor
Extracts all pages, assets, SVGs, CSS, JS, and other files from a website.
"""

import os
import re
import requests
from urllib.parse import urljoin, urlparse, unquote
from pathlib import Path
from bs4 import BeautifulSoup
import time
from typing import Set, Dict, List
import json


class WebsiteExtractor:
    def __init__(self, base_url: str, output_folder: str):
        """
        Initialize the website extractor.
        
        Args:
            base_url: The base URL of the website to extract
            output_folder: The folder where extracted files will be saved
        """
        self.base_url = base_url.rstrip('/')
        self.domain = urlparse(base_url).netloc
        self.output_folder = Path(output_folder).resolve()
        
        # Create folder and all parent directories
        try:
            self.output_folder.mkdir(parents=True, exist_ok=True)
            print(f"✓ Output folder ready: {self.output_folder}")
        except Exception as e:
            raise Exception(f"Failed to create output folder '{self.output_folder}': {e}")
        
        self.visited_urls: Set[str] = set()
        self.downloaded_files: Dict[str, str] = {}  # URL -> local path
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        # File extensions to download
        self.asset_extensions = {
            '.css', '.js', '.json', '.xml', '.svg', '.png', '.jpg', '.jpeg', 
            '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot',
            '.pdf', '.zip', '.mp4', '.mp3', '.webm', '.ogg'
        }
        
    def is_same_domain(self, url: str) -> bool:
        """Check if URL belongs to the same domain."""
        parsed = urlparse(url)
        return parsed.netloc == self.domain or parsed.netloc == ''
    
    def normalize_url(self, url: str) -> str:
        """Normalize URL by removing fragments and query params if needed."""
        parsed = urlparse(url)
        # Keep query params for some cases, but remove fragments
        normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if parsed.query:
            normalized += f"?{parsed.query}"
        return normalized
    
    def get_local_path(self, url: str, is_asset: bool = False) -> Path:
        """Convert URL to local file path."""
        parsed = urlparse(url)
        path = unquote(parsed.path)
        
        # Remove leading slash
        if path.startswith('/'):
            path = path[1:]
        
        # If no extension, assume it's HTML
        if not is_asset and not Path(path).suffix:
            if not path.endswith('/'):
                path += '.html'
            else:
                path = path.rstrip('/') + '/index.html'
        
        # If path is empty, use index.html
        if not path or path == '/':
            path = 'index.html'
        
        return self.output_folder / path
    
    def download_file(self, url: str, local_path: Path) -> bool:
        """Download a file from URL to local path."""
        try:
            # Create parent directories (with error handling)
            try:
                local_path.parent.mkdir(parents=True, exist_ok=True)
            except Exception as e:
                print(f"✗ Failed to create directory {local_path.parent}: {e}")
                return False
            
            response = self.session.get(url, timeout=30, allow_redirects=True)
            response.raise_for_status()
            
            # Write file
            if url.endswith('.svg') or 'image/svg' in response.headers.get('content-type', ''):
                # Save SVG as text
                local_path.write_text(response.text, encoding='utf-8')
            else:
                # Save binary files
                local_path.write_bytes(response.content)
            
            # Show shorter path for cleaner output
            relative_path = local_path.relative_to(self.output_folder)
            print(f"  ✓ {relative_path}")
            return True
            
        except Exception as e:
            print(f"  ✗ Failed: {os.path.basename(str(local_path))} - {str(e)[:50]}")
            return False
    
    def extract_urls_from_css(self, css_content: str, css_url: str) -> List[str]:
        """Extract all URLs from CSS content."""
        urls = []
        
        # @import statements
        import_pattern = r'@import\s+(?:url\()?["\']?([^"\']+)["\']?\)?'
        for match in re.finditer(import_pattern, css_content, re.IGNORECASE):
            urls.append(urljoin(css_url, match.group(1)))
        
        # url() references (fonts, images, etc.)
        url_pattern = r'url\(["\']?([^"\'()]+)["\']?\)'
        for match in re.finditer(url_pattern, css_content, re.IGNORECASE):
            url = match.group(1).strip()
            # Skip data URIs
            if not url.startswith('data:'):
                urls.append(urljoin(css_url, url))
        
        return urls
    
    def extract_assets_from_html(self, html_content: str, page_url: str) -> List[str]:
        """Extract all asset URLs from HTML content."""
        soup = BeautifulSoup(html_content, 'html.parser')
        assets = []
        
        # CSS files
        for link in soup.find_all('link', rel='stylesheet'):
            href = link.get('href')
            if href:
                assets.append(urljoin(page_url, href))
        
        # JavaScript files
        for script in soup.find_all('script', src=True):
            assets.append(urljoin(page_url, script['src']))
        
        # Images - check multiple attributes
        for img in soup.find_all('img'):
            # src attribute
            if img.get('src'):
                assets.append(urljoin(page_url, img['src']))
            # srcset attribute (responsive images)
            if img.get('srcset'):
                srcset = img['srcset']
                # Parse srcset: "image1.jpg 1x, image2.jpg 2x" or "image1.jpg 300w"
                for item in srcset.split(','):
                    url = item.strip().split()[0]
                    assets.append(urljoin(page_url, url))
            # data-src (lazy loading)
            if img.get('data-src'):
                assets.append(urljoin(page_url, img['data-src']))
            # data-srcset (lazy loading with srcset)
            if img.get('data-srcset'):
                srcset = img['data-srcset']
                for item in srcset.split(','):
                    url = item.strip().split()[0]
                    assets.append(urljoin(page_url, url))
        
        # Picture source elements
        for source in soup.find_all('source'):
            if source.get('srcset'):
                srcset = source['srcset']
                for item in srcset.split(','):
                    url = item.strip().split()[0]
                    assets.append(urljoin(page_url, url))
            if source.get('src'):
                assets.append(urljoin(page_url, source['src']))
        
        # SVGs - extract inline SVGs as separate files
        for idx, svg in enumerate(soup.find_all('svg')):
            # Check for external SVG references
            for use in svg.find_all('use'):
                href = use.get('href') or use.get('xlink:href')
                if href:
                    assets.append(urljoin(page_url, href))
            
            # Extract image references in SVG
            for img in svg.find_all('image', href=True):
                assets.append(urljoin(page_url, img.get('href') or img.get('xlink:href')))
        
        # Background images in style attributes
        for element in soup.find_all(style=True):
            style = element['style']
            urls = re.findall(r'url\(["\']?([^"\']+)["\']?\)', style)
            for url in urls:
                if not url.startswith('data:'):
                    assets.append(urljoin(page_url, url))
        
        # Background images in CSS classes (check style tags)
        for style_tag in soup.find_all('style'):
            if style_tag.string:
                css_urls = self.extract_urls_from_css(style_tag.string, page_url)
                assets.extend(css_urls)
        
        # Favicons and icons
        for link in soup.find_all('link'):
            rel = link.get('rel', [])
            if isinstance(rel, list):
                rel = ' '.join(rel)
            rel = rel.lower()
            href = link.get('href')
            if href and ('icon' in rel or 'shortcut' in rel or 'apple-touch' in rel or 'manifest' in rel):
                assets.append(urljoin(page_url, href))
        
        # Preload/prefetch resources
        for link in soup.find_all('link', rel=['preload', 'prefetch', 'dns-prefetch']):
            href = link.get('href')
            if href:
                assets.append(urljoin(page_url, href))
            # as attribute for preload
            if link.get('as') == 'style' and href:
                assets.append(urljoin(page_url, href))
        
        # Video and audio sources
        for media in soup.find_all(['video', 'audio']):
            if media.get('src'):
                assets.append(urljoin(page_url, media['src']))
            if media.get('poster'):  # Video poster image
                assets.append(urljoin(page_url, media['poster']))
        
        for source in soup.find_all('source'):
            if source.get('src'):
                assets.append(urljoin(page_url, source['src']))
        
        # Object and embed tags
        for obj in soup.find_all(['object', 'embed']):
            if obj.get('data'):
                assets.append(urljoin(page_url, obj['data']))
            if obj.get('src'):
                assets.append(urljoin(page_url, obj['src']))
        
        # Iframe sources (same domain only)
        for iframe in soup.find_all('iframe', src=True):
            src = iframe['src']
            if self.is_same_domain(urljoin(page_url, src)):
                assets.append(urljoin(page_url, src))
        
        # Manifest files
        for link in soup.find_all('link', rel='manifest'):
            href = link.get('href')
            if href:
                assets.append(urljoin(page_url, href))
        
        # Meta tags with content URLs
        for meta in soup.find_all('meta', property=True):
            prop = meta.get('property', '')
            content = meta.get('content', '')
            if content and ('image' in prop.lower() or 'url' in prop.lower()):
                if content.startswith('http'):
                    assets.append(content)
                else:
                    assets.append(urljoin(page_url, content))
        
        return assets
    
    def update_css_links(self, css_content: str, css_url: str) -> str:
        """Update URLs in CSS to point to local files."""
        updated_css = css_content
        
        # Update url() references
        def replace_url(match):
            url = match.group(1).strip()
            if url.startswith('data:'):
                return match.group(0)  # Keep data URIs as-is
            
            original_url = urljoin(css_url, url)
            if original_url in self.downloaded_files:
                local_path = Path(self.downloaded_files[original_url])
                css_local_path = self.get_local_path(css_url, is_asset=True)
                relative_path = os.path.relpath(local_path, css_local_path.parent)
                return f"url('{relative_path.replace(chr(92), '/')}')"
            return match.group(0)
        
        updated_css = re.sub(r'url\(["\']?([^"\'()]+)["\']?\)', replace_url, updated_css, flags=re.IGNORECASE)
        
        # Update @import statements
        def replace_import(match):
            url = match.group(1).strip()
            original_url = urljoin(css_url, url)
            if original_url in self.downloaded_files:
                local_path = Path(self.downloaded_files[original_url])
                css_local_path = self.get_local_path(css_url, is_asset=True)
                relative_path = os.path.relpath(local_path, css_local_path.parent)
                return f"@import url('{relative_path.replace(chr(92), '/')}')"
            return match.group(0)
        
        updated_css = re.sub(r'@import\s+(?:url\()?["\']?([^"\']+)["\']?\)?', replace_import, updated_css, flags=re.IGNORECASE)
        
        return updated_css
    
    def update_html_links(self, html_content: str, page_url: str) -> str:
        """Update all links in HTML to point to local files."""
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Update CSS links
        for link in soup.find_all('link', rel='stylesheet'):
            if link.get('href'):
                original_url = urljoin(page_url, link['href'])
                if original_url in self.downloaded_files:
                    local_path = Path(self.downloaded_files[original_url])
                    relative_path = os.path.relpath(local_path, self.get_local_path(page_url).parent)
                    link['href'] = relative_path.replace('\\', '/')
        
        # Update JavaScript sources
        for script in soup.find_all('script', src=True):
            if script.get('src'):
                original_url = urljoin(page_url, script['src'])
                if original_url in self.downloaded_files:
                    local_path = Path(self.downloaded_files[original_url])
                    relative_path = os.path.relpath(local_path, self.get_local_path(page_url).parent)
                    script['src'] = relative_path.replace('\\', '/')
        
        # Update image sources
        for img in soup.find_all('img'):
            if img.get('src'):
                original_url = urljoin(page_url, img['src'])
                if original_url in self.downloaded_files:
                    local_path = Path(self.downloaded_files[original_url])
                    relative_path = os.path.relpath(local_path, self.get_local_path(page_url).parent)
                    img['src'] = relative_path.replace('\\', '/')
            # Update srcset
            if img.get('srcset'):
                srcset = img['srcset']
                new_srcset_parts = []
                for item in srcset.split(','):
                    parts = item.strip().split()
                    if parts:
                        url = parts[0]
                        original_url = urljoin(page_url, url)
                        if original_url in self.downloaded_files:
                            local_path = Path(self.downloaded_files[original_url])
                            relative_path = os.path.relpath(local_path, self.get_local_path(page_url).parent)
                            new_url = relative_path.replace('\\', '/')
                            if len(parts) > 1:
                                new_srcset_parts.append(f"{new_url} {' '.join(parts[1:])}")
                            else:
                                new_srcset_parts.append(new_url)
                        else:
                            new_srcset_parts.append(item.strip())
                img['srcset'] = ', '.join(new_srcset_parts)
            # Update data-src
            if img.get('data-src'):
                original_url = urljoin(page_url, img['data-src'])
                if original_url in self.downloaded_files:
                    local_path = Path(self.downloaded_files[original_url])
                    relative_path = os.path.relpath(local_path, self.get_local_path(page_url).parent)
                    img['data-src'] = relative_path.replace('\\', '/')
        
        # Update picture source srcset
        for source in soup.find_all('source'):
            if source.get('srcset'):
                srcset = source['srcset']
                new_srcset_parts = []
                for item in srcset.split(','):
                    parts = item.strip().split()
                    if parts:
                        url = parts[0]
                        original_url = urljoin(page_url, url)
                        if original_url in self.downloaded_files:
                            local_path = Path(self.downloaded_files[original_url])
                            relative_path = os.path.relpath(local_path, self.get_local_path(page_url).parent)
                            new_url = relative_path.replace('\\', '/')
                            if len(parts) > 1:
                                new_srcset_parts.append(f"{new_url} {' '.join(parts[1:])}")
                            else:
                                new_srcset_parts.append(new_url)
                        else:
                            new_srcset_parts.append(item.strip())
                source['srcset'] = ', '.join(new_srcset_parts)
        
        # Update inline styles with background images
        for element in soup.find_all(style=True):
            style = element['style']
            new_style = style
            for match in re.finditer(r'url\(["\']?([^"\']+)["\']?\)', style):
                url = match.group(1)
                if not url.startswith('data:'):
                    original_url = urljoin(page_url, url)
                    if original_url in self.downloaded_files:
                        local_path = Path(self.downloaded_files[original_url])
                        relative_path = os.path.relpath(local_path, self.get_local_path(page_url).parent)
                        new_style = new_style.replace(url, relative_path.replace('\\', '/'))
            element['style'] = new_style
        
        # Update inline style tags
        for style_tag in soup.find_all('style'):
            if style_tag.string:
                style_tag.string = self.update_css_links(style_tag.string, page_url)
        
        # Update anchor links to local HTML files
        for anchor in soup.find_all('a', href=True):
            href = anchor['href']
            if href.startswith('#') or href.startswith('javascript:') or href.startswith('mailto:'):
                continue
            
            full_url = urljoin(page_url, href)
            if self.is_same_domain(full_url):
                normalized = self.normalize_url(full_url)
                if normalized in self.downloaded_files:
                    local_path = Path(self.downloaded_files[normalized])
                    relative_path = os.path.relpath(local_path, self.get_local_path(page_url).parent)
                    anchor['href'] = relative_path.replace('\\', '/')
        
        return str(soup)
    
    def extract_page(self, url: str) -> bool:
        """Extract a single page and all its assets."""
        normalized_url = self.normalize_url(url)
        
        if normalized_url in self.visited_urls:
            return True
        
        self.visited_urls.add(normalized_url)
        
        try:
            # Show progress
            page_num = len(self.visited_urls)
            print(f"\n[{page_num}] 📄 {url}")
            response = self.session.get(url, timeout=30, allow_redirects=True)
            response.raise_for_status()
            
            # Check if it's HTML
            content_type = response.headers.get('content-type', '').lower()
            if 'text/html' not in content_type:
                # It's an asset file
                local_path = self.get_local_path(normalized_url, is_asset=True)
                if self.download_file(normalized_url, local_path):
                    self.downloaded_files[normalized_url] = str(local_path)
                    
                    # If it's a CSS file, extract and download resources from it
                    if 'text/css' in content_type or normalized_url.endswith('.css'):
                        try:
                            css_content = local_path.read_text(encoding='utf-8')
                            # Update CSS links to local files
                            updated_css = self.update_css_links(css_content, normalized_url)
                            local_path.write_text(updated_css, encoding='utf-8')
                            
                            # Extract and download resources from CSS
                            css_assets = self.extract_urls_from_css(css_content, normalized_url)
                            for css_asset_url in css_assets:
                                if css_asset_url not in self.downloaded_files:
                                    css_normalized = self.normalize_url(css_asset_url)
                                    if self.is_same_domain(css_asset_url):
                                        css_asset_path = self.get_local_path(css_normalized, is_asset=True)
                                        if self.download_file(css_asset_url, css_asset_path):
                                            self.downloaded_files[css_asset_url] = str(css_asset_path)
                                            self.downloaded_files[css_normalized] = str(css_asset_path)
                        except Exception as e:
                            pass  # Skip if CSS parsing fails
                return True
            
            html_content = response.text
            local_path = self.get_local_path(normalized_url)
            
            # Extract all assets from this page
            assets = self.extract_assets_from_html(html_content, normalized_url)
            
            # Download all assets
            for asset_url in assets:
                if asset_url not in self.downloaded_files:
                    asset_normalized = self.normalize_url(asset_url)
                    if self.is_same_domain(asset_url):
                        asset_path = self.get_local_path(asset_normalized, is_asset=True)
                        if self.download_file(asset_url, asset_path):
                            self.downloaded_files[asset_url] = str(asset_path)
                            self.downloaded_files[asset_normalized] = str(asset_path)
                            
                            # If it's a CSS file, extract URLs from it and update links
                            if asset_url.endswith('.css') or 'text/css' in str(asset_path):
                                try:
                                    css_content = asset_path.read_text(encoding='utf-8')
                                    # Update CSS links to local files
                                    updated_css = self.update_css_links(css_content, asset_url)
                                    asset_path.write_text(updated_css, encoding='utf-8')
                                    
                                    # Extract and download resources from CSS
                                    css_assets = self.extract_urls_from_css(css_content, asset_url)
                                    for css_asset_url in css_assets:
                                        if css_asset_url not in self.downloaded_files:
                                            css_normalized = self.normalize_url(css_asset_url)
                                            if self.is_same_domain(css_asset_url):
                                                css_asset_path = self.get_local_path(css_normalized, is_asset=True)
                                                if self.download_file(css_asset_url, css_asset_path):
                                                    self.downloaded_files[css_asset_url] = str(css_asset_path)
                                                    self.downloaded_files[css_normalized] = str(css_asset_path)
                                except Exception as e:
                                    pass  # Skip if CSS parsing fails
            
            # Update HTML links to point to local files
            updated_html = self.update_html_links(html_content, normalized_url)
            
            # Save the HTML file
            try:
                local_path.parent.mkdir(parents=True, exist_ok=True)
            except Exception as e:
                print(f"  ✗ Failed to create directory: {e}")
                return False
            
            local_path.write_text(updated_html, encoding='utf-8')
            self.downloaded_files[normalized_url] = str(local_path)
            
            relative_path = local_path.relative_to(self.output_folder)
            print(f"  ✓ Page saved: {relative_path}")
            
            # Find all links to other pages on the same domain
            soup = BeautifulSoup(html_content, 'html.parser')
            for anchor in soup.find_all('a', href=True):
                href = anchor['href']
                if href.startswith('#') or href.startswith('javascript:'):
                    continue
                
                full_url = urljoin(normalized_url, href)
                if self.is_same_domain(full_url):
                    link_normalized = self.normalize_url(full_url)
                    if link_normalized not in self.visited_urls:
                        # Recursively extract linked pages
                        time.sleep(0.5)  # Be polite to the server
                        self.extract_page(link_normalized)
            
            return True
            
        except Exception as e:
            print(f"✗ Error extracting {url}: {e}")
            return False
    
    def extract(self):
        """Start the extraction process."""
        print(f"🚀 Starting extraction from: {self.base_url}")
        print(f"📁 Output folder: {self.output_folder}")
        print("-" * 60)
        
        # Try to download common files first
        common_files = ['/robots.txt', '/sitemap.xml', '/favicon.ico', '/manifest.json']
        for common_file in common_files:
            try:
                common_url = urljoin(self.base_url, common_file)
                if self.is_same_domain(common_url):
                    normalized = self.normalize_url(common_url)
                    if normalized not in self.visited_urls:
                        self.extract_page(common_url)
            except:
                pass
        
        # Start with the base URL
        self.extract_page(self.base_url)
        
        # Save extraction report
        report = {
            'base_url': self.base_url,
            'total_pages': len([url for url in self.visited_urls if url.endswith('.html') or 'text/html' in str(url)]),
            'total_files': len(self.downloaded_files),
            'visited_urls': list(self.visited_urls),
            'downloaded_files': self.downloaded_files
        }
        
        report_path = self.output_folder / 'extraction_report.json'
        report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
        
        print("\n" + "=" * 60)
        print(f"✅ Extraction complete!")
        print(f"📊 Total pages extracted: {report['total_pages']}")
        print(f"📦 Total files downloaded: {report['total_files']}")
        print(f"📄 Report saved to: {report_path}")
        print("=" * 60)


def validate_url(url: str) -> str:
    """Validate and normalize URL."""
    url = url.strip()
    if not url:
        raise ValueError("URL cannot be empty")
    
    # Add https:// if no scheme is provided
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    # Validate URL format
    parsed = urlparse(url)
    if not parsed.netloc:
        raise ValueError(f"Invalid URL format: {url}")
    
    return url


def get_safe_folder_name(url: str) -> str:
    """Generate a safe folder name from URL."""
    parsed = urlparse(url)
    domain = parsed.netloc.replace('www.', '')
    # Remove invalid characters for folder names
    folder_name = re.sub(r'[<>:"/\\|?*]', '_', domain)
    return folder_name


def main():
    """Main function to run the extractor."""
    import sys
    
    print("=" * 60)
    print("🌐 Website Content Extractor")
    print("=" * 60)
    print()
    
    # Get URL
    if len(sys.argv) >= 2:
        url = sys.argv[1]
    else:
        url = input("Enter website URL: ").strip()
    
    # Validate URL
    try:
        url = validate_url(url)
    except ValueError as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    
    # Get output folder
    if len(sys.argv) >= 3:
        output_folder = sys.argv[2]
    else:
        default_folder = get_safe_folder_name(url)
        folder_input = input(f"Enter output folder (press Enter for '{default_folder}'): ").strip()
        output_folder = folder_input if folder_input else default_folder
    
    # Ensure folder path is absolute and create it
    output_folder = Path(output_folder).resolve()
    
    print()
    print(f"📋 Configuration:")
    print(f"   URL: {url}")
    print(f"   Output Folder: {output_folder}")
    print()
    
    # Confirm before starting
    if len(sys.argv) < 3:
        confirm = input("Start extraction? (Y/n): ").strip().lower()
        if confirm and confirm not in ['y', 'yes', '']:
            print("❌ Extraction cancelled.")
            sys.exit(0)
        print()
    
    try:
        extractor = WebsiteExtractor(url, str(output_folder))
        extractor.extract()
    except KeyboardInterrupt:
        print("\n\n⚠️  Extraction interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

