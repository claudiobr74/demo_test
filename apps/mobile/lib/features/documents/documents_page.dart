import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/serena_theme.dart';
import '../../shared/widgets/serena_section.dart';

final documentTemplatesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final data = await ref.watch(apiClientProvider).get('/api/v1/documents/templates');
  return (data['items'] as List? ?? [])
      .map((e) => Map<String, dynamic>.from(e as Map))
      .toList();
});

final documentsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final data = await ref.watch(apiClientProvider).get('/api/v1/documents');
  return (data['items'] as List? ?? [])
      .map((e) => Map<String, dynamic>.from(e as Map))
      .toList();
});

final documentPatientsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final data = await ref.watch(apiClientProvider).get('/api/v1/patients');
  return (data['items'] as List? ?? [])
      .map((e) => Map<String, dynamic>.from(e as Map))
      .toList();
});

class DocumentsPage extends ConsumerWidget {
  const DocumentsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docs = ref.watch(documentsProvider);
    final templates = ref.watch(documentTemplatesProvider);

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          pinned: true,
          title: const Text('Documentos'),
          actions: [
            IconButton(
              tooltip: 'Novo documento',
              onPressed: () => _create(context, ref),
              icon: const Icon(Icons.add),
            ),
          ],
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 48),
          sliver: SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Declarações e recibos do consultório — rascunho até você finalizar.',
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 20),
                SerenaSection(
                  title: 'Modelos',
                  child: templates.when(
                    loading: () => const LinearProgressIndicator(),
                    error: (e, _) => Text(e.toString()),
                    data: (items) => Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final t in items)
                          OutlinedButton(
                            onPressed: () => _create(context, ref, template: t),
                            child: Text(t['name'] as String? ?? 'Modelo'),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                SerenaSection(
                  title: 'Documentos recentes',
                  child: docs.when(
                    loading: () => const LinearProgressIndicator(),
                    error: (e, _) => Text(e.toString()),
                    data: (items) {
                      if (items.isEmpty) {
                        return Text(
                          'Nenhum documento ainda. Escolha um modelo acima.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        );
                      }
                      return Column(
                        children: [
                          for (final d in items)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _DocTile(
                                doc: d,
                                onFinalize: () async {
                                  await ref.read(apiClientProvider).post(
                                    '/api/v1/documents/${d['id']}/finalize',
                                    body: {'confirm': true},
                                  );
                                  ref.invalidate(documentsProvider);
                                },
                                onCopy: () async {
                                  await Clipboard.setData(
                                    ClipboardData(text: d['body'] as String? ?? ''),
                                  );
                                  if (!context.mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Texto copiado.')),
                                  );
                                },
                                onExport: (fmt) => _exportDoc(context, ref, d['id'] as String, fmt),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _create(
    BuildContext context,
    WidgetRef ref, {
    Map<String, dynamic>? template,
  }) async {
    final patients = await ref.read(documentPatientsProvider.future);
    if (!context.mounted) return;
    String? patientId = patients.isNotEmpty ? patients.first['id'] as String : null;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            final bottom = MediaQuery.viewInsetsOf(ctx).bottom;
            return Padding(
              padding: EdgeInsets.fromLTRB(24, 8, 24, 24 + bottom),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    template?['name'] as String? ?? 'Novo documento',
                    style: Theme.of(ctx).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: patientId,
                    items: [
                      for (final p in patients)
                        DropdownMenuItem(
                          value: p['id'] as String,
                          child: Text(p['display_name'] as String? ?? ''),
                        ),
                    ],
                    onChanged: (v) => setLocal(() => patientId = v),
                    decoration: const InputDecoration(labelText: 'Paciente'),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: patientId == null ? null : () => Navigator.pop(ctx, true),
                    child: const Text('Gerar rascunho'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
    if (ok != true || patientId == null) return;
    final body = <String, dynamic>{'patient_id': patientId};
    if (template != null) {
      body['template_id'] = template['id'];
    } else {
      final templates = await ref.read(documentTemplatesProvider.future);
      if (templates.isNotEmpty) body['template_id'] = templates.first['id'];
    }
    await ref.read(apiClientProvider).post('/api/v1/documents', body: body);
    ref.invalidate(documentsProvider);
  }

  Future<void> _exportDoc(
    BuildContext context,
    WidgetRef ref,
    String documentId,
    String format,
  ) async {
    try {
      final data = await ref.read(apiClientProvider).get(
            '/api/v1/documents/$documentId/export?format=$format',
          );
      final content = data['content'] as String? ?? '';
      final filename = data['filename'] as String? ?? 'documento';
      final hint = data['print_hint'] as String?;
      await Clipboard.setData(ClipboardData(text: content));
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            format == 'txt'
                ? 'Texto de $filename copiado.'
                : '${hint ?? 'HTML copiado.'} Arquivo: $filename',
          ),
          duration: const Duration(seconds: 4),
        ),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }
}

class _DocTile extends StatelessWidget {
  const _DocTile({
    required this.doc,
    required this.onFinalize,
    required this.onCopy,
    required this.onExport,
  });

  final Map<String, dynamic> doc;
  final VoidCallback onFinalize;
  final VoidCallback onCopy;
  final void Function(String format) onExport;

  @override
  Widget build(BuildContext context) {
    final status = doc['status'] as String? ?? 'draft';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: SerenaColors.offWhite,
        borderRadius: BorderRadius.circular(SerenaRadius.md),
        border: Border.all(color: SerenaColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(doc['title'] as String? ?? '', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(status == 'finalized' ? 'Finalizado' : 'Rascunho'),
          const SizedBox(height: 8),
          Text(
            doc['body'] as String? ?? '',
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton(onPressed: onCopy, child: const Text('Copiar')),
              OutlinedButton(onPressed: () => onExport('txt'), child: const Text('Exportar TXT')),
              OutlinedButton(onPressed: () => onExport('html'), child: const Text('Exportar HTML')),
              OutlinedButton(
                onPressed: () => onExport('pdf'),
                child: const Text('Para PDF'),
              ),
              if (status != 'finalized')
                FilledButton(onPressed: onFinalize, child: const Text('Finalizar')),
            ],
          ),
        ],
      ),
    );
  }
}
