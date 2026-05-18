# Android Integration & Architecture 📱

HostelFlow integrates natively with Android shells through a lightweight **Capacitor wrapper**, providing native speeds, hardware integration, and a stable PWA experience.

---

## 🛠️ Build Toolchain Environment

We resolved the classic Gradle Java runtime error:
`Unsupported class file major version 69`

We directed Gradle to use Android Studio's bundled **JBR 21 (JetBrains Java Runtime)** inside your [gradle.properties](file:///c:/project/hostel/client/android/gradle.properties):
```properties
org.gradle.java.home=C:/Program Files/Android/Android Studio/jbr
```
This forces all Capacitor builds to build under a fully compliant Java 21 environment.

---

## 🎨 Mobile Optimizations

1. **Splash Screen Black-Flash Shield**: Auto-dismiss timeout set to `250ms` in [App.jsx](file:///c:/project/hostel/client/src/App.jsx) guarantees React finishes render paint cycles before fading the splash logo, resolving layout jumps.
2. **StatusBar Auto-Contrast**: An integrated `MutationObserver` watches HTML classes to dynamically style native status bar text when switching between light and dark modes.
3. **Hardware Native Navigation**: Customized physical back button handlers close open sidebars and overlay panels before falling back.
