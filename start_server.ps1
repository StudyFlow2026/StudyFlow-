# StudyFlow Native Static File Server for Windows
# Runs natively in PowerShell without Node.js or Python

$port = 3000
$listener = New-Object System.Net.HttpListener

# Detect local IPv4 address
$localIp = ""
try {
    $localIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1 -ExpandProperty IPAddress)
} catch {}

$hasNetworkAccess = $false

# Attempt to bind to localhost, loopback, and local network IP
try {
    $listener.Prefixes.Clear()
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    if ($localIp) {
        $listener.Prefixes.Add("http://$($localIp):$port/")
    }
    $listener.Start()
    $hasNetworkAccess = $true
} catch {
    # Fail-safe fallback to localhost-only if access is denied (non-Admin run)
    try {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:$port/")
        $listener.Start()
        $hasNetworkAccess = $false
    } catch {
        Write-Error "Could not start server. Port $port may already be in use."
        exit
    }
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  StudyFlow local server successfully started!" -ForegroundColor Green
Write-Host "  Local URL:   http://localhost:$port/" -ForegroundColor White
if ($localIp) {
    if ($hasNetworkAccess) {
        Write-Host "  Network URL: http://$($localIp):$port/  (Use this on other devices!)" -ForegroundColor Green
    } else {
        Write-Host "  Network URL: http://$($localIp):$port/" -ForegroundColor Gray
        Write-Host "  [TIP] Run PowerShell as Administrator to enable access from other devices." -ForegroundColor Yellow
    }
}
Write-Host "  Press Ctrl+C inside terminal to stop the server." -ForegroundColor Yellow
Write-Host "==================================================`n" -ForegroundColor Cyan

# Open default web browser to the server url
Start-Process "http://localhost:$port/"

$currentDir = Get-Location
$latestOtp = ""

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        
        try {
            $request = $context.Request
            $response = $context.Response
            
            # Add CORS Headers for local development cross-origin sync
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
            
            # Handle OPTIONS preflight requests
            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }
            
            $urlPath = $request.Url.LocalPath
            
            # Cross-Origin Profile & State Sync API Endpoints
            if ($urlPath -eq "/api/sync") {
                if ($request.HttpMethod -eq "GET") {
                    $syncFile = Join-Path $currentDir "database_sync.json"
                    $response.ContentType = "application/json; charset=utf-8"
                    if (Test-Path $syncFile -PathType Leaf) {
                        $contentBytes = [System.IO.File]::ReadAllBytes($syncFile)
                    } else {
                        $contentBytes = [System.Text.Encoding]::UTF8.GetBytes('{"users":[],"activeUser":null}')
                    }
                    $response.ContentLength64 = $contentBytes.Length
                    $response.OutputStream.Write($contentBytes, 0, $contentBytes.Length)
                }
                elseif ($request.HttpMethod -eq "POST") {
                    try {
                        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                        $body = $reader.ReadToEnd()
                        $reader.Close()
                        
                        $syncFile = Join-Path $currentDir "database_sync.json"
                        [System.IO.File]::WriteAllText($syncFile, $body, [System.Text.Encoding]::UTF8)
                        
                        $response.ContentType = "application/json; charset=utf-8"
                        $successBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true}')
                        $response.ContentLength64 = $successBytes.Length
                        $response.OutputStream.Write($successBytes, 0, $successBytes.Length)
                    } catch {
                        $response.StatusCode = 500
                        $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"Failed to save sync file"}')
                        $response.ContentType = "application/json; charset=utf-8"
                        $response.ContentLength64 = $errBytes.Length
                        $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    }
                }
                $response.Close()
                continue
            }
            
            # Logging Channel API Endpoint for Remote Browser Diagnostics
            if ($urlPath -eq "/api/log") {
                if ($request.HttpMethod -eq "POST") {
                    try {
                        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                        $body = $reader.ReadToEnd()
                        $reader.Close()
                        
                        $logFile = Join-Path $currentDir "browser_console.log"
                        [System.IO.File]::AppendAllText($logFile, "$body`n", [System.Text.Encoding]::UTF8)
                        
                        $response.ContentType = "application/json; charset=utf-8"
                        $successBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true}')
                        $response.ContentLength64 = $successBytes.Length
                        $response.OutputStream.Write($successBytes, 0, $successBytes.Length)
                    } catch {
                        $response.StatusCode = 500
                        $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":false}')
                        $response.ContentType = "application/json; charset=utf-8"
                        $response.ContentLength64 = $errBytes.Length
                        $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    }
                }
                $response.Close()
                continue
            }
            
            # OTP Email Sender API Endpoint
            if ($urlPath -eq "/api/send-otp") {
                if ($request.HttpMethod -eq "POST") {
                    try {
                        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                        $body = $reader.ReadToEnd()
                        $reader.Close()
                        
                        $payload = ConvertFrom-Json $body
                        $toEmail = $payload.email
                        $otp = $payload.otp
                        
                        $smtpUser = $payload.smtpUser
                        $smtpPass = $payload.smtpPass
                        $smtpServer = "smtp.gmail.com"
                        if ($payload.smtpServer) { $smtpServer = $payload.smtpServer }
                        $smtpPort = 587
                        if ($payload.smtpPort) { $smtpPort = [int]$payload.smtpPort }
                        
                        # Fallback to smtp_config.json if not passed in HTTP payload
                        if (-not $smtpUser -or -not $smtpPass) {
                            $smtpConfigPath = Join-Path $currentDir "smtp_config.json"
                            if (Test-Path $smtpConfigPath -PathType Leaf) {
                                $smtpConfig = Get-Content $smtpConfigPath | ConvertFrom-Json
                                $smtpUser = $smtpConfig.smtpUser
                                $smtpPass = $smtpConfig.smtpPass
                                if ($smtpConfig.smtpServer) { $smtpServer = $smtpConfig.smtpServer }
                                if ($smtpConfig.smtpPort) { $smtpPort = [int]$smtpConfig.smtpPort }
                            }
                        }
                        
                        $emailSent = $false
                        $errorMsg = ""
                        
                        # Store the OTP globally for test automation retrieval
                        $latestOtp = $otp
                        
                        if ($smtpUser -and $smtpPass -and $smtpUser -ne "your-email@gmail.com") {
                            try {
                                $mail = New-Object System.Net.Mail.MailMessage
                                $mail.From = New-Object System.Net.Mail.MailAddress($smtpUser, "StudyFlow Support")
                                $mail.To.Add($toEmail)
                                $mail.Subject = "StudyFlow Password Recovery OTP"
                                
                                $htmlBody = @"
<html>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f9; padding: 20px; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 1px solid #e0e0e0;">
    <h2 style="color: #1a73e8; margin-top: 0;">StudyFlow Security OTP</h2>
    <p>Please use the following One-Time Password (OTP) to verify your account or reset your password:</p>
    <div style="font-size: 24px; font-weight: bold; background: #f0f4f9; padding: 15px; text-align: center; letter-spacing: 5px; color: #1a73e8; border-radius: 4px; margin: 20px 0;">
      $otp
    </div>
    <p style="font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 15px;">If you did not request this, you can safely ignore this email.</p>
  </div>
</body>
</html>
"@
                                $mail.Body = $htmlBody
                                $mail.IsBodyHtml = $true
                                
                                $smtp = New-Object System.Net.Mail.SmtpClient($smtpServer, $smtpPort)
                                $smtp.EnableSsl = $true
                                $smtp.Credentials = New-Object System.Net.NetworkCredential($smtpUser, $smtpPass)
                                $smtp.Send($mail)
                                $emailSent = $true
                                Write-Host "[SMTP] Recovery OTP email successfully sent to $toEmail" -ForegroundColor Green
                            } catch {
                                $errorMsg = $_.Exception.Message
                                Write-Host "[SMTP Error] Failed to send email to $toEmail : $errorMsg" -ForegroundColor Red
                            }
                        }
                        
                        if (-not $emailSent) {
                            Write-Host "`n==================================================" -ForegroundColor Yellow
                            Write-Host "  [DEVELOPER FALLBACK] Recovery OTP for $toEmail" -ForegroundColor Yellow
                            Write-Host "  OTP CODE: $otp" -ForegroundColor Green
                            if ($errorMsg) {
                                Write-Host "  SMTP Error Details: $errorMsg" -ForegroundColor Red
                            } else {
                                Write-Host "  Note: Configure 'smtp_config.json' with your Gmail & App Password for real delivery." -ForegroundColor Gray
                            }
                            Write-Host "==================================================`n" -ForegroundColor Yellow
                        }
                        
                        $response.ContentType = "application/json; charset=utf-8"
                        $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true}')
                        $response.ContentLength64 = $resBytes.Length
                        $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                    } catch {
                        $response.StatusCode = 500
                        $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"Failed to process request"}')
                        $response.ContentType = "application/json; charset=utf-8"
                        $response.ContentLength64 = $errBytes.Length
                        $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    }
                }
                $response.Close()
                continue
            }
            
            # GET Latest OTP endpoint (for automated testing context only)
            if ($urlPath -eq "/api/get-latest-otp") {
                if ($request.HttpMethod -eq "GET") {
                    $response.ContentType = "application/json; charset=utf-8"
                    $jsonStr = '{"otp":"' + $latestOtp + '"}'
                    $otpBytes = [System.Text.Encoding]::UTF8.GetBytes($jsonStr)
                    $response.ContentLength64 = $otpBytes.Length
                    $response.OutputStream.Write($otpBytes, 0, $otpBytes.Length)
                }
                $response.Close()
                continue
            }
            
            # GET all registered users for chat contact lookup
            if ($urlPath -eq "/api/chat/users") {
                if ($request.HttpMethod -eq "GET") {
                    $syncFile = Join-Path $currentDir "database_sync.json"
                    $usernames = @()
                    if (Test-Path $syncFile -PathType Leaf) {
                        $syncData = Get-Content $syncFile -Raw | ConvertFrom-Json
                        if ($syncData -and $syncData.users) {
                            foreach ($u in $syncData.users) {
                                if ($u.username) {
                                    $usernames += $u.username
                                }
                            }
                        }
                    }
                    $jsonElements = @()
                    foreach ($u in $usernames) {
                        $u_esc = $u.Replace('\','\\').Replace('"','\"')
                        $jsonElements += ('"{0}"' -f $u_esc)
                    }
                    $json = "[" + ($jsonElements -join ",") + "]"
                    
                    $response.ContentType = "application/json; charset=utf-8"
                    $resBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                    $response.ContentLength64 = $resBytes.Length
                    $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                }
                $response.Close()
                continue
            }
            
            # POST send chat message to another user
            if ($urlPath -eq "/api/chat/send") {
                if ($request.HttpMethod -eq "POST") {
                    try {
                        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                        $body = $reader.ReadToEnd()
                        $reader.Close()
                        
                        $payload = ConvertFrom-Json $body
                        $sender = $payload.sender
                        $receiver = $payload.receiver
                        $text = $payload.text
                        $timestamp = $payload.timestamp
                        if (-not $timestamp) {
                            $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                        }
                        $msgId = [Guid]::NewGuid().ToString()
                        
                        $msgObj = [PSCustomObject]@{
                            id = $msgId
                            sender = $sender
                            receiver = $receiver
                            text = $text
                            timestamp = $timestamp
                        }
                        
                        $chatsFile = Join-Path $currentDir "database_chats.json"
                        $chatsList = @()
                        if (Test-Path $chatsFile -PathType Leaf) {
                            $content = Get-Content $chatsFile -Raw
                            if ($content) {
                                $chatsList = ConvertFrom-Json $content
                                if (-not $chatsList) { $chatsList = @() }
                                if ($chatsList -isnot [Array]) { $chatsList = @($chatsList) }
                            }
                        }
                        $chatsList += $msgObj
                        
                        $jsonElements = @()
                        foreach ($m in $chatsList) {
                            $s_esc = $m.sender.Replace('\','\\').Replace('"','\"')
                            $r_esc = $m.receiver.Replace('\','\\').Replace('"','\"')
                            $t_esc = $m.text.Replace('\','\\').Replace('"','\"').Replace("`n","\n").Replace("`r","")
                            $id_esc = $m.id
                            $time_esc = $m.timestamp
                            $jsonElements += ('{"id":"{0}","sender":"{1}","receiver":"{2}","text":"{3}","timestamp":{4}}' -f $id_esc, $s_esc, $r_esc, $t_esc, $time_esc)
                        }
                        $jsonOut = "[" + ($jsonElements -join ",") + "]"
                        [System.IO.File]::WriteAllText($chatsFile, $jsonOut, [System.Text.Encoding]::UTF8)
                        
                        $response.ContentType = "application/json; charset=utf-8"
                        $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true}')
                        $response.ContentLength64 = $resBytes.Length
                        $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                    } catch {
                        $response.StatusCode = 500
                        $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"Failed to save message"}')
                        $response.ContentType = "application/json; charset=utf-8"
                        $response.ContentLength64 = $errBytes.Length
                        $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    }
                }
                $response.Close()
                continue
            }
            
            # GET all messages for a specific user (either sent or received)
            if ($urlPath -eq "/api/chat/messages") {
                if ($request.HttpMethod -eq "GET") {
                    $user = $request.QueryString["user"]
                    $chatsFile = Join-Path $currentDir "database_chats.json"
                    $filtered = @()
                    if ($user -and (Test-Path $chatsFile -PathType Leaf)) {
                        $content = Get-Content $chatsFile -Raw
                        if ($content) {
                            $allChats = ConvertFrom-Json $content
                            if ($allChats) {
                                if ($allChats -isnot [Array]) { $allChats = @($allChats) }
                                foreach ($m in $allChats) {
                                    if ($m.sender -eq $user -or $m.receiver -eq $user) {
                                        $filtered += $m
                                    }
                                }
                            }
                        }
                    }
                    
                    $jsonElements = @()
                    foreach ($m in $filtered) {
                        $s_esc = $m.sender.Replace('\','\\').Replace('"','\"')
                        $r_esc = $m.receiver.Replace('\','\\').Replace('"','\"')
                        $t_esc = $m.text.Replace('\','\\').Replace('"','\"').Replace("`n","\n").Replace("`r","")
                        $id_esc = $m.id
                        $time_esc = $m.timestamp
                        $jsonElements += ('{"id":"{0}","sender":"{1}","receiver":"{2}","text":"{3}","timestamp":{4}}' -f $id_esc, $s_esc, $r_esc, $t_esc, $time_esc)
                    }
                    $jsonOut = "[" + ($jsonElements -join ",") + "]"
                    
                    $response.ContentType = "application/json; charset=utf-8"
                    $resBytes = [System.Text.Encoding]::UTF8.GetBytes($jsonOut)
                    $response.ContentLength64 = $resBytes.Length
                    $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                }
                $response.Close()
                continue
            }
            
            # Route root directory to index.html
            if ($urlPath -eq "/") {
                $urlPath = "/index.html"
            }
            
            # Replace forward slashes with backward slashes for Windows paths
            $normalizedPath = $urlPath.Replace("/", "\")
            $filePath = Join-Path $currentDir $normalizedPath
            
            if (Test-Path $filePath -PathType Leaf) {
                $contentBytes = [System.IO.File]::ReadAllBytes($filePath)
                
                # MIME Content-Type mapping
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = "application/octet-stream"
                
                if ($ext -eq ".html" -or $ext -eq ".htm") { $contentType = "text/html; charset=utf-8" }
                elseif ($ext -eq ".css") { $contentType = "text/css; charset=utf-8" }
                elseif ($ext -eq ".js") { $contentType = "application/javascript; charset=utf-8" }
                elseif ($ext -eq ".json") { $contentType = "application/json; charset=utf-8" }
                elseif ($ext -eq ".svg") { $contentType = "image/svg+xml; charset=utf-8" }
                elseif ($ext -eq ".png") { $contentType = "image/png" }
                elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $contentType = "image/jpeg" }
                elseif ($ext -eq ".ico") { $contentType = "image/x-icon" }
                
                $response.ContentType = $contentType
                $response.ContentLength64 = $contentBytes.Length
                $response.OutputStream.Write($contentBytes, 0, $contentBytes.Length)
            } else {
                # File Not Found
                $response.StatusCode = 404
                $errorBytes = [System.Text.Encoding]::UTF8.GetBytes("404 File Not Found: $urlPath")
                $response.ContentLength64 = $errorBytes.Length
                $response.OutputStream.Write($errorBytes, 0, $errorBytes.Length)
            }
            $response.Close()
        } catch {
            Write-Host "Error processing request: $_" -ForegroundColor Red
            try { $context.Response.Close() } catch {}
        }
    }
} catch {
    Write-Host "Fatal server error: $_" -ForegroundColor Red
} finally {
    $listener.Stop()
    Write-Host "Server stopped." -ForegroundColor Red
}
