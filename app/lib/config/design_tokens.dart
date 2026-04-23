import 'package:flutter/material.dart';
import 'package:mix/mix.dart';

final $brandPrimary = ColorToken('brandPrimary');
final $brandPrimaryHover = ColorToken('brandPrimaryHover');
final $brandPrimaryLight = ColorToken('brandPrimaryLight');
final $statusSuccess = ColorToken('statusSuccess');
final $statusError = ColorToken('statusError');

final $spaceXs = SpaceToken('space.xs');
final $spaceSm = SpaceToken('space.sm');
final $spaceMd = SpaceToken('space.md');
final $spaceLg = SpaceToken('space.lg');
final $spaceXl = SpaceToken('space.xl');
final $spaceXxl = SpaceToken('space.xxl');

class AppSpacing {
  AppSpacing._();
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

class AppFontSizes {
  AppFontSizes._();
  static const double xs = 11;
  static const double sm = 13;
  static const double base = 15;
  static const double md = 16;
  static const double lg = 18;
  static const double xl = 22;
  static const double pinDigit = 24;
  static const double iconSmall = 20;
  static const double iconMedium = 24;
  static const double iconLarge = 64;
}

final mixTokens = <MixToken<dynamic>, dynamic>{
  $brandPrimary: const Color(0xFF7C3AED),
  $brandPrimaryHover: const Color(0xFF6D28D9),
  $brandPrimaryLight: const Color(0xFFA855F7),
  $statusSuccess: const Color(0xFF22C55E),
  $statusError: const Color(0xFFEF4444),
};
