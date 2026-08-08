import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_state.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/serena_theme.dart';
import '../../shared/widgets/serena_section.dart';

final todayProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  return client.get('/api/v1/today');
});

class TodayPage extends ConsumerWidget {
  const TodayPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final today = ref.watch(todayProvider);

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          pinned: true,
          title: const Text('Meu Dia'),
          actions: [
            IconButton(
              tooltip: 'Uso de IA',
              onPressed: () => context.go('/ia'),
              icon: const Icon(Icons.auto_awesome_outlined),
            ),
            IconButton(
              tooltip: 'Financeiro',
              onPressed: () => context.go('/financeiro'),
              icon: const Icon(Icons.payments_outlined),
            ),
            IconButton(
              tooltip: 'Sair',
              onPressed: () => ref.read(authControllerProvider.notifier).logout(),
              icon: const Icon(Icons.logout),
            ),
          ],
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 48),
          sliver: SliverToBoxAdapter(
            child: today.when(
              loading: () => const _LoadingState(),
              error: (e, _) => _ErrorState(
                message: e.toString(),
                onRetry: () => ref.invalidate(todayProvider),
              ),
              data: (data) => _TodayContent(data: data, userName: auth.userName, ref: ref),
            ),
          ),
        ),
      ],
    );
  }
}

class _TodayContent extends StatelessWidget {
  const _TodayContent({required this.data, required this.ref, this.userName});

  final Map<String, dynamic> data;
  final WidgetRef ref;
  final String? userName;

  @override
  Widget build(BuildContext context) {
    final next = data['next_appointment'] as Map<String, dynamic>?;
    final appointments = data['appointments'] as Map<String, dynamic>? ?? {};
    final incomplete = data['incomplete_sessions'] as List? ?? [];
    final pendencies = data['pendencies'] as Map<String, dynamic>? ?? {};
    final tasks = data['tasks'] as List? ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          userName == null ? 'O que preciso fazer agora?' : 'Olá, ${userName!.split(' ').first}',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 6),
        Text(
          data['primary_question'] as String? ?? 'O que preciso fazer agora?',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 28),
        if (next != null)
          SerenaSection(
            title: 'Próximo atendimento',
            child: _ActionRow(
              title: next['patient_display_name'] as String? ?? 'Paciente',
              subtitle: _formatWhen(next['starts_at'] as String?),
              primaryLabel: 'Iniciar sessão',
              onPrimary: () => context.push(
                '/sessoes/nova?patientId=${next['patient_id']}&appointmentId=${next['id']}',
              ),
              secondaryLabel: 'Ver paciente',
              onSecondary: () => context.push('/pacientes/${next['patient_id']}'),
            ),
          )
        else
          SerenaSection(
            title: 'Próximo atendimento',
            child: Text(
              'Nenhum atendimento restante hoje.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        const SizedBox(height: 20),
        SerenaSection(
          title: 'Agenda de hoje',
          child: Column(
            children: [
              _StatusChipRow(appointments: appointments),
              const SizedBox(height: 12),
              ..._flattenAppointments(appointments).map(
                (a) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _AppointmentTile(
                    appointment: a,
                    onConfirm: () async {
                      await ref.read(apiClientProvider).post(
                        '/api/v1/appointments/${a['id']}/status',
                        body: {'status': 'confirmed'},
                      );
                      ref.invalidate(todayProvider);
                    },
                    onStart: () => context.push(
                      '/sessoes/nova?patientId=${a['patient_id']}&appointmentId=${a['id']}',
                    ),
                  ),
                ),
              ),
              if (_flattenAppointments(appointments).isEmpty)
                Text(
                  'Nenhum atendimento listado para hoje.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => context.go('/agenda'),
                  child: const Text('Abrir agenda completa'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        SerenaSection(
          title: 'Registros incompletos',
          child: incomplete.isEmpty
              ? Text(
                  'Tudo em dia nos registros.',
                  style: Theme.of(context).textTheme.bodyMedium,
                )
              : Column(
                  children: [
                    for (final item in incomplete)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text((item as Map)['patient_display_name'] as String? ?? ''),
                        subtitle: Text(item['status'] as String? ?? ''),
                        trailing: FilledButton(
                          onPressed: () => context.push('/sessoes/${item['id']}'),
                          child: Text(item['primary_action'] as String? ?? 'Continuar'),
                        ),
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 20),
        SerenaSection(
          title: 'Pendências',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _PendencyChip(
                label: 'Registros',
                count: pendencies['incomplete_clinical_records'] as int? ?? 0,
              ),
              _PendencyChip(
                label: 'Pagamentos',
                count: pendencies['pending_payments'] as int? ?? 0,
                onTap: () => context.go('/financeiro'),
              ),
              _PendencyChip(
                label: 'Consentimentos',
                count: pendencies['pending_consents'] as int? ?? 0,
              ),
              _PendencyChip(
                label: 'Tarefas',
                count: pendencies['open_tasks'] as int? ?? tasks.length,
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        SerenaSection(
          title: 'Tarefas de hoje',
          child: tasks.isEmpty
              ? Text(
                  'Nenhuma tarefa aberta — as pendências chegam aqui.',
                  style: Theme.of(context).textTheme.bodyMedium,
                )
              : Column(
                  children: [
                    for (final raw in tasks)
                      Builder(
                        builder: (context) {
                          final task = Map<String, dynamic>.from(raw as Map);
                          return _TaskTile(
                            task: task,
                            onOpen: () {
                              final link = task['deep_link'] as String?;
                              if (link != null && link.isNotEmpty) {
                                context.push(link);
                              } else if (task['patient_id'] != null) {
                                context.push('/pacientes/${task['patient_id']}');
                              }
                            },
                            onComplete: () async {
                              await ref.read(apiClientProvider).post(
                                    '/api/v1/tasks/${task['id']}/complete',
                                  );
                              ref.invalidate(todayProvider);
                            },
                          );
                        },
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 20),
        TextButton.icon(
          onPressed: () => context.go('/financeiro'),
          icon: const Icon(Icons.payments_outlined),
          label: const Text('Abrir Financeiro'),
        ),
      ],
    );
  }

  List<Map<String, dynamic>> _flattenAppointments(Map<String, dynamic> buckets) {
    final out = <Map<String, dynamic>>[];
    for (final key in [
      'confirmed',
      'awaiting_confirmation',
      'scheduled',
      'completed',
      'no_show',
      'cancelled',
    ]) {
      final list = buckets[key] as List? ?? [];
      for (final item in list) {
        out.add(Map<String, dynamic>.from(item as Map));
      }
    }
    return out;
  }

  String _formatWhen(String? iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return iso;
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

class _StatusChipRow extends StatelessWidget {
  const _StatusChipRow({required this.appointments});
  final Map<String, dynamic> appointments;

  @override
  Widget build(BuildContext context) {
    int count(String key) => (appointments[key] as List?)?.length ?? 0;
    return Wrap(
      spacing: 8,
      children: [
        _MiniStat(label: 'Confirmados', value: count('confirmed')),
        _MiniStat(label: 'Aguardando', value: count('awaiting_confirmation')),
        _MiniStat(label: 'Concluídos', value: count('completed')),
        _MiniStat(label: 'Faltas', value: count('no_show')),
      ],
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value});
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: SerenaColors.offWhite,
        borderRadius: BorderRadius.circular(SerenaRadius.sm),
        border: Border.all(color: SerenaColors.border),
      ),
      child: Text('$label · $value', style: Theme.of(context).textTheme.labelLarge),
    );
  }
}

class _AppointmentTile extends StatelessWidget {
  const _AppointmentTile({
    required this.appointment,
    required this.onConfirm,
    required this.onStart,
  });

  final Map<String, dynamic> appointment;
  final VoidCallback onConfirm;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final status = appointment['status'] as String? ?? '';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: SerenaColors.surface,
        borderRadius: BorderRadius.circular(SerenaRadius.md),
        border: Border.all(color: SerenaColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  appointment['patient_display_name'] as String? ?? '',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  '${_statusLabel(status)} · ${appointment['modality'] ?? ''}',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          if (status == 'awaiting_confirmation')
            OutlinedButton(onPressed: onConfirm, child: const Text('Confirmar'))
          else if (status == 'confirmed' || status == 'scheduled')
            FilledButton(onPressed: onStart, child: const Text('Iniciar')),
        ],
      ),
    );
  }

  String _statusLabel(String status) {
    return switch (status) {
      'confirmed' => 'Confirmado',
      'awaiting_confirmation' => 'Aguardando confirmação',
      'completed' => 'Realizado',
      'cancelled' => 'Cancelado',
      'no_show' => 'Faltou',
      'rescheduled' => 'Reagendado',
      _ => 'Agendado',
    };
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.title,
    required this.subtitle,
    required this.primaryLabel,
    required this.onPrimary,
    this.secondaryLabel,
    this.onSecondary,
  });

  final String title;
  final String subtitle;
  final String primaryLabel;
  final VoidCallback onPrimary;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFE9F2EE), SerenaColors.surface],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(SerenaRadius.lg),
        border: Border.all(color: SerenaColors.border),
        boxShadow: SerenaShadows.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton(onPressed: onPrimary, child: Text(primaryLabel)),
              if (secondaryLabel != null)
                OutlinedButton(onPressed: onSecondary, child: Text(secondaryLabel!)),
            ],
          ),
        ],
      ),
    );
  }
}

class _TaskTile extends StatelessWidget {
  const _TaskTile({
    required this.task,
    required this.onOpen,
    required this.onComplete,
  });

  final Map<String, dynamic> task;
  final VoidCallback onOpen;
  final VoidCallback onComplete;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: SerenaColors.surface,
          borderRadius: BorderRadius.circular(SerenaRadius.md),
          border: Border.all(color: SerenaColors.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: InkWell(
                onTap: onOpen,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task['title'] as String? ?? '',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    if (task['kind'] != null)
                      Text(
                        task['kind'] == 'clinical' ? 'Clínica' : 'Administrativa',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: SerenaColors.inkSoft,
                            ),
                      ),
                  ],
                ),
              ),
            ),
            TextButton(onPressed: onOpen, child: const Text('Abrir')),
            FilledButton(onPressed: onComplete, child: const Text('Concluir')),
          ],
        ),
      ),
    );
  }
}

class _PendencyChip extends StatelessWidget {
  const _PendencyChip({required this.label, required this.count, this.onTap});
  final String label;
  final int count;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final child = Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: count > 0 ? SerenaColors.sage.withValues(alpha: 0.12) : SerenaColors.offWhite,
        borderRadius: BorderRadius.circular(SerenaRadius.md),
        border: Border.all(color: SerenaColors.border),
      ),
      child: Text('$label · $count'),
    );
    if (onTap == null) return child;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(SerenaRadius.md),
      child: child,
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 48),
      child: Center(child: CircularProgressIndicator()),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(message, style: const TextStyle(color: SerenaColors.danger)),
        const SizedBox(height: 12),
        OutlinedButton(onPressed: onRetry, child: const Text('Tentar novamente')),
      ],
    );
  }
}
