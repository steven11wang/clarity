import { cp, mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'

console.log('📦 Preparing deployment build for satclarity.com...')

// 1. Ensure clean build
console.log('🔨 Running Vite build...')
execSync('npm run build', { stdio: 'inherit' })

const htaccessContent = `# ----------------------------------------------------------------------
# Clarity (satclarity.com) Apache / LiteSpeed Configuration for cPanel
# ----------------------------------------------------------------------

# Prevent directory listings
Options -Indexes -MultiViews

# Default landing page
DirectoryIndex landing.html index.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # 1. Force HTTPS
  RewriteCond %{HTTPS} off
  RewriteCond %{HTTP:X-Forwarded-Proto} !https
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

  # 2. Existing files and directories serve directly
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # 3. Route /plans or /plans/ to plans.html
  RewriteRule ^plans/?$ plans.html [L]

  # 4. Route /app and /app/* to index.html (React SPA)
  RewriteRule ^app(/.*)?$ index.html [L]

  # 5. SPA routing / catch-all fallback
  RewriteCond %{REQUEST_URI} !^/brand/
  RewriteCond %{REQUEST_URI} !^/data/
  RewriteCond %{REQUEST_URI} !^/assets/
  RewriteCond %{REQUEST_URI} !^/lessons/
  RewriteCond %{REQUEST_URI} !^/plans
  RewriteRule ^(.*)$ landing.html [L]
</IfModule>

# Caching optimization
<IfModule mod_headers.c>
  # 1 Year caching for hashed assets, fonts, and images
  <FilesMatch "\\.(js|css|woff2|woff|ttf|eot|svg|png|jpg|jpeg|webp|gif|ico|mp4)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>

  # HTML files & JSON: no-cache so user changes and updates propagate immediately
  <FilesMatch "\\.(html|json)$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires 0
  </FilesMatch>
</IfModule>

# MIME Types
<IfModule mod_mime.c>
  AddType application/javascript .js .mjs
  AddType text/css .css
  AddType application/json .json
  AddType font/woff2 .woff2
  AddType image/webp .webp
  AddType video/mp4 .mp4
</IfModule>

# Gzip / Deflate Compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json application/xml
</IfModule>
`

console.log('📝 Writing .htaccess...')
await writeFile('dist/.htaccess', htaccessContent, 'utf-8')

console.log('📂 Creating directory aliases for static routing fallback (/app/ and /plans/)...')
await mkdir('dist/app', { recursive: true })
await cp('dist/index.html', 'dist/app/index.html')

await mkdir('dist/plans', { recursive: true })
await cp('dist/plans.html', 'dist/plans/index.html')

console.log('🗜️  Creating deployment ZIP archive (satclarity-deployment.zip)...')
execSync('rm -f satclarity-deployment.zip && cd dist && zip -r ../satclarity-deployment.zip . -x ".*" -x "__MACOSX" -x ".DS_Store"', {
  stdio: 'inherit',
})
// Also ensure hidden .htaccess is inside the zip
execSync('cd dist && zip ../satclarity-deployment.zip .htaccess', {
  stdio: 'inherit',
})

console.log('✅ Deployment package created successfully: satclarity-deployment.zip')
