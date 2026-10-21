# MavMD 本地静态服务器 (PowerShell, 无需安装任何东西)
$port = 8000
$root = $PSScriptRoot

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  MavMD LOCAL SERVER" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "PATH: $root"
Write-Host "URL:   http://localhost:$port"
Write-Host "CLOSE THIS WINDOW TO STOP THE SERVER" -ForegroundColor Yellow
Write-Host ""

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

# 自动打开浏览器
Start-Process "http://localhost:$port"

# MIME 类型
$mimeTypes = @{
    '.html'        = 'text/html; charset=utf-8'
    '.htm'         = 'text/html; charset=utf-8'
    '.css'         = 'text/css; charset=utf-8'
    '.js'          = 'application/javascript; charset=utf-8'
    '.mjs'         = 'application/javascript; charset=utf-8'
    '.json'        = 'application/json; charset=utf-8'
    '.md'          = 'text/markdown; charset=utf-8'
    '.txt'         = 'text/plain; charset=utf-8'
    '.png'         = 'image/png'
    '.jpg'         = 'image/jpeg'
    '.jpeg'        = 'image/jpeg'
    '.gif'         = 'image/gif'
    '.svg'         = 'image/svg+xml'
    # '.ico'         = 'image/x-icon'
    '.webp'        = 'image/webp'
    '.woff'        = 'font/woff'
    '.woff2'       = 'font/woff2'
    '.ttf'         = 'font/ttf'
    '.map'         = 'application/json'
    '.webmanifest' = 'application/manifest+json'
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
        if ($urlPath -eq '/') { $urlPath = '/index.html' }

        # 防止目录穿越
        $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $urlPath.TrimStart('/')))
        if (-not $fullPath.StartsWith($root)) {
            $response.StatusCode = 403
            $response.Close()
            continue
        }

        # 目录 -> index.html
        if (Test-Path $fullPath -PathType Container) {
            $fullPath = Join-Path $fullPath 'index.html'
        }

        if (Test-Path $fullPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { 'application/octet-stream' }
            $response.ContentType = $contentType
            $response.Headers.Add('Cache-Control', 'no-cache')
            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)

            Write-Host "[200] $($request.HttpMethod) $urlPath" -ForegroundColor Green
        }
        else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
            $response.ContentType = 'text/plain; charset=utf-8'
            $response.OutputStream.Write($msg, 0, $msg.Length)
            Write-Host "[404] $urlPath" -ForegroundColor Red
        }
        $response.Close()
    }
    catch {
        Write-Host "Err: $_" -ForegroundColor Red
    }
}