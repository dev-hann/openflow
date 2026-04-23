import 'package:flutter/material.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

class AppTheme {
  AppTheme._();

  static ShadThemeData light() {
    return ShadThemeData(
      colorScheme: const ShadVioletColorScheme.light(),
      brightness: Brightness.light,
      radius: const BorderRadius.all(Radius.circular(10)),
      cardTheme: ShadCardTheme(
        radius: const BorderRadius.all(Radius.circular(12)),
        border: ShadBorder.all(
          color: const Color(0xFFE5E7EB),
          padding: EdgeInsets.zero,
        ),
        padding: const EdgeInsets.all(16),
      ),
      inputTheme: const ShadInputTheme(
        style: TextStyle(fontSize: 15, color: Color(0xff030712)),
        padding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      ),
      primaryButtonTheme: const ShadButtonTheme(
        backgroundColor: Color(0xFF7C3AED),
        hoverBackgroundColor: Color(0xFF6D28D9),
      ),
      progressTheme: const ShadProgressTheme(
        color: Color(0xFF7C3AED),
        borderRadius: BorderRadius.all(Radius.circular(999)),
      ),
      primaryBadgeTheme: const ShadBadgeTheme(
        backgroundColor: Color(0xFF7C3AED),
      ),
    );
  }

  static ShadThemeData dark() {
    return ShadThemeData(
      colorScheme: const ShadVioletColorScheme.dark(),
      brightness: Brightness.dark,
      radius: const BorderRadius.all(Radius.circular(10)),
      cardTheme: ShadCardTheme(
        radius: const BorderRadius.all(Radius.circular(12)),
        border: ShadBorder.all(
          color: const Color(0xFF1F2937),
          padding: EdgeInsets.zero,
        ),
        padding: const EdgeInsets.all(16),
      ),
      inputTheme: const ShadInputTheme(
        style: TextStyle(fontSize: 15, color: Color(0xFFF9FAFB)),
        padding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      ),
      primaryButtonTheme: const ShadButtonTheme(
        backgroundColor: Color(0xFF6D28D9),
        hoverBackgroundColor: Color(0xFF5B21B6),
      ),
      progressTheme: const ShadProgressTheme(
        color: Color(0xFF6D28D9),
        borderRadius: BorderRadius.all(Radius.circular(999)),
      ),
      primaryBadgeTheme: const ShadBadgeTheme(
        backgroundColor: Color(0xFF6D28D9),
      ),
    );
  }
}
