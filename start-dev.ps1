$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
cd "C:\Users\30430\Desktop\编导知识大全\小宋\xiaosong-web"
& "C:\Program Files\nodejs\npm.cmd" run dev
