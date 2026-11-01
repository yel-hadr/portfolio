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

// The Tech section's bento: a large card, two medium ones and three single tools. Each technology
// names its group; titles and descriptions are tech.groups.<id> in the locales
const techGroups = [
  { id: 'cloud', size: 'large' },
  { id: 'platform', size: 'medium' },
  { id: 'code', size: 'medium' },
  { id: 'linux', size: 'small' },
  { id: 'nginx', size: 'small' },
  { id: 'git', size: 'small' },
];

const technologies = [
  {
    name: 'AWS',
    group: 'cloud',
    icon: aws,
  },
  {
    name: 'Terraform',
    group: 'cloud',
    icon: terraform,
  },
  {
    name: 'Ansible',
    group: 'cloud',
    icon: ansible,
  },
  {
    name: 'Kubernetes',
    group: 'platform',
    icon: kubernetes,
  },
  {
    name: 'Argo CD',
    group: 'platform',
    icon: argocd,
  },
  {
    name: 'Docker',
    group: 'platform',
    icon: docker,
  },
  {
    name: 'Linux',
    group: 'linux',
    icon: linux,
  },
  {
    name: 'Nginx',
    group: 'nginx',
    icon: nginx,
  },
  {
    name: 'Python',
    group: 'code',
    icon: python,
  },
  {
    name: 'C++',
    group: 'code',
    icon: cpp,
  },
  {
    name: 'Git',
    group: 'git',
    icon: git,
  },
  {
    name: 'React',
    group: 'code',
    icon: reactjs,
  },
];

// Title, dates and points: experience.items.<id>, newest first
// The timeline's dot: the brand orange for the current job, slate for past ones
const experiences = [
  {
    id: 'legaliox',
    company_name: 'Legaliox',
    iconBg: 'var(--color-primary)',
  },
  {
    id: 'wepartner',
    company_name: 'WePartner Consulting',
    iconBg: 'var(--color-timeline-past)',
  },
  {
    id: 'infinitivebyte',
    company_name: 'Infinitive Byte',
    iconBg: 'var(--color-timeline-past)',
  },
];

// Name and description: works.items.<id>. `diagram` opens an architecture diagram modal.
const projects = [
  {
    id: 'badass',
    tags: [
      {
        name: 'BGP EVPN',
      },
      {
        name: 'VXLAN',
      },
      {
        name: 'FRRouting',
      },
    ],
    source_code_link: 'https://github.com/yel-hadr/Bgp-At-Doors-of-Autonomous-Systems-',
  },
  {
    id: 'cloud1',
    tags: [
      {
        name: 'AWS',
      },
      {
        name: 'Terraform',
      },
      {
        name: 'Ansible',
      },
      {
        name: 'WordPress / MariaDB',
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
      },
      {
        name: 'K3s',
      },
      {
        name: 'Traefik',
      },
      {
        name: 'K3d',
      },
      {
        name: 'Argo CD',
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
      },
      {
        name: 'Three.js',
      },
      {
        name: 'Tailwind CSS',
      },
    ],
    source_code_link: 'https://github.com/yel-hadr/portfolio',
  },
  // 42 graphics projects with a live web demo (`demo`: the dialog Works opens)
  {
    id: 'cub3d',
    tags: [
      { name: 'C' },
      { name: 'MLX42' },
      // A technique rather than a product: its name is translated (works.tags.<id>)
      { id: 'raycasting' },
    ],
    source_code_link: 'https://github.com/yel-hadr/cub3D_42',
    demo: 'cub3d',
  },
  {
    id: 'fdf',
    tags: [{ name: 'C' }, { name: 'MiniLibX' }, { id: 'isometric' }],
    source_code_link: 'https://github.com/yel-hadr/my_fdf_42',
    demo: 'fdf',
  },
];

// School, degree, date and points: education.items.<id> (the school's name differs in French)
const education = [{ id: 'school1337' }];

// Terminal challenge (`game` in the terminal): the commands to type, by difficulty. Plain text
// only, rendered as text nodes; edit freely.
const typingCommands = {
  easy: ['ls', 'cd ~', 'pwd', 'whoami', 'clear'],
  medium: ['sudo systemctl restart nginx', 'docker ps', 'kubectl get pods'],
  hard: [
    'terraform apply -auto-approve',
    'kubectl rollout restart deployment/app',
    'docker-compose up -d --build',
  ],
};

// Its clock: seconds at the start, seconds added per fixed command
const typingChallenge = { seconds: 30, bonus: 5 };

// localStorage keys of the mini-games' best scores
const gameStorage = {
  snake: 'packet_snake_high_score',
  typing: 'typing_high_score',
  // Game Mode's mission: the fastest time (ms) and the best grade (3 S, 2 A, 1 B)
  missionTime: 'game_mode_best_time',
  missionGrade: 'game_mode_best_grade',
};

export {
  services,
  technologies,
  techGroups,
  experiences,
  projects,
  education,
  typingCommands,
  typingChallenge,
  gameStorage,
};
export { posts } from './posts.js';
