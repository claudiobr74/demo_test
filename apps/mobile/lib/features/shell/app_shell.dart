import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/serena_theme.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final location = GoRouterState.of(context).uri.toString();

    // Full-bleed clinical session — hide chrome for tablet focus.
    if (location.startsWith('/sessoes')) {
      return Scaffold(body: child);
    }

    if (width >= SerenaBreakpoints.desktop) {
      return _DesktopShell(location: location, child: child);
    }
    if (width >= SerenaBreakpoints.tablet) {
      return _TabletShell(location: location, child: child);
    }
    return _PhoneShell(location: location, child: child);
  }
}

class _NavItem {
  const _NavItem(this.label, this.icon, this.path);
  final String label;
  final IconData icon;
  final String path;
}

const _items = [
  _NavItem('Meu Dia', Icons.wb_twilight_outlined, '/hoje'),
  _NavItem('Agenda', Icons.calendar_today_outlined, '/agenda'),
  _NavItem('Pacientes', Icons.people_outline, '/pacientes'),
  _NavItem('Financeiro', Icons.payments_outlined, '/financeiro'),
];

int _indexFor(String location) {
  if (location.startsWith('/agenda')) return 1;
  if (location.startsWith('/pacientes')) return 2;
  if (location.startsWith('/financeiro')) return 3;
  return 0;
}

class _PhoneShell extends StatelessWidget {
  const _PhoneShell({required this.location, required this.child});
  final String location;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final index = _indexFor(location);
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        onDestinationSelected: (i) => context.go(_items[i].path),
        destinations: [
          for (final item in _items)
            NavigationDestination(icon: Icon(item.icon), label: item.label),
        ],
      ),
    );
  }
}

class _TabletShell extends StatelessWidget {
  const _TabletShell({required this.location, required this.child});
  final String location;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final index = _indexFor(location);
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: index,
            onDestinationSelected: (i) => context.go(_items[i].path),
            labelType: NavigationRailLabelType.all,
            destinations: [
              for (final item in _items)
                NavigationRailDestination(icon: Icon(item.icon), label: Text(item.label)),
            ],
          ),
          const VerticalDivider(width: 1),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _DesktopShell extends StatelessWidget {
  const _DesktopShell({required this.location, required this.child});
  final String location;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final index = _indexFor(location);
    return Scaffold(
      body: Row(
        children: [
          Container(
            width: 240,
            decoration: const BoxDecoration(
              color: SerenaColors.offWhite,
              border: Border(right: BorderSide(color: SerenaColors.border)),
            ),
            child: SafeArea(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Padding(
                    padding: EdgeInsets.fromLTRB(24, 28, 24, 8),
                    child: _BrandMark(),
                  ),
                  const SizedBox(height: 16),
                  for (var i = 0; i < _items.length; i++)
                    _SideNavTile(
                      item: _items[i],
                      selected: i == index,
                      onTap: () => context.go(_items[i].path),
                    ),
                  const Spacer(),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      'Ambiente calmo para o seu consultório',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: SerenaColors.inkSoft,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'SerenaPsi',
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                color: SerenaColors.sageDark,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          'Seu consultório, com serenidade',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _SideNavTile extends StatelessWidget {
  const _SideNavTile({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final _NavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Material(
        color: selected ? SerenaColors.sage.withValues(alpha: 0.15) : Colors.transparent,
        borderRadius: BorderRadius.circular(SerenaRadius.md),
        child: InkWell(
          borderRadius: BorderRadius.circular(SerenaRadius.md),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Icon(item.icon, color: selected ? SerenaColors.sageDark : SerenaColors.inkSoft),
                const SizedBox(width: 12),
                Text(
                  item.label,
                  style: TextStyle(
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                    color: selected ? SerenaColors.sageDark : SerenaColors.ink,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
