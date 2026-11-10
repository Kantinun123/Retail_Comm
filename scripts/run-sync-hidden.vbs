' Run scripts\sync-runner.mjs without a console window (used by Windows Task Scheduler)
' Usage: wscript.exe run-sync-hidden.vbs gsheet|sharepoint
' Waits for completion so Task Scheduler knows it is still running (no overlapping runs)
Option Explicit
Dim sh, fso, root, group, nodeExe
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
group = "all"
If WScript.Arguments.Count > 0 Then group = WScript.Arguments(0)
nodeExe = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\nodejs\node.exe"
If Not fso.FileExists(nodeExe) Then nodeExe = "node"
sh.CurrentDirectory = root
WScript.Quit sh.Run("""" & nodeExe & """ scripts\sync-runner.mjs --group " & group, 0, True)
