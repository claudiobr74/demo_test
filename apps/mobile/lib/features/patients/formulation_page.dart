import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/serena_theme.dart';
import '../../shared/widgets/serena_section.dart';

final formulationProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>?, String>((ref, patientId) async {
  final data = await ref.watch(apiClientProvider).get(
        '/api/v1/formulations/patients/$patientId/current',
      );
  final f = data['formulation'];
  if (f == null) return null;
  return Map<String, dynamic>.from(f as Map);
});

class FormulationPage extends ConsumerStatefulWidget {
  const FormulationPage({super.key, required this.patientId});

  final String patientId;

  @override
  ConsumerState<FormulationPage> createState() => _FormulationPageState();
}

class _FormulationPageState extends ConsumerState<FormulationPage> {
  final _focusCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  final _problemsCtrl = TextEditingController();
  final _maintainingCtrl = TextEditingController();
  final _hypothesesCtrl = TextEditingController();
  String _framework = 'cbt';
  int? _version;
  String? _status;
  bool _loading = false;
  bool _hydrated = false;

  @override
  void dispose() {
    _focusCtrl.dispose();
    _notesCtrl.dispose();
    _problemsCtrl.dispose();
    _maintainingCtrl.dispose();
    _hypothesesCtrl.dispose();
    super.dispose();
  }

  void _hydrate(Map<String, dynamic>? data) {
    if (_hydrated || data == null) return;
    final body = Map<String, dynamic>.from(data['body'] as Map? ?? {});
    _framework = data['framework'] as String? ?? 'cbt';
    _version = data['version'] as int?;
    _status = data['status'] as String?;
    _focusCtrl.text = body['therapeutic_focus'] as String? ?? '';
    _notesCtrl.text = body['notes'] as String? ?? '';
    _problemsCtrl.text = _listToLines(body['presenting_problems']);
    _maintainingCtrl.text = _listToLines(body['maintaining_factors']);
    _hypothesesCtrl.text = _hypothesesToLines(body['working_hypotheses']);
    _hydrated = true;
  }

  String _listToLines(dynamic value) {
    final list = value as List? ?? [];
    return list.map((e) => e.toString()).join('\n');
  }

  String _hypothesesToLines(dynamic value) {
    final list = value as List? ?? [];
    return list.map((e) {
      if (e is Map) return e['text']?.toString() ?? '';
      return e.toString();
    }).where((e) => e.isNotEmpty).join('\n');
  }

  List<String> _lines(String text) =>
      text.split('\n').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();

  Future<void> _persist({bool promote = false}) async {
    setState(() => _loading = true);
    try {
      final client = ref.read(apiClientProvider);
      final saved = await _putDraft(client);
      _version = saved['version'] as int?;
      _status = saved['status'] as String?;
      if (promote) {
        final promoted = await client.post(
          '/api/v1/formulations/${saved['id']}/promote',
        );
        _version = promoted['version'] as int?;
        _status = promoted['status'] as String?;
      }
      ref.invalidate(formulationProvider(widget.patientId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(promote ? 'Formulação oficial salva.' : 'Rascunho salvo.'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<Map<String, dynamic>> _putDraft(ApiClient client) async {
    // Use post-like helper via http put through raw — ApiClient has no put.
    // Prefer POST-compatible path already defined as PUT on API — add put to ApiClient.
    return client.put(
      '/api/v1/formulations/patients/${widget.patientId}/draft',
      body: {
        'framework': _framework,
        'version': _version,
        'body': {
          'therapeutic_focus': _focusCtrl.text.trim(),
          'notes': _notesCtrl.text.trim(),
          'presenting_problems': _lines(_problemsCtrl.text),
          'maintaining_factors': _lines(_maintainingCtrl.text),
          'working_hypotheses': [
            for (final h in _lines(_hypothesesCtrl.text))
              {'text': h, 'epistemology': 'working_hypothesis', 'source': 'professional'},
          ],
        },
      },
    );
  }

  Future<void> _suggestFromSupervisor() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(apiClientProvider);
      final result = await client.post(
        '/api/v1/supervisor/run',
        body: {
          'mode': 'case_formulation',
          'patient_id': widget.patientId,
          'framework': _framework,
        },
      );
      final focus = (result['suggested_focus'] as List? ?? []);
      if (focus.isNotEmpty && _focusCtrl.text.trim().isEmpty) {
        _focusCtrl.text = focus.first.toString();
      }
      final hyps = (result['hypotheses'] as List? ?? [])
          .map((e) {
            if (e is Map) return e['text']?.toString() ?? '';
            return e.toString();
          })
          .where((e) => e.isNotEmpty)
          .toList();
      if (hyps.isNotEmpty) {
        final existing = _lines(_hypothesesCtrl.text);
        _hypothesesCtrl.text = [...existing, ...hyps].join('\n');
      }
      final note = (result['summary'] as Map?)?['message']?.toString();
      if (note != null && note.isNotEmpty) {
        _notesCtrl.text = '${_notesCtrl.text}\n\n[Sugestão Supervisor]\n$note'.trim();
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Sugestões aplicadas ao rascunho — revise antes de tornar oficial.'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(formulationProvider(widget.patientId));
    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('Formulação viva')),
        body: Center(child: Text(e.toString())),
      ),
      data: (data) {
        _hydrate(data);
        return Scaffold(
          appBar: AppBar(title: const Text('Formulação viva')),
          body: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(
                'Documento vivo do caso — a IA só sugere; você decide o que entra.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 8),
              Text(
                _status == null
                    ? 'Novo rascunho'
                    : _status == 'official'
                        ? 'Oficial · v${_version ?? 1}'
                        : 'Rascunho · v${_version ?? 1}',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(color: SerenaColors.sageDark),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: _framework,
                items: const [
                  DropdownMenuItem(value: 'cbt', child: Text('TCC')),
                  DropdownMenuItem(value: 'schema', child: Text('Terapia do Esquema')),
                ],
                onChanged: (v) => setState(() => _framework = v ?? 'cbt'),
                decoration: const InputDecoration(labelText: 'Abordagem'),
              ),
              const SizedBox(height: 16),
              SerenaSection(
                title: 'Foco terapêutico',
                child: TextField(
                  controller: _focusCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(hintText: 'O que guia o trabalho agora?'),
                ),
              ),
              const SizedBox(height: 16),
              SerenaSection(
                title: 'Problemas apresentados',
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
              SerenaSection(
                title: 'Fatores de manutenção',
                child: TextField(
                  controller: _maintainingCtrl,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    hintText: 'Um por linha',
                    alignLabelWithHint: true,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              SerenaSection(
                title: 'Hipóteses de trabalho',
                child: TextField(
                  controller: _hypothesesCtrl,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    hintText: 'Uma por linha — sempre provisórias',
                    alignLabelWithHint: true,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              SerenaSection(
                title: 'Notas',
                child: TextField(
                  controller: _notesCtrl,
                  maxLines: 4,
                  decoration: const InputDecoration(alignLabelWithHint: true),
                ),
              ),
              const SizedBox(height: 24),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilledButton(
                    onPressed: _loading ? null : () => _persist(),
                    child: const Text('Salvar rascunho'),
                  ),
                  OutlinedButton(
                    onPressed: _loading ? null : () => _persist(promote: true),
                    child: const Text('Tornar oficial'),
                  ),
                  OutlinedButton.icon(
                    onPressed: _loading ? null : _suggestFromSupervisor,
                    icon: const Icon(Icons.psychology_outlined),
                    label: const Text('Sugerir com Supervisor'),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
