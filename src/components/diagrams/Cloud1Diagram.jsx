import InteractiveDiagram from './InteractiveDiagram';

// Cloud-1 (github.com/yel-hadr/cloud-1_42). Left column: provisioning (make up -> Terraform ->
// Ansible). Right: the request path through the AWS security group, ufw and nginx to the
// php-fpm pools and MariaDB, with the two Compose networks drawn as overlapping bands
// (WordPress and phpMyAdmin sit on both). Ansible's SSH crosses the same two firewalls, on its
// own line beside the request path. Coordinates are viewBox units.
const SPEC = {
  width: 960,
  height: 712,
  groups: [
    { id: 'aws', kind: 'boundary', x: 270, y: 124, w: 666, h: 576, label: [288, 148] },
    { id: 'ec2', kind: 'boundary', x: 292, y: 250, w: 624, h: 434, label: [310, 274] },
    { id: 'frontend', kind: 'network', x: 312, y: 380, w: 584, h: 186, label: [330, 402] },
    { id: 'backend', kind: 'network', x: 312, y: 494, w: 584, h: 176, label: [330, 660] },
  ],
  nodes: [
    { id: 'make', x: 24, y: 40, w: 190, h: 64 },
    { id: 'terraform', x: 24, y: 180, w: 190, h: 64 },
    { id: 'ansible', x: 24, y: 330, w: 190, h: 64 },
    { id: 'visitor', x: 520, y: 20, w: 200, h: 64 },
    { id: 'sg', x: 520, y: 168, w: 200, h: 56 },
    { id: 'ufw', x: 520, y: 296, w: 200, h: 56 },
    { id: 'nginx', x: 520, y: 404, w: 200, h: 56 },
    { id: 'wordpress', x: 370, y: 506, w: 200, h: 52 },
    { id: 'phpmyadmin', x: 670, y: 506, w: 200, h: 52 },
    { id: 'mariadb', x: 540, y: 590, w: 160, h: 52 },
  ],
  edges: [
    { id: 'apply', from: 'make', to: 'terraform', flow: 'control', label: [129, 147] },
    { id: 'inventory', from: 'terraform', to: 'ansible', flow: 'control', label: [129, 292] },
    {
      id: 'awsApi',
      from: 'terraform',
      to: 'aws',
      flow: 'control',
      points: [
        [214, 190],
        [270, 190],
      ],
      label: [242, 181, 'middle'],
    },
    {
      id: 'ssh',
      from: 'ansible',
      to: 'sg',
      flow: 'control',
      points: [
        [214, 362],
        [246, 362],
        [246, 218],
        [520, 218],
      ],
      label: [395, 209, 'middle'],
    },
    {
      id: 'sshUfw',
      from: 'sg',
      to: 'ufw',
      flow: 'control',
      points: [
        [680, 224],
        [680, 296],
      ],
      label: [690, 242],
    },
    { id: 'visit', from: 'visitor', to: 'sg', flow: 'request', label: [630, 112] },
    { id: 'sgUfw', from: 'sg', to: 'ufw', flow: 'request', label: [610, 242, 'end'] },
    { id: 'ufwNginx', from: 'ufw', to: 'nginx', flow: 'request', label: [630, 373] },
    { id: 'fcgiWp', from: 'nginx', to: 'wordpress', flow: 'request', label: [534, 480, 'end'] },
    { id: 'fcgiPma', from: 'nginx', to: 'phpmyadmin', flow: 'request', label: [706, 480] },
    { id: 'wpDb', from: 'wordpress', to: 'mariadb', flow: 'request', label: [540, 588, 'end'] },
    { id: 'pmaDb', from: 'phpmyadmin', to: 'mariadb', flow: 'request', label: [700, 588] },
  ],
  packets: [
    ['visit', 'sgUfw', 'ufwNginx', 'fcgiWp', 'wpDb'],
    ['visit', 'sgUfw', 'ufwNginx', 'fcgiPma', 'pmaDb'],
  ],
  legend: [
    { flow: 'request', key: 'diagrams.modal.flows.request' },
    { flow: 'control', key: 'diagrams.cloud1.legend.control' },
  ],
};

const Cloud1Diagram = ({ title }) => (
  <InteractiveDiagram spec={SPEC} ns='diagrams.cloud1' title={title} headingLevel='h3' />
);

export default Cloud1Diagram;
