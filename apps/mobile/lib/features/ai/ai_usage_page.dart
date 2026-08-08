import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/serena_theme.dart';
import '../../shared/widgets/serena_section.dart';

final aiUsageDaysProvider = NotifierProvider<_AiUsageDaysNotifier, int>(
  _AiUsageDaysNotifier.new,
);

class _AiUsageDaysNotifier extends Notifier<int> {
  @override
  int build() => 30;
  void setDays(int days) => state = days;
}

final aiUsageProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final days = ref.watch(aiUsageDaysProvider);
  return ref.watch(apiClientProvider).get('/api/v1/ai/usage?days=$days');
});

class AiUsagePage extends ConsumerWidget {
  const AiUsagePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final days = ref.watch(aiUsageDaysProvider);
    final usage = ref.watch(aiUsageProvider);

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          pinned: true,
          title: const Text('Uso de IA'),
          actions: [
            PopupMenuButton<int>(
              initialValue: days,
              tooltip: 'Período',
              onSelected: (v) => ref.read(aiUsageDaysProvider.notifier).setDays(v),
              itemBuilder: (_) => const [
                PopupMenuItem(value: 7, child: Text('7 dias')),
                PopupMenuItem(value: 30, child: Text('30 dias')),
                PopupMenuItem(value: 90, child: Text('90 dias')),
              ],
              icon: const Icon(Icons.date_range_outlined),
            ),
          ],
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 48),
          sliver: SliverToBoxAdapter(
            child: usage.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Text(e.toString(), style: const TextStyle(color: SerenaColors.danger)),
              data: (data) => _UsageBody(data: data, days: days),
            ),
          ),
        ),
      ],
    );
  }
}

class _UsageBody extends StatelessWidget {
  const _UsageBody({required this.data, required this.days});

  final Map<String, dynamic> data;
  final int days;

  @override
  Widget build(BuildContext context) {
    final byProvider =
        (data['by_provider'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    final byTask =
        (data['by_task'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    final feedback = data['feedback'] as Map<String, dynamic>? ?? {};
    final costRaw = data['estimated_cost_usd'];
    final cost = costRaw is num
        ? costRaw.toDouble()
        : double.tryParse(costRaw?.toString() ?? '0') ?? 0;
    final avgLat = data['avg_latency_ms'] as int?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Custo estimado e latência da organização (últimos $days dias). '
          'Sem conteúdo clínico neste painel.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 20),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            _Metric(label: 'Requisições', value: '${data['total_requests'] ?? 0}'),
            _Metric(label: 'Custo est. (USD)', value: cost.toStringAsFixed(4)),
            _Metric(
              label: 'Latência média',
              value: avgLat == null ? '—' : '$avgLat ms',
            ),
            _Metric(
              label: 'Tokens in/out',
              value: '${data['input_tokens'] ?? 0} / ${data['output_tokens'] ?? 0}',
            ),
            _Metric(
              label: 'Feedback útil',
              value: '${feedback['useful'] ?? 0} / ${feedback['not_useful'] ?? 0}',
            ),
          ],
        ),
        if (data['note'] != null) ...[
          const SizedBox(height: 12),
          Text(
            data['note'] as String,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: SerenaColors.inkSoft),
          ),
        ],
        const SizedBox(height: 28),
        SerenaSection(
          title: 'Por provedor',
          child: byProvider.isEmpty
              ? Text(
                  'Nenhuma requisição no período.',
                  style: Theme.of(context).textTheme.bodyMedium,
                )
              : Column(
                  children: [
                    for (final row in byProvider)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: SerenaColors.offWhite,
                            borderRadius: BorderRadius.circular(SerenaRadius.md),
                            border: Border.all(color: SerenaColors.border),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                row['provider'] as String? ?? '—',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${row['count']} req · '
                                'lat. ${row['avg_latency_ms'] ?? '—'} ms · '
                                'USD ${row['estimated_cost_usd'] ?? '0'}',
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 24),
        SerenaSection(
          title: 'Por modo',
          child: byTask.isEmpty
              ? Text('—', style: Theme.of(context).textTheme.bodyMedium)
              : Column(
                  children: [
                    for (final row in byTask)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                        title: Text(row['task'] as String? ?? '—'),
                        trailing: Text('${row['count']}'),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 160,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: SerenaColors.surface,
        borderRadius: BorderRadius.circular(SerenaRadius.md),
        border: Border.all(color: SerenaColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 6),
          Text(value, style: Theme.of(context).textTheme.titleLarge),
        ],
      ),
    );
  }
}
