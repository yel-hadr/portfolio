import { useId, useRef, useState } from 'react';

import { useI18n } from '../../i18n/context';
import InteractiveDiagram from './InteractiveDiagram';

// Inception-of-Things (github.com/yel-hadr/-Inception-of-Things): one diagram per part, from
// the Vagrantfiles, setup scripts and manifests in p1, p2, p3 and bonus. viewBox units.
const SPECS = {
  p1: {
    width: 960,
    height: 430,
    groups: [{ id: 'net', kind: 'network', x: 40, y: 140, w: 880, h: 270, label: [60, 166] }],
    nodes: [
      { id: 'vagrant', x: 380, y: 24, w: 200, h: 74 },
      { id: 'server', x: 100, y: 210, w: 260, h: 120 },
      { id: 'agent', x: 600, y: 210, w: 260, h: 120 },
    ],
    edges: [
      { id: 'sshServer', from: 'vagrant', to: 'server', flow: 'control', label: [362, 146, 'end'] },
      { id: 'sshAgent', from: 'vagrant', to: 'agent', flow: 'control', label: [598, 146] },
      {
        id: 'join',
        from: 'agent',
        to: 'server',
        flow: 'control',
        points: [
          [600, 250],
          [360, 250],
        ],
        label: [480, 241, 'middle'],
      },
      {
        id: 'flannel',
        from: 'server',
        to: 'agent',
        flow: 'network',
        both: true,
        points: [
          [360, 296],
          [600, 296],
        ],
        label: [480, 287, 'middle'],
      },
    ],
    legend: [
      { flow: 'control', key: 'diagrams.modal.flows.control' },
      { flow: 'network', key: 'diagrams.modal.flows.network' },
    ],
  },
  p2: {
    width: 960,
    height: 470,
    groups: [{ id: 'vm', kind: 'boundary', x: 260, y: 24, w: 676, h: 426, label: [280, 50] }],
    nodes: [
      { id: 'client', x: 30, y: 200, w: 180, h: 60 },
      { id: 'traefik', x: 300, y: 190, w: 200, h: 80 },
      { id: 'app1', x: 680, y: 70, w: 220, h: 80 },
      { id: 'app2', x: 680, y: 180, w: 220, h: 100, pods: 3 },
      { id: 'app3', x: 680, y: 310, w: 220, h: 80 },
    ],
    edges: [
      {
        id: 'http',
        from: 'client',
        to: 'traefik',
        flow: 'request',
        points: [
          [210, 230],
          [300, 230],
        ],
        label: [255, 221, 'middle'],
      },
      {
        id: 'toApp1',
        from: 'traefik',
        to: 'app1',
        flow: 'request',
        points: [
          [500, 214],
          [560, 214],
          [560, 110],
          [680, 110],
        ],
        label: [620, 101, 'middle'],
      },
      {
        id: 'toApp2',
        from: 'traefik',
        to: 'app2',
        flow: 'request',
        points: [
          [500, 230],
          [680, 230],
        ],
        label: [590, 221, 'middle'],
      },
      {
        id: 'toApp3',
        from: 'traefik',
        to: 'app3',
        flow: 'request',
        points: [
          [500, 246],
          [560, 246],
          [560, 350],
          [680, 350],
        ],
        label: [620, 341, 'middle'],
      },
    ],
    packets: [
      ['http', 'toApp1'],
      ['http', 'toApp2'],
      ['http', 'toApp3'],
    ],
    legend: [{ flow: 'request', key: 'diagrams.modal.flows.request' }],
  },
  p3: {
    width: 960,
    height: 470,
    groups: [{ id: 'cluster', kind: 'boundary', x: 330, y: 20, w: 606, h: 430, label: [350, 46] }],
    nodes: [
      { id: 'github', x: 30, y: 40, w: 230, h: 80 },
      { id: 'you', x: 30, y: 330, w: 200, h: 60 },
      { id: 'argocd', x: 380, y: 70, w: 220, h: 80 },
      { id: 'playground', x: 680, y: 190, w: 230, h: 80 },
      { id: 'lb', x: 380, y: 320, w: 220, h: 80 },
    ],
    edges: [
      {
        id: 'push',
        from: 'you',
        to: 'github',
        flow: 'control',
        points: [
          [130, 330],
          [130, 120],
        ],
        label: [140, 230],
      },
      {
        id: 'pull',
        from: 'argocd',
        to: 'github',
        flow: 'control',
        points: [
          [380, 96],
          [260, 96],
        ],
        label: [320, 87, 'middle'],
      },
      {
        id: 'sync',
        from: 'argocd',
        to: 'playground',
        flow: 'control',
        points: [
          [600, 110],
          [795, 110],
          [795, 190],
        ],
        label: [702, 101, 'middle'],
      },
      {
        id: 'curl',
        from: 'you',
        to: 'lb',
        flow: 'request',
        points: [
          [230, 360],
          [380, 360],
        ],
        label: [305, 351, 'middle'],
      },
      {
        id: 'svc',
        from: 'lb',
        to: 'playground',
        flow: 'request',
        points: [
          [600, 360],
          [795, 360],
          [795, 270],
        ],
        label: [690, 351, 'middle'],
      },
    ],
    packets: [['curl', 'svc']],
    legend: [
      { flow: 'request', key: 'diagrams.modal.flows.request' },
      { flow: 'control', key: 'diagrams.modal.flows.control' },
    ],
  },
  bonus: {
    width: 900,
    height: 470,
    groups: [{ id: 'cluster', kind: 'boundary', x: 250, y: 20, w: 630, h: 430, label: [270, 46] }],
    nodes: [
      { id: 'you', x: 30, y: 200, w: 180, h: 60 },
      { id: 'traefik', x: 290, y: 66, w: 200, h: 80 },
      { id: 'lb', x: 290, y: 190, w: 200, h: 80 },
      { id: 'gitea', x: 640, y: 66, w: 220, h: 80 },
      { id: 'argocd', x: 640, y: 190, w: 220, h: 80 },
      { id: 'playground', x: 640, y: 340, w: 220, h: 80 },
    ],
    edges: [
      {
        id: 'ports',
        from: 'you',
        to: 'lb',
        flow: 'request',
        points: [
          [210, 230],
          [290, 230],
        ],
        label: [250, 221, 'middle'],
      },
      {
        id: 'ingress',
        from: 'lb',
        to: 'traefik',
        flow: 'request',
        points: [
          [390, 190],
          [390, 146],
        ],
        label: [400, 172],
      },
      {
        id: 'gitea',
        from: 'traefik',
        to: 'gitea',
        flow: 'request',
        points: [
          [490, 106],
          [640, 106],
        ],
        label: [565, 97, 'middle'],
      },
      {
        id: 'app',
        from: 'lb',
        to: 'playground',
        flow: 'request',
        points: [
          [390, 270],
          [390, 380],
          [640, 380],
        ],
        label: [515, 371, 'middle'],
      },
      {
        id: 'pull',
        from: 'argocd',
        to: 'gitea',
        flow: 'control',
        points: [
          [750, 190],
          [750, 146],
        ],
        label: [760, 172],
      },
      {
        id: 'sync',
        from: 'argocd',
        to: 'playground',
        flow: 'control',
        points: [
          [750, 270],
          [750, 340],
        ],
        label: [760, 310],
      },
    ],
    packets: [
      ['ports', 'ingress', 'gitea'],
      ['ports', 'app'],
    ],
    legend: [
      { flow: 'request', key: 'diagrams.modal.flows.request' },
      { flow: 'control', key: 'diagrams.modal.flows.control' },
    ],
  },
};

const PARTS = Object.keys(SPECS);

/** The four parts as tabs (WAI-ARIA tabs: arrow keys, Home and End move between them). */
const IotDiagram = () => {
  const { t } = useI18n();
  const uid = useId();
  const [part, setPart] = useState('p1');
  const tabs = useRef({});

  const onKeyDown = (e) => {
    const i = PARTS.indexOf(part);
    const next = {
      ArrowRight: PARTS[(i + 1) % PARTS.length],
      ArrowLeft: PARTS[(i - 1 + PARTS.length) % PARTS.length],
      Home: PARTS[0],
      End: PARTS[PARTS.length - 1],
    }[e.key];
    if (!next) return;
    e.preventDefault();
    setPart(next);
    tabs.current[next]?.focus();
  };

  const base = `diagrams.iot.parts.${part}`;

  return (
    <>
      <div
        role='tablist'
        aria-label={t('diagrams.iot.tabsLabel')}
        className='grid grid-cols-2 gap-2 sm:grid-cols-4'
      >
        {PARTS.map((p) => {
          const selected = p === part;
          return (
            <button
              key={p}
              ref={(el) => (tabs.current[p] = el)}
              type='button'
              role='tab'
              id={`${uid}-tab-${p}`}
              aria-selected={selected}
              aria-controls={`${uid}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setPart(p)}
              onKeyDown={onKeyDown}
              className={`flex min-h-11 flex-col items-start rounded-xl border px-4 py-2 text-left transition-colors ${
                selected
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-line-strong bg-surface text-foreground hover:border-foreground-muted'
              }`}
            >
              <span className='font-bold'>{t(`diagrams.iot.parts.${p}.tab`)}</span>
              <span className={`text-sm ${selected ? '' : 'text-foreground-muted'}`}>
                {t(`diagrams.iot.parts.${p}.short`)}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role='tabpanel'
        id={`${uid}-panel`}
        aria-labelledby={`${uid}-tab-${part}`}
        className='mt-6'
      >
        <h3 className='text-xl font-bold text-foreground'>{t(`${base}.title`)}</h3>
        <p className='mt-1 mb-5 max-w-prose text-foreground-muted leading-relaxed'>
          {t(`${base}.summary`)}
        </p>
        {/* key: a new part starts with nothing selected */}
        <InteractiveDiagram
          key={part}
          spec={SPECS[part]}
          ns={base}
          title={t(`${base}.title`)}
          headingLevel='h4'
        />
      </div>
    </>
  );
};

export default IotDiagram;
