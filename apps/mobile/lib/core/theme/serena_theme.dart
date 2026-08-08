import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// SerenaPsi design tokens — premium, acolhedor, sereno, profissional.
/// Sem estética hospitalar. Sem valores hardcoded espalhados na UI.
abstract final class SerenaColors {
  static const cream = Color(0xFFFFFBF7);
  static const offWhite = Color(0xFFF7F4EF);
  static const sage = Color(0xFF7A9E8E);
  static const sageDark = Color(0xFF4F7364);
  static const teal = Color(0xFF3D7A7A);
  static const tealMuted = Color(0xFF5C8F8F);
  static const blueGray = Color(0xFF5B6B7A);
  static const lavender = Color(0xFFB8A9C9);
  static const ink = Color(0xFF2C3338);
  static const inkSoft = Color(0xFF5A646C);
  static const border = Color(0xFFE4DED5);
  static const surface = Color(0xFFFFFFFF);
  static const success = Color(0xFF5F8F74);
  static const warning = Color(0xFFC4A35A);
  static const danger = Color(0xFFB56B6B);
  static const info = Color(0xFF6B8CAE);
}

abstract final class SerenaSpacing {
  static const xxs = 4.0;
  static const xs = 8.0;
  static const sm = 12.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
  static const xxl = 48.0;
}

abstract final class SerenaRadius {
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
}

abstract final class SerenaBreakpoints {
  static const phone = 600.0;
  static const tablet = 900.0;
  static const desktop = 1200.0;
  static const wide = 1600.0;
}

abstract final class SerenaShadows {
  static List<BoxShadow> get soft => [
        BoxShadow(
          color: SerenaColors.ink.withValues(alpha: 0.06),
          blurRadius: 16,
          offset: const Offset(0, 6),
        ),
      ];
}

ThemeData buildSerenaTheme() {
  final baseText = GoogleFonts.sourceSans3TextTheme();
  final display = GoogleFonts.frauncesTextTheme();

  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: SerenaColors.cream,
    colorScheme: ColorScheme.light(
      primary: SerenaColors.sageDark,
      onPrimary: Colors.white,
      secondary: SerenaColors.teal,
      onSecondary: Colors.white,
      surface: SerenaColors.surface,
      onSurface: SerenaColors.ink,
      error: SerenaColors.danger,
      outline: SerenaColors.border,
    ),
    textTheme: baseText.copyWith(
      displayLarge: display.displayLarge?.copyWith(
        color: SerenaColors.ink,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.5,
      ),
      displayMedium: display.displayMedium?.copyWith(
        color: SerenaColors.ink,
        fontWeight: FontWeight.w600,
      ),
      headlineLarge: display.headlineLarge?.copyWith(
        color: SerenaColors.ink,
        fontWeight: FontWeight.w600,
        fontSize: 32,
      ),
      headlineMedium: display.headlineMedium?.copyWith(
        color: SerenaColors.ink,
        fontWeight: FontWeight.w600,
        fontSize: 24,
      ),
      titleLarge: baseText.titleLarge?.copyWith(
        color: SerenaColors.ink,
        fontWeight: FontWeight.w600,
      ),
      bodyLarge: baseText.bodyLarge?.copyWith(color: SerenaColors.ink, height: 1.45),
      bodyMedium: baseText.bodyMedium?.copyWith(color: SerenaColors.inkSoft, height: 1.45),
      labelLarge: baseText.labelLarge?.copyWith(
        color: SerenaColors.ink,
        fontWeight: FontWeight.w600,
      ),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: display.titleLarge?.copyWith(
        color: SerenaColors.ink,
        fontWeight: FontWeight.w600,
        fontSize: 22,
      ),
      iconTheme: const IconThemeData(color: SerenaColors.ink),
    ),
    cardTheme: CardThemeData(
      color: SerenaColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(SerenaRadius.md),
        side: const BorderSide(color: SerenaColors.border),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: SerenaColors.sageDark,
        foregroundColor: Colors.white,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(SerenaRadius.md),
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: SerenaColors.sageDark,
        minimumSize: const Size(48, 48),
        side: const BorderSide(color: SerenaColors.border),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(SerenaRadius.md),
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: SerenaColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(SerenaRadius.md),
        borderSide: const BorderSide(color: SerenaColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(SerenaRadius.md),
        borderSide: const BorderSide(color: SerenaColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(SerenaRadius.md),
        borderSide: const BorderSide(color: SerenaColors.teal, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    dividerTheme: const DividerThemeData(color: SerenaColors.border, thickness: 1),
    navigationRailTheme: const NavigationRailThemeData(
      backgroundColor: SerenaColors.offWhite,
      selectedIconTheme: IconThemeData(color: SerenaColors.sageDark),
      selectedLabelTextStyle: TextStyle(color: SerenaColors.sageDark, fontWeight: FontWeight.w600),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: SerenaColors.surface,
      selectedItemColor: SerenaColors.sageDark,
      unselectedItemColor: SerenaColors.inkSoft,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
  );
}
