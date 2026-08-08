import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/serena_theme.dart';
import 'patient_hub_page.dart';

class ClinicalRecordsPage extends ConsumerWidget {
  const ClinicalRecordsPage({super.key, required this.patientId});

  final String patientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final records = ref.watch(patientRecordsProvider(patientId));
    final patient = ref.watch(patientProvider(patientId));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          patient.maybeWhen(
            data: (d) => 'Prontuário · ${d['display_name'] ?? ''}',
            orElse: () => 'Prontuário',
          ),
        ),
      ),
      body: records.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e.toString())),
        data: (items) {
          if (items.isEmpty) {
            return Center(
              child: Text(
                'Nenhum registro clínico ainda.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(24),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final r = items[index];
              return Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: SerenaColors.surface,
                  borderRadius: BorderRadius.circular(SerenaRadius.md),
                  border: Border.all(color: SerenaColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      (r['recorded_at'] as String? ?? '').replaceFirst('T', ' · ').split('.').first,
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      r['focus'] as String? ?? 'Sem foco registrado',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      r['evolution_preview'] as String? ?? '',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      r['status'] == 'finalized' ? 'Finalizado' : 'Rascunho',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}
