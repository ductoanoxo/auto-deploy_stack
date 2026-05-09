import json
import re

with open('grafana-dashboard.json', 'r') as f:
    dashboard = json.load(f)

for panel in dashboard.get('panels', []):
    for target in panel.get('targets', []):
        if 'expr' in target:
            expr = target['expr']
            # Revert everything to group by (name) since Alloy now provides it
            expr = expr.replace('by (id)', 'by (name)')
            
            if 'legendFormat' in target:
                 target['legendFormat'] = '{{name}}'
                 
            if panel.get('title') == "📊 Replica Status":
                 target['expr'] = 'count by (name) (container_last_seen{name=~".+"})'
                 target['format'] = 'table'
                 
            target['expr'] = expr

with open('grafana-dashboard.json', 'w') as f:
    json.dump(dashboard, f, indent=2)
