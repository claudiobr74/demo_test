import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/serena_theme.dart';
import '../../shared/widgets/serena_section.dart';

final patientProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) async {
  final client = ref.watch(apiClientProvider);
  return client.get('/api/v1/patients/$id');
});

final patientConsentsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, id) async {
  final client = ref.watch(apiClientProvider);
  final data = await client.get('/api/v1/consents/patients/$id');
  return (data['items'] as List? ?? [])
      .map((e) => Map<String, dynamic>.from(e as Map))
      .toList();
});

final patientRecordsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, id) async {
  final client = ref.watch(apiClientProvider);
  final data = await client.get('/api/v1/clinical-records/patients/$id');
  return (data['items'] as List? ?? [])
      .map((e) => Map<String, dynamic>.from(e as Map))
      .toList();
});

class PatientHubPage extends ConsumerWidget {
  const PatientHubPage({super.key, required this.patientId});

  final String patientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final patient = ref.watch(patientProvider(patientId));
    final consents = ref.watch(patientConsentsProvider(patientId));
    final records = ref.watch(patientRecordsProvider(patientId));

    return patient.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('Paciente')),
        body: Center(child: Text(e.toString())),
      ),
      data: (data) {
        final name = data['display_name'] as String? ?? 'Paciente';
        return Scaffold(
          appBar: AppBar(title: Text(name)),
          body: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(name, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 6),
              Text(
                'Hub do paciente — jornada clínica e administrativa em um só lugar.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 24),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilledButton.icon(
                    onPressed: () => context.push('/sessoes/nova?patientId=$patientId'),
                    icon: const Icon(Icons.play_arrow_outlined),
                    label: const Text('Nova sessão'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () => context.push('/pacientes/$patientId/prontuario'),
                    icon: const Icon(Icons.folder_open_outlined),
                    label: const Text('Ver prontuário'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () async {
                      try {
                        final client = ref.read(apiClientProvider);
                        final result = await client.post('/api/v1/supervisor/run', body: {
                          'mode': 'prepare_session',
                          'patient_id': patientId,
                        });
                        if (!context.mounted) return;
                        await showModalBottomSheet<void>(
                          context: context,
                          showDragHandle: true,
                          isScrollControlled: true,
                          builder: (ctx) => _SupervisorSheet(result: result),
                        );
                      } catch (e) {
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(e.toString())),
                        );
                      }
                    },
                    icon: const Icon(Icons.psychology_outlined),
                    label: const Text('Abrir Supervisor IA'),
                  ),
                ],
              ),
              const SizedBox(height: 28),
              SerenaSection(
                title: 'Cadastro',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _kv(context, 'Modalidade', data['modality']?.toString()),
                    _kv(context, 'Status', data['status']?.toString()),
                    _kv(context, 'Abordagem', data['framework']?.toString()),
                    _kv(context, 'Telefone', data['phone']?.toString()),
                    _kv(context, 'E-mail', data['email']?.toString()),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SerenaSection(
                title: 'Prontuário recente',
                child: records.when(
                  loading: () => const LinearProgressIndicator(),
                  error: (e, _) => Text(e.toString()),
                  data: (items) {
                    if (items.isEmpty) {
                      return Text(
                        'Nenhum registro clínico ainda.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      );
                    }
                    return Column(
                      children: [
                        for (final r in items.take(5))
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(r['focus'] as String? ?? 'Sessão'),
                            subtitle: Text(r['evolution_preview'] as String? ?? ''),
                            trailing: Text((r['recorded_at'] as String? ?? '').split('T').first),
                          ),
                      ],
                    );
                  },
                ),
              ),
              const SizedBox(height: 20),
              SerenaSection(
                title: 'Consentimentos',
                child: consents.when(
                  loading: () => const LinearProgressIndicator(),
                  error: (e, _) => Text(e.toString()),
                  data: (items) => _ConsentsBlock(patientId: patientId, items: items),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _kv(BuildContext context, String k, String? v) {
    if (v == null || v.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(width: 120, child: Text(k, style: Theme.of(context).textTheme.bodyMedium)),
          Expanded(child: Text(v, style: Theme.of(context).textTheme.titleSmall)),
        ],
      ),
    );
  }
}

class _ConsentsBlock extends ConsumerWidget {
  const _ConsentsBlock({required this.patientId, required this.items});
  final String patientId;
  final List<Map<String, dynamic>> items;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (items.isEmpty)
          Text(
            'Nenhum consentimento registrado.',
            style: Theme.of(context).textTheme.bodyMedium,
          )
        else
          for (final c in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${_typeLabel(c['consent_type'] as String?)} · v${c['version']}',
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        Text(_statusLabel(c['status'] as String?)),
                      ],
                    ),
                  ),
                  if (c['status'] == 'pending') ...[
                    TextButton(
                      onPressed: () => _decide(ref, c['id'] as String, 'accepted'),
                      child: const Text('Aceitar'),
                    ),
                    TextButton(
                      onPressed: () => _decide(ref, c['id'] as String, 'refused'),
                      child: const Text('Recusar'),
                    ),
                  ],
                ],
              ),
            ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () async {
            final type = await showModalBottomSheet<String>(
              context: context,
              showDragHandle: true,
              builder: (ctx) => SafeArea(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final t in const [
                      ('data_processing', 'Tratamento de dados'),
                      ('digital_resources', 'Recursos digitais'),
                      ('transcription', 'Transcrição'),
                      ('ai_processing', 'Processamento por IA'),
                    ])
                      ListTile(
                        title: Text(t.$2),
                        onTap: () => Navigator.pop(ctx, t.$1),
                      ),
                  ],
                ),
              ),
            );
            if (type == null) return;
            await ref.read(apiClientProvider).post(
              '/api/v1/consents/patients/$patientId',
              body: {'consent_type': type},
            );
            ref.invalidate(patientConsentsProvider(patientId));
          },
          icon: const Icon(Icons.add),
          label: const Text('Solicitar consentimento'),
        ),
      ],
    );
  }

  Future<void> _decide(WidgetRef ref, String id, String status) async {
    await ref.read(apiClientProvider).post(
      '/api/v1/consents/$id/decision',
      body: {'status': status, 'method': 'manual'},
    );
    ref.invalidate(patientConsentsProvider(patientId));
  }

  String _typeLabel(String? t) => switch (t) {
        'data_processing' => 'Tratamento de dados',
        'digital_resources' => 'Recursos digitais',
        'transcription' => 'Transcrição',
        'ai_processing' => 'IA',
        'telehealth' => 'Teleatendimento',
        _ => t ?? 'Consentimento',
      };

  String _statusLabel(String? s) => switch (s) {
        'accepted' => 'Aceito',
        'refused' => 'Recusado',
        'revoked' => 'Revogado',
        'expired' => 'Expirado',
        _ => 'Pendente',
      };
}

class _SupervisorSheet extends StatelessWidget {
  const _SupervisorSheet({required this.result});
  final Map<String, dynamic> result;

  @override
  Widget build(BuildContext context) {
    final summary = result['summary'] as Map? ?? {};
    final questions = (result['questions'] as List? ?? []).cast<dynamic>();
    final focus = (result['suggested_focus'] as List? ?? []).cast<dynamic>();
    final note = result['epistemology_note'] as String? ?? '';

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Supervisor IA', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            Text(summary['message']?.toString() ?? note),
            const SizedBox(height: 16),
            Text('Foco sugerido', style: Theme.of(context).textTheme.titleMedium),
            for (final f in focus) Text('• $f'),
            const SizedBox(height: 12),
            Text('Perguntas para reflexão', style: Theme.of(context).textTheme.titleMedium),
            for (final q in questions) Text('• $q'),
            const SizedBox(height: 16),
            Text(
              note,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: SerenaColors.inkSoft),
            ),
          ],
        ),
      ),
    );
  }
}
