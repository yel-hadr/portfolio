import {
  mobile,
  backend,
  creator,
  web,
  aws,
  terraform,
  ansible,
  kubernetes,
  argocd,
  docker,
  linux,
  nginx,
  python,
  cpp,
  git,
  reactjs,
} from '../assets';

// Language-independent facts. All user-facing text (title, summary, descriptions...) lives in
// the dictionaries in src/locales/<lang>/core.json, keyed by the ids below.
export const person = {
  name: 'Youssef El Hadraoui',
  alias: 'Jebril',
  email: 'youssefelhadraoui99@gmail.com',
  linkedin: 'https://www.linkedin.com/in/youssef-el-hadraoui',
  github: 'https://github.com/yel-hadr',
  // public/Youssef_Elhadraoui_Resume.pdf, resolved against Vite's base path
  resume: `${import.meta.env.BASE_URL}Youssef_Elhadraoui_Resume.pdf`,
};

// Labels: nav.<id> in the dictionaries
export const navLinks = [
  { id: 'about' },
  { id: 'experience' },
  { id: 'works' },
  { id: 'education' },
  { id: 'contact' },
];

// Labels: about.services.<id>
const services = [
  {
    id: 'backend',
    icon: backend,
  },
  {
    id: 'cloud',
    icon: web,
  },
  {
    id: 'devops',
    icon: mobile,
  },
  {
    id: 'automation',
    icon: creator,
  },
];

const technologies = [
  {
    name: 'AWS',
    icon: aws,
  },
  {
    name: 'Terraform',
    icon: terraform,
  },
  {
    name: 'Ansible',
    icon: ansible,
  },
  {
    name: 'Kubernetes',
    icon: kubernetes,
  },
  {
    name: 'Argo CD',
    icon: argocd,
  },
  {
    name: 'Docker',
    icon: docker,
  },
  {
    name: 'Linux',
    icon: linux,
  },
  {
    name: 'Nginx',
    icon: nginx,
  },
  {
    name: 'Python',
    icon: python,
  },
  {
    name: 'C++',
    icon: cpp,
  },
  {
    name: 'Git',
    icon: git,
  },
  {
    name: 'React',
    icon: reactjs,
  },
];

// Dates are left empty until they are confirmed; the timeline hides an empty date.
// Title and points: experience.items.<id>
const experiences = [
  {
    id: 'legaliox',
    company_name: 'Legaliox',
    iconBg: 'var(--color-primary)',
    date: '',
  },
  {
    id: 'wepartner',
    company_name: 'WePartner Consulting',
    iconBg: 'var(--color-secondary)',
    date: '',
  },
];

// Name and description: works.items.<id>. `diagram` opens an architecture diagram modal.
const projects = [
  {
    id: 'badass',
    tags: [
      {
        name: 'BGP EVPN',
        color: 'blue-text-gradient',
      },
      {
        name: 'VXLAN',
        color: 'green-text-gradient',
      },
      {
        name: 'FRRouting',
        color: 'pink-text-gradient',
      },
    ],
    source_code_link: '',
  },
  {
    id: 'cloud1',
    tags: [
      {
        name: 'AWS',
        color: 'orange-text-gradient',
      },
      {
        name: 'Terraform',
        color: 'blue-text-gradient',
      },
      {
        name: 'Ansible',
        color: 'pink-text-gradient',
      },
      {
        name: 'WordPress / MariaDB',
        color: 'green-text-gradient',
      },
    ],
    source_code_link: 'https://github.com/yel-hadr/cloud-1_42',
    diagram: 'cloud1',
  },
  {
    id: 'iot',
    tags: [
      {
        name: 'Vagrant',
        color: 'blue-text-gradient',
      },
      {
        name: 'K3s',
        color: 'green-text-gradient',
      },
      {
        name: 'Traefik',
        color: 'pink-text-gradient',
      },
      {
        name: 'K3d',
        color: 'green-text-gradient',
      },
      {
        name: 'Argo CD',
        color: 'orange-text-gradient',
      },
    ],
    source_code_link: 'https://github.com/yel-hadr/-Inception-of-Things',
    diagram: 'iot',
  },
  {
    id: 'portfolio',
    tags: [
      {
        name: 'React',
        color: 'blue-text-gradient',
      },
      {
        name: 'Three.js',
        color: 'pink-text-gradient',
      },
      {
        name: 'Tailwind CSS',
        color: 'green-text-gradient',
      },
    ],
    source_code_link: 'https://github.com/yel-hadr/portfolio',
  },
];

// Degree, date and points: education.items.<id>
const education = [
  { id: 'paris42', school: '42 Paris' },
  { id: 'school1337', school: '1337 Coding School' },
];

// "Today I learned" notes. Title and body: til.items.<id> in src/locales/<lang>/til.json. Code is
// not translated, so comments inside snippets stay in English. Tag color: info, success, danger
// or primary (theme tokens, see Til.jsx).
const tils = [
  {
    id: 'pgbouncer',
    tags: [
      { name: 'PostgreSQL', color: 'info' },
      { name: 'PgBouncer', color: 'success' },
      { name: 'django-tenants', color: 'primary' },
    ],
    code: {
      language: 'ini',
      snippet: `; pgbouncer.ini
[databases]
app = host=postgres port=5432 dbname=app

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
; django-tenants issues a session-level SET search_path:
; it must run on the same server connection as the queries
pool_mode = session
default_pool_size = 20`,
    },
  },
  {
    id: 'argocd',
    tags: [
      { name: 'Argo CD', color: 'primary' },
      { name: 'GitOps', color: 'success' },
      { name: 'Kubernetes', color: 'info' },
    ],
    code: {
      language: 'yaml',
      snippet: `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: api
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/example/deploy.git
    targetRevision: main
    path: apps/api
  destination:
    server: https://kubernetes.default.svc
    namespace: api
  syncPolicy:
    automated:
      prune: true     # delete resources removed from Git
      selfHeal: true  # revert changes made directly in the cluster
    syncOptions:
      - CreateNamespace=true`,
    },
  },
  {
    id: 'vxlan',
    tags: [
      { name: 'VXLAN', color: 'info' },
      { name: 'BGP EVPN', color: 'danger' },
      { name: 'MTU', color: 'success' },
    ],
    code: {
      language: 'shell',
      snippet: `# 1500-byte underlay - 50 bytes of encapsulation:
# outer IPv4 (20) + UDP (8) + VXLAN (8) + inner Ethernet (14)
ip link add vxlan100 type vxlan id 100 dstport 4789 local 10.0.0.1 nolearning
ip link set vxlan100 mtu 1450 up

# Check the path without fragmentation: 1422 + ICMP (8) + IPv4 (20) = 1450
ping -M do -s 1422 10.200.0.2`,
    },
  },
  {
    id: 'terraform',
    tags: [
      { name: 'Terraform', color: 'danger' },
      { name: 'AWS S3', color: 'primary' },
    ],
    code: {
      language: 'hcl',
      snippet: `terraform {
  required_version = ">= 1.11"

  backend "s3" {
    bucket       = "example-terraform-state"
    key          = "prod/network/terraform.tfstate"
    region       = "eu-west-3"
    encrypt      = true
    use_lockfile = true # lock object: prod/network/terraform.tfstate.tflock
  }
}`,
    },
  },
  {
    id: 'jsonlogs',
    tags: [
      { name: 'Loki', color: 'primary' },
      { name: 'LogQL', color: 'info' },
      { name: 'Python', color: 'success' },
    ],
    code: {
      language: 'python',
      snippet: `# One JSON object per line on stdout; Grafana Alloy (or Promtail) ships it to Loki as is
import json
import logging
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def format(self, record):
        entry = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            # Set with logger.info("...", extra={"tenant": schema_name})
            "tenant": getattr(record, "tenant", None),
        }
        if record.exc_info:
            entry["exc"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


# LogQL: {app="api"} | json | level="ERROR" | tenant="acme"`,
    },
  },
  {
    id: 'tmux',
    tags: [
      { name: 'tmux', color: 'success' },
      { name: 'SSH', color: 'info' },
    ],
    code: {
      language: 'shell',
      snippet: `tmux new -s deploy      # start a named session
tmux attach -t deploy   # reattach after the SSH connection drops
tmux ls                 # list sessions

# Default bindings, pressed after the prefix (Ctrl-b):
#   d  detach                %  split left / right
#   "  split top / bottom    z  zoom the current pane
#   [  scroll (copy mode)    s  switch session
#   :setw synchronize-panes on  -> type into every pane at once`,
    },
  },
];

export { services, technologies, experiences, projects, education, tils };
