import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'core/theme/serena_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: SerenaPsiApp()));
}

class SerenaPsiApp extends ConsumerWidget {
  const SerenaPsiApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'SerenaPsi',
      debugShowCheckedModeBanner: false,
      theme: buildSerenaTheme(),
      routerConfig: router,
    );
  }
}
