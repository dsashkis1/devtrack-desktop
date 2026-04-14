@echo off
chcp 65001 > nul
title בניית DevTrack

echo.
echo ╔══════════════════════════════════════════════╗
echo ║         DevTrack — בנייה ל-Windows           ║
echo ╚══════════════════════════════════════════════╝
echo.

:: בדיקת Node.js
node --version > nul 2>&1
if errorlevel 1 (
    echo [!] Node.js לא מותקן
    echo     מוריד מ-https://nodejs.org
    start https://nodejs.org/en/download
    echo.
    echo     התקן Node.js LTS ואז הרץ מחדש
    pause
    exit /b
)
for /f "tokens=*" %%v in ('node --version') do echo [✓] Node.js %%v

:: התקנת תלויות
echo [→] מתקין תלויות ^(כ-2 דקות^)...
call npm install
if errorlevel 1 (
    echo [!] שגיאה בהתקנת תלויות
    pause
    exit /b
)
echo [✓] תלויות הותקנו

:: בנייה
echo.
echo [→] בונה DevTrack.exe ^(כ-3-5 דקות^)...
call npm run build
if errorlevel 1 (
    echo [!] שגיאה בבנייה
    pause
    exit /b
)

echo.
echo ╔══════════════════════════════════════════════╗
echo ║   ✓ הבנייה הושלמה!                          ║
echo ║                                              ║
echo ║   קבצים בתיקייה dist\:                      ║
echo ║   • DevTrack Setup.exe  ← מתקין             ║
echo ║   • DevTrack.exe        ← נייד ^(ללא התקנה^) ║
echo ╚══════════════════════════════════════════════╝
echo.
echo פותח את תיקיית dist...
explorer dist
pause
