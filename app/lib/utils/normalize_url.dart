String normalizeUrl(String url) {
  var normalized = url.trim();
  if (normalized.isEmpty) return normalized;

  if (!normalized.startsWith(RegExp('https?://'))) {
    normalized = 'http://$normalized';
  }

  normalized = normalized.replaceAll(RegExp(r'/+$'), '');
  normalized = normalized.replaceAll(RegExp('(?<!:)//+'), '/');

  return normalized;
}
