# ลงทะเบียน Windows Task Scheduler สำหรับ sync อัตโนมัติ (รันซ้ำได้ — จะแทนที่ของเดิม)
#   RetailComm Sync GSheet     : ทุก 1 ชม. 08:00–19:00 (Google Sheet: BA, Cust Sat x2, ผลตรวจประเมินร้าน)
#   RetailComm Sync SharePoint : 09:30 / 12:00 / 16:00 (DI, Odoo, LHS/Rudy, แบบรับเข้า — รันเฉพาะไฟล์ที่เปลี่ยน)
# - รันเฉพาะตอนผู้ใช้ล็อกอิน (ต้องใช้ OneDrive ของผู้ใช้) ; พลาดรอบ (ปิดเครื่อง) -> รันชดเชยเมื่อเปิดเครื่อง
# - ไม่เริ่มรอบใหม่ถ้ารอบก่อนยังไม่จบ ; จำกัดเวลา 1 ชม.
# ใช้: powershell -ExecutionPolicy Bypass -File scripts\register-sync-tasks.ps1
# ลบ:  Unregister-ScheduledTask -TaskName "RetailComm Sync*" -Confirm:$false
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$vbs = Join-Path $PSScriptRoot "run-sync-hidden.vbs"
$user = "$env:USERDOMAIN\$env:USERNAME"

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

function New-Action($group) {
  New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`" $group" -WorkingDirectory $root
}

# Google Sheet: 08:00 แล้วซ้ำทุก 1 ชม. อีก 11 ชม. (ถึง 19:00)
$gs = New-ScheduledTaskTrigger -Daily -At "08:00"
$gs.Repetition = (New-ScheduledTaskTrigger -Once -At "08:00" -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours 11)).Repetition
Register-ScheduledTask -TaskName "RetailComm Sync GSheet" -Description "Retail Comm: sync Google Sheet (BA, Cust Sat, SCG Home survey, store evaluation) -> Supabase" `
  -Action (New-Action "gsheet") -Trigger $gs -Settings $settings -Principal $principal -Force | Out-Null

# SharePoint: 09:30 / 12:00 / 16:00
$sp = @("09:30", "12:00", "16:00") | ForEach-Object { New-ScheduledTaskTrigger -Daily -At $_ }
Register-ScheduledTask -TaskName "RetailComm Sync SharePoint" -Description "Retail Comm: sync SharePoint files via OneDrive (DI, Odoo, LHS/Rudy, CRM design intake) -> Supabase; runs only changed files" `
  -Action (New-Action "sharepoint") -Trigger $sp -Settings $settings -Principal $principal -Force | Out-Null

Get-ScheduledTask -TaskName "RetailComm Sync*" | ForEach-Object {
  $i = $_ | Get-ScheduledTaskInfo
  "{0,-28} {1,-6} next run: {2}" -f $_.TaskName, $_.State, $i.NextRunTime
}
