import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/serena_theme.dart';
import '../../shared/widgets/serena_section.dart';

final prepareProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, patientId) async {
  return ref.watch(apiClientProvider).get('/api/v1/sessions/prepare/$patientId');
});

class PrepareSessionPage extends ConsumerWidget {
  const PrepareSessionPage({super.key, required this.patientId});

  final String patientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prep = ref.watch(prepareProvider(patientId));

    return Scaffold(
      appBar: AppBar(title: const Text('Preparar sessão')),
      body: prep.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e.toString())),
        data: (data) {
          final patient = data['patient'] as Map? ?? {};
          final last = data['last_session_summary'] as Map?;
          final memory = data['case_memory'] as Map? ?? {};
          final formulation = data['formulation'] as Map?;
          final tasks = data['active_tasks'] as List? ?? [];
          final focus = data['suggested_focus'] as String?;

          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(
                patient['display_name'] as String? ?? 'Paciente',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 6),
              Text(
                'Só o essencial para entrar na sessão com presença.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 20),
              SerenaSection(
                title: 'Foco sugerido',
                child: Text(
                  focus?.isNotEmpty == true ? focus! : 'Sem foco sugerido ainda — use o Supervisor se quiser.',
                ),
              ),
              if (formulation != null) ...[
                const SizedBox(height: 16),
                SerenaSection(
                  title: 'Formulação viva',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        formulation['is_official'] == true ? 'Oficial' : 'Rascunho',
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              color: SerenaColors.sageDark,
                            ),
                      ),
                      const SizedBox(height: 6),
                      Text(formulation['therapeutic_focus'] as String? ?? 'Sem foco registrado.'),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: () => context.push('/pacientes/$patientId/formulacao'),
                        child: const Text('Abrir formulação'),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),
              SerenaSection(
                title: 'Última sessão',
                child: last == null
                    ? const Text('Primeira sessão ou sem evolução finalizada.')
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Foco: ${last['focus'] ?? '—'}'),
                          const SizedBox(height: 8),
                          Text(last['evolution'] as String? ?? ''),
                          if ((last['tasks'] as String?)?.isNotEmpty == true) ...[
                            const SizedBox(height: 8),
                            Text('Tarefas: ${last['tasks']}'),
                          ],
                        ],
                      ),
              ),
              const SizedBox(height: 16),
              SerenaSection(
                title: 'Memória do caso',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _memBlock(context, 'Fatos', memory['facts'] as List? ?? []),
                    _memBlock(context, 'Observações', memory['observations'] as List? ?? []),
                    _memBlock(context, 'Hipóteses', memory['hypotheses'] as List? ?? []),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SerenaSection(
                title: 'Tarefas ativas',
                child: tasks.isEmpty
                    ? const Text('Nenhuma tarefa clínica aberta.')
                    : Column(
                        children: [
                          for (final t in tasks)
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text((t as Map)['title'] as String? ?? ''),
                            ),
                        ],
                      ),
              ),
              const SizedBox(height: 24),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilledButton.icon(
                    onPressed: () => context.push('/sessoes/nova?patientId=$patientId'),
                    icon: const Icon(Icons.play_arrow_outlined),
                    label: const Text('Iniciar sessão'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () async {
                      try {
                        final result = await ref.read(apiClientProvider).post(
                          '/api/v1/supervisor/run',
                          body: {'mode': 'prepare_session', 'patient_id': patientId},
                        );
                        if (!context.mounted) return;
                        await showModalBottomSheet<void>(
                          context: context,
                          showDragHandle: true,
                          isScrollControlled: true,
                          builder: (ctx) => Padding(
                            padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
                            child: SingleChildScrollView(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Supervisor — Preparar sessão',
                                      style: Theme.of(ctx).textTheme.headlineMedium),
                                  const SizedBox(height: 12),
                                  Text((result['summary'] as Map?)?['message']?.toString() ?? ''),
                                  const SizedBox(height: 12),
                                  for (final q in (result['questions'] as List? ?? []))
                                    Text('• $q'),
                                  const SizedBox(height: 12),
                                  Text(
                                    result['epistemology_note'] as String? ?? '',
                                    style: const TextStyle(color: SerenaColors.inkSoft),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      } catch (e) {
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                      }
                    },
                    icon: const Icon(Icons.psychology_outlined),
                    label: const Text('Abrir Supervisor'),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _memBlock(BuildContext context, String title, List items) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleSmall),
          if (items.isEmpty)
            Text('—', style: Theme.of(context).textTheme.bodyMedium)
          else
            for (final i in items.take(5))
              Text('• ${(i as Map)['content'] ?? ''}'),
        ],
      ),
    );
  }
}
