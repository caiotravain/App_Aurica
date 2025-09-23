# Aurica Mobile App

This is a React Native mobile application that connects to the Aurica Django server for authentication and data management.

## Features

- **Authentication**: Login/logout functionality with Django server
- **Modern UI**: Clean, responsive design with loading states
- **Cross-platform**: Works on iOS, Android, and Web
- **Real-time**: Live connection to Django backend

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- Python 3.8+ (for Django server)
- Django server running (see Django setup below)

## Setup

### 1. Install Dependencies

```bash
cd App_Aurica/Aurica
npm install
```

### 2. Start the Development Server

```bash
npm start
```

This will start the Expo development server. You can then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Press `w` for web browser
- Scan QR code with Expo Go app on your phone

### 3. Django Server Setup

Make sure the Django server is running on `http://localhost:8000`:

```bash
cd ../Aurica/site
pip install -r requirements.txt
python manage.py runserver
```

## Configuration

### API Configuration

The app is configured to connect to the Django server at `http://localhost:8000`. To change this, update the `API_BASE_URL` in `services/api.ts`.

### CORS Configuration

The Django server is configured to allow CORS requests from the React Native app. Make sure `django-cors-headers` is installed and configured in Django settings.

## Project Structure

```
App_Aurica/
├── Aurica/
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── index.tsx          # Main home screen with auth
│   │   │   └── explore.tsx        # Explore tab with logout
│   │   └── _layout.tsx            # Root layout with auth provider
│   ├── components/
│   │   └── LoginScreen.tsx        # Login form component
│   ├── contexts/
│   │   └── AuthContext.tsx        # Authentication context
│   ├── services/
│   │   └── api.ts                 # API service for Django communication
│   └── package.json
└── README.md
```

## Authentication Flow

1. App starts and checks authentication status
2. If not authenticated, shows login screen
3. User enters credentials and submits
4. App sends POST request to Django `/login/` endpoint
5. Django authenticates and redirects to home page
6. App detects successful login and shows main interface
7. User can logout from the Explore tab

## Troubleshooting

### Connection Issues

- Ensure Django server is running on `http://localhost:8000`
- Check that CORS is properly configured in Django
- Verify network connectivity between devices

### Authentication Issues

- Check Django user credentials
- Ensure Django server is accessible from the device
- Check browser/device console for error messages

### Development Issues

- Clear Expo cache: `expo start -c`
- Restart Metro bundler
- Check for TypeScript errors in the console

## Development Notes

- The app uses Expo Router for navigation
- Authentication state is managed with React Context
- API calls use fetch with proper CORS configuration
- Error handling includes user-friendly messages
- Loading states provide good UX during network requests