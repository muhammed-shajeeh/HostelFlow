# Android Native & Capacitor Integration Snippets 📱

This document contains key, highly readable software engineering snippets representing the **HostelFlow Native Capacitor Shell Integration** for Android.

---

## 1. Hardware Back Button Navigation Handling
This client-side snippet intercepts Android physical hardware back key presses to ensure native-compliant back navigations.

```javascript
import { App } from '@capacitor/app';

useEffect(() => {
  const backHandler = App.addListener('backButton', ({ canGoBack }) => {
    if (window.location.pathname === '/dashboard') {
      App.exitApp(); // Exit if on primary landing view
    } else if (canGoBack) {
      window.history.back(); // Navigate back inside React state
    }
  });

  return () => {
    backHandler.then(h => h.remove());
  };
}, []);
```

### 📝 Technical Explanation:
This snippet registers a native listener on Capacitor's `'backButton'` hook. When a student presses the physical back key on their Android device, this listener intercepts the trigger: if the user is on the primary `/dashboard` landing path, it exits the app safely; otherwise, it simulates standard browser back navigation, matching Android native navigation standards.

---

## 2. Dynamic Capacitor Platform Detection
This helper detects whether the client bundle is executing within a standard web browser context or packed inside the Capacitor Android runtime shell.

```javascript
import { Cap } from '@capacitor/core';

const isNativeApp = () => {
  return Cap.isNativePlatform();
};

// Conditional runtime layout sizing adjustment
if (isNativeApp()) {
  document.body.classList.add('android-native-viewport');
  // Safe area padding offsets are triggered...
}
```

### 📝 Technical Explanation:
This code utilizes Capacitor’s core platform detection utility to determine at runtime whether the React bundle is running inside a native mobile wrapper. If a native shell is detected, it dynamically appends helper CSS classes to the HTML body to apply status-bar safe paddings and prevent layout overlapping or clipping.

---

## 3. Dynamic Splash Screen Fade Dismissal
To eliminate sudden startup white flashes, this client utility hides the native Android splash screen post-DOM mount.

```javascript
import { SplashScreen } from '@capacitor/splash-screen';

const initializeAppShell = async () => {
  // Let React complete DOM rendering paints...
  setTimeout(async () => {
    await SplashScreen.hide({
      fadeOutDuration: 250 // Clean fading transition
    });
  }, 250);
};
```

### 📝 Technical Explanation:
By default, the Android package loads a native splash screen image. Instead of hiding it instantly on index script execution, this code waits exactly 250 milliseconds after React starts up—ensuring the virtual DOM has completed its first painting cycle. It then hides the splash screen with a smooth 250ms fade transition.
