import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/serena_theme.dart';
import '../../shared/widgets/serena_section.dart';

final financeSummaryProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.watch(apiClientProvider).get('/api/v1/finance/summary');
});

final financeChargesProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final data = await ref.watch(apiClientProvider).get('/api/v1/finance/charges');
  return (data['items'] as List? ?? [])
      .map((e) => Map<String, dynamic>.from(e as Map))
      .toList();
});

class FinancePage extends ConsumerWidget {
  const FinancePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(financeSummaryProvider);
    final charges = ref.watch(financeChargesProvider);

    return CustomScrollView(
      slivers: [
        const SliverAppBar(pinned: true, title: Text('Financeiro')),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 48),
          sliver: SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Visão simples do consultório',
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 20),
                summary.when(
                  loading: () => const LinearProgressIndicator(),
                  error: (e, _) => Text(e.toString(), style: const TextStyle(color: SerenaColors.danger)),
                  data: (s) => Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      _Metric(label: 'A receber', value: 'R\$ ${s['pending_amount']}'),
                      _Metric(label: 'Recebido', value: 'R\$ ${s['received_amount']}'),
                      _Metric(label: 'Cobranças abertas', value: '${s['open_charges']}'),
                      _Metric(label: 'Vencidas', value: '${s['overdue_count']}'),
                    ],
                  ),
                ),
                const SizedBox(height: 28),
                SerenaSection(
                  title: 'Cobranças',
                  child: charges.when(
                    loading: () => const LinearProgressIndicator(),
                    error: (e, _) => Text(e.toString()),
                    data: (items) {
                      if (items.isEmpty) {
                        return Text(
                          'Nenhuma cobrança ainda. Ao finalizar uma sessão com valor, a cobrança aparece aqui.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        );
                      }
                      return Column(
                        children: [
                          for (final c in items)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _ChargeTile(
                                charge: c,
                                onPaid: () async {
                                  await ref.read(apiClientProvider).post(
                                    '/api/v1/finance/payments',
                                    body: {
                                      'charge_id': c['id'],
                                      'amount': c['balance'],
                                      'method': 'pix',
                                    },
                                  );
                                  ref.invalidate(financeSummaryProvider);
                                  ref.invalidate(financeChargesProvider);
                                },
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
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 6),
          Text(value, style: Theme.of(context).textTheme.titleLarge),
        ],
      ),
    );
  }
}

class _ChargeTile extends StatelessWidget {
  const _ChargeTile({required this.charge, required this.onPaid});
  final Map<String, dynamic> charge;
  final VoidCallback onPaid;

  @override
  Widget build(BuildContext context) {
    final status = charge['status'] as String? ?? '';
    final open = status == 'pending' || status == 'partial' || status == 'overdue';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: SerenaColors.offWhite,
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
                  charge['patient_display_name'] as String? ?? '',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Text(charge['description'] as String? ?? ''),
                Text('Saldo R\$ ${charge['balance']} · ${_status(status)}'),
              ],
            ),
          ),
          if (open)
            FilledButton(onPressed: onPaid, child: const Text('Registrar pagamento')),
        ],
      ),
    );
  }

  String _status(String s) => switch (s) {
        'paid' => 'Pago',
        'partial' => 'Parcial',
        'overdue' => 'Vencido',
        'cancelled' => 'Cancelado',
        _ => 'Pendente',
      };
}
