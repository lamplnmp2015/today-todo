Add-Type -AssemblyName System.Drawing

$size = 1024
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# 透明底
$g.Clear([System.Drawing.Color]::Transparent)

# 圆角矩形背景（Mac 风蓝色渐变）
$rect = New-Object System.Drawing.Rectangle(40, 40, 944, 944)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$radius = 220
$path.AddArc($rect.X, $rect.Y, $radius, $radius, 180, 90)
$path.AddArc($rect.Right - $radius, $rect.Y, $radius, $radius, 270, 90)
$path.AddArc($rect.Right - $radius, $rect.Bottom - $radius, $radius, $radius, 0, 90)
$path.AddArc($rect.X, $rect.Bottom - $radius, $radius, $radius, 90, 90)
$path.CloseAllFigures()

$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 90, 160, 255),
    [System.Drawing.Color]::FromArgb(255, 0, 122, 255),
    45.0
)
$g.FillPath($brush, $path)

# 写一个 ✓ 对勾
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 80)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$g.DrawLines($pen, @(
    (New-Object System.Drawing.Point(320, 540)),
    (New-Object System.Drawing.Point(470, 690)),
    (New-Object System.Drawing.Point(740, 360))
))

$bmp.Save("E:\today-todo\app-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Host "Icon saved to E:\today-todo\app-icon.png"
