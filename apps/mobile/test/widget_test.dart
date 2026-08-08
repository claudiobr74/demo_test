import 'package:flutter_test/flutter_test.dart';
import 'package:serenapsi/core/theme/serena_theme.dart';

void main() {
  test('design tokens expose serene palette', () {
    expect(SerenaColors.sageDark.toARGB32(), isNonZero);
    expect(SerenaSpacing.md, 16);
    expect(SerenaBreakpoints.tablet, 900);
  });

  testWidgets('theme builds without error', (tester) async {
    final theme = buildSerenaTheme();
    expect(theme.colorScheme.primary, SerenaColors.sageDark);
  });
}
