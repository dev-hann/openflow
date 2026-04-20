import 'package:flutter/material.dart';

class Spacing {
  Spacing._();
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double xxl = 48;
}

class AppRadius {
  AppRadius._();
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double full = 999;
}

class AppShadows {
  AppShadows._();

  static final BoxShadow sm = BoxShadow(
    color: const Color(0xFF000000).withValues(alpha: 0.08),
    blurRadius: 4,
    offset: const Offset(0, 1),
  );

  static final BoxShadow md = BoxShadow(
    color: const Color(0xFF000000).withValues(alpha: 0.12),
    blurRadius: 8,
    offset: const Offset(0, 2),
  );

  static final BoxShadow lg = BoxShadow(
    color: const Color(0xFF000000).withValues(alpha: 0.16),
    blurRadius: 16,
    offset: const Offset(0, 4),
  );
}
