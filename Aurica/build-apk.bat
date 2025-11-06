@echo off
echo Building Aurica APK...
echo.

echo Choose build type:
echo 1. Preview APK (for testing)
echo 2. Production APK (for release)
echo 3. Development APK (with dev client)
echo.

set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo Building Preview APK...
    eas build --platform android --profile preview
) else if "%choice%"=="2" (
    echo Building Production APK...
    eas build --platform android --profile production
) else if "%choice%"=="3" (
    echo Building Development APK...
    eas build --platform android --profile development
) else (
    echo Invalid choice. Please run the script again.
    pause
    exit /b 1
)

echo.
echo Build completed! Check your EAS dashboard for the download link.
pause
