# DevTrack — גרסת Desktop (Electron)

## בנייה ל-Windows

### דרישות
- **Node.js LTS** — https://nodejs.org (פעם אחת)

### בנייה
1. חלץ את התיקייה
2. לחץ פעמיים על `build-windows.bat`
3. המתן ~5 דקות
4. בתיקיית `dist/` תמצא:
   - `DevTrack Setup.exe` — מתקין מלא עם קיצור דרך
   - `DevTrack.exe` — גרסה ניידת ללא התקנה

### הפעלה
לאחר הבנייה — לחץ פעמיים על `DevTrack Setup.exe` והתקן.
האפליקציה תופיע בתפריט Start ועל הדסקטופ.

## מה כולל
- ✅ ממשק מלא בעברית, ערכת צבעים כהה
- ✅ SQLite מקומי — נתונים שמורים על המחשב
- ✅ הרצת .bat ישירות מהכרטיס
- ✅ פתיחת תיקייה בסייר קבצים
- ✅ בחירת קובץ/תיקייה דרך dialog אמיתי
- ✅ ייבוא JSON — בחירת קובץ אמיתית
- ✅ ייצוא JSON — גיבוי מלא
- ✅ ניהול גרסאות, תלויות, קישורי AI

## מבנה קבצים
```
devtrack-electron/
├── main.js          ← Electron + Express + SQLite
├── preload.js       ← אבטחה
├── package.json     ← תלויות
├── build-windows.bat ← סקריפט בנייה
└── renderer/
    └── index.html   ← ממשק המשתמש
```
