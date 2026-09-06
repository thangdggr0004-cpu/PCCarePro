Add-Type -AssemblyName System.Drawing

function Create-Icon([int], [string]) {
     = New-Object System.Drawing.Bitmap , 
     = [System.Drawing.Graphics]::FromImage()
    .SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    # Background gradient or solid dark slate
     = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
    .FillEllipse(, 2, 2, ( - 4), ( - 4))

    # Cyan glowing border
     = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 14, 165, 233), [Math]::Max(2, [int]( * 0.04)))
    .DrawEllipse(, 4, 4, ( - 8), ( - 8))

    # Text: TP
     = [int]( * 0.28)
     = New-Object System.Drawing.Font('Segoe UI', , [System.Drawing.FontStyle]::Bold)
     = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 56, 189, 248))
     = New-Object System.Drawing.StringFormat
    .Alignment = [System.Drawing.StringAlignment]::Center
    .LineAlignment = [System.Drawing.StringAlignment]::Center
    .DrawString('TP', , , ( / 2), ( * 0.38), )

    # Subtext: KEY
     = [Math]::Max(8, [int]( * 0.12))
     = New-Object System.Drawing.Font('Segoe UI', , [System.Drawing.FontStyle]::Bold)
     = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 248, 250, 252))
    .DrawString('LIC GEN', , , ( / 2), ( * 0.72), )

    .Save(, [System.Drawing.Imaging.ImageFormat]::Png)
    .Dispose()
    .Dispose()
}

 = 'c:\Users\PC\Downloads\ThienPhatTechToolKit-Tauri\android-licgen\res'
Create-Icon 72  " \mipmap-hdpi\ic_launcher.png\
Create-Icon 96 \\mipmap-xhdpi\ic_launcher.png\
Create-Icon 144 \\mipmap-xxhdpi\ic_launcher.png\
Create-Icon 192 \c:\Users\PC\Downloads\ThienPhatTechToolKit-Tauri\android-licgen\res\drawable\ic_launcher.png\
Write-Host 'Icons created successfully!'
