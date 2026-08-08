import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/serena_theme.dart';

final patientsProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  return client.get('/api/v1/patients');
});

class PatientsPage extends ConsumerStatefulWidget {
  const PatientsPage({super.key});

  @override
  ConsumerState<PatientsPage> createState() => _PatientsPageState();
}

class _PatientsPageState extends ConsumerState<PatientsPage> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final patients = ref.watch(patientsProvider);

    return CustomScrollView(
      slivers: [
        const SliverAppBar(pinned: true, title: Text('Pacientes')),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 48),
          sliver: SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: _search,
                  decoration: const InputDecoration(
                    labelText: 'Buscar pacientes',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
                ),
                const SizedBox(height: 20),
                patients.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Text(e.toString(), style: const TextStyle(color: SerenaColors.danger)),
                  data: (data) {
                    final items = (data['items'] as List? ?? [])
                        .map((e) => Map<String, dynamic>.from(e as Map))
                        .where((p) {
                      if (_query.isEmpty) return true;
                      final name = (p['display_name'] as String? ?? '').toLowerCase();
                      return name.contains(_query);
                    }).toList();
                    if (items.isEmpty) {
                      return Text(
                        'Nenhum paciente encontrado.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      );
                    }
                    return Column(
                      children: [
                        for (final p in items)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Material(
                              color: SerenaColors.surface,
                              borderRadius: BorderRadius.circular(SerenaRadius.md),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(SerenaRadius.md),
                                onTap: () => context.go('/pacientes/${p['id']}'),
                                child: Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(SerenaRadius.md),
                                    border: Border.all(color: SerenaColors.border),
                                  ),
                                  child: Row(
                                    children: [
                                      CircleAvatar(
                                        backgroundColor: SerenaColors.sage.withValues(alpha: 0.2),
                                        foregroundColor: SerenaColors.sageDark,
                                        child: Text(
                                          ((p['first_name'] as String?) ?? '?').substring(0, 1),
                                        ),
                                      ),
                                      const SizedBox(width: 14),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              p['display_name'] as String? ?? '',
                                              style: Theme.of(context).textTheme.titleMedium,
                                            ),
                                            Text(
                                              _statusLabel(p['status'] as String?),
                                              style: Theme.of(context).textTheme.bodyMedium,
                                            ),
                                          ],
                                        ),
                                      ),
                                      const Icon(Icons.chevron_right, color: SerenaColors.inkSoft),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  String _statusLabel(String? status) {
    return switch (status) {
      'active' => 'Ativo',
      'paused' => 'Pausado',
      'inactive' => 'Inativo',
      'closed' => 'Acompanhamento encerrado',
      'archived' => 'Arquivado',
      _ => status ?? '',
    };
  }
}
