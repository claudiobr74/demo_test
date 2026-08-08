import 'package:flutter/material.dart';

import '../../core/theme/serena_theme.dart';

class SerenaSection extends StatelessWidget {
  const SerenaSection({super.key, required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(SerenaSpacing.md),
          decoration: BoxDecoration(
            color: SerenaColors.surface,
            borderRadius: BorderRadius.circular(SerenaRadius.lg),
            border: Border.all(color: SerenaColors.border),
          ),
          child: child,
        ),
      ],
    );
  }
}
