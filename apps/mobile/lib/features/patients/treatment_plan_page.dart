import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/serena_theme.dart';
import '../../shared/widgets/serena_section.dart';

final treatmentPlanProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>?, String>((ref, patientId) async {
  final data = await ref.watch(apiClientProvider).get(
        '/api/v1/treatment-plans/patients/$patientId/current',
      );
  final plan = data['plan'];
  if (plan == null) return null;
  return Map<String, dynamic>.from(plan as Map);
});

class TreatmentPlanPage extends ConsumerStatefulWidget {
  const TreatmentPlanPage({super.key, required this.patientId});

  final String patientId;

  @override
  ConsumerState<TreatmentPlanPage> createState() => _TreatmentPlanPageState();
}

class _TreatmentPlanPageState extends ConsumerState<TreatmentPlanPage> {
  final _summaryCtrl = TextEditingController();
  final _problemsCtrl = TextEditingController();
  bool _hydrated = false;
  bool _loading = false;

  @override
  void dispose() {
    _summaryCtrl.dispose();
    _problemsCtrl.dispose();
    super.dispose();
  }

  void _hydrate(Map<String, dynamic>? plan) {
    if (_hydrated) return;
    if (plan != null) {
      _summaryCtrl.text = plan['initial_formulation_summary'] as String? ?? '';
      final problems = plan['priority_problems'] as List? ?? [];
      _problemsCtrl.text = problems.map((e) => e.toString()).join('\n');
    }
    _hydrated = true;
  }

  List<String> _lines(String text) =>
      text.split('\n').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();

  Future<void> _savePlan() async {
    setState(() => _loading = true);
    try {
      await ref.read(apiClientProvider).put(
        '/api/v1/treatment-plans/patients/${widget.patientId}',
        body: {
          'initial_formulation_summary': _summaryCtrl.text.trim(),
          'priority_problems': _lines(_problemsCtrl.text),
        },
      );
      ref.invalidate(treatmentPlanProvider(widget.patientId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Plano terapêutico salvo.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _addGoal() async {
    final titleCtrl = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        final bottom = MediaQuery.viewInsetsOf(ctx).bottom;
        return Padding(
          padding: EdgeInsets.fromLTRB(24, 8, 24, 24 + bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Nova meta', style: Theme.of(ctx).textTheme.headlineMedium),
              const SizedBox(height: 12),
              TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(labelText: 'Título'),
                autofocus: true,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Adicionar'),
              ),
            ],
          ),
        );
      },
    );
    if (ok != true || titleCtrl.text.trim().isEmpty) return;
    await ref.read(apiClientProvider).post(
      '/api/v1/treatment-plans/patients/${widget.patientId}/goals',
      body: {'title': titleCtrl.text.trim()},
    );
    ref.invalidate(treatmentPlanProvider(widget.patientId));
  }

  Future<void> _setGoalStatus(String goalId, String status) async {
    await ref.read(apiClientProvider).patch(
      '/api/v1/treatment-plans/goals/$goalId',
      body: {'status': status},
    );
    ref.invalidate(treatmentPlanProvider(widget.patientId));
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(treatmentPlanProvider(widget.patientId));
    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('Plano terapêutico')),
        body: Center(child: Text(e.toString())),
      ),
      data: (plan) {
        _hydrate(plan);
        final goals = (plan?['goals'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();

        return Scaffold(
          appBar: AppBar(title: const Text('Plano terapêutico')),
          body: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(
                'Prioridades e metas do tratamento — vivo e revisável.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 8),
              Text(
                plan == null ? 'Novo plano' : 'Status: ${plan['status']} · v${plan['version']}',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(color: SerenaColors.sageDark),
              ),
              const SizedBox(height: 20),
              SerenaSection(
                title: 'Resumo da formulação',
                child: TextField(
                  controller: _summaryCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    hintText: 'Síntese que orienta o plano',
                    alignLabelWithHint: true,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              SerenaSection(
                title: 'Problemas prioritários',
                child: TextField(
                  controller: _problemsCtrl,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    hintText: 'Um por linha',
                    alignLabelWithHint: true,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loading ? null : _savePlan,
                child: const Text('Salvar plano'),
              ),
              const SizedBox(height: 28),
              Row(
                children: [
                  Expanded(
                    child: Text('Metas', style: Theme.of(context).textTheme.titleMedium),
                  ),
                  OutlinedButton.icon(
                    onPressed: _addGoal,
                    icon: const Icon(Icons.add),
                    label: const Text('Meta'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (goals.isEmpty)
                Text(
                  'Nenhuma meta ainda. Adicione o que importa acompanhar.',
                  style: Theme.of(context).textTheme.bodyMedium,
                )
              else
                for (final g in goals)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: SerenaColors.offWhite,
                        borderRadius: BorderRadius.circular(SerenaRadius.md),
                        border: Border.all(color: SerenaColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(g['title'] as String? ?? '', style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 4),
                          Text(_goalStatus(g['status'] as String?)),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            children: [
                              if (g['status'] != 'achieved')
                                TextButton(
                                  onPressed: () => _setGoalStatus(g['id'] as String, 'achieved'),
                                  child: const Text('Concluída'),
                                ),
                              if (g['status'] == 'active')
                                TextButton(
                                  onPressed: () => _setGoalStatus(g['id'] as String, 'paused'),
                                  child: const Text('Pausar'),
                                ),
                              if (g['status'] == 'paused')
                                TextButton(
                                  onPressed: () => _setGoalStatus(g['id'] as String, 'active'),
                                  child: const Text('Retomar'),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
            ],
          ),
        );
      },
    );
  }

  String _goalStatus(String? s) => switch (s) {
        'achieved' => 'Concluída',
        'paused' => 'Pausada',
        'dropped' => 'Descartada',
        _ => 'Ativa',
      };
}
