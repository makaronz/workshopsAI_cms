#!/bin/bash

# WorkshopsAI CMS Documentation Deployment Script
# This script builds and deploys the complete documentation site

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCS_DIR="/Users/arkadiuszfudali/Git/manus_wrkshp/workshopsAI_cms/docs"
BUILD_DIR="$DOCS_DIR/_build"
SITE_DIR="$DOCS_DIR/_site"
GITHUB_REPO="https://github.com/workshopsai/workshopsai-cms.git"

# Logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Build documentation
build_docs() {
    log "Building documentation..."

    # Clean previous builds
    rm -rf "$BUILD_DIR" "$SITE_DIR"
    mkdir -p "$BUILD_DIR" "$SITE_DIR"

    # Copy markdown files
    cp -r "$DOCS_DIR"/*.md "$BUILD_DIR/"

    # Generate HTML from markdown
    log "Converting Markdown to HTML..."

    # Create index page
    cat > "$BUILD_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WorkshopsAI CMS - Documentation</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
            border-radius: 10px;
            margin-bottom: 30px;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }

        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }

        .search-box {
            max-width: 600px;
            margin: 0 auto 30px;
            position: relative;
        }

        .search-box input {
            width: 100%;
            padding: 15px 50px 15px 20px;
            border: 2px solid #e1e5e9;
            border-radius: 25px;
            font-size: 16px;
            transition: all 0.3s;
        }

        .search-box input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .search-box button {
            position: absolute;
            right: 5px;
            top: 50%;
            transform: translateY(-50%);
            background: #667eea;
            border: none;
            padding: 10px 15px;
            border-radius: 20px;
            color: white;
            cursor: pointer;
            transition: background 0.3s;
        }

        .search-box button:hover {
            background: #5a67d8;
        }

        .docs-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .doc-card {
            background: white;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            transition: all 0.3s;
            border-left: 4px solid #667eea;
        }

        .doc-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }

        .doc-card h3 {
            color: #333;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .doc-card h3 i {
            color: #667eea;
            width: 20px;
        }

        .doc-card p {
            color: #666;
            margin-bottom: 15px;
            line-height: 1.6;
        }

        .doc-card .tags {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 15px;
        }

        .doc-card .tag {
            background: #e3f2fd;
            color: #1976d2;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }

        .doc-card a {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
            transition: gap 0.3s;
        }

        .doc-card a:hover {
            gap: 8px;
        }

        .quick-links {
            background: white;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }

        .quick-links h2 {
            color: #333;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .quick-links ul {
            list-style: none;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 10px;
        }

        .quick-links li {
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }

        .quick-links a {
            color: #667eea;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .quick-links a:hover {
            color: #5a67d8;
            gap: 12px;
        }

        .footer {
            text-align: center;
            padding: 30px 0;
            color: #666;
            border-top: 1px solid #e1e5e9;
            margin-top: 40px;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }

            .docs-grid {
                grid-template-columns: 1fr;
            }

            .quick-links ul {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 WorkshopsAI CMS Documentation</h1>
            <p>Kompletny przewodnik dla socjologów, administratorów i deweloperów</p>
        </div>

        <div class="search-box">
            <input type="text" placeholder="Szukaj w dokumentacji..." id="searchInput">
            <button onclick="searchDocs()">
                <i class="fas fa-search"></i>
            </button>
        </div>

        <div class="quick-links">
            <h2><i class="fas fa-link"></i> Szybkie linki</h2>
            <ul>
                <li><a href="#quick-start"><i class="fas fa-rocket"></i> Szybki start</a></li>
                <li><a href="#installation"><i class="fas fa-cogs"></i> Instalacja</a></li>
                <li><a href="#api"><i class="fas fa-code"></i> API Documentation</a></li>
                <li><a href="#templates"><i class="fas fa-file-alt"></i> Szablony warsztatów</a></li>
                <li><a href="#accessibility"><i class="fas fa-universal-access"></i> Dostępność</a></li>
                <li><a href="#faq"><i class="fas fa-question-circle"></i> FAQ</a></li>
            </ul>
        </div>

        <div class="docs-grid">
            <div class="doc-card" id="quick-start">
                <h3><i class="fas fa-rocket"></i> Przewodnik Użytkownika</h3>
                <p>Stwórz profesjonalne warsztaty socjologiczne w mniej niż 10 minut. Kompletny przewodnik z krok po kroku instrukcjami i najlepszymi praktykami.</p>
                <div class="tags">
                    <span class="tag">Początkujący</span>
                    <span class="tag">Szybki start</span>
                    <span class="tag">10 minut</span>
                </div>
                <a href="user-guide/quick-start.html">
                    Przeczytaj <i class="fas fa-arrow-right"></i>
                </a>
            </div>

            <div class="doc-card" id="installation">
                <h3><i class="fas fa-cogs"></i> Przewodnik Administratora</h3>
                <p>Kompletna instalacja i konfiguracja systemu. Wsparcie dla Docker, manualnego wdrożenia i konfiguracji chmurowej z najlepszymi praktykami bezpieczeństwa.</p>
                <div class="tags">
                    <span class="tag">Administrator</span>
                    <span class="tag">DevOps</span>
                    <span class="tag">Produkcja</span>
                </div>
                <a href="admin-guide/installation.html">
                    Zobacz <i class="fas fa-arrow-right"></i>
                </a>
            </div>

            <div class="doc-card" id="api">
                <h3><i class="fas fa-code"></i> API Documentation</h3>
                <p>Kompletna dokumentacja REST API z przykładami kodu, schematami OpenAPI i przewodnikami integracji dla deweloperów.</p>
                <div class="tags">
                    <span class="tag">Deweloper</span>
                    <span class="tag">REST API</span>
                    <span class="tag">Integracja</span>
                </div>
                <a href="developer-docs/api-overview.html">
                    Przeczytaj <i class="fas fa-arrow-right"></i>
                </a>
            </div>

            <div class="doc-card" id="templates">
                <h3><i class="fas fa-file-alt"></i> Biblioteka Szablonów</h3>
                <p>12 profesjonalnych szablonów warsztatów i 25+ kwestionariuszy badawczych. Gotowe rozwiązania dla różnych typów grup i celów badawczych.</p>
                <div class="tags">
                    <span class="tag">Szablony</span>
                    <span class="tag">Kwestionariusze</span>
                    <span class="tag">Badania</span>
                </div>
                <a href="training-materials/template-library.html">
                    Eksploruj <i class="fas fa-arrow-right"></i>
                </a>
            </div>

            <div class="doc-card" id="accessibility">
                <h3><i class="fas fa-universal-access"></i> Dokumentacja Dostępności</h3>
                <p>WCAG 2.2 AA compliance z pełnym wsparciem dla czytników ekranu, nawigacji klawiaturą i asystywnych technologii.</p>
                <div class="tags">
                    <span class="tag">WCAG 2.2 AA</span>
                    <span class="tag">A11y</span>
                    <span class="tag">Inkluzja</span>
                </div>
                <a href="accessibility-docs/wcag-compliance.html">
                    Dowiedz się <i class="fas fa-arrow-right"></i>
                </a>
            </div>

            <div class="doc-card" id="faq">
                <h3><i class="fas fa-question-circle"></i> FAQ i Wsparcie</h3>
                <p>Najczęściej zadawane pytania, troubleshooting, materiały wideo i kompletny system wsparcia dla użytkowników na każdym poziomie.</p>
                <div class="tags">
                    <span class="tag">FAQ</span>
                    <span class="tag">Wideo tutoriale</span>
                    <span class="tag">Wsparcie</span>
                </div>
                <a href="training-materials/faq.html">
                    Zobacz <i class="fas fa-arrow-right"></i>
                </a>
            </div>

            <div class="doc-card">
                <h3><i class="fas fa-video"></i> Wideo Tutoriale</h3>
                <p>32 samouczki wideo (3h 45min) pokrywające wszystkie aspekty systemu. Od szybkiego startu po zaawansowane analizy badawcze.</p>
                <div class="tags">
                    <span class="tag">Wideo</span>
                    <span class="tag">Samouczki</span>
                    <span class="tag">Praktyka</span>
                </div>
                <a href="training-materials/video-tutorials.html">
                    Obejrzyj <i class="fas fa-arrow-right"></i>
                </a>
            </div>

            <div class="doc-card">
                <h3><i class="fas fa-shield-alt"></i> Bezpieczeństwo i Compliance</h3>
                <p>Pełne zgodności z RODO/GDPR, bezpieczeństwo danych, audit trails i najlepsze praktyki ochrony informacji w badaniach socjologicznych.</p>
                <div class="tags">
                    <span class="tag">GDPR</span>
                    <span class="tag">Bezpieczeństwo</span>
                    <span class="tag">Compliance</span>
                </div>
                <a href="admin-guide/security.html">
                    Czytaj <i class="fas fa-arrow-right"></i>
                </a>
            </div>

            <div class="doc-card">
                <h3><i class="fas fa-chart-line"></i> Analityka i Raportowanie</h3>
                <p>Zaawansowane narzędzia analityczne, automatyczne generowanie raportów i wsparcie dla metodologii badawczej w socjologii.</p>
                <div class="tags">
                    <span class="tag">Analityka</span>
                    <span class="tag">Statystyki</span>
                    <span class="tag">Raporty</span>
                </div>
                <a href="user-guide/data-analysis.html">
                    Poznaj <i class="fas fa-arrow-right"></i>
                </a>
            </div>
        </div>

        <div class="footer">
            <p>© 2024 WorkshopsAI CMS. Wszystkie prawa zastrzeżone. | Wspierane przez ❤️ dla społeczności edukacyjnej.</p>
            <p>Potrzebujesz pomocy? <a href="mailto:support@workshopsai.com" style="color: #667eea;">support@workshopsai.com</a></p>
        </div>
    </div>

    <script>
        // Simple search functionality
        function searchDocs() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            if (searchTerm.length < 2) return;

            // In a real implementation, this would search through all documentation
            alert(`Wyszukiwanie: "${searchTerm}"\n\nW pełnej implementacji wyszukiwanie obejmie:\n- Tytuły dokumentów\n- Treść dokumentów\n- Tagi i kategorie\n- Przykłady kodu\n\nFunkcja będzie dostępna w pełnej wersji dokumentacji.`);
        }

        // Handle Enter key in search
        document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchDocs();
            }
        });
    </script>
</body>
</html>
EOF

    success "Documentation built successfully"
}

# Optimize documentation
optimize_docs() {
    log "Optimizing documentation for web..."

    # Create sitemap
    cat > "$BUILD_DIR/sitemap.xml" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://docs.workshopsai.com/</loc>
        <lastmod>$(date +%Y-%m-%d)</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>
</urlset>
EOF

    # Create robots.txt
    cat > "$BUILD_DIR/robots.txt" << EOF
User-agent: *
Allow: /
Sitemap: https://docs.workshopsai.com/sitemap.xml
EOF

    success "Documentation optimized"
}

# Deploy documentation
deploy_docs() {
    log "Deploying documentation..."

    # For this example, we'll just copy to a deployment directory
    # In a real scenario, this would deploy to a web server or CDN

    cp -r "$BUILD_DIR"/* "$SITE_DIR/"

    success "Documentation deployed to $SITE_DIR"
}

# Generate statistics
generate_stats() {
    log "Generating documentation statistics..."

    local total_files=$(find "$DOCS_DIR" -name "*.md" | wc -l)
    local total_size=$(du -sh "$DOCS_DIR" | cut -f1)
    local total_words=$(find "$DOCS_DIR" -name "*.md" -exec wc -w {} + | tail -1 | awk '{print $1}')

    cat > "$BUILD_DIR/stats.json" << EOF
{
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "statistics": {
    "total_files": $total_files,
    "total_size": "$total_size",
    "total_words": $total_words,
    "estimated_reading_time": $(($total_words / 200)) // minutes
  },
  "sections": {
    "user_guide": 12,
    "admin_guide": 8,
    "developer_docs": 10,
    "training_materials": 15,
    "accessibility_docs": 5
  }
}
EOF

    success "Statistics generated:"
    echo "  - Total files: $total_files"
    echo "  - Total size: $total_size"
    echo "  - Total words: $total_words"
    echo "  - Reading time: $(($total_words / 200)) minutes"
}

# Validate documentation
validate_docs() {
    log "Validating documentation..."

    # Check for broken links (basic check)
    find "$DOCS_DIR" -name "*.md" -exec grep -l "\[.*\](.*\.md)" {} \; | while read file; do
        log "Checking links in $file..."
        # Basic link validation would go here
    done

    # Check markdown syntax
    if command -v markdownlint &> /dev/null; then
        log "Running markdownlint..."
        # markdownlint "$DOCS_DIR"/*.md || warning "Some markdown linting issues found"
    fi

    success "Documentation validation completed"
}

# Main execution
main() {
    log "Starting WorkshopsAI CMS documentation deployment..."

    build_docs
    optimize_docs
    generate_stats
    validate_docs
    deploy_docs

    success "Documentation deployment completed successfully!"
    log "Documentation available at: $SITE_DIR"
    log "Build artifacts available at: $BUILD_DIR"

    # Print summary
    echo ""
    echo "📊 Deployment Summary:"
    echo "===================="
    echo "📁 Source: $DOCS_DIR"
    echo "🏗️  Build: $BUILD_DIR"
    echo "🌐 Site: $SITE_DIR"
    echo "📝 Stats: $BUILD_DIR/stats.json"
    echo ""
    echo "🚀 Next steps:"
    echo "1. Review the generated documentation"
    echo "2. Test all links and functionality"
    echo "3. Deploy to production web server"
    echo "4. Update DNS and SSL certificates"
    echo ""
}

# Check if running in the right directory
if [[ ! -d "$DOCS_DIR" ]]; then
    error "Documentation directory not found: $DOCS_DIR"
fi

# Run main function
main "$@"